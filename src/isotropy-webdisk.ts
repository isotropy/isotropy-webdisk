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

export function init(diskName: string, data: TreeNode) {
  const disk = new Disk(data);
  disks[diskName] = disk;
}

export async function open(diskName: string) {
  return disks[diskName].open();
}

export function __data(diskName: string) {
  return disks[diskName].fsTree;
}
