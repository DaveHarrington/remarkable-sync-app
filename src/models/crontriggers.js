const { openDb } = require("../config/db");

const TABLE = "crontriggers";

(async () => {
  const db = await openDb();
  await db.run(
    `
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          trigger_json TEXT NOT NULL,
          UNIQUE(user_id, name)
        )
      `
  );
})().catch(err => console.error("crontriggers init ERROR: " + err));

exports.setCronTriggers = async (user, triggers) => {
  if (user == null) throw Error("No user given");
  const db = await openDb();

  const existing_rows = await getCronTriggers(user);
  const existing = existing_rows.map(x => x.name);

  for (const name of existing) {
    if (!(name in triggers)) {
      console.log("Removing stale crontrigger: ${name}");
      await db.run(
        `DELETE FROM ${TABLE} WHERE user_id=:user_id AND name=:name`,
        {
          ":user_id": user.id,
          ":name": name
        }
      );
    }
  }

  for (const trigger in triggers) {
    await db.run(
      `INSERT OR REPLACE INTO ${TABLE} (user_id, name, trigger_json)
          VALUES (:user_id, :name, :trigger_json)`,
      {
        ":user_id": user.id,
        ":name": trigger,
        ":trigger_json": JSON.stringify(triggers[trigger])
      }
    );
  }
};

const getCronTriggers = async user => {
  if (user == null) throw Error("No user given");

  const db = await openDb();
  var feeds = await db.all(
    `SELECT id, user_id, name, trigger_json FROM ${TABLE} WHERE user_id=:user_id`,
    { ":user_id": user.id }
  );

  for (const feed of feeds) {
    feed.trigger = JSON.parse(feed.trigger_json);
  }

  return feeds;
};
exports.getCronTriggers = getCronTriggers;
