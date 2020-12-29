const { openDb } = require("../config/db");

const TABLE = "tokens";

(async () => {
  const db = await openDb();
  await db.run(
    `
        CREATE TABLE IF NOT EXISTS ${TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          token_name TEXT,
          token_json TEXT,
          UNIQUE(user_id, token_name)
        )
      `
  );
})().catch(err => console.error('tokens init ERROR: ' + err));

exports.storeToken = async (user, token_name, token) => {
  if (user == null) throw Error("No user given");
  const db = await openDb();

  await db.run(`
    INSERT OR REPLACE INTO ${TABLE} (user_id, token_name, token_json)
    VALUES(:user_id, :token_name, :token_json)
  `,
    {
      ":user_id": user.id,
      ":token_name": token_name,
      ":token_json": JSON.stringify(token)
    }
  );
};

exports.getToken = async (user, token_name) => {
  if (user == null) throw Error("No user given");
  const db = await openDb();
  var row = await db.get(
    `SELECT token_json FROM ${TABLE} WHERE user_id=:user_id AND token_name=:token_name`,
    { ":user_id": user.id, ":token_name": token_name }
  );
  if (row == null) throw Error("Missing token! Try re-authenticating?");
  return JSON.parse(row.token_json);
};

exports.deleteToken = async (user, token_name) => {
  if (user == null) throw Error("No user given");
  const db = await openDb();
  await db.get(
    `DELETE FROM ${TABLE} WHERE user_id=:user_id AND token_name=:token_name`,
    { ":user_id": user.id, ":token_name": token_name }
  );
};

exports.REMARKABLE = "remarkable";
