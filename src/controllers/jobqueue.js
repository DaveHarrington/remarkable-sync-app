const { Worker, Queue, QueueScheduler } = require("bullmq");
const { DateTime } = require("luxon");

const { findOneById } = require("../models/user");

const redis = require("../config/redis.js");

const cronQueueName = "cron";
const cronQueue = new Queue(cronQueueName, redis.opts);
const cronQueueScheduler = new QueueScheduler(cronQueueName, redis.opts); // Required for cron jobs
exports.cronQueue = cronQueue;

const asyncQueueName = "async";
const asyncQueue = new Queue(asyncQueueName, redis.opts);

const rssfeeds = require("./rssfeeds");
const sync = require("./sync");

var jobFuncRouter = Object.assign(
  {
    "jobqueue:testLog": async function (user, args) {
      var datestr = DateTime.local().setZone("America/Los_Angeles");
      console.log(`Test log: ${datestr}`);
    },
  },
  rssfeeds.jobFuncs,
  sync.jobFuncs
);

exports.startWorker = async function () {
  const asyncWorker = new Worker(
    asyncQueueName,
    async (job) => {
      console.log(`got job (${job.id}): ${JSON.stringify(job)}`);
      var data = job.data;
      var user = await findOneById(data.user_id);
      var func = jobFuncRouter[data.job_func];

      if (func == null) throw Error("Unknown function: ", data.job_func);
      await func(user, data.func_args);
      console.log(`Finished job (${job.id})`);
    },
    redis.opts
  );

  asyncWorker.on("failed", (job) => {
    console.error(job);
  });

  const cronWorker = new Worker(
    cronQueueName,
    async (job) => {
      //console.log(`got job (${job.id}): ${JSON.stringify(job)}`);
      // We do this dance because queues with a scheduler (needed for Cron) will stall out at 30s,
      // which big processing jobs can hit.
      // See https://docs.bullmq.io/guide/jobs/stalled
      asyncQueue.add(job.name, job.data);
    },
    redis.opts
  );
};
