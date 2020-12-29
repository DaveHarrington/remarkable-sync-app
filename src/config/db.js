const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

exports.openDb = async function openDb() {
  return open({
    filename: "/app/.data/sqlite.db",
    driver: sqlite3.Database
  });
}