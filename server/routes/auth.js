const auth = require('../utils/auth');
const saml = require('../utils/saml');
const apps = require('../utils/apps');
const passport = require('passport');
const express = require('express');
const activation = require('../utils/activation');
const ldaphelper = require('../utils/ldaphelper');
const mail = require('../utils/mailhelper');
const Promise = require("bluebird");

const router = express.Router();

router.get('/api/ping', (req, res, next) => {
  res.send('pong');
})

router.post("/api/login", (req, res, next) => {
  passport.authenticate("ldapauth", (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(400).send({message: "Login fehlgeschlagen: Falscher Username oder falsches Passwort "});
    }
    ldaphelper.populateUserGroups(user, false)
      .then(user => {
        req.login(user, err => {
          if (err) {
            throw err;
          }
          if (req.body.requestId && req.body.appId) {
            const request  = saml.buildRequest(req.body.requestId);
            return apps.getApp(req.body.appId)
              .then(app => {
                return saml.createLoginResponse(req, app, request, 'post', user)
                  .then(response => res.send({user: user, redirect: saml.postHtmlBody(app, response)}))
              })
          } else {
            return res.send({user: user});
          }
        });
      })
      .catch(error => {
        next(error);
      })
  })(req, res, next);
});

router.get('/api/logout', (req, res) => {
  return saml.initiateLogoutFlow(req)
    .then(sloFlow => {
      if (sloFlow.queue.length === 0) {
        delete req.session.samlLogoutFlow;
        return auth.logout(req)
          .then(() => res.send({}))
      } else {
        return apps.getApp(sloFlow.queue[0])
          .then(app => saml.createLogoutRequest(req, app, 'redirect'))
          .then(url => res.send({redirect: url}))
      }
    })
});

// SEND PASSWORD RESET E-MAIL

router.post('/api/user/resetpassword', function(req, res, next) {
    ldaphelper.getByEmail(req.body.mail)
        .then(users => {
            if (users.length == 0) {
                throw "Kein*e Benutzer*in mit dieser E-Mail Adresse gefunden";
            } else if (users.length > 1) {
                throw "Mehrere Benutzer*innen mit dieser E-Mail Adresse gefunden";
            }
            return mail.sendPasswordResetEmail(users[0])
                .then(() => res.send({}))
                .catch(error => next('Fehler beim Senden der E-Mail: ' + error));
        })
        .catch(error => next('E-Mailadresse nicht gefunden: ' + error));
});

// UPDATE USER PASSWORD

router.post('/api/user/changepassword', auth.isLoggedIn, function(req, res, next) {
  if (req.body.dn && !req.user.isAdmin) {
    res.status(401).send('Das ist nicht erlaubt')
  } else {
    return ldaphelper.checkPassword(req.user.dn, req.body.currentPassword)
      .then(result => {
        if (!result) {
          return next('Falsches Passwort')
        } else {
          return ldaphelper.updatePassword(req.body.dn || req.user.dn, req.body.password)
            .then(res.send({}))
        }
      })
      .catch(next)
  }
});

// SET USER PASSWORD (AFTER RESET EMAIL)

router.post('/api/user/setpassword', function(req, res, next) {
  return activation.isTokenValid(req.body.token)
    .then(token => ldaphelper.updatePassword(token.data.dn, req.body.password))
    .then(res.send({}))
    .catch(next);
});

module.exports = router;
