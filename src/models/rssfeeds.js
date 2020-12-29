const { openDb } = require("../config/db");

const TABLE = "rssfeeds";

(async () => {
  const db = await openDb();
  await db.run(
    `
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          name TEXT,
          url TEXT,
          last_guid TEXT,
          format TEXT,
          UNIQUE(user_id, name)
        )
    `
  );
})().catch(err => console.error("rssfeeds init ERROR: " + err));

exports.setFeeds = async (user, feeds_conf) => {
  if (user == null) throw Error("No user given");

  const existing_rows = await getFeeds(user);
  const removed = existing_rows
    .map(x => x.name)
    .filter(x => !feeds_conf.map(x => x.name).includes(x));

  const db = await openDb();
  for (const name of removed) {
    console.log("Deleting");
    console.log({
      ":user_id": user.id,
      ":name": name
    });
    db.run(`DELETE FROM ${TABLE} WHERE user_id=:user_id AND name=:name`, {
      ":user_id": user.id,
      ":name": name
    });
  }

  for (const feed of feeds_conf) {
    var last_guid = null;

    for (const row of existing_rows) {
      if (row.name == feed.name) {
        last_guid = row.last_guid;
        break;
      }
    }

    console.log("Insert / replace feed");
    console.log({
        ":user_id": user.id,
        ":name": feed.name,
        ":url": feed.url,
        ":last_guid": last_guid
    });
    await db.run(
      `INSERT OR REPLACE INTO ${TABLE} (user_id, name, url, last_guid) VALUES (:user_id, :name, :url, :last_guid)`,
      {
        ":user_id": user.id,
        ":name": feed.name,
        ":url": feed.url,
        ":last_guid": last_guid
      }
    );
  }
};

const getFeeds = async user => {
  if (user == null) throw Error("No user given");
  const db = await openDb();
  const feeds = await db.all(
    `SELECT name, url, last_guid FROM ${TABLE} WHERE user_id=:user_id`,
    { ":user_id": user.id }
  );

  return feeds;
};
exports.getFeeds = getFeeds;

exports.updateLastSeenGuid = async (user, name, last_seen_guid) => {
  if (user == null) throw Error("No user given");
  const db = await openDb();
  await db.run(
    `UPDATE ${TABLE} SET last_guid=:last_seen_guid WHERE user_id=:user_id AND name=:name`,
    {
      ":user_id": user.id,
      ":name": name,
      ":last_seen_guid": last_seen_guid
    }
  );
};
