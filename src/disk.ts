import exception from "./exception";
import WebDisk, { FileNode, DirNode, TreeNode } from "./isotropy-webdisk";

function toParts(path: string) {
  const parts = path.split("/");
  return parts.slice(0, path.endsWith("/") ? parts.length - 1 : parts.length);
}

function cloneDirWithModification(
  tree: DirNode,
  path: string,
  fnModify: (n: DirNode) => DirNode
): DirNode {
  return doCloneDirWithModification(tree, toParts(path), fnModify);
}

function isChild(maybeParent: string, node: string) {
  return node.startsWith(
    /\/$/.test(maybeParent) ? maybeParent : maybeParent + "/"
  );
}

function doCloneDirWithModification(
  tree: DirNode,
  path: string[],
  fnModify: (dir: DirNode) => DirNode
): DirNode {
  return path.length === 1
    ? fnModify(tree)
    : {
        name: tree.name,
        contents: tree.contents.map(
          item =>
            item.name !== path[1]
              ? item
              : isDir(item)
                ? doCloneDirWithModification(item, path.slice(1), fnModify)
                : exception(
                    `The path ${"/" + path.join("/")} is not a directory.`
                  )
        )
      };
}

function isDir(obj: TreeNode): obj is DirNode {
  return Array.isArray(obj.contents);
}

function getNodeName(path: string) {
  return toParts(path).slice(-1)[0];
}

function isValidFilePath(path: string) {
  return !/\/$/.test(path);
}

function getParentPath(path: string) {
  return toParts(path)
    .slice(0, -1)
    .join("/");
}

function getFilename(path: string) {
  return /\/$/.test(path)
    ? exception(`The path ${path} is not a file.`)
    : getNodeName(path);
}

export default class Disk {
  state: string;
  webdisk: WebDisk;
  fsTree: DirNode;

  constructor(webdisk: WebDisk, fsTree: DirNode) {
    this.state = "CLOSED";
    this.webdisk = webdisk;
    this.fsTree = fsTree;
  }

  __data() {
    return this.fsTree;
  }

  private getNode(path: string): TreeNode | undefined {
    return path === "/"
      ? this.fsTree
      : (() => {
          const mustBeDir = path.endsWith("/");
          const parts = toParts(path);

          function loop(
            tree: TreeNode | undefined,
            parts: string[]
          ): TreeNode | undefined {
            return tree
              ? parts.length > 0
                ? isDir(tree)
                  ? loop(
                      tree.contents.find(x => x.name === parts[0]),
                      parts.slice(1)
                    )
                  : exception(`The path ${path} is invalid.`)
                : !mustBeDir || isDir(tree)
                  ? tree
                  : exception(`The path ${path} exists but is not a directory.`)
              : undefined;
          }

          return loop(this.fsTree, parts.slice(1));
        })();
  }

  private getDir(path: string): DirNode {
    const node = this.getNode(path);
    return node
      ? isDir(node) ? node : exception(`The path ${path} is not a directory.`)
      : exception(`The path ${path} does not exist.`);
  }

  async close() {
    this.state = "CLOSED";
  }

  async open() {
    this.state = "OPEN";
  }

  /*
    Copy a file
  */
  private _copyFile(
    sourcePath: string,
    destPath: string,
    options: { force: false }
  ) {
    const self = this;

    function copyToDir(
      source: FileNode,
      sourcePath: string,
      newName: string,
      destDirPath: string
    ) {
      const file: FileNode = {
        ...source,
        name: newName
      };

      self.fsTree = cloneDirWithModification(self.fsTree, destDirPath, dir => ({
        name: dir.name,
        contents: dir.contents.concat(file)
      }));

      self._remove(sourcePath, { force: false });
    }

    const source = this.getNode(sourcePath);
    return source
      ? !isDir(source)
        ? () => {
            const dest = this.getNode(destPath);
            return dest
              ? //If dest is a directory we copy into it
                isDir(dest)
                ? copyToDir(source, sourcePath, source.name, destPath)
                : //If dest is not a directory, copy if force option is set
                  options.force
                  ? copyToDir(
                      source,
                      sourcePath,
                      getNodeName(destPath),
                      getParentPath(destPath)
                    )
                  : exception(`The path ${destPath} already exists.`)
              : //dest does not exist
                () => {
                  const parentPath = getParentPath(destPath);
                  const parent = this.getNode(parentPath);

                  //See if parent exists
                  return parent
                    ? copyToDir(
                        source,
                        sourcePath,
                        getNodeName(destPath),
                        parentPath
                      )
                    : exception(`The path ${parentPath} does not exist.`);
                };
          }
        : exception(
            `The path ${sourcePath} is a directory. Use copyDir() instead.`
          )
      : exception(`The path ${sourcePath} does not exist.`);
  }

  /*
    Create a file.
  */
  async createFile(path: string, contents: string, options = { force: true }) {
    return this._createFile(path, contents, options);
  }

  private _createFile(
    path: string,
    contents: string,
    options = { force: true }
  ) {
    const self = this;
    return isValidFilePath(path)
      ? (() => {
          const parentPath = getParentPath(path);
          const parentNode = self.getDir(parentPath);
          return parentNode
            ? (() => {
                self.fsTree = cloneDirWithModification(
                  self.fsTree,
                  parentPath,
                  dir => {
                    const filename = getFilename(path);
                    return !dir.contents.find(x => x.name === filename) ||
                      options.force
                      ? {
                          name: dir.name,
                          contents: dir.contents
                            .filter(x => x.name !== filename)
                            .concat({ name: filename, contents })
                        }
                      : exception(`The path ${path} already exists.`);
                  }
                );
              })()
            : exception(`The path ${parentPath} does not exist.`);
        })()
      : exception(`Invalid path ${path}.`);
  }

