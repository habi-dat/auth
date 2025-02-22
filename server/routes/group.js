const auth = require("../utils/auth");
const ldaphelper = require("../utils/ldaphelper");
const discoursehelper = require("../utils/discoursehelper");
const express = require("express");
const Promise = require("bluebird");
const { logAction } = require("../utils/audit");

const router = express.Router();

const validateGroup = async (group) => {
  return Promise.resolve().then(() => {
    var errors = [];
    if ("cn" in group) {
      if (!/^[A-Za-z0-9_-]{2,}[A-Za-z0-9]+$/.test(group.cn)) {
        errors.push(
          "Gruppen ID: mindestens 3 Zeichen, keine Sonderzeichen, keine Umlaute, keine Leerzeichen"
        );
      }
    }
    if (!/^.{3,}$/.test(group.o)) {
      errors.push("Anzeigename: mindestens 3 Zeichen");
    }

    if (group.description == "") {
      errors.push("Beschreibung: darf nicht leer sein");
    }

    if (errors.length > 0) {
      throw { status: 400, message: errors.join("\n") };
    } else {
      return group;
    }
  });
};

const validateCn = (cn, dn = undefined) => {
  ldaphelper
    .fetchObject(ldaphelper.groupCnToDn(cn))
    .then((group) => {
      if (group && (!dn || group.dn !== group.dn)) {
        throw {
          status: 400,
          message: "Gruppen ID: " + cn + " ist bereits vergeben",
        };
      }
      return;
    })
    .catch((error) => {
      return;
    });
};

router.get(
  "/api/group/:dn",
  auth.isLoggedInMemberOfGroup("params", "dn"),
  function (req, res, next) {
    return ldaphelper
      .fetchGroup(req.params.dn)
      .then((group) => res.send({ group: group }))
      .catch(next);
  }
);

router.get("/api/groups", auth.isLoggedIn, function (req, res, next) {
  return Promise.resolve()
    .then(() =>
      ldaphelper.fetchGroupTree(req.user.isAdmin ? "all" : req.user.member)
    )
    .then((groups) => {
      return res.send({ groups: groups });
    })
    .catch(next);
});

router.get(
  "/api/groups/list",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    return Promise.resolve()
      .then(() => {
        if (req.user.isAdmin) {
          return ldaphelper.fetchGroups("all");
        } else {
          return req.user.ownerGroups;
        }
      })
      .then((groups) => {
        return res.send({ groups: groups });
      })
      .catch(next);
  }
);

router.get(
  "/api/group/available/cn/:cn",
  auth.isLoggedInAdmin,
  function (req, res, next) {
    ldaphelper
      .fetchObject(ldaphelper.groupCnToDn(req.params.cn))
      .then((group) => {
        res.send({ available: false });
      })
      .catch((error) => {
        res.send({ available: true });
      });
  }
);

// CREATE GROUP

router.post(
  "/api/group/create",
  auth.isLoggedInAdmin,
  function (req, res, next) {
    var member = []
      .concat(req.body.member.concat(req.body.subGroups))
      .map((user) => {
        return user.dn;
      });
    var owner = req.body.owner.map((user) => {
      return user.dn;
    });
    var parentGroups = req.body.parentGroups.map((group) => group.dn);

    var group = {
      cn: req.body.cn,
      o: req.body.o,
      description: req.body.description || "",
      member: member,
      owner: owner,
      parentGroups: parentGroups,
    };
    return validateGroup(group)
      .then(() => validateCn(group.cn))
      .then(() => ldaphelper.createGroup(group))
      .then(() =>
        discoursehelper.createGroup({
          ...group,
          member: req.body.member.map((user) => user.uid),
        })
      )
      .then(() =>
        logAction(
          req.user.dn,
          "CREATE",
          "GROUP",
          ldaphelper.groupCnToDn(group.cn),
          "",
          group
        )
      )
      .then(() => res.send({ success: true }))
      .catch(next);
  }
);

// UPDATE GROUP

router.post(
  "/api/group/update",
  auth.isLoggedInAdmin,
  async function (req, res, next) {
    try {
      var member = []
        .concat(req.body.member.concat(req.body.subGroups))
        .map((user) => user.dn);
      var owner = req.body.owner.map((user) => user.dn);
      var parentGroups = req.body.parentGroups.map((group) => group.dn);

      var group = {
        cn: req.body.cn,
        o: req.body.o,
        description: req.body.description,
        member: member,
        owner: owner,
        parentGroups: parentGroups,
      };

      await validateGroup(group);
      await validateCn(req.body.cn, req.body.dn);
      const oldGroup = await ldaphelper.fetchGroup(req.body.dn);
      await ldaphelper.updateGroup(req.body.dn, group);
      await logAction(
        req.user.dn,
        "UPDATE",
        "GROUP",
        group.dn,
        oldGroup,
        group
      );

      try {
        await discoursehelper.updateGroup(
          ldaphelper.dnToCn(req.body.dn),
          group
        );
        return res.send({
          status: "success",
          message: "Gruppe " + group.cn + " wurde geändert.",
        });
      } catch (error) {
        return res.send({
          status: "notFound",
          message:
            "Gruppe " +
            group.cn +
            " wurde gändert. Discourse Gruppe konnte nicht geändert werden: " +
            error,
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// UPDATE GROUP (GROUP ADMIN)

router.post(
  "/api/group/update/groupadmin",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    return ldaphelper
      .fetchGroup(req.body.dn)
      .then((oldGroup) => {
        var member = []
          .concat(req.body.member.concat(oldGroup.subGroups))
          .map((user) => user.dn);
        var owner = req.body.owner.map((user) => user.dn);
        var parentGroups = oldGroup.parentGroups.map((group) => group.dn);
        var group = {
          cn: oldGroup.cn,
          o: req.body.o,
          description: req.body.description,
          member: member,
          owner: owner,
          parentGroups: parentGroups,
        };
        return validateGroup(group)
          .then(() => validateCn(req.body.cn, req.body.dn))
          .then(() => ldaphelper.updateGroup(req.body.dn, group))
          .then(() =>
            logAction(req.user.dn, "UPDATE", "GROUP", group.dn, oldGroup, group)
          )
          .then(() =>
            discoursehelper
              .updateGroup(ldaphelper.dnToCn(req.body.dn), group)
              .then(() =>
                res.send({
                  status: "success",
                  message: "Gruppe " + group.cn + " wurde geändert.",
                })
              )
              .catch((error) =>
                res.send({
                  status: "notFound",
                  message:
                    "Gruppe " +
                    group.cn +
                    " wurde gändert. Discourse Gruppe konnte nicht geändert werden: " +
                    error,
                })
              )
          );
      })
      .catch(next);
  }
);

// DELETE GROUP

router.delete(
  "/api/group/:dn",
  auth.isLoggedInAdmin,
  function (req, res, next) {
    return ldaphelper
      .fetchGroup(req.params.dn)
      .then((group) => {
        return ldaphelper.remove(group.dn).then(() => {
          return logAction(req.user.dn, "DELETE", "GROUP", group.dn, group, "")
            .then(() => discoursehelper.deleteGroup(group))
            .then(() => {
              res.send({
                status: "success",
                message: "Gruppe " + group.cn + " wurde gelöscht.",
              });
            })
            .catch((error) => {
              res.send({
                status: "notFound",
                message:
                  "Gruppe " +
                  group.cn +
                  " wurde gelöscht. Discourse Gruppe konnte nicht gelöscht werden: " +
                  error,
              });
            });
        });
      })
      .catch(next);
  }
);

module.exports = router;
