import Disk from "./disk";

export type FileNode = {
  name: string;
  contents: string;
};

export type DirNode = {
  name: string;
  contents: Array<TreeNode>;
};

export type TreeNode = FileNode | DirNode;

const disks: { [key: string]: Disk } = {};

export class WebDisk {
  disk: Disk;
  originalTree: DirNode[];

  constructor(tree: DirNode[]) {
    this.originalTree = tree;
    this.__reset();
  }

  __reset() {
    this.disk = new Disk(this, { name: "", contents: this.originalTree });
  }

  async open() {
    await this.disk.open();
    return this.disk;
  }
}

export function webdisk(tree: DirNode[]) : WebDisk {
  return new WebDisk(tree);
}