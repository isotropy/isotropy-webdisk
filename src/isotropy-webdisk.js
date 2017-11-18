import Disk from "./disk";

const disks = {};

export function init(diskName, data) {
  const disk = new Disk(data);
  disks[diskName] = disk;
}

export async function open(diskName) {
  return disks[diskName].open();
}

export function __data(diskName) {
  return disks[diskName].fsTree;
}
