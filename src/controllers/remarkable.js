const express = require("express");
const router = express.Router();
exports.router = router;

const { Remarkable: RemarkableClient } = require("remarkable-typescript-dave");

const { getToken, storeToken, deleteToken, REMARKABLE } = require("../models/tokens");

async function getRemarkableClient(user) {
  const deviceToken = await getToken(user, REMARKABLE);
  const remarkClient = new RemarkableClient({ deviceToken: deviceToken });
  await remarkClient.refreshToken();
  return remarkClient;
};
exports.getRemarkableClient = getRemarkableClient;

router.get("/remarkable", async (req, res) => {
  var message;
  if (process.env.PREVENT_PUBLIC_EXPOSURE === true) {
    res.flash('message', "Connect is disabled on this instance - remix your own project");
  }
  var hasToken;
  try {
    hasToken = (await getToken(req.user, REMARKABLE) != null);
  } catch (err) {};

  res.render("connect/remarkable", { hasToken: hasToken });
});

router.post("/remarkable", async (req, res) => {
  if (process.env.PREVENT_PUBLIC_EXPOSURE === true) {
    res.redirect(req.originalUrl);
  }
  const code = req.body.code;

  const code_regex = /^[a-z]{8}$/;
  if (code == null || !code.match(code_regex)) {
    req.flash('message', "Code must be 8 letters only");
    res.redirect(req.originalUrl);
  }

  const client = new RemarkableClient();
  const deviceToken = await client.register({ code: code });

  await storeToken(req.user, REMARKABLE, deviceToken);

  req.flash("message", "Success!");
  res.redirect(req.originalUrl);
});

router.post("/remarkable/delete", async (req, res) => {
  await deleteToken(req.user, REMARKABLE);

  req.flash("message", "Token deleted");
  res.redirect("/connect/remarkable");
});

async function getAllItems(user) {
  if (user == null) throw Error("No user given");
  const remarkClient = await getRemarkableClient(user);
  return remarkClient.getAllItems();
}

exports.getFolderNameToId = async (user, name) => {
  const allItems = await getAllItems(user);
  for (const item of allItems) {
    if (item.Type == "CollectionType" && item.VissibleName == name) {
      return item.ID;
    }
  }
}

router.get("/items", async (req, res) => {
  const allItems = await getAllItems(req.user);
  res.header("Content-Type", "application/json");
  res.send(JSON.stringify(allItems, null, 2));
});
