const crypto = require("crypto");

const { openDb } = require("../config/db");

const TABLE = "users";

exports.ROLE_ADMIN = "admin";
exports.ROLE_USER = "user";
exports.ROLE_TEST = "test";

(async () => {
  const db = await openDb();
  await db.run(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL
    )`);
})().catch(err => console.error("users init ERROR: " + err));

exports.findOneByEmailPassword = async (email, password) => {
  const db = await openDb();

  var user = await db.get(`SELECT * FROM ${TABLE} WHERE email=:email`, {
    ":email": email
  });

  if (!user) return null;

  const password_hash = hashPassword(password, user.salt);
  if (password_hash === user.password_hash) return user;
  throw new Error("Wrong password");
};

async function findOneById(user_id) {
  const db = await openDb();
  return db.get(`SELECT id, email, role FROM ${TABLE} WHERE id=:id`, {
    ":id": user_id
  });
};
exports.findOneById = findOneById;

exports.register = async (email, password) => {
  const salt = crypto.randomBytes(128).toString("hex");
  const password_hash = hashPassword(password, salt);

  const db = await openDb();
  var info = await db.run(
    `
    INSERT INTO ${TABLE} (email, role, password_hash, salt)
     VALUES (:email, :role, :password_hash, :salt)
    `,
    {
      ":email": email,
      // FIXME: Obviously you want to change this if you have other users!
      ":role": exports.ROLE_ADMIN,
      ":password_hash": password_hash,
      ":salt": salt
    }
  );
  
  return await findOneById(info.lastID);
};

exports.setRole = async (user, role) => {
  const db = await openDb();
  return db.get(`UPDATE ${TABLE} SET role=:role WHERE id=:id`, {
    ":id": user.id,
    ":role": role
  });
};

exports.getAllUsers = async () => {
  const db = await openDb();
  return db.all(`SELECT id, email, role FROM ${TABLE}`);
};

function hashPassword(password, salt) {
  var hash = crypto.createHash("sha256");
  hash.update(password);
  hash.update(salt);
  return hash.digest("hex");
}

