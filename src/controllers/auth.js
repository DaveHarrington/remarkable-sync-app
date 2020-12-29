const passport = require('passport');
const user = require("../models/user");

const express = require("express"),
  router = express.Router();
exports.router = router;

const { register, ROLE_ADMIN } = require("../models/user");

router.get("/signup", function(req, res) {
  res.render("auth/signup", {});
});

router.post("/signup", async (req, res, next) => {
  console.log("registering user");
  console.log(req.body);
  if (req.body.email == null) {
    throw "Missing email";
  }
  if (req.body.password == null) {
    throw "Missing password";
  } 
  console.log(req.body);
  
  var user;
  try {
    user = await user.register(req.body.email, req.body.password);
    console.log(`Registered new user: ${user.id}`);
  } catch (err) {
    console.error("Could not register user!", err);
    return next(err);
  }
  console.log(`Registered new user: ${user.id}`);
  try {
    req.login(user)    
  } catch (err) {
    console.error(err);
    return next(err);
  }
  return res.redirect('/');
});

router.get("/login", function(req, res) {
  res.render("auth/login", { user: req.user, message: req.flash("error") });
});

router.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true
  }),
  function(req, res) {
    res.redirect("/");
  }
);

router.get("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

var requiresLoggedIn = function() {
  return [
    function(req, res, next) {
      if (req.user) next();
      else res.redirect("/login");
    }
  ];
};

var requiresAdmin = function() {
  return [
    function(req, res, next) {
      if (req.user && req.user.role == ROLE_ADMIN ) next();
      else res.status(401).send("Unauthorized");
    }
  ];
};

exports.requiresLoggedIn = requiresLoggedIn;
exports.requiresAdmin = requiresAdmin;