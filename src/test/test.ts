require("should");
import webdisk from "./webdisk";
import { DirNode, TreeNode } from "../isotropy-webdisk";
import exception from "../exception";

function find(tree: DirNode, path: string): TreeNode {
  const parts = path
    .replace(/\/$/, "")
    .split("/")
    .slice(1);

  const result = parts.reduce(
    (acc: TreeNode | undefined, part) =>
      acc && isDir(acc) ? acc.contents.find(x => x.name === part) : undefined,
    tree
  );

  return result || exception(`The path ${path} does not exist.`);
}

function ensureDir(node: TreeNode | undefined): DirNode {
  return isDir(node) ? node : exception(`Not a directory.`);
}

function isDir(node: TreeNode | undefined): node is DirNode {
  return typeof node !== "undefined" && Array.isArray(node.contents);
}

function findDir(tree: DirNode, path: string): DirNode {
  const node = find(tree, path);
  return node && Array.isArray(node.contents)
    ? (node as DirNode)
    : exception(`Not a directory.`);
}

describe("Isotropy FS", () => {
  beforeEach(() => {
    webdisk.__reset();
  });

  /* createFile */

  it(`Creates a file`, async () => {
    const disk = await webdisk.open();
    await disk.createFile(
      "/docs/planet-report.txt",
      "We're recommending that pluto be a planet."
    );
    const file = find(disk.__data(), "/docs/planet-report.txt");
    file.name.should.equal("planet-report.txt");
    file.contents.should.equal("We're recommending that pluto be a planet.");
  });

  it(`Creates or overwrites a file`, async () => {
    const path = "/docs/report.txt";
    const filename = "report.txt";
    const disk = await webdisk.open();
    await disk.createFile(path, "Pluto is a planet.", { force: true });
    const file = find(disk.__data(), path);
    file.name.should.equal(filename);
    file.contents.should.equal("Pluto is a planet.");
  });

  it(`Fails to overwrite existing file`, async () => {
    const path = "/docs/report.txt";
    const filename = "report.txt";
    let ex;
    try {
      const disk = await webdisk.open();
      await disk.createFile(path, "Pluto is a planet.", { force: false });
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("The path /docs/report.txt already exists.");
  });

  /* readFile */
  it(`Reads a file`, async () => {
    const path = "/docs/report.txt";
    const filename = "report.txt";
    const disk = await webdisk.open();
    const contents = await disk.readFile(path);
    contents.should.equal("Pluto downgraded to a rock.");
  });

  /* readFile */
  it(`Fails to read a missing file`, async () => {
    const path = "/docs/missing-report.txt";
    let ex;
    try {
      const disk = await webdisk.open();
      const contents = await disk.readFile(path);
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal(
      "The path /docs/missing-report.txt does not exist."
    );
  });

  /* readDir */
  it(`Reads a directory`, async () => {
    const path = "/pics";
    const disk = await webdisk.open();
    const files = await disk.readDir(path);
    files.should.deepEqual([
      "/pics/asterix.jpg",
      "/pics/obelix.jpg",
      "/pics/large-pics"
    ]);
  });

  it(`Fails to read missing directory`, async () => {
    const path = "/pics/missing";
    let ex;
    try {
      const disk = await webdisk.open();
      const files = await disk.readDir(path);
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("The path /pics/missing does not exist.");
  });

  /* readDirRecursive */
  it(`Reads a directory recursively`, async () => {
    const path = "/pics";
    const disk = await webdisk.open();
    const files = await disk.readDirRecursive(path);
    files.should.deepEqual([
      "/pics/asterix.jpg",
      "/pics/obelix.jpg",
      "/pics/large-pics",
      "/pics/large-pics/asterix-large.jpg",
      "/pics/large-pics/obelix-large.jpg",
      "/pics/large-pics/backup",
      "/pics/large-pics/backup/asterix-large-bak.jpg",
      "/pics/large-pics/backup/obelix-large-bak.jpg"
    ]);
  });

  /* createDir */
  it(`Creates a directory`, async () => {
    const path = "/pics/secret";
    const disk = await webdisk.open();
    await disk.createDir(path);
    const dir = findDir(disk.__data(), "/pics/secret");
    dir.name.should.equal("secret");
    dir.contents.should.be.an.instanceOf(Array);
  });

  /* createDir */
  it(`Fails to create a directory if it exists.`, async () => {
    const path = "/docs";
    const disk = await webdisk.open();
    let ex;
    try {
      const disk = await webdisk.open();
      await disk.createDir(path);
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("The path /docs already exists.");
  });

  /* createDir */
  it(`Doesn't fail if the directory exists during createDir() with the ignoreIfExists option.`, async () => {
    const path = "/docs";
    const disk = await webdisk.open();
    await disk.createDir(path, { ignoreIfExists: true });
    const dir = find(disk.__data(), "/docs");
    should.exist(dir);
  });

  /* createDir */
  it(`Fails if a file exists at the same path even with the ignoreIfExists option.`, async () => {
    const path = "/docs/links";
    const disk = await webdisk.open();
    let ex;
    try {
      const disk = await webdisk.open();
      await disk.createDir(path, { ignoreIfExists: true });
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("The path /docs/links is already a file.");
  });

  /* createDir */
  it(`Creates parent directories with the parents option.`, async () => {
    const path = "/docs/a/b/c";
    const disk = await webdisk.open();
    await disk.createDir(path, { parents: true });
    const dir = find(disk.__data(), "/docs/a/b/c");
    should.exist(dir);
  });

  /* Removes */
  it(`Removes a file or directory`, async () => {
    const path = "/pics";
    const disk = await webdisk.open();
    await disk.removeDir(path);
    const dir = findDir(disk.__data(), "/");
    dir.contents.length.should.equal(1);
  });

  it(`Moves a file`, async () => {
    const path = "/pics/asterix.jpg";
    const newPath = "/docs";
    const disk = await webdisk.open();
    await disk.moveFile(path, newPath);
    const pics = findDir(disk.__data(), "/pics");
    const docs = findDir(disk.__data(), "/docs");
    should.not.exist(pics.contents.find(x => x.name === "asterix.jpg"));
    should.exist(docs.contents.find(x => x.name === "asterix.jpg"));
  });

  /* move */
  it(`Moves a file to parent`, async () => {
    const path = "/pics/large-pics/asterix-large.jpg";
    const newPath = "/pics";
    const disk = await webdisk.open();
    await disk.moveFile(path, newPath);
    const pics = findDir(disk.__data(), "/pics");
    const largePics = findDir(disk.__data(), "/pics/large-pics");
    should.not.exist(largePics.contents.find(x => x.name === "asterix-large.jpg"));
    should.exist(pics.contents.find(x => x.name === "asterix-large.jpg"));
  });

  it(`Renames a file`, async () => {
    const path = "/pics/asterix.jpg";
    const newPath = "/pics/asterix-original.jpg";
    const disk = await webdisk.open();
    await disk.moveFile(path, newPath);
    const pics = findDir(disk.__data(), "/pics");
    should.not.exist(pics.contents.find(x => x.name === "asterix.jpg"));
    should.exist(pics.contents.find(x => x.name === "asterix-original.jpg"));
  });

  it(`Moves a directory`, async () => {
    const path = "/pics/large-pics/backup";
    const newPath = "/docs";
    const disk = await webdisk.open();
    await disk.moveDir(path, newPath);
    const largePicsDir = findDir(disk.__data(), "/pics/large-pics");
    const docs = findDir(disk.__data(), "/docs");
    should.not.exist(largePicsDir.contents.find(x => x.name === "backup"));
    should.exist(docs.contents.find(x => x.name === "backup"));
  });

  it(`Moves a directory to separate branch and renames`, async () => {
    const path = "/pics/large-pics/backup";
    const newPath = "/docs/storage";
    const disk = await webdisk.open();
    await disk.moveDir(path, newPath);
    const largePicsDir = findDir(disk.__data(), "/pics/large-pics");
    const docs = findDir(disk.__data(), "/docs");
    should.not.exist(largePicsDir.contents.find(x => x.name === "backup"));
    should.exist(docs.contents.find(x => x.name === "storage"));
  });

  /* move */
  it(`Moves a directory to parent`, async () => {
    const path = "/pics/large-pics/backup";
    const newPath = "/";
    const disk = await webdisk.open();
    await disk.moveDir(path, newPath);
    const loopDir = find(disk.__data(), "/");
    loopDir.contents.length.should.equal(3);
    const largePicsDir = findDir(disk.__data(), "/pics/large-pics");
    largePicsDir.contents.length.should.equal(2);
  });

  it(`Renames a directory`, async () => {
    const path = "/pics/large-pics/backup";
    const newPath = "/pics/large-pics/storage";
    const disk = await webdisk.open();
    await disk.moveDir(path, newPath);
    const largePicsDir = findDir(disk.__data(), "/pics/large-pics");
    should.not.exist(largePicsDir.contents.find(x => x.name === "backup"));
    should.exist(largePicsDir.contents.find(x => x.name === "storage"));
  });

  it(`Fails to move a directory into an existing file path`, async () => {
    const path = "/pics/large-pics/backup";
    const newPath = "/pics/asterix.jpg";
    let ex;
    try {
      const disk = await webdisk.open();
      await disk.moveDir(path, newPath);
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("The path /pics/asterix.jpg already exists.");
  });

  it(`Fails to move a directory into a sub-directory`, async () => {
    const path = "/pics";
    const newPath = "/pics/large-pics";
    let ex;
    try {
      const disk = await webdisk.open();
      await disk.moveDir(path, newPath);
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("Cannot copy path /pics into itself.");
  });

    /* copy */
    it(`Copies a file`, async () => {
      const path = "/pics/asterix.jpg";
      const newPath = "/docs/asterix.jpg";
      const disk = await webdisk.open();
      await disk.copyFile(path, newPath);
      const pics = findDir(disk.__data(), "/pics");
      const docs = findDir(disk.__data(), "/docs");
      pics.contents.length.should.equal(3);
      docs.contents.length.should.equal(3);
    });

    /* copy */
    it(`Copies a directory`, async () => {
      const path = "/pics/large-pics";
      const newPath = "/docs/";
      const disk = await webdisk.open();
      await disk.copyDir(path, newPath);
      const pics = findDir(disk.__data(), "/pics");
      const docs = findDir(disk.__data(), "/docs");
      pics.contents.length.should.equal(3);
      docs.contents.length.should.equal(3);
    });
});
