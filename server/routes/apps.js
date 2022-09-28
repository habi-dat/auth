const auth = require('../utils/auth');
const apps = require('../utils/apps');
const _ = require('lodash');
const express = require('express');

const router = express.Router();


// APPS API

const validateApp= app => {
  return Promise.resolve()
    .then(() => {
      var errors = [];

      if (errors.length > 0) {
        throw {status: 400, message: errors.join("\n")};
      } else {
        return app;
      }
    })
}

router.get("/api/apps", auth.isLoggedInAdmin, function(req, res, next) {
  return apps.getApps()
    .then(apps => res.send({apps: apps}))
    .catch(next);
})

router.get("/api/app/:id", auth.isLoggedInAdmin, function(req, res, next) {
  return apps.getApp(req.params.id)
    .then(app => res.send({app: app}))
    .catch(next);
})

router.post("/api/app/create", auth.isLoggedInAdmin, function(req, res, next) {
  return validateApp(_.pick(req.body, 'id', 'label', 'url', 'saml', 'groups'))
    .then(apps.createApp)
    .then(app => res.send({app: app}))
    .catch(next);
})

router.post("/api/app/update", auth.isLoggedInAdmin, function(req, res, next) {
  return validateApp(_.pick(req.body, 'id', 'label', 'url', 'saml', 'groups'))
    .then(apps.updateApp)
    .then(app => res.send({app: app}))
    .catch(next);
})

module.exports = router;