const passport = require('passport')
const config = require('../config/config.json')
const ldaphelper = require('./ldaphelper')

const SamlStrategy = require('passport-saml').Strategy
const LdapStrategy = require('passport-ldapauth');

// passport config
passport.use(new LdapStrategy(config.ldap));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
    if (user.isAdmin == undefined) {
        ldaphelper.fetchIsAdmin(user.dn)
            .then((isAdmin) => {
                user.isAdmin = isAdmin;
                ldaphelper.fetchOwnedGroups(user)
                    .then((groups) => {
                        user.ownedGroups = groups.owner.map((group) => { return group.dn;});
                        user.memberGroups = groups.member.map((group) => { return group.cn;});
                        if (user.isAdmin  || groups.owner.length > 0) {
                            user.isGroupAdmin = true;
                        } else {
                            user.isGroupAdmin = false;
                        }
                        done (null, user);
                    })
            })
            .catch((error) => {
                done(error);
            });
    } else {
        done(null, user);
    }
});

exports.isLoggedIn = (req, res, next) => {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated()) {
        next();
    } else {
        res.status(401).send('Du bist nicht eingeloggt')
    }
};

exports.isLoggedInAdmin = function(req, res, next) {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated() && req.user.isAdmin) {
        next();
    } else {
        //  if they aren't redirect them to the home page
        req.session.returnTo = req.url;
        if (!req.isAuthenticated()) {
            res.status(401).send('Du bist nicht eingeloggt')
        } else {
        	res.status(403).send('Das ist nicht erlaubt')
        }        
    }
};

exports.isLoggedInGroupAdmin = function(req, res, next) {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated() && req.user.isGroupAdmin) {
        next();
    } else {
        //  if they aren't redirect them to the home page
        req.session.returnTo = req.url;
        if (!req.isAuthenticated()) {
            res.status(401).send('Du bist nicht eingeloggt')
        } else {
            res.status(403).send('Das ist nicht erlaubt')
        }        
    }
};

exports.isLoggedInGroupAdminForGroup = function(container, field) {

  return function(req, res, next) {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated() && (req.user.isAdmin || req.user.isGroupAdmin && req.user.ownedGroups.includes(req[container][field]))) {
        next();
    } else {
        //  if they aren't redirect them to the home page
        req.session.returnTo = req.url;
        if (!req.isAuthenticated()) {
            res.status(401).send('Du bist nicht eingeloggt')
        } else {
            res.status(403).send('Das ist nicht erlaubt')
        }        
    }
  }
};

exports.logout = function(req) {
  return new Promise((resolve, reject) =>  {
    req.logout(err => {
      if (err) {
        reject('Logout fehlgeschlagen: ' + err)
      } else {
        resolve();
      }
    })
  })
}