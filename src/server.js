const express = require("express");

const { initApp } = require("./config");
const { badRequestHandlers } = require("./config/log");

const app = express();
initApp(app);

// Register routes
app.use(require("./controllers"));

// Add 404 and error handlers last
badRequestHandlers(app);

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
