const passport = require("passport");
const User = require("../models/user");

const express = require("express"),
  router = express.Router();
exports.router = router;

const { register, ROLE_ADMIN } = require("../models/user");

router.get("/signup", function (req, res) {
  res.render("auth/signup", {});
});

router.post("/signup", async (req, res, next) => {
  console.log("registering user");

  if (req.body.email == null) {
    return next(new Error("Missing email"));
  }
  if (req.body.password == null) {
    return next(new Error("Missing password"));
  }
  
  if (req.body.password != req.body.confirm_password) {
    return next(new Error("Passwords don't match"));
  }

  try {
    await User.findOneByEmailPassword(req.body.email, "");
  } catch {
    console.log("User already exists");
    return next(new Error("User already exists"));
  }

  try {
    var user = await User.register(req.body.email, req.body.password);
  } catch (err) {
    console.error("Could not register user!", err);
    return next(err);
  }

  try {
    await req.login(user, function(err) {
      if (err) { return next(err); }
      return res.redirect("/");
    });
  } catch (err) {
    console.error(err);
    return next(err);
  }
  return res.redirect("/");
});

router.get("/login", function (req, res) {
  res.render("auth/login", { user: req.user, message: req.flash("error") });
});

router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  function (req, res) {
    res.redirect("/");
  }
);

router.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

var requiresLoggedIn = function () {
  return [
    function (req, res, next) {
      if (req.user) next();
      else res.redirect("/login");
    },
  ];
};

var requiresAdmin = function () {
  return [
    function (req, res, next) {
      if (req.user && (req.user.id == 1 || req.user.role == ROLE_ADMIN)) next();
      else res.status(401).send("Unauthorized");
    },
  ];
};

exports.requiresLoggedIn = requiresLoggedIn;
exports.requiresAdmin = requiresAdmin;

