const express = require("express");
const logger = require("morgan");

const cors = require('cors')
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);

const { logInit } = require("./log");
const { passportInit } = require("./passport");
const { viewInit } = require("./views");

exports.initApp = function(app) {
  logInit(app);
  
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  app.use(cookieParser());
  if (process.env.SESSION_SECRET == null) {
    throw Error("Set a random string in .env for SESSION_SECRET");
  }
  app.use(
    session({
      store: new SQLiteStore({dir:'.data/'}),
      resave: true,
      saveUninitialized: true,
      secret: process.env.SESSION_SECRET,
      cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 } // 1 year
    })
  );

  passportInit(app);
  
  viewInit(app);
  
  return app;
}
