const getCronStringOrig = require("@darkeyedevelopers/natural-cron.js");

const { cronQueue } = require("./jobqueue");

const { getCronTriggers } = require("../models/crontriggers");

exports.reloadTriggers = async function (user) {
  const repeatableJobs = await cronQueue.getRepeatableJobs();

  repeatableJobs.forEach(async job => {
    var user_id_in_key = job.key.split(":")[0].split("#")[1];
    if (user_id_in_key == user.id)

      await cronQueue.removeRepeatableByKey(job.key);
  });
  // Drain jobs already enqueued
  await cronQueue.drain(true);
  
  const cronTriggers = await getCronTriggers(user);
  for (const crontrigger of cronTriggers) {
    const job = crontrigger.trigger;
    var randInt = Math.floor(Math.random() * 1000);
    job.user_id = user.id;
    var job_name = ["cron", user.id, job._id, randInt].join("#");

    await cronQueue.add(job_name, job, {
      repeat: {
        cron: getCronString(job.cron),
        tz: job.timezone
      }
    });
  }
  console.log(`${cronTriggers.length} cron triggers loaded`)
  console.log(await cronQueue.getRepeatableJobs());
}

function getCronString(str) {
  var newstr;
  const regex = /([\*\/0-9A-Z-]+ ){4}([\*\/0-9A-Z-]+)/;
  if (regex.test(str)) {
    newstr = str;
  } else {
    // BullMQ doesn't understand ? in a cron string.
    newstr = getCronStringOrig(str, "MIN HOR DOM MON WEK").replace("?", "*"); 
  }
  
  console.log(`get cron string: ${str}, ${newstr}`);
  return newstr;
}
