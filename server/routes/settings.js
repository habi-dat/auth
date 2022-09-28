const config      = require('../config/config.json');
const settings    = require('../utils/settings');
const express = require('express');
const Promise = require("bluebird");

const router = express.Router();

module.exports = router;

router.get("/api/config",  (req, res, next) => {
  return settings.getSettings()
    .then(settings => {
      res.send({
          config: {
              saml: config.saml.enabled,
              title: config.settings.general.title || settings.title,
              authenticated: req.isAuthenticated(),
              settings: settings || { theme: {}}
          },
          user: req.user
      })
    })
    .catch(next)
})

router.get("/api/settings",  (req, res, next) => {
  return settings.getSettings()
    .then(settings => {
      res.send({ settings: settings})
    })
    .catch(next)
})

router.post('/api/settings', (req, res, next) => {
  const post = {
    title: req.body.title !== config.settings.general.title?req.body.title:undefined,
    customTheme: req.body.customTheme,
    theme: {
      primary: req.body.theme.primary,
      secondary: req.body.theme.secondary,
      accent: req.body.theme.accent,
      success: req.body.theme.success,
      warning: req.body.theme.warning,
      error: req.body.theme.error,
      info: req.body.theme.info
    }
  }
  return settings.saveSettings(post)
    .then(settings => {
      res.send({settings: settings});
    })
    .catch(next);
})
