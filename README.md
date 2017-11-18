# isotropy-filesystem
Browser side lib for emulating the file system.

```javascript
//my-filesystem.js
import fs from "isotropy-lib-filesystem";

fs.init([
  {
    name: "home",
    contents: [
      {
        name: "docs",
        contents: [
          {
            type: "file",
            name: "report.txt",
            contents: "2017: 200; 2016: 150"
          },
          {
            name: "old-report.txt",
            contents: "2017: 220; 2016: 100"
          }
        ]
      },
      {
        name: "placeholder.txt",
        contents: "This is empty."
      }
    ]
  }
])
```

You should then be able to query from anywhere else.

```javascript
import fs from "./my-filesystem";

//Read a file
//Create a file
fs.createFile("/home/reports/report-2015.txt", "2015: 40");

// returns { type: "file", name: "report-2015.txt", contents: "2015: 40" } 
fs.readFile("/home/reports/report-2015.txt");

//Update a file
fs.updateFile("/home/reports/report-2015.txt", "2015: 60");

//Read a directory
fs.readDir("/home/reports");

//Read dir recursively
fs.readDirRecursive("/home")

//Create a directory
fs.createDir("/home/reports/older");

//Move a file or dir
fs.move("/home/reports/older", "/home/reports/archived");

//Delete dir
fs.remove("/home/reports/archived")
```