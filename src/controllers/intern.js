const fs = require("fs");
const tempy = require("tempy");

const express = require("express");
const router = express.Router();
module.exports = router;

const { Remarkable, ItemResponse } = require("remarkable-typescript-dave");

const user = require("../models/user");
const { openDb } = require("../config/db");
const { getRemarkClient } = require("./remarkable");
const { reloadTriggers } = require("./cron");
const { cronQueue } = require("./jobqueue");
const { sendFeedsToRemarkable } = require("./rssfeeds");
const { getFeeds, setFeeds } = require("../models/rssfeeds");
const { getCronTriggers, setCronTriggers } = require("../models/crontriggers");
const { setPref, getAllPrefs } = require("../models/remarkable-prefs");

const DEFAULT_FEEDS = [
  {
    name: "Yglesias - Slow Boring",
    url: "https://www.slowboring.com/feed"
  }
];
const DEFAULT_TRIGGERS = {
  morning: {
    timezone: "America/Los_Angeles",
    cron: "Every day at 7AM",
    job_func: "rssfeeds:sendFeedsToRemarkable",
    func_args: {
      title: "Morning Edition"
    }
  },
  evening: {
    timezone: "America/Los_Angeles",
    cron: "Every day at 8PM",
    job_func: "rssfeeds:sendFeedsToRemarkable",
    func_args: {
      title: "Evening Edition"
    }
  }
};

const DEFAULT_PREFS = [
  {
    name: "feeds_folder",
    value: "Feeds" // Must exist or will go to root folder
  }
];

router.get("/setconfig", async (req, res) => {

  for (const pref of DEFAULT_PREFS) {
    await setPref(req.user, pref.name, pref.value);
  }

  await setFeeds(req.user, DEFAULT_FEEDS);
  await setCronTriggers(req.user, DEFAULT_TRIGGERS);
  await reloadTriggers(req.user);

  const all = {
    'prefs': await getAllPrefs(req.user),
    'crontriggers': await getCronTriggers(req.user),
    'feeds': await getFeeds(req.user)
  }
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(all, null, 2));
});

router.get("/setfeeds", async (req, res) => {
  
  await setFeeds(req.user, DEFAULT_FEEDS);

  var feeds = await getFeeds(req.user);
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(feeds, null, 2));
});

router.get("/settriggers", async (req, res) => {
  await setCronTriggers(req.user, {});

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
    'active': await cronQueue.getJobs(["active"]),
    'waiting': await cronQueue.getJobs(["waiting"]),
    'delayed': await cronQueue.getJobs(["delayed"]),
    'repeatable': await cronQueue.getRepeatableJobs()
  }

  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(jobs, null, 2));
});
