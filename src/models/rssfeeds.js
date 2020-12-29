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
  const db = await openDb();
  const existing_rows = await getFeeds(user);
  const existing = existing_rows.map(x => x.name);
  for (const name of existing) {
    if (!(name in feeds_conf)) {
      db.run(`DELETE FROM ${TABLE} WHERE user_id=:user_id AND name=:name`, {
        ":user_id": user.id,
        ":name": name
      });
    }
  }

  for (const feed of feeds_conf) {
    await db.run(
      `INSERT OR REPLACE INTO ${TABLE} (user_id, name, url) VALUES (:user_id, :name, :url)`,
      {
        ":user_id": user.id,
        ":name": feed.name,
        ":url": feed.url
      }
    );
  }
};

const getFeeds = async user => {
  if (user == null) throw Error("No user given");
  const db = await openDb();
  const feeds = await db.all(
    `SELECT name, url FROM ${TABLE} WHERE user_id=:user_id`,
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
