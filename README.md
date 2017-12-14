# isotropy-filesystem
Browser side lib for emulating the file system.

### Setup

```javascript
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
```

### API

Creates a file

```javascript
const disk = await webdisk.open("testdisk");
await disk.createFile("/docs/report.txt", "Pluto is a planet.");
```

Creates or overwrites a file

```javascript
const path = "/docs/report.txt";
const filename = "report.txt";
const disk = await webdisk.open("testdisk");
await disk.createFile(path, "Pluto is a planet.", { overwrite: true });
```

Reads a file

```javascript
const path = "/docs/report.txt";
const filename = "report.txt";
const disk = await webdisk.open("testdisk");
const contents = await disk.readFile(path);
```

Reads a directory

```javascript
const path = "/pics";
const disk = await webdisk.open("testdisk");
const files = await disk.readDir(path);
files.should.deepEqual([
  "/pics/asterix.jpg",
  "/pics/obelix.jpg",
  "/pics/large-pics"
]);
```

Reads a directory recursively

```javascript
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
```

Creates a directory

```javascript
const path = "/pics/secret";
const disk = await webdisk.open("testdisk");
await disk.createDir(path);
```

Removes a file or directory

```javascript
const path = "/pics";
const disk = await webdisk.open("testdisk");
await disk.remove(path);
```

Moves a file or directory

```javascript
const path = "/pics/large-pics/backup";
const newPath = "/";
const disk = await webdisk.open("testdisk");
await disk.move(path, newPath);
```

Renames a file or directory

```javascript
const path = "/pics/large-pics/backup";
const newPath = "/pics/large-pics/storage";
const disk = await webdisk.open("testdisk");
await disk.move(path, newPath);
```

