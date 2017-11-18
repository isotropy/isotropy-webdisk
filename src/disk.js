import exception from "./exception";

export default class Disk {
  constructor(fsTree) {
    this.fsTree = fsTree;
  }

  getNodeName(path) {
    return path.split("/").slice(-1)[0];
  }

  getNode(path) {
    const parts = path.split("/").slice(1);

    return parts.reduce(
      (acc, part) =>
        acc && this.isDir(acc)
          ? acc.contents.find(x => x.name === part)
          : undefined,
      this.fsTree
    );
  }

  getDir(path) {
    const node = this.getNode(path);
    return node && this.isDir(node) ? node : undefined;
  }

  isValidFilePath(path) {
    return !/\/$/.test(path);
  }

  getParentPath(path) {
    return path
      .split("/")
      .slice(0, -1)
      .join("/");
  }

  getFilename(path) {
    return this.getNodeName(path);
  }

  isDir(obj) {
    return Array.isArray(obj.contents);
  }

  close() {
    this.status = "CLOSED";
  }

  /*
    Create a file.
  */
  createFile(path, contents, options = { overwrite: true }) {
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
      : exception(`Invalid filename ${_path}.`);
  }

  /*
    Create a directory. Similar to mkdir.
  */
  createDir(path, options = { parents: true }) {
    const pathToParent = this.getParentPath(path);
    const newDirName = this.getNodeName(path);

    const parent = !options.parents
      ? this.getDir(pathToParent)
      : (() => {
          const partsToParent = pathToParent.split("/").slice(1);
          return partsToParent.reduce(
            (acc, item) =>
              acc.contents.find(x => x.name === item)
                ? this.isDir(acc)
                  ? acc.contents.find(x => x.name === item)
                  : exception(`The path ${path} already exists.`)
                : (() => {
                    const newDir = { name: item, contents: [] };
                    acc.contents = acc.contents.filter(x => x.name !== item);
                    acc.contents.concat(newDir);
                    return newDir;
                  })(),
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
  move(path, newPath, options = { overwrite: false }) {
    const self = this;
    return !newPath.startsWith(path)
      ? (() => {
          const source = this.getNode(path);

          function deleteOriginal() {
            const parentDir = self.getDir(self.getParentPath(path));
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
                              );
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
                        const parentDir = this.getDir(this.getParentPath(newPath));
                        return parentDir
                          ? (() => {
                              parentDir.contents = parentDir.contents.concat({
                                ...source,
                                name: newNodeName
                              });
                              deleteOriginal();
                            })()
                          : exception(`The path ${_newPath} does not exist.`);
                      })();
              })()
            : exception(`The path ${nodeName} does not exist.`);
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
  readFile(path) {
    return this.isValidFilePath(path)
      ? (() => {
          const node = this.getNode(path);
          return node && !this.isDir(node)
            ? node.contents
            : exception(`The path ${path} does not exist.`);
        })()
      : exception(`Invalid filename ${_path}.`);
  }

  /*
    Read a directory
  */
  readDir(path) {
    const dir = this.getDir(path);
    return dir
      ? dir.contents.map(x => `${path}/${x.name}`)
      : exception(`The path ${path} does not exist.`);
  }

  /*
    Read a directory recursively.
  */
  readDirRecursive(path) {
    const self = this;
    function read(dir, path) {
      return dir.contents.reduce((acc, x) => {
        const childPath = `${path}/${x.name}`;
        const inner = self.isDir(x)
          ? [childPath].concat(read(x, childPath))
          : [childPath];
        return acc.concat(inner);
      }, []);
    }

    const dir = this.getDir(path);
    return read(dir, path);
  }

  /*
    Delete a directory or file. Similar to rm -f.
  */
  remove(path) {
    const parentPath = this.getParentPath(path);
    const nodeName = this.getNodeName(path);
    const parent = this.getDir(parentPath);
    parent.contents = parent.contents.filter(x => x.name !== nodeName);
  }
}
