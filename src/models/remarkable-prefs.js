const { openDb } = require("../config/db");

const TABLE = "remarkableprefs";

(async () => {
  const db = await openDb();
  await db.run(
    `
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          key TEXT,
          value_json TEXT,
          UNIQUE(user_id, key)
        )
      `
  );
})().catch(err => {
  console.error("remarkable prefs init ERROR: " + err);
  throw err;
});

exports.setPref = async (user_id, key, value) => {
  if (user_id == null) throw Error("No user_id given");
  const db = await openDb();

  await db.run(
      `INSERT OR REPLACE INTO ${TABLE} (user_id, key, value_json) VALUES (:user_id, :key, :value_json)`,
      {
        ":user_id": user_id,
        ":key": key,
        ":value_json": JSON.stringify(value)
      }
    );
};

exports.getPref = async (user_id, key) => {
  if (user_id == null) throw Error("No user_id given");
  const db = await openDb();
  const row = await db.get(
    `SELECT value_json FROM ${TABLE} WHERE user_id=:user_id AND key=:key`,
    {
      ":user_id": user_id,
      ":key": key
    }
  );
  if (row != null) {
    return JSON.parse(row.value_json);
  }
};

exports.getAllPrefs = async (user_id) => {
  if (user_id == null) throw Error("No user_id given");
  const db = await openDb();

  const rows = await db.all(
    `SELECT value_json FROM ${TABLE} WHERE user_id=:user_id`,
    {
      ":user_id": user_id,
    }
  );

  for (const row of rows) {
    row.value = JSON.parse(row.value_json);
  }

  return rows;
};
