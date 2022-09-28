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
    req.login(user, err => {
      ldaphelper.populateUserGroups(user, false)
        .then(user => {
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
        })
        .catch(error => {
          next(error);
        })
    });
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

//}

// LOST PASSWORD ROUTES
/*
router.get('/lostpasswd', function(req, res) {
    routing.render(req, res, 'user/lostpasswd', 'Passwort Vergessen');
});

router.get('/passwd/:uid/:token', function(req, res) {
    activation.isTokenValid(req.params.token)
        .then(token => {
            return ldaphelper.getByUID(req.params.uid)
                .then(user => routing.render(req, res, 'user/passwd', 'Passwort Ändern', {user: user, token: req.params.token}));
        })
        .catch(error => routing.errorPage(req,res,error));
});

router.post('/user/passwd', function(req, res) {
    var user = {
                    cn: false,
                    l: false,
                    ou: false,
                    mail: false,
                    description: false,
                    changedUid: false,
                    password: req.body.password,
                    passwordRepeat: req.body.passwordRepeat,
                    language: false,
                    member: false,
                    owner: false
                };
    activation.isTokenValid(req.body.token)
        .then(token => {
            user.dn = token.data.dn;
            user.uid = token.data.uid;
            return actions.user.modify(user, { ownedGroups : []})
                .then(response => {
                    if (response.status) {
                        return activation.deleteToken(req.body.token)
                            .then(() => {return response;});
                    } else {
                        return response;
                    }
                })
                .then(response => routing.checkResponseAndRedirect(req, res, response, 'Passwort geändert', 'Fehler beim Ändern des Passworts', '/redirect', '/passwd/' + req.body.uid + '/' + req.body.token));
            })
        .catch(error => routing.errorPage(req, res, 'Fehler beim Ändern des Passworts: ' + error));
});

router.post('/user/lostpasswd', function(req, res) {
    ldaphelper.getByEmail(req.body.mail)
        .then(users => {
            if (users.length == 0) {
                throw "Kein*e Benutzer*in mit dieser E-Mail Adresse gefunden";
            } else if (users.length > 1) {
                throw "Mehrere Benutzer*innen mit dieser E-Mail Adresse gefunden";
            }
            return mail.sendPasswordResetEmail(req, res, users[0])
                .then(info =>  routing.successRedirect(req, res, 'Link zum Ändern des Passworts wurde per E-Mail verschickt', '/lostpasswd'))
                .catch(error => routing.errorRedirect(req, res, 'Link zum Ändern des Passworts konnte nicht verschickt werden: ' + error, '/lostpasswd'));
        })
        .catch(error => routing.errorRedirect(req, res, 'E-Mailadresse nicht gefunden: ' + error, '/lostpasswd'));
});*/


module.exports = router;
