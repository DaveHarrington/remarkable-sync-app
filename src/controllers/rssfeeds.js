const express = require("express");
const router = express.Router();
exports.router = router;

const Epub = require("epub-gen");
let Parser = require("rss-parser");
var FormData = require("form-data");
const fs = require("fs");
const got = require("got");
const { DateTime } = require("luxon");
const stream = require("stream");
const tempy = require("tempy");
const util = require("util");
const { CookieJar } = require("tough-cookie");
const { parse } = require("node-html-parser");

const { getRemarkableClient, getFolderNameToId } = require("./remarkable");
const { getFeeds, updateLastSeenGuid } = require("../models/rssfeeds");
const { getPref } = require("../models/remarkable-prefs");
const { getToken, REMARKABLE } = require("../models/tokens");

const pipeline = util.promisify(stream.pipeline);
let parser = new Parser();

const MAX_ITEMS_PER_FEED = 5;

const default_format = async function (item) {
  var content = item["content:encoded"] || item["content"];
  return `
    <h1>${item.title}</h1>
    <div color:grey>by ${item.creator}</div><br/>
    ${content}`;
};

const substack_format = async function (item) {
  if (item.title.toLowerCase().includes("open thread")) return;
  return await default_format(item);
};

const FORMATS = {
  // Regular Substack
  "Astral Codex Ten": substack_format,
  // With login cookie
  "Yglesias - Slow Boring": async function (item) {
    if (item.link.includes("-thread-")) return; // Skip comment thread posts
    if (
      !item.content ||
      item.content.includes("Listen to more mind-expanding audio")
    ) {
      return;
    }
    const cookieJar = new CookieJar();
    const setCookie = util.promisify(cookieJar.setCookie.bind(cookieJar));
    await setCookie(
      `connect.sid=${process.env.SLOW_BORING_COOKIE}`,
      "https://www.slowboring.com"
    );
    const res = await got(item.link, { cookieJar });
    const root = parse(res.body, {
      blockTextElements: {
        script: false,
      },
    });

    return `
    <h1>${item.title}</h1>
    <div color:grey>by ${item.creator}</div><br/>
    ${root.querySelector(".markup").toString()}`;
  },
};

async function sendFeedsToRemarkable(user, args) {
  console.log(`Send feeds to remarkable: ${JSON.stringify(args)}`);
  var datestr = DateTime.local()
    .setZone("America/Los_Angeles")
    .toLocaleString({ month: "long", day: "numeric" });

  var title = `${datestr} ` + (args["title"] || "RSS Feeds");

  var feeds = await getFeeds(user);
  if (args.feed) {
    feeds = feeds.filter((f) => f["name"] == args.feed);
    console.log(`Feed = ${args.feed}; ${JSON.stringify(feeds, null, 2)}`);
  }

  var all_content = [];
  var last_guid = [];
  for (const feed_conf of feeds) {
    var format = FORMATS[feed_conf.name] || default_format;
    var feed = [];
    try {
      feed = await parser.parseURL(feed_conf.url);
    } catch (err) {
      console.error("Error parsing feed: " + feed_conf.url);
      console.error(err);
      continue;
    }
    var feed_content = [];
    for (var i = 0; i < feed.items.slice(0, MAX_ITEMS_PER_FEED).length; i++) {
      var item = feed.items[i];
      if (!item.guid) item.guid = item.link;
      if (item.guid == feed_conf.last_guid && args["force"] != true) {
        console.log(`found last guid (${item.guid}) for ` + feed_conf.name);
        break;
      }
      try {
        var formated = await format(item);
      } catch (err) {
        console.error("Could not parse for feed: " + feed_conf.name);
        console.error(item);
        console.error(err);
        var formatted = `
          ${feed_conf.name}: ${item.title}

          Error formatting
          ${err.toString()}
        `;
      }
      if (formated == null) continue;

      feed_content.push({
        title: `${feed_conf.name}: ${item.title}`,
        data: formated,
      });
    }
    if (args["force"] != true && feed.items && feed.items[0]) {
      last_guid[feed_conf.name] = feed.items[0].guid;
    }
    all_content = all_content.concat(feed_content);
  }
  console.log("done getting feed content");

  if (all_content.length == 0) {
    console.log("No new content found");
    return;
  }

  var tmp_epub = tempy.file({ extension: "epub" });

  const option = {
    appendChapterTitles: false,
    title: title,
    tocTitle: "Posts",
    author: "remarkable-syncer",
    content: all_content,
  };

  await new Epub(option, tmp_epub).promise;

  // Set margins so toolbar can be open
  var content_opts = {
    margins: 150,
    extraMetadata: {
      LastTool: "Finelinerv2",
      LastPen: "Finelinerv2",
    },
  };

  const tmp_epub_buffer = fs.readFileSync(tmp_epub);

  const feeds_folder_name = await getPref(user, "feeds_folder"); // null if not set will save to root
  const feeds_folder_id = await getFolderNameToId(user, feeds_folder_name);

  const remarkClient = await getRemarkableClient(user);
  const epubDocId = await remarkClient.uploadEPUB(
    title,
    tmp_epub_buffer,
    feeds_folder_id,
    content_opts
  );
  console.log("Sent epub: " + title);

  console.log("Last GUIDs");
  console.log(last_guid);
  for (const feed_name in last_guid) {
    await updateLastSeenGuid(user, feed_name, last_guid[feed_name]);
  }

  return all_content.length;
}

exports.sendFeedsToRemarkable = sendFeedsToRemarkable;
exports.jobFuncs = {
  "rssfeeds:sendFeedsToRemarkable": sendFeedsToRemarkable,
};
