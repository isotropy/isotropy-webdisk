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

function isFile(obj: TreeNode): obj is FileNode {
  return !isDir(obj);
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

  async copyFile(
    sourcePath: string,
    destPath: string,
    options = { force: false }
  ) {
    return this._moveFile(sourcePath, destPath, {
      ...options,
      deleteOriginal: false
    });
  }

  async copyDir(
    sourcePath: string,
    destPath: string,
    options = { force: false }
  ) {
    return this._moveDir(sourcePath, destPath, {
      ...options,
      deleteOriginal: false
    });
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
      ? isFile(existingItem)
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

  async moveFile(
    sourcePath: string,
    destPath: string,
    options = { force: false }
  ) {
    return this._moveFile(sourcePath, destPath, {
      ...options,
      deleteOriginal: true
    });
  }

  private _moveFile(
    sourcePath: string,
    destPath: string,
    options: { force: boolean; deleteOriginal: boolean }
  ) {
    const self = this;
    const source = this.getNode(sourcePath);
    return source
      ? isFile(source)
        ? (() => {
            const dest = self.getNode(destPath);
            return dest
              ? isDir(dest)
                ? this.moveAndDeleteOriginal(
                    source,
                    sourcePath,
                    source.name,
                    destPath,
                    options.deleteOriginal
                  )
                : options.force
                  ? (() => {
                      self._remove(destPath);
                      self.moveToDestParent(source, sourcePath, destPath, options.deleteOriginal);
                    })()
                  : exception(`The path ${destPath} already exists.`)
              : self.moveToDestParent(source, sourcePath, destPath, options.deleteOriginal);
          })()
        : exception(`The path ${sourcePath} is a directory.`)
      : exception(`The path ${sourcePath} does not exist.`);
  }

  async moveDir(
    sourcePath: string,
    destPath: string,
    options = { force: false }
  ) {
    return this._moveDir(sourcePath, destPath, {
      ...options,
      deleteOriginal: true
    });
  }

  private _moveDir(
    sourcePath: string,
    destPath: string,
    options: { force: boolean; deleteOriginal: boolean }
  ) {
    const self = this;
    const source = this.getNode(sourcePath);
    return source
      ? !isChild(sourcePath, destPath)
        ? isDir(source)
          ? (() => {
              const dest = self.getNode(destPath);
              return dest
                ? isDir(dest)
                  ? this.moveAndDeleteOriginal(
                      source,
                      sourcePath,
                      source.name,
                      destPath,
                      options.deleteOriginal
                    )
                  : options.force
                    ? (() => {
                        self._remove(destPath);
                        self.moveToDestParent(
                          source,
                          sourcePath,
                          destPath,
                          options.deleteOriginal
                        );
                      })()
                    : exception(`The path ${destPath} already exists.`)
                : self.moveToDestParent(
                    source,
                    sourcePath,
                    destPath,
                    options.deleteOriginal
                  );
            })()
          : exception(`The path ${sourcePath} is a file.`)
        : exception(`Cannot copy path ${sourcePath} into itself.`)
      : exception(`The path ${sourcePath} does not exist.`);
  }

  private moveAndDeleteOriginal(
    source: TreeNode,
    sourcePath: string,
    newName: string,
    destDirPath: string,
    deleteOriginal: boolean
  ) {
    const treeNode: TreeNode = {
      ...source,
      name: newName
    };
    this.fsTree = cloneDirWithModification(this.fsTree, destDirPath, dir => ({
      name: dir.name,
      contents: dir.contents.concat(treeNode)
    }));

    //Delete source
    if (deleteOriginal) this._remove(sourcePath);
  }

  private moveToDestParent(
    source: TreeNode,
    sourcePath: string,
    destPath: string,
    deleteOriginal: boolean
  ) {
    const destParentPath = getParentPath(destPath);
    const destParent = this.getNode(destParentPath);
    return destParent
      ? this.moveAndDeleteOriginal(
          source,
          sourcePath,
          getNodeName(destPath),
          getParentPath(destPath),
          deleteOriginal
        )
      : exception(`The path ${destParentPath} does not exist.`);
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
            ? isFile(node)
              ? node.contents
              : exception(`The path ${path} is a directory.`)
            : exception(`The path ${path} does not exist.`);
        })()
      : exception(`Invalid filename ${path}.`);
  }

  /*
    Read a directory
  */
  async readDir(path: string) {
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
  async readDirRecursive(path: string) {
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

  async removeFile(path: string, options = { force: true }) {
    return this._removeFile(path, options);
  }

  private _removeFile(path: string, options = { force: true }) {
    const node = this.getNode(path);
    return node
      ? isFile(node)
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
        : exception(`The path ${path} is a directory.`)
      : options.force
        ? undefined
        : exception(`The path ${path} does not exist.`);
  }

  async removeDir(path: string, options = { force: true }) {
    return this._removeDir(path, options);
  }

  private _removeDir(path: string, options = { force: true }) {
    const node = this.getNode(path);
    return node
      ? isDir(node)
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
        : exception(`The path ${path} is a file.`)
      : options.force
        ? undefined
        : exception(`The path ${path} does not exist.`);
  }

  private _remove(path: string) {
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
      : exception(`The path ${path} does not exist.`);
  }
}
