const config = require("../config/config.json");
const settings = require("../utils/settings");
const mailhelper = require("../utils/mailhelper");
const auth = require("../utils/auth");
const express = require("express");
const Promise = require("bluebird");

const router = express.Router();

module.exports = router;

router.get("/api/config", (req, res, next) => {
  return settings
    .getSettings()
    .then((settings) => {
      res.send({
        config: {
          saml: config.saml.enabled,
          title: settings.title || config.settings.general.title,
          authenticated: req.isAuthenticated(),
          settings: settings || { theme: {} },
          groupIdDelimiter: settings.groupIdDelimiter,
        },
        user: req.user,
      });
    })
    .catch(next);
});

router.get("/api/settings", auth.isLoggedInAdmin, (req, res, next) => {
  return settings
    .getSettings()
    .then((settings) => {
      res.send({ settings: settings });
    })
    .catch(next);
});

router.post("/api/settings", auth.isLoggedInAdmin, (req, res, next) => {
  const post = {
    title:
      req.body.title !== config.settings.general.title
        ? req.body.title
        : undefined,
    entryUrl: req.body.entryUrl,
    customTheme: req.body.customTheme,
    groupIdDelimiter: req.body.groupIdDelimiter,
    theme: {
      primary: req.body.theme.primary,
      secondary: req.body.theme.secondary,
      accent: req.body.theme.accent,
      success: req.body.theme.success,
      warning: req.body.theme.warning,
      error: req.body.theme.error,
      info: req.body.theme.info,
    },
  };
  return settings
    .saveSettings(post)
    .then((settings) => {
      res.send({ settings: settings });
    })
    .catch(next);
});

// EDIT EMAIL TEMPLATES

router.get(
  "/api/email/templates",
  auth.isLoggedInAdmin,
  function (req, res, next) {
    Promise.join(
      mailhelper.getTemplate("invite"),
      mailhelper.getTemplate("passwordReset"),
      (inviteEmail, passwdEmail) =>
        res.send({
          templates: { invite: inviteEmail, passwordReset: passwdEmail },
        })
    ).catch(next);
  }
);

router.post(
  "/api/email/templates",
  auth.isLoggedInAdmin,
  function (req, res, next) {
    mailhelper
      .saveCustomTemplate(req.body.template, {
        activated: req.body.activated,
        subject: req.body.subject,
        body: req.body.body,
      })
      .then(() => res.send({}))
      .catch(next);
  }
);
