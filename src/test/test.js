import should from "should";
import * as babel from "babel-core";
import sourceMapSupport from "source-map-support";
import * as webdisk from "../isotropy-webdisk";

sourceMapSupport.install();

function find(tree, path) {
  const parts = path.split("/").slice(1);
  return parts.reduce((acc, p) => acc.contents.find(x => x.name === p), tree);
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
    const dir = find(webdisk.__data("testdisk"), "/docs");
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
    const dir = find(webdisk.__data("testdisk"), "/docs");
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
    const dir = find(webdisk.__data("testdisk"), "/docs");
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
  it(`Create a directory`, async () => {
    const path = "/pics/secret";
    const disk = await webdisk.open("testdisk");
    await disk.createDir(path);
    const dir = find(webdisk.__data("testdisk"), "/pics/secret");
    dir.name.should.equal("secret");
    dir.contents.should.be.an.instanceOf(Array);
  });

  /* move */
  it(`Remove a node`, async () => {
    const path = "/pics";
    const disk = await webdisk.open("testdisk");
    await disk.remove(path);
    const dir = find(webdisk.__data("testdisk"), "/");
    dir.contents.length.should.equal(1);
  });

  // /* move */
  // [
  //   ["/pics/large-pics/backup", "/home/loop", "absolute path"],
  //   ["./pics/large-pics/backup", "./", "relative path"]
  // ].forEach(([path, newpath, pathType]) => {
  //   it(`Move a node`, async () => {
  //     const disk = await webdisk.open("testdisk");
  //     await disk.move(path, newpath);
  //     const loopDir = find(webdisk.__data("testdisk"), "/home/loop");
  //     loopDir.contents.length.should.equal(3);
  //     const largePicsDir = find(webdisk.__data("testdisk"), "/pics/large-pics");
  //     largePicsDir.contents.length.should.equal(2);
  //   });
  // });

  // [
  //   ["/pics/large-pics/backup", "/pics/large-pics/storage", "absolute path"],
  //   ["./pics/large-pics/backup", "./pics/large-pics/storage", "relative path"]
  // ].forEach(([path, newpath, pathType]) => {
  //   it(`Rename a node`, async () => {
  //     const disk = await webdisk.open("testdisk");
  //     await disk.move(path, newpath);
  //     const largePicsDir = find(webdisk.__data("testdisk"), "/pics/large-pics");
  //     should.not.exist(largePicsDir.contents.find(x => x.name === "backup"));
  //     largePicsDir.contents
  //       .find(x => x.name === "storage")
  //       .should.not.be.empty();
  //   });
  // });

  // [
  //   ["/pics/large-pics/backup", "/pics/asterix.jpg", "absolute path"],
  //   ["./pics/large-pics/backup", "./pics/asterix.jpg", "relative path"]
  // ].forEach(([path, newpath, pathType]) => {
  //   it(`Fails to move a directory into an existing file path`, async () => {
  //     let ex;
  //     try {
  //       const disk = await webdisk.open("testdisk");
  //       await disk.move(path, newpath);
  //     } catch (_ex) {
  //       ex = _ex;
  //     }
  //     ex.message.should.equal("The path /pics/asterix.jpg already exists.");
  //   });
  // });

  // [
  //   ["/pics", "/pics/large-pics", "absolute path"], // [
  //   ["/docs/report.txt", "report.txt", "absolute path"],
  //   ["./docs/report.txt", "report.txt", "relative path"]
  // ].forEach(([path, filename, pathType]) => {
  //   it(`Creates or overwrites a file`, async () => {
  //     const dir = find(webdisk.__data("testdisk"), "/docs");
  //     dir.contents = dir.contents.concat({
  //       name: "report.txt",
  //       contents: "Pluto downgraded to a rock."
  //     });
  //     const disk = await webdisk.open("testdisk");
  //     await disk.createFile(path, "Pluto is a planet.", { overwrite: true });
  //     const file = find(webdisk.__data("testdisk"), path);
  //     file.name.should.equal(filename);
  //     file.contents.should.equal("Pluto is a planet.");
  //   });
  // });

  // [
  //   ["/docs/report.txt", "report.txt", "absolute path"],
  //   ["./docs/report.txt", "report.txt", "relative path"]
  // ].forEach(([path, filename, pathType]) => {
  //   it(`Fails to overwrite existing file`, async () => {
  //     const dir = find(webdisk.__data("testdisk"), "/docs");
  //     dir.contents = dir.contents.concat({
  //       name: "report.txt",
  //       contents: "Pluto downgraded to a rock."
  //     });
  //     let ex;
  //     try {
  //       const disk = await webdisk.open("testdisk");
  //       await disk.createFile(path, "Pluto is a planet.", { overwrite: false });
  //     } catch (_ex) {
  //       ex = _ex;
  //     }
  //     ex.message.should.equal("The path /docs/report.txt already exists.");
  //   });
  // });

  // /* readFile */
  // [
  //   ["/docs/report.txt", "report.txt", "absolute path"],
  //   ["./docs/report.txt", "report.txt", "relative path"]
  // ].forEach(([path, filename, pathType]) => {
  //   it(`Reads a file`, async () => {
  //     const dir = find(webdisk.__data("testdisk"), "/docs");
  //     dir.contents = dir.contents.concat({
  //       name: "report.txt",
  //       contents: "Pluto downgraded to a rock."
  //     });
  //     const disk = await webdisk.open("testdisk");
  //     const contents = await disk.readFile(path);
  //     contents.should.equal("Pluto downgraded to a rock.");
  //   });
  // });

  // /* readFile */
  // [
  //   ["/docs/report.txt", "report.txt", "absolute path"],
  //   ["./docs/report.txt", "report.txt", "relative path"]
  // ].forEach(([path, filename, pathType]) => {
  //   it(`Fails to read a missing file`, async () => {
  //     let ex;
  //     try {
  //       const disk = await webdisk.open("testdisk");
  //       const contents = await disk.readFile(path);
  //     } catch (_ex) {
  //       ex = _ex;
  //     }
  //     ex.message.should.equal("The path /docs/report.txt does not exist.");
  //   });
  // });

  // /* readDir */
  // [
  //   ["/pics", "absolute path"],
  //   ["./pics", "relative path"]
  // ].forEach(([path, pathType]) => {
  //   it(`Reads a directory`, async () => {
  //     const disk = await webdisk.open("testdisk");
  //     const files = await disk.readDir(path);
  //     files.should.deepEqual([
  //       "/pics/asterix.jpg",
  //       "/pics/obelix.jpg",
  //       "/pics/large-pics"
  //     ]);
  //   });
  // });

  // [
  //   ["/pics/missing", "absolute path"],
  //   ["./pics/missing", "relative path"]
  // ].forEach(([path, pathType]) => {
  //   it(`Fails to read missing directory`, async () => {
  //     let ex;
  //     try {
  //       const disk = await webdisk.open("testdisk");
  //       const files = await disk.readDir(path);
  //     } catch (_ex) {
  //       ex = _ex;
  //     }
  //     ex.message.should.equal("The path /pics/missing does not exist.");
  //   });
  // });

  // /* readDirRecursive */
  // [
  //   ["/pics", "absolute path"],
  //   ["./pics", "relative path"]
  // ].forEach(([path, pathType]) => {
  //   it(`Reads a directory recursively`, async () => {
  //     const disk = await webdisk.open("testdisk");
  //     const files = await disk.readDirRecursive(path);
  //     files.should.deepEqual([
  //       "/pics/asterix.jpg",
  //       "/pics/obelix.jpg",
  //       "/pics/large-pics",
  //       "/pics/large-pics/asterix-large.jpg",
  //       "/pics/large-pics/obelix-large.jpg",
  //       "/pics/large-pics/backup",
  //       "/pics/large-pics/backup/asterix-large-bak.jpg",
  //       "/pics/large-pics/backup/obelix-large-bak.jpg"
  //     ]);
  //   });
  // });

  // /* createDir */
  // [
  //   ["/pics/secret", "absolute path"],
  //   ["./pics/secret", "relative path"]
  // ].forEach(([path, pathType]) => {
  //   it(`Create a directory`, async () => {
  //     const disk = await webdisk.open("testdisk");
  //     await disk.createDir(path);
  //     const dir = find(webdisk.__data("testdisk"), "/pics/secret");
  //     dir.name.should.equal("secret");
  //     dir.contents.should.be.an.instanceOf(Array);
  //   });
  // });

  // /* move */
  // [
  //   ["/pics", "absolute path"],
  //   ["./pics", "relative path"]
  // ].forEach(([path, pathType]) => {
  //   it(`Remove a node`, async () => {
  //     const disk = await webdisk.open("testdisk");
  //     await disk.remove(path);
  //     const dir = find(webdisk.__data("testdisk"), "/home/loop");
  //     dir.contents.length.should.equal(1);
  //   });
  // });

  // /* move */
  // [
  //   ["/pics/large-pics/backup", "/home/loop", "absolute path"],
  //   ["./pics/large-pics/backup", "./", "relative path"]
  // ].forEach(([path, newpath, pathType]) => {
  //   it(`Move a node`, async () => {
  //     const disk = await webdisk.open("testdisk");
  //     await disk.move(path, newpath);
  //     const loopDir = find(webdisk.__data("testdisk"), "/home/loop");
  //     loopDir.contents.length.should.equal(3);
  //     const largePicsDir = find(webdisk.__data("testdisk"), "/pics/large-pics");
  //     largePicsDir.contents.length.should.equal(2);
  //   });
  // });

  // [
  //   ["/pics/large-pics/backup", "/pics/large-pics/storage", "absolute path"],
  //   ["./pics/large-pics/backup", "./pics/large-pics/storage", "relative path"]
  // ].forEach(([path, newpath, pathType]) => {
  //   it(`Rename a node`, async () => {
  //     const disk = await webdisk.open("testdisk");
  //     await disk.move(path, newpath);
  //     const largePicsDir = find(webdisk.__data("testdisk"), "/pics/large-pics");
  //     should.not.exist(largePicsDir.contents.find(x => x.name === "backup"));
  //     largePicsDir.contents
  //       .find(x => x.name === "storage")
  //       .should.not.be.empty();
  //   });
  // });

  // [
  //   ["/pics/large-pics/backup", "/pics/asterix.jpg", "absolute path"],
  //   ["./pics/large-pics/backup", "./pics/asterix.jpg", "relative path"]
  // ].forEach(([path, newpath, pathType]) => {
  //   it(`Fails to move a directory into an existing file path`, async () => {
  //     let ex;
  //     try {
  //       const disk = await webdisk.open("testdisk");
  //       await disk.move(path, newpath);
  //     } catch (_ex) {
  //       ex = _ex;
  //     }
  //     ex.message.should.equal("The path /pics/asterix.jpg already exists.");
  //   });
  // });

  // [
  //   ["/pics", "/pics/large-pics", "absolute path"],
  //   ["./pics", "./pics/large-pics", "relative path"]
  // ].forEach(([path, newpath, pathType]) => {
  //   it(`Fails to move a directory into a sub-directory`, async () => {
  //     let ex;
  //     try {
  //       const disk = await webdisk.open("testdisk");
  //       await disk.move(path, newpath);
  //     } catch (_ex) {
  //       ex = _ex;
  //     }
  //     ex.message.should.equal("Cannot move to the same path /pics.");
  //   });
  // });
  //   ["./pics", "./pics/large-pics", "relative path"]
  // ].forEach(([path, newpath, pathType]) => {
  //   it(`Fails to move a directory into a sub-directory`, async () => {
  //     let ex;
  //     try {
  //       const disk = await webdisk.open("testdisk");
  //       await disk.move(path, newpath);
  //     } catch (_ex) {
  //       ex = _ex;
  //     }
  //     ex.message.should.equal("Cannot move to the same path /pics.");
  //   });
  // });
});
