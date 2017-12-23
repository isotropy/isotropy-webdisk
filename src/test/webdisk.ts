import WebDisk from "../isotropy-webdisk";

export default new WebDisk({
  name: "/",
  contents: [
    {
      name: "docs",
      contents: [
        {
          name: "report.txt",
          contents: "Pluto downgraded to a rock."
        }
      ]
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
});