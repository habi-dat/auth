const auth = require('../utils/auth');
const path = require('path');
const fs = require('fs');
const apps = require('../utils/apps');
const _ = require('lodash');
const express = require('express');
const Promise = require('bluebird');

const readdir = Promise.promisify(fs.readdir);

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

router.get("/api/app/icons", auth.isLoggedInAdmin, function(req, res, next) {
  var directoryPath = path.join(__dirname, '../data/public/img/icons');
  return readdir(directoryPath)
    .then(files => files.map(file => {return {name: file, url: '/img/icons/' + file}}))
    .then(icons => res.send({ icons: icons }))
    .catch(next);
})

router.get("/api/app/:id", auth.isLoggedInAdmin, function(req, res, next) {
  return apps.getApp(req.params.id)
    .then(app => res.send({app: app}))
    .catch(next);
})

router.post("/api/app/create", auth.isLoggedInAdmin, function(req, res, next) {
  return validateApp(_.pick(req.body, 'id', 'label', 'url', 'saml', 'groups', 'icon'))
    .then(apps.createApp)
    .then(app => res.send({app: app}))
    .catch(next);
})

router.post("/api/app/update", auth.isLoggedInAdmin, function(req, res, next) {
  return validateApp(_.pick(req.body, 'id', 'label', 'url', 'saml', 'groups', 'icon'))
    .then(apps.updateApp)
    .then(app => res.send({app: app}))
    .catch(next);
})

module.exports = router;