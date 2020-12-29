const express = require("express");
const router = express.Router();
exports.router = router;

const Epub = require("epub-gen");
const feedparser = require("feedparser-promised");
var FormData = require("form-data");
const fs = require("fs");
const got = require("got");
const { DateTime } = require("luxon");
const stream = require("stream");
const tempy = require("tempy");
const util = require("util");

const { getRemarkableClient, getFolderNameToId } = require("./remarkable");
const { getFeeds, updateLastSeenGuid } = require("../models/rssfeeds");
const { getPref } = require("../models/remarkable-prefs");
const { getToken, REMARKABLE } = require("../models/tokens");

const pipeline = util.promisify(stream.pipeline);

const MAX_ITEMS_PER_FEED = 5;

router.get("/getfeeds", async (req, res) => {

  res.header("Content-Type", "application/json");

  var sentCount = -1;
  try {
    sentCount = await sendFeedsToRemarkable(req.user, { force: true });
  } catch (err) {
    res.status(500).json({ success: false, msg: err });
    throw err;
  }

  res.json({
    success: true,
    msg: `Sent ${sentCount} article(s) to Remarkable`
  });
});

const default_format = function(item) {
  if (item["atom:content"] != null) {
    item["content:encoded"] = item["atom:content"];
  }
  return `
    <div color:grey>by ${item.author}</div><br/>
    ${item["content:encoded"]["#"]}`;
};

async function sendFeedsToRemarkable(user, args) {
  console.log(`Send feeds to remarkable: ${JSON.stringify(args)}`);
  var datestr = DateTime.local()
    .setZone("America/Los_Angeles")
    .toLocaleString({ month: "long", day: "numeric" });

  var title = `${datestr} ` + (args["title"] || "RSS Feeds");

  var feeds = await getFeeds(user.id);

  var all_content = [];
  var last_guid = [];
  for (const feed_conf of feeds) {
    var format = default_format;

    let feed = await feedparser.parse(feed_conf.url, feed_conf.parse_options);
    var feed_content = [];
    for (var i = 0; i < feed.slice(0, MAX_ITEMS_PER_FEED).length; i++) {
      var item = feed[i];
      if (item.guid == feed_conf.last_guid && !args["force"]) {
        // console.log(`found last guid (${item.guid}) for ` + feed_conf.name);
        break;
      }

      feed_content.push({
        title: feed_conf.name + ": " + item.title,
        data: format(item)
      });
    }
    if (!args["force"]) {
      last_guid[feed_conf.name] = feed[0].guid;
    }
    all_content = all_content.concat(feed_content);
  }
  // console.log("done getting feed content");

  if (all_content.length == 0) {
    console.log("No new content found");
    return;
  }

  var tmp_epub = tempy.file({ extension: "epub" });

  const option = {
    title: title,
    tocTitle: "Posts",
    author: "remarkable-syncer",
    content: all_content
  };

  // console.log("Generating EPUB");
  await new Epub(option, tmp_epub).promise;
  // console.log("Done: " + tmp_epub);

  // Set margins so toolbar can be open
  var content_opts = {
    margins: 150
  };

  // console.log("Reading epub in");
  const tmp_epub_buffer = fs.readFileSync(tmp_epub);

  // console.log("Sending epub to remarkable");
  const feeds_folder_name = await getPref(user, "feeds_folder"); // null if not set will save to root
  const feeds_folder_id = await getFolderNameToId(user, feeds_folder_name);

  const remarkClient = await getRemarkableClient(user);
  // const epubDocId = await remarkClient.uploadEPUB(
  //   title,
  //   tmp_epub_buffer,
  //   feeds_folder_id,
  //   content_opts
  // );
  console.log("Sent epub: " + title);

  for (const feed_name in last_guid) {
    await updateLastSeenGuid(user, feed_name, last_guid[feed_name]);
  }
  
  return all_content.length;
}
exports.sendFeedsToRemarkable = sendFeedsToRemarkable;
exports.jobFuncs = {
  "rssfeeds:sendFeedsToRemarkable": sendFeedsToRemarkable
};
