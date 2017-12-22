import exception from "./exception";
import { FileNode, DirNode, TreeNode } from "./isotropy-webdisk";
import { EISDIR } from "constants";

export default class Disk {
  fsTree: DirNode;
  status: string;

  constructor(fsTree: DirNode) {
    this.fsTree = fsTree;
  }

  getNodeName(path: string) {
    return path.split("/").slice(-1)[0];
  }

  getNode(path: string): TreeNode | undefined {
    const parts = path.split("/").slice(1);

    return parts.reduce(
      (acc: TreeNode | undefined, part) =>
        acc && this.isDir(acc)
          ? acc.contents.find(x => x.name === part)
          : undefined,
      this.fsTree
    );
  }

  getDir(path: string): DirNode | never {
    const node = this.getNode(path);
    return node && this.isDir(node)
      ? node
      : exception(`The path ${path} was not found.`);
  }

  isValidFilePath(path: string) {
    return !/\/$/.test(path);
  }

  getParentPath(path: string) {
    return path
      .split("/")
      .slice(0, -1)
      .join("/");
  }

  getFilename(path: string) {
    return this.getNodeName(path);
  }

  isDir(obj: TreeNode | undefined): obj is DirNode {
    return typeof obj !== "undefined" && Array.isArray(obj.contents);
  }

  ensureDir(obj: any): DirNode | never {
    return this.isDir(obj) ? obj : exception(`The node is not a directory.`);
  }

  close() {
    this.status = "CLOSED";
  }

  /*
    Create a file.
  */
  createFile(path: string, contents: string, options = { overwrite: true }) {
    return this.isValidFilePath(path)
      ? (() => {
          const parentPath = this.getParentPath(path);
          const dir = this.getDir(parentPath);
          return dir
            ? (() => {
                const filename = this.getFilename(path);

                return !dir.contents.find(x => x.name === filename) ||
                  options.overwrite
                  ? (() => {
                      dir.contents = dir.contents.filter(
                        x => x.name !== filename
                      );
                      dir.contents = dir.contents.concat({
                        name: filename,
                        contents
                      });
                    })()
                  : exception(`The path ${path} already exists.`);
              })()
            : exception(`The path ${parentPath} does not exist.`);
        })()
      : exception(`Invalid filename ${path}.`);
  }

  /*
    Create a directory. Similar to mkdir.
  */
  createDir(path: string, options = { parents: true }) {
    const self = this;
    const pathToParent = this.getParentPath(path);
    const newDirName = this.getNodeName(path);

    const parent = !options.parents
      ? this.getDir(pathToParent)
      : (() => {
          const partsToParent = pathToParent.split("/").slice(1);
          return partsToParent.reduce(
            (acc: TreeNode, item: string): TreeNode =>
              self.isDir(acc)
                ? acc.contents.find(x => x.name === item)
                  ? this.isDir(acc)
                    ? this.ensureDir(acc.contents.find(x => x.name === item))
                    : exception(`The path ${path} already exists.`)
                  : (() => {
                      const newDir: DirNode = { name: item, contents: [] };
                      acc.contents = acc.contents.filter(x => x.name !== item);
                      acc.contents.concat(newDir);
                      return newDir;
                    })()
                : exception(`The path ${pathToParent} is a file.`),
            this.fsTree
          );
        })();

    const existing = parent.contents.find(x => x.name === newDirName);

    return existing
      ? this.isDir(existing)
        ? undefined
        : exception(`The path ${path} already exists.`)
      : (() => {
          parent.contents = parent.contents.concat({
            name: newDirName,
            contents: []
          });
        })();
  }

  /*
    Move a directory or file. Similar to mv.
  */
  move(path: string, newPath: string, options = { overwrite: false }) {
    const self = this;
    return !newPath.startsWith(path)
      ? (() => {
          const source = this.getNode(path);

          function deleteOriginal() {
            const parentDir = self.getDir(self.getParentPath(path)) as DirNode;
            const nodeName = self.getNodeName(path);
            parentDir.contents = parentDir.contents.filter(
              x => x.name !== nodeName
            );
          }

          return source
            ? (() => {
                const newNodeName = this.getNodeName(newPath);

                const newNode = this.getNode(newPath);
                return newNode && this.isDir(newNode)
                  ? (() => {
                      //If newPath exists and is a directory, copy into that directory
                      newNode.contents = newNode.contents.concat(source);
                      deleteOriginal();
                    })()
                  : newNode
                    ? (() => {
                        // If path and newPath are both files overwrite it.
                        return !this.isDir(source)
                          ? (() => {
                              const parentDir = this.getDir(
                                this.getParentPath(newPath)
                              ) as DirNode;
                              parentDir.contents = parentDir.contents.filter(
                                x => x.name !== newNodeName
                              );
                              parentDir.contents = parentDir.contents.concat({
                                ...source,
                                name: newNodeName
                              });
                              deleteOriginal();
                            })()
                          : exception(`The path ${newPath} already exists.`);
                      })()
                    : (() => {
                        //No such file or directory
                        //Check if parent exists.
                        const parentDir = this.getDir(
                          this.getParentPath(newPath)
                        );
                        return parentDir
                          ? (() => {
                              parentDir.contents = parentDir.contents.concat({
                                ...source,
                                name: newNodeName
                              });
                              deleteOriginal();
                            })()
                          : exception(`The path ${newPath} does not exist.`);
                      })();
              })()
            : exception(`The path ${path} does not exist.`);
        })()
      : exception(`Cannot move to the same path ${path}.`);
  }

  open() {
    this.status = "OPEN";
    return this;
  }

  /*
    Read a file.
  */
  readFile(path: string) {
    return this.isValidFilePath(path)
      ? (() => {
          const node = this.getNode(path);
          return node && !this.isDir(node)
            ? node.contents
            : exception(`The path ${path} does not exist.`);
        })()
      : exception(`Invalid filename ${path}.`);
  }

  /*
    Read a directory
  */
  readDir(path: string) {
    const dir = this.getDir(path);
    return dir
      ? dir.contents.map(x => `${path}/${x.name}`)
      : exception(`The path ${path} does not exist.`);
  }

  /*
    Read a directory recursively.
  */
  readDirRecursive(path: string): string[] {
    const self = this;
    function read(dir: DirNode, path: string): string[] {
      return dir.contents.reduce((acc, x) => {
        const childPath = `${path}/${x.name}`;
        const inner = self.isDir(x)
          ? [childPath].concat(read(x, childPath))
          : [childPath];
        return acc.concat(inner);
      }, []);
    }

    const dir = this.getDir(path);
    return dir
      ? read(dir, path)
      : exception(`The path ${path} does not exist.`);
  }

  /*
    Delete a directory or file. Similar to rm -f.
  */
  remove(path: string) {
    const parentPath = this.getParentPath(path);
    const nodeName = this.getNodeName(path);
    const parent = this.getDir(parentPath) as DirNode;
    parent.contents = parent.contents.filter(x => x.name !== nodeName);
  }
}
