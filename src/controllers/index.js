const express = require("express"),
  router = express.Router();
module.exports = router;

const { getAllUsers, setRole, ROLE_ADMIN } = require("../models/user");

// Index
router.get("/", function(req, res) {
  res.render("index", { user: req.user });
});

const {
  router: authRoutes,
  requiresAdmin,
  requiresLoggedIn
} = require("./auth.js");
router.use("/", authRoutes);

const { router: remarkableRouter } = require("./remarkable");
router.use("/connect", requiresLoggedIn(), remarkableRouter);

// Use basic auth
router.use("/save", require("./url").router)

const { router: googleRouter } = require("./google");
router.use("/google", requiresLoggedIn(), googleRouter);

router.use("/", requiresLoggedIn(), require("./rssfeeds").router);

router.use("/intern", requiresAdmin(), require("./intern"));

// Load job queues
const { reloadTriggers } = require("./cron");
const { startWorker } = require("./jobqueue");

(async () => {
    const users = await getAllUsers();
  for (const user of users) {
    await reloadTriggers(user);
  }
  await startWorker();
})().catch(err => {
  console.error("Failed to load cron queue ERROR: " + err);
  throw err;
});
