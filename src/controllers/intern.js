// Internal admin type functions, e.g. update configuration etc

const fs = require("fs");
const tempy = require("tempy");

const express = require("express");
const router = express.Router();
module.exports = router;

const { Remarkable, ItemResponse } = require("remarkable-typescript-dave");

const user = require("../models/user");
const { openDb } = require("../config/db");
const { getRemarkableClient, getFolderNameToId } = require("./remarkable");
const { reloadTriggers } = require("./cron");
const { cronQueue } = require("./jobqueue");
const { sendFeedsToRemarkable } = require("./rssfeeds");
const { getFeeds, setFeeds } = require("../models/rssfeeds");
const { getCronTriggers, setCronTriggers } = require("../models/crontriggers");
const { setPref, getAllPrefs } = require("../models/remarkable-prefs");
const { syncToDrive } = require("./sync");

const MY_FEEDS = [
  {
    name: "Astral Codex Ten",
    url: "https://astralcodexten.substack.com/feed",
  },
  {
    name: "Yglesias - Slow Boring",
    url: "https://www.slowboring.com/feed",
  },
];

const MY_TRIGGERS = {
  evening: {
    timezone: "America/Los_Angeles",
    cron: "Every day at 7PM",
    job_func: "rssfeeds:sendFeedsToRemarkable",
    func_args: {
      title: "Evening Edition",
    },
  },
  sync: {
    timezone: "America/Los_Angeles",
    cron: "*/10 * * * *",
    job_func: "sync:syncToDrive",
  },
};

const MY_PREFS = [
  {
    name: "feeds_folder",
    value: "Feeds", // Goes to root folder if it doesn't exist
  }
];

const { parse } = require("node-html-parser");

router.get("/setconfig", async (req, res) => {
  for (const pref of MY_PREFS) {
    await setPref(req.user, pref.name, pref.value);
  }

  await setFeeds(req.user, MY_FEEDS);
  await setCronTriggers(req.user, MY_TRIGGERS);
  await reloadTriggers(req.user);

  const all = {
    prefs: await getAllPrefs(req.user),
    crontriggers: await getCronTriggers(req.user),
    feeds: await getFeeds(req.user),
  };
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(all, null, 2));
});

// Testing & Debugging helpers

router.get("/setfeeds", async (req, res) => {
  await setFeeds(req.user, MY_FEEDS);

  var feeds = await getFeeds(req.user);
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(feeds, null, 2));
});

router.get("/settriggers", async (req, res) => {
  // await setCronTriggers(req.user, {});
  await setCronTriggers(req.user, MY_TRIGGERS);

  await reloadTriggers(req.user);

  var cronTriggers = await getCronTriggers(req.user);
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(cronTriggers, null, 2));
});

router.get("/gettriggers", async (req, res) => {
  var cronTriggers = await getCronTriggers(req.user);
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(cronTriggers, null, 2));
});

router.get("/getcronqueue", async (req, res) => {
  const jobs = {
    active: await cronQueue.getJobs(["active"]),
    waiting: await cronQueue.getJobs(["waiting"]),
    delayed: await cronQueue.getJobs(["delayed"]),
    repeatable: await cronQueue.getRepeatableJobs(),
  };

  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(jobs, null, 2));
});

router.get("/getallitems", async (req, res) => {
  const remarkClient = await getRemarkableClient(req.user);
  var x = await remarkClient.getAllItems();
  // console.log(x);
  res.send(JSON.stringify(x, null, 2));
});

router.get("/sync", async (req, res) => {
  // res.send(JSON.stringify('lol', null, 2));
  var x = await syncToDrive(req.user, { force: true });
  res.send(JSON.stringify(x, null, 2));
});

router.get("/getfeeds", async (req, res) => {
  res.header("Content-Type", "application/json");
  
  if (req.query.force != "false") {
    req.query.force = true;
    console.log("Feed: set force true");
  }

  var sentCount = -1;
  try {
    sentCount = await sendFeedsToRemarkable(req.user, req.query);
  } catch (err) {
    res.status(500).json({ success: false, msg: err });
    throw err;
  }

  res.json({
    success: true,
    msg: `Sent ${sentCount} article(s) to Remarkable`,
  });
});

router.get("/getitembyid", async (req, res) => {
  var tmp_zip = tempy.file({ extension: "zip" });
  var id = req.query.id;
  const remarkClient = await getRemarkableClient(req.user);
  var x = await remarkClient.downloadZip(id);
  fs.writeFileSync(tmp_zip, x);
  res.download(tmp_zip);
});

router.get("/testquanta", async (req, res) => {
  const got = require("got");
  const res1 = await got("https://www.quantamagazine.org/with-one-galaxy-ai-defines-a-whole-simulated-universe-20220120/");
  const root = parse(
    res1.body,
    {
      blockTextElements: {
        script: false
      }
    }
  );
  var content_root = root.querySelector(".post__content__section");

  const content = [{
    title: "foo1",
    data: content_root.toString()
  }];

  var tmp_epub = tempy.file({ extension: "epub" });

  const option = {
    appendChapterTitles: false,
    title: "foo",
    tocTitle: "Posts",
    author: "remarkable-syncer",
    content: content,
  };
  const Epub = require("epub-gen");
  await new Epub(option, tmp_epub).promise;

  return res.download(tmp_epub);
})

router.get("/download", function (req, res) {
  if (req.query.file == null) {
    res.status(500).json({ success: false, err: "missing ID parameter" });
  }
  console.log("/tmp/" + req.query.file);
  res.download("/tmp/" + req.query.file); // Set disposition and send it
});

const getCronStringOrig = require("@darkeyedevelopers/natural-cron.js");
router.get("/testcron", async (req, res) => {
  const regex = /([\*\/0-9A-Z-]+ ){4}([\*\/0-9A-Z-]+)/;
  console.log(req.query.cron);
  console.log(regex.test(req.query.cron));

  res.send(regex.test(req.query.cron));
});
