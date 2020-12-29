require("log-timestamp");
const logger = require("morgan");

exports.logInit = function(app) {
  app.use(logger("dev"));

  process.on("unhandledRejection", (reason, p) => {
    console.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    console.error(reason.stack);
  });
};

exports.badRequestHandlers = function(app) {
  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    const err = new Error("Not Found");
    err.status = 404;
    next(err);
  });

  // error handlers
  // development error handler - will print stacktrace
  if (app.get("env") === "development") {
    app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      res.render("error", {
        message: err.message,
        error: err
      });
    });
  } else {
    // production error handler - no stacktraces leaked to user
    app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      res.render("error", {
        message: err.message,
        error: {}
      });
    });
  }
};
