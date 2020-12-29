const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

const { findOneById, findOneByEmailPassword } = require("../models/user");

exports.passportInit = function(app) {
  app.use(passport.initialize()); 
  app.use(passport.session());
  
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email"
      },
      async (email, password, done) => {
        var user;
        try {
          user = await findOneByEmailPassword(email, password);
        } catch (err) {
          return done(err);
        }
        if (user == null) {
          return done(null, false, {
            message: "Unknown email or incorrect password"
          });
        }
        return done(null, user);
      }
    )
  );

  passport.serializeUser(function(user, done) {
    return done(null, user.id);
  });

  passport.deserializeUser(async (user_id, done) => {
    var user;
    try {
      user = await findOneById(user_id);
    } catch (err) {
      return done(err);
    }
    if (user === null) return done(null, false, { message: "User not found" });
    return done(null, user);
  });
}
