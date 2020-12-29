const { Worker, Queue, QueueScheduler } = require("bullmq");

const { findOneById } = require("../models/user");

const cronQueueName = "cron";
const cronQueue = new Queue(cronQueueName);
const cronQueueScheduler = new QueueScheduler(cronQueueName); // Required for cron jobs
exports.cronQueue = cronQueue;

const asyncQueueName = "async";
const asyncQueue = new Queue(asyncQueueName);

const rssfeeds = require("./rssfeeds");

var jobFuncRouter = Object.assign({}, rssfeeds.jobFuncs);

exports.startWorker = async function () {

  const asyncWorker = new Worker(asyncQueueName, async job => {
    
    console.log(`got job (${job.id}): ${JSON.stringify(job)}`);
    var data = job.data;
    var user = await findOneById(data.user_id);
    var func = jobFuncRouter[data.job_func];

    if (func == null) throw Error("Unknown function: ", data.job_func);
    await func(user, data.func_args);
    console.log(`Finished job (${job.id})`);
  })
  
  asyncWorker.on("failed", job => {
    console.error(job);
  });

  const cronWorker = new Worker(cronQueueName, async job => {
    //console.log(`got job (${job.id}): ${JSON.stringify(job)}`);
    // We do this dance because queues with a scheduler (needed for Cron) will stall out at 30s,
    // which big processing jobs can hit.
    // See https://docs.bullmq.io/guide/jobs/stalled
    asyncQueue.add(job.name, job.data);
  });
}
