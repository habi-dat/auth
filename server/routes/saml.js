const saml = require('../utils/saml');
const express = require('express');
const apps = require('../utils/apps');
const passport = require('passport');

const router = express.Router();


router.get('/sso/metadata', (req, res, next) => {
  res.header('Content-Type', 'text/xml').send(idp.getMetadata());
});

// endpoint for SP initiated SSO
router.get('/sso/login/:id', async (req, res, next) => {
  return apps.getApp(req.params.id)
    .then(app => {
      if (!app || !app.saml.samlEnabled) {
        throw "Keine SSO informationen für app " + req.params.id + " gefunden"
      }
      return saml.parseLoginRequest(req, app, 'redirect')
        .then(request => {
          if (req.isAuthenticated()) {
            return saml.createLoginResponse(req, app, request, 'post', req.user)
              .then(response => {
                return res.type('html').send(saml.postHtml(app, response))
              })
          } else {
            return saml.loginRedirect(req, app, request)
              .then(redirectURL => res.redirect(redirectURL))
          }
        })
    })
});

// endpoint for SP initiated SLO and SLO responses from SPs
router.get('/sso/logout/:id', async (req, res, next) => {
  return apps.getApp(req.params.id)
    .then(app => {
      if (!app || !app.saml.samlEnabled) {
        throw "Keine SSO informationen für app " + req.params.id + " gefunden"
      }
      if (req.query.SAMLResponse) {
        return saml.parseLogoutResponse(req, app, 'redirect')
          .then(redirectURL => res.redirect(redirectURL || '/'))
      } else if (req.query.SAMLRequest) {
        return saml.parseLogoutRequest(req, app, 'redirect')
          .then(redirectURL => res.redirect(redirectURL));
      } else {
        throw "Keine SSO Nachricht gefunden"
      }
    })
});


module.exports = router;