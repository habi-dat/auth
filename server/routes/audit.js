const auth = require("../utils/auth");
const audit = require("../utils/audit");
const express = require("express");
const { parse } = require("path");

const router = express.Router();

router.get("/api/audit", auth.isLoggedInAdmin, async function (req, res, next) {
  try {
    const duration = parseInt(req.query.duration ?? 1000 * 60 * 60 * 24 * 7);
    const records = await audit.getRecords(duration);
    res.send({ records });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
