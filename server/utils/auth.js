const passport = require("passport");
const config = require("../config/config.json");
const LdapStrategy = require("passport-ldapauth");

// passport config
passport.use(new LdapStrategy(config.ldap));

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

exports.isAuthorized = (user, app) => {
  if (app.groups && app.groups.length > 0) {
    return !!app.groups.find((group) => user.member.includes(group));
  } else {
    return true;
  }
};

exports.isLoggedIn = (req, res, next) => {
  // if user is authenticated in the session, carry on
  if (req.isAuthenticated()) {
    next();
  } else {
    res.status(401).send("Du bist nicht eingeloggt");
  }
};

exports.isLoggedInAdmin = function (req, res, next) {
  // if user is authenticated in the session, carry on
  if (req.isAuthenticated() && req.user.isAdmin) {
    next();
  } else {
    //  if they aren't redirect them to the home page
    req.session.returnTo = req.url;
    if (!req.isAuthenticated()) {
      res.status(401).send("Du bist nicht eingeloggt");
    } else {
      res.status(403).send("Das ist nicht erlaubt");
    }
  }
};

exports.isLoggedInGroupAdmin = function (req, res, next) {
  // if user is authenticated in the session, carry on
  if (req.isAuthenticated() && req.user.isGroupAdmin) {
    next();
  } else {
    //  if they aren't redirect them to the home page
    req.session.returnTo = req.url;
    if (!req.isAuthenticated()) {
      res.status(401).send("Du bist nicht eingeloggt");
    } else {
      res.status(403).send("Das ist nicht erlaubt");
    }
  }
};

exports.isLoggedInGroupAdminForGroup = function (container, field) {
  return function (req, res, next) {
    // if user is authenticated in the session, carry on
    if (
      req.isAuthenticated() &&
      (req.user.isAdmin ||
        (req.user.isGroupAdmin &&
          req.user.owner.includes(req[container][field])))
    ) {
      next();
    } else {
      //  if they aren't redirect them to the home page
      req.session.returnTo = req.url;
      if (!req.isAuthenticated()) {
        res.status(401).send("Du bist nicht eingeloggt");
      } else {
        res.status(403).send("Das ist nicht erlaubt");
      }
    }
  };
};

exports.isLoggedInMemberOfGroup = function (container, field) {
  return function (req, res, next) {
    // if user is authenticated in the session, carry on
    if (
      req.isAuthenticated() &&
      (req.user.isAdmin || req.user.member.includes(req[container][field]))
    ) {
      next();
    } else {
      //  if they aren't redirect them to the home page
      req.session.returnTo = req.url;
      if (!req.isAuthenticated()) {
        res.status(401).send("Du bist nicht eingeloggt");
      } else {
        res.status(403).send("Das ist nicht erlaubt");
      }
    }
  };
};

exports.logout = function (req) {
  return new Promise((resolve, reject) => {
    req.logout((err) => {
      if (err) {
        reject("Logout fehlgeschlagen: " + err);
      } else {
        resolve();
      }
    });
  });
};
