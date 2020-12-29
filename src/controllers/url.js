const express = require("express");
const router = express.Router();
exports.router = router;

const Epub = require("epub-gen");
const tempy = require("tempy");
const fs = require("fs");
const { getRemarkableClient, getFolderNameToId } = require("./remarkable");
const { findOneById } = require("../models/user");

router.post("/article", async (req, res) => {
  const user = await findOneById(1); // FIXME: me!
  if (req.headers.authorization !== "Basic" + process.env.SEND_ARTICLE_AUTH) {
    res.send(401, "Missing or incorrect authorization header");
    return;
  }

  res.header("Content-Type", "application/json");
  // return early so Shortcut doesn't wait
  res.send(JSON.stringify({ success: "true" }, null, 2));

  // Send folder name in Shortcut
  const folder_name = req.headers.folder;
  const folder_id = await getFolderNameToId(user, folder_name);

  const title = req.body.title;

  const article = req.body.html.replace(
    '<body>',
    `<body><h1>${title}</h1>
    <div color:grey><a href=${req.body.url}>${req.body.url}</a></div><br/>
    `
    )
  var content = [
    {
      title: title,
      data: article,
      beforeToc: true
    }
  ];
  var tmp_epub = tempy.file({ extension: "epub" });

  const option = {
    appendChapterTitles: false,
    title: title,
    author: "remarkable-syncer",
    customHtmlTocTemplatePath: "/app/public/blanktoc.html.ejs",
    content: content
  };

  await new Epub(option, tmp_epub).promise;

  // Set margins so toolbar can be open
  const content_opts = {
    margins: 150,
    extraMetadata: {
      LastTool: "Finelinerv2",
      LastPen: "Finelinerv2"
    }
  };

  const tmp_epub_buffer = fs.readFileSync(tmp_epub);

  const remarkClient = await getRemarkableClient(user);
  const epubDocId = await remarkClient.uploadEPUB(
    title,
    tmp_epub_buffer,
    folder_id,
    content_opts
  );
  console.log("Sent article as epub: " + title);
});