  /*
    Create a directory. Similar to mkdir.
  */
  async createDir(
    path: string,
    options: { ignoreIfExists?: boolean; parents?: boolean } = {
      ignoreIfExists: false,
      parents: true
    }
  ) {
    this._createDir(path, {
      ignoreIfExists: options.ignoreIfExists || false,
      parents: options.parents || false
    });
  }

  private _createDir(
    path: string,
    options: { ignoreIfExists: boolean; parents: boolean }
  ): DirNode {
    const self = this;
    const pathToParent = getParentPath(path);
    const partsToParent = toParts(pathToParent);
    const newDirName = getNodeName(path);

    const parentOrEmpty = this.getNode(pathToParent);

    //If parent does not exist, we have to create it.
    const parent =
      parentOrEmpty && isDir(parentOrEmpty)
        ? parentOrEmpty
        : options.parents
          ? this._createDir(pathToParent, {
              ignoreIfExists: false,
              parents: true
            })
          : exception(`Invalid path ${path}.`);

    //See if the target path already exists.
    const existingItem = parent.contents.find(x => x.name === newDirName);
    return existingItem
      ? !isDir(existingItem)
        ? exception(`The path ${path} is already a file.`)
        : !options.ignoreIfExists
          ? exception(`The path ${path} already exists.`)
          : existingItem
      : //Does not exist. Add a new directory.
        (() => {
          self.fsTree = cloneDirWithModification(
            self.fsTree,
            pathToParent,
            dir => ({
              name: dir.name,
              contents: dir.contents.concat({
                name: newDirName,
                contents: []
              })
            })
          );
          return this.getNode(path) as DirNode;
        })();
  }

  /*
    Move a directory or file. Similar to mv.
  */
  async move(path: string, newPath: string, options = { force: false }) {
    return this._move(path, newPath, options);
  }

  private _move(
    sourcePath: string,
    destPath: string,
    options: { force: boolean }
  ) {
    const self = this;

    function moveAndDeleteOriginal(
      source: TreeNode,
      sourcePath: string,
      newName: string,
      destDirPath: string
    ) {
      const treeNode: TreeNode = {
        ...source,
        name: newName
      };
      self.fsTree = cloneDirWithModification(self.fsTree, destDirPath, dir => ({
        name: dir.name,
        contents: dir.contents.concat(treeNode)
      }));
      //Delete source
      self._remove(sourcePath, { force: false });
    }

    function moveToDestParent(
      source: TreeNode,
      sourcePath: string,
      destPath: string
    ) {
      const destParentPath = getParentPath(destPath);
      const destParent = self.getNode(destParentPath);
      return destParent
        ? moveAndDeleteOriginal(
            source,
            sourcePath,
            getNodeName(destPath),
            getParentPath(destPath)
          )
        : exception(`Thep path ${destParentPath} does not exist.`);
    }

    return !isChild(sourcePath, destPath)
      ? (() => {
          const self = this;

          const source = this.getNode(sourcePath);
          return source
            ? (() => {
                const dest = self.getNode(destPath);
                return dest
                  ? isDir(dest)
                    ? moveAndDeleteOriginal(
                        source,
                        sourcePath,
                        source.name,
                        destPath
                      )
                    : options.force
                      ? (() => {
                          self._remove(destPath, { force: false });
                          moveToDestParent(source, sourcePath, destPath);
                        })()
                      : exception(`The path ${destPath} already exists.`)
                  : moveToDestParent(source, sourcePath, destPath);
              })()
            : exception(`The path ${sourcePath} does not exist.`);
        })()
      : exception(`Cannot copy path ${sourcePath} into itself.`);
  }

  /*
    Read a file.
  */
  async readFile(path: string) {
    return this._readFile(path);
  }

  private _readFile(path: string) {
    return isValidFilePath(path)
      ? (() => {
          const node = this.getNode(path);
          return node
            ? !isDir(node)
              ? node.contents
              : exception(`The path ${path} is a directory.`)
            : exception(`The path ${path} does not exist.`);
        })()
      : exception(`Invalid filename ${path}.`);
  }

  /*
    Read a directory
  */
  readDir(path: string) {
    return this._readDir(path);
  }
  private _readDir(path: string) {
    const dir = this.getDir(path);
    return dir
      ? dir.contents.map(x => `${path}/${x.name}`)
      : exception(`The path ${path} does not exist.`);
  }

  /*
    Read a directory recursively.
  */
  readDirRecursive(path: string): string[] {
    return this._readDirRecursive(path);
  }

  private _readDirRecursive(path: string): string[] {
    const self = this;

    function read(dir: DirNode, path: string): string[] {
      return dir.contents.reduce(
        (acc, x) => {
          const childPath = `${path}/${x.name}`;
          const inner = isDir(x)
            ? [childPath].concat(read(x, childPath))
            : [childPath];
          return acc.concat(inner);
        },
        [] as string[]
      );
    }

    const dir = this.getDir(path);
    return dir
      ? read(dir, path)
      : exception(`The path ${path} does not exist.`);
  }

  /*
    Delete a directory or file. Similar to rm -f.
  */
  async remove(path: string, options = { force: true }) {
    return this._remove(path, options);
  }

  private _remove(path: string, options: { force: boolean }): void {
    const node = this.getNode(path);
    return node
      ? (() => {
          this.fsTree = cloneDirWithModification(
            this.fsTree,
            getParentPath(path),
            dir => ({
              name: dir.name,
              contents: dir.contents.filter(c => c.name !== getNodeName(path))
            })
          );
        })()
      : options.force
        ? undefined
        : exception(`The path ${path} does not exist.`);
  }
}
