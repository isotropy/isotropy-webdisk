require("should");
import * as webdisk from "../isotropy-webdisk";
import { DirNode, TreeNode } from "../isotropy-webdisk";
import exception from "../exception";

function find(tree: DirNode, path: string): TreeNode {
  const parts = path.split("/").slice(1);

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
    const tree = {
      name: "/",
      contents: [
        {
          name: "docs",
          contents: []
        },
        {
          name: "pics",
          contents: [
            { name: "asterix.jpg", contents: "FFh D8h asterix" },
            { name: "obelix.jpg", contents: "FFh D8h obelix" },
            {
              name: "large-pics",
              contents: [
                {
                  name: "asterix-large.jpg",
                  contents: "FFh D8h asterix"
                },
                {
                  name: "obelix-large.jpg",
                  contents: "FFh D8h obelix"
                },
                {
                  name: "backup",
                  contents: [
                    {
                      name: "asterix-large-bak.jpg",
                      contents: "FFh D8h asterix"
                    },
                    {
                      name: "obelix-large-bak.jpg",
                      contents: "FFh D8h obelix"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    };

    webdisk.init("testdisk", tree);
  });

  /* createFile */

  it(`Creates a file`, async () => {
    const disk = await webdisk.open("testdisk");
    await disk.createFile("/docs/report.txt", "Pluto is a planet.");
    const file = find(webdisk.__data("testdisk"), "/docs/report.txt");
    file.name.should.equal("report.txt");
    file.contents.should.equal("Pluto is a planet.");
  });

  it(`Creates or overwrites a file`, async () => {
    const path = "/docs/report.txt";
    const filename = "report.txt";
    const dir = findDir(webdisk.__data("testdisk"), "/docs");
    dir.contents = dir.contents.concat({
      name: "report.txt",
      contents: "Pluto downgraded to a rock."
    });
    const disk = await webdisk.open("testdisk");
    await disk.createFile(path, "Pluto is a planet.", { overwrite: true });
    const file = find(webdisk.__data("testdisk"), path);
    file.name.should.equal(filename);
    file.contents.should.equal("Pluto is a planet.");
  });

  it(`Fails to overwrite existing file`, async () => {
    const path = "/docs/report.txt";
    const filename = "report.txt";
    const dir = findDir(webdisk.__data("testdisk"), "/docs");
    dir.contents = dir.contents.concat({
      name: "report.txt",
      contents: "Pluto downgraded to a rock."
    });
    let ex;
    try {
      const disk = await webdisk.open("testdisk");
      await disk.createFile(path, "Pluto is a planet.", { overwrite: false });
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("The path /docs/report.txt already exists.");
  });

  /* readFile */
  it(`Reads a file`, async () => {
    const path = "/docs/report.txt";
    const filename = "report.txt";
    const dir = findDir(webdisk.__data("testdisk"), "/docs");
    dir.contents = dir.contents.concat({
      name: "report.txt",
      contents: "Pluto downgraded to a rock."
    });
    const disk = await webdisk.open("testdisk");
    const contents = await disk.readFile(path);
    contents.should.equal("Pluto downgraded to a rock.");
  });

  /* readFile */
  it(`Fails to read a missing file`, async () => {
    const path = "/docs/report.txt";
    const filename = "report.txt";
    let ex;
    try {
      const disk = await webdisk.open("testdisk");
      const contents = await disk.readFile(path);
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("The path /docs/report.txt does not exist.");
  });

  /* readDir */
  it(`Reads a directory`, async () => {
    const path = "/pics";
    const disk = await webdisk.open("testdisk");
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
      const disk = await webdisk.open("testdisk");
      const files = await disk.readDir(path);
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("The path /pics/missing does not exist.");
  });

  /* readDirRecursive */
  it(`Reads a directory recursively`, async () => {
    const path = "/pics";
    const disk = await webdisk.open("testdisk");
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
    const disk = await webdisk.open("testdisk");
    await disk.createDir(path);
    const dir = findDir(webdisk.__data("testdisk"), "/pics/secret");
    dir.name.should.equal("secret");
    dir.contents.should.be.an.instanceOf(Array);
  });

  /* move */
  it(`Removes a file or directory`, async () => {
    const path = "/pics";
    const disk = await webdisk.open("testdisk");
    await disk.remove(path);
    const dir = findDir(webdisk.__data("testdisk"), "/");
    dir.contents.length.should.equal(1);
  });

  /* move */
  it(`Moves a file or directory`, async () => {
    const path = "/pics/large-pics/backup";
    const newPath = "/";
    const disk = await webdisk.open("testdisk");
    await disk.move(path, newPath);
    const loopDir = find(webdisk.__data("testdisk"), "/");
    loopDir.contents.length.should.equal(3);
    const largePicsDir = findDir(
      webdisk.__data("testdisk"),
      "/pics/large-pics"
    );
    largePicsDir.contents.length.should.equal(2);
  });

  it(`Renames a file or directory`, async () => {
    const path = "/pics/large-pics/backup";
    const newPath = "/pics/large-pics/storage";
    const disk = await webdisk.open("testdisk");
    await disk.move(path, newPath);
    const largePicsDir = findDir(
      webdisk.__data("testdisk"),
      "/pics/large-pics"
    );
    should.not.exist(largePicsDir.contents.find(x => x.name === "backup"));
    should.exist(largePicsDir.contents.find(x => x.name === "storage"));
  });

  it(`Fails to move a directory into an existing file path`, async () => {
    const path = "/pics/large-pics/backup";
    const newPath = "/pics/asterix.jpg";
    let ex;
    try {
      const disk = await webdisk.open("testdisk");
      await disk.move(path, newPath);
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
      const disk = await webdisk.open("testdisk");
      await disk.move(path, newPath);
    } catch (_ex) {
      ex = _ex;
    }
    ex.message.should.equal("Cannot move to the same path /pics.");
  });
});
