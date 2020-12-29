const express = require("express");
const path = require("path");
const flash = require("connect-flash");

exports.viewInit = function(app) {  
  app.use(express.static("public"));
  
  app.set("views", path.join(__dirname, "../views"));
  app.set("view engine", "pug");
  
  app.use(flash());
}