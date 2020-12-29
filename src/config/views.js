const express = require("express");
const path = require("path");
const flash = require("connect-flash");

function forceHttps(req, res, next){
  // protocol check, if http, redirect to https
  
  if(req.get('X-Forwarded-Proto').indexOf("https") != -1){
    // console.log('is https');
    // console.log(req.get('X-Forwarded-Proto'));
    return next()
  } else {
    // console.log('redirect to https');
    res.redirect('https://' + req.hostname + req.url);
  }
}

exports.viewInit = function(app) {  
  app.all('*', forceHttps);
  app.use(express.static("public"));
  
  app.set("views", path.join(__dirname, "../views"));
  app.set("view engine", "pug");
  
  app.use(flash());
}