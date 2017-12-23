import exception from "./exception";
import WebDisk, { FileNode, DirNode, TreeNode } from "./isotropy-webdisk";

function cloneDirWithModification(
  tree: DirNode,
  path: string,
  fnModify: (n: DirNode) => DirNode
): DirNode {
  return doCloneDirWithModification(tree, path.split("/").slice(1), fnModify);
}

function doCloneDirWithModification(
  tree: DirNode,
  path: string[],
  fnModify: (dir: DirNode) => DirNode
): DirNode {
  return path.length === 0
    ? fnModify(tree)
    : {
        name: tree.name,
        contents: tree.contents.map(
          item =>
            item.name !== path[0]
              ? item
              : isDir(item)
                ? doCloneDirWithModification(item, path.slice(1), fnModify)
                : exception(
                    `The path ${"/" + path.join("/")} is not a directory.`
                  )
        )
      };
}

function isDir(obj: TreeNode | undefined): obj is DirNode {
  return typeof obj !== "undefined" && Array.isArray(obj.contents);
}

function ensureDir(obj: any): DirNode | never {
  return isDir(obj) ? obj : exception(`The node is not a directory.`);
}

function getNodeName(path: string) {
  return path.split("/").slice(path.endsWith("/") ? -2 : -1)[0];
}

function isValidFilePath(path: string) {
  return !/\/$/.test(path);
}

function getParentPath(path: string) {
  return path
    .split("/")
    .slice(0, path.endsWith("/") ? -2 : -1)
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
    const mustBeDir = path.endsWith("/");
    const parts = path.split("/").slice(1);

    const result = parts.reduce(
      (acc: TreeNode | undefined, part) =>
        acc && isDir(acc) ? acc.contents.find(x => x.name === part) : undefined,
      this.fsTree
    );

    return mustBeDir
      ? isDir(result)
        ? result
        : exception(`The path ${path} exists but is not a directory.`)
      : result;
  }

  private getDir(path: string): DirNode | never {
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
    Create a file.
  */
  async createFile(
    path: string,
    contents: string,
    options = { overwrite: true }
  ) {
    return this._createFile(path, contents, options);
  }

  private _createFile(
    path: string,
    contents: string,
    options = { overwrite: true }
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
                      options.overwrite
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
    return this._createDir(path, {
      ignoreIfExists: options.ignoreIfExists || false,
      parents: options.parents || false
    });
  }

  private _createDir(
    path: string,
    options: { ignoreIfExists: boolean; parents: boolean }
  ) {
    const self = this;
    const pathToParent = getParentPath(path);
    const partsToParent = pathToParent.split("/").slice(1);
    const newDirName = getNodeName(path);

    const parent = !options.parents
      ? this.getDir(pathToParent)
      : (() => {
          partsToParent.reduce(
            (acc, part) => (
              self.createDir(
                "/" + acc.concat(part).join("/"),
                (options = { ignoreIfExists: true, parents: false })
              ),
              acc.concat(part)
            ),
            [] as string[]
          );
          return this.getDir(pathToParent);
        })();

    const existing = parent.contents.find(x => x.name === newDirName);

    return existing
      ? isDir(existing)
        ? options.ignoreIfExists
          ? undefined
          : exception(`The path ${path} already exists.`)
        : exception(`The path ${path} is already a file.`)
      : (() => {
          this.fsTree = cloneDirWithModification(
            this.fsTree,
            pathToParent,
            dir => ({
              name: parent.name,
              contents: parent.contents.concat({
                name: newDirName,
                contents: []
              })
            })
          );
        })();
  }

  /*
    Move a directory or file. Similar to mv.
  */
  async move(path: string, newPath: string, options = { overwrite: false }) {
    return this._move(path, newPath, options);
  }

  private _move(
    path: string,
    newPath: string,
    options: { overwrite: boolean }
  ) {
    const self = this;

    return !newPath.startsWith(path)
      ? (() => {
          const source = this.getNode(path);

          return source
            ? (() => {
                const newNode = this.getNode(newPath);
                return newNode && isDir(newNode) //new node is a directory
                  ? newNode.contents.some(x => x.name === getNodeName(path))
                    ? exception(
                        `The path ${newPath}${getNodeName(
                          path
                        )} already exists.`
                      )
                    : (() => {
                        self.fsTree = cloneDirWithModification(
                          self.fsTree,
                          getParentPath(newPath),
                          dir => ({
                            name: dir.name,
                            contents: dir.contents.concat()
                          })
                        );
                        self._remove(path, { force: false });
                      })()
                  : newNode //new node is a file that exists
                    ? exception(`The path ${newPath} already exists.`)
                    : (() => {
                        //Let's see if parentNode exists.
                        const parentPath = getParentPath(newPath);
                        const parentDir = this.getDir(parentPath);
                        return parentDir
                          ? (() => {
                              self.fsTree = cloneDirWithModification(
                                self.fsTree,
                                parentPath,
                                dir => ({
                                  name: dir.name,
                                  contents: dir.contents.concat(source)
                                })
                              );
                            })()
                          : exception(`The path ${parentPath} does not exist.`);
                      })();
              })()
            : exception(`The path ${path} does not exist.`);
        })()
      : exception(`Cannot move to the same path ${path}.`);
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
