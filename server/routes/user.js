const auth = require("../utils/auth");
const ldaphelper = require("../utils/ldaphelper");
const discoursehelper = require("../utils/discoursehelper");
const activation = require("../utils/activation");
const mailhelper = require("../utils/mailhelper");
const config = require("../config/config.json");
const express = require("express");
const Promise = require("bluebird");

const router = express.Router();

const validateUser = async (user, member) => {
  return Promise.resolve().then(() => {
    var errors = [];
    if ("cn" in user) {
      if (!/^[A-Za-z0-9 ]{2,}[A-Za-z0-9]+$/.test(user.cn)) {
        errors.push("Anzeigename: mindestens 3 Zeichen, keine Sonderzeichen");
      }
    }

    if ("ou" in user) {
      if (!!!user.ou && member.length > 0) {
        errors.push("Zugehörigkeit: Bitte Zugehörigkeit auswählen");
      }
      if (!!user.ou && !member.includes(user.ou)) {
        errors.push("Zugehörigkeit: keine Berechtigungen für " + user.ou);
      }
    }

    if ("l" in user) {
      if (user.l == "") {
        errors.push("Ort: darf nicht leer sein");
      }
    }

    if ("preferredLanguage" in user) {
      if (!["de", "en"].includes(user.preferredLanguage || "de")) {
        errors.push("Sprache: erlaubte Werte: [de, en]");
      }
    }

    if ("uid" in user) {
      if (!/^[A-Za-z0-9_]{2,}[A-Za-z0-9]+$/.test(user.uid)) {
        errors.push(
          "User ID: mindestens 3 Zeichen, keine Sonderzeichen, keine Umlaute, keine Leerzeichen"
        );
      }
    }

    if ("mail" in user) {
      if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,20})+$/.test(user.mail)) {
        errors.push("E-Mailadresse: keine gültige E-Mailadresse");
      }
    }

    if ("userPassword" in user) {
      if (user.userPassword == "") {
        errors.push("Passwort: darf nicht leer sein");
      }
    }
    if (errors.length > 0) {
      throw { status: 400, message: errors.join("\n") };
    } else {
      return user;
    }
  });
};

const validateUserGroups = (member, owner, currentUser) => {
  return Promise.resolve().then(() => {
    if (!currentUser.isAdmin) {
      member.forEach((m) => {
        if (!currentUser.owner.includes(m)) {
          throw {
            status: 400,
            message: "Mitglied: keine Berechtigungen für Gruppe" + m,
          };
        }
      });
      owner.forEach((o) => {
        if (!currentUser.owner.includes(o)) {
          throw {
            status: 400,
            message: "Gruppenadmin: keine Berechtigungen für Gruppe" + o,
          };
        }
      });
    }
    return;
  });
};

const validateUid = (uid) => {
  return ldaphelper.getByUID(uid).then((user) => {
    if (user) {
      throw {
        status: 400,
        message: "User ID: " + uid + " ist bereits vergeben",
      };
    }
    return;
  });
};

const validateCn = (cn, dn = undefined) => {
  return ldaphelper.getByCN(cn).then((user) => {
    if (user && (!dn || user.dn !== user.dn)) {
      throw {
        status: 400,
        message: "Anzeigename: " + cn + " ist bereits vergeben",
      };
    }
    return;
  });
};

const validateEmail = (mail, dn = undefined) => {
  if (!mail) {
    return Promise.reject({
      status: 400,
      message: "Keine E-Mailadresse angegeben",
    });
  } else {
    return ldaphelper.getByEmail(mail).then((users) => {
      if (dn) {
        users = users.filter((user) => {
          return user.dn !== dn;
        });
      }
      if (users.length > 0) {
        throw {
          status: 400,
          message:
            "Benutzer*in mit E-Mailadresse " +
            mail +
            " existiert bereits: " +
            users
              .map((user) => {
                return user.cn;
              })
              .join(", "),
        };
      } else {
        return;
      }
    });
  }
};

// UPDATE USER PROFILE (SELF)

router.post("/api/user/profile", auth.isLoggedIn, function (req, res, next) {
  var user = {
    cn: req.body.cn,
    ou: req.body.ou,
    l: req.body.l,
    preferredLanguage: req.body.preferredLanguage,
  };

  return validateUser(user, req.user.member)
    .then(() => validateCn(user.cn, req.user.dn))
    .then(() => ldaphelper.populateUserTitle(user))
    .then((user) => ldaphelper.updateUser(req.user.dn, user))
    .then((user) => ldaphelper.populateUserGroups(user, true, true))
    .then(discoursehelper.syncUser)
    .then((user) => res.send({ user: user }))
    .catch(next);
});

// CREATE USER

router.post(
  "/api/user/create",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    var user = {
      cn: req.body.cn,
      uid: req.body.uid,
      ou: req.body.ou,
      l: req.body.l,
      sn: "none",
      givenName: "none",
      mail: req.body.mail,
      preferredLanguage: req.body.preferredLanguage,
      description:
        req.body.description || config.nextcloud.defaultQuota || "1 GB",
      userPassword: req.body.password,
    };
    return validateUser(user, req.body.member)
      .then(() => validateEmail(user.mail))
      .then(() => validateUid(user.uid))
      .then(() => validateCn(user.cn))
      .then(() => validateUserGroups(req.body.member, req.body.owner, req.user))
      .then(() => ldaphelper.populateUserTitle(user))
      .then(ldaphelper.createUser)
      .then((user) => {
        return ldaphelper
          .addUserToGroups(user.dn, "member", req.body.member)
          .then(() =>
            ldaphelper.addUserToGroups(user.dn, "owner", req.body.owner)
          )
          .then(() => ldaphelper.populateUserGroups(user, true, true));
      })
      .then(discoursehelper.syncUser)
      .then((user) => res.send({ user: user }))
      .catch(next);
  }
);

// CREATE USER

router.post("/api/user/acceptinvite/:token", function (req, res, next) {
  var user = {
    cn: req.body.cn,
    uid: req.body.uid,
    ou: req.body.ou,
    l: req.body.l,
    sn: "none",
    givenName: "none",
    preferredLanguage: req.body.preferredLanguage,
    description: config.nextcloud.defaultQuota || "1 GB",
    userPassword: req.body.password,
  };
  var member = [];
  var owner = [];
  return activation
    .isTokenValid(req.params.token)
    .then((token) => {
      user.mail = token.data.mail;
      member = token.data.member;
      owner = token.data.owner;
    })
    .then(() => validateUser(user, member))
    .then(() => validateEmail(user.mail))
    .then(() => validateUid(user.uid))
    .then(() => validateCn(user.cn))
    .then(() => ldaphelper.populateUserTitle(user))
    .then(ldaphelper.createUser)
    .then((user) => {
      return ldaphelper
        .addUserToGroups(user.dn, "member", member)
        .then(() => ldaphelper.addUserToGroups(user.dn, "owner", owner))
        .then(() => ldaphelper.populateUserGroups(user, true, true));
    })
    .then(discoursehelper.syncUser)
    .then(() => activation.deleteToken(req.params.token))
    .then(() => res.send({}))
    .catch(next);
});

// UPDATE USER

router.post(
  "/api/user/update",
  auth.isLoggedInAdmin,
  function (req, res, next) {
    var user = {
      cn: req.body.cn,
      ou: req.body.ou ? req.body.ou : "",
      l: req.body.l,
      sn: "none",
      givenName: "none",
      mail: req.body.mail,
      preferredLanguage: req.body.preferredLanguage,
      description:
        req.body.description || config.nextcloud.defaultQuota || "1 GB",
    };
    return validateUser(user, req.body.member)
      .then(() => validateEmail(user.mail, req.body.dn))
      .then(() => validateCn(user.cn, req.body.dn))
      .then(() => validateUserGroups(req.body.member, req.body.owner, req.user))
      .then(() => ldaphelper.populateUserTitle(user))
      .then((user) => ldaphelper.updateUser(req.body.dn, user))
      .then((user) => ldaphelper.populateUserGroups(user, false, true))
      .then((user) => {
        return ldaphelper
          .syncUserGroups(
            user.dn,
            "member",
            user.member,
            req.body.member,
            req.user
          )
          .then(() =>
            ldaphelper.syncUserGroups(
              user.dn,
              "owner",
              user.owner,
              req.body.owner,
              req.user
            )
          )
          .then(() => ldaphelper.fetchUser(user.dn, true, true));
      })
      .then(discoursehelper.syncUser)
      .then((user) => res.send({ user: user }))
      .catch(next);
  }
);

// UPDATE USER

router.post(
  "/api/user/updategroups",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    var user = {
      dn: req.body.dn,
      ou: req.body.ou,
    };
    return validateUserGroups(req.body.member, req.body.owner, req.user)
      .then(() => ldaphelper.populateUserTitle(user))
      .then((user) => ldaphelper.updateUser(req.body.dn, user))
      .then((user) => ldaphelper.populateUserGroups(user, false, true))
      .then((user) => {
        return ldaphelper
          .syncUserGroups(
            user.dn,
            "member",
            user.member,
            req.body.member,
            req.user
          )
          .then(() =>
            ldaphelper.syncUserGroups(
              user.dn,
              "owner",
              user.owner,
              req.body.owner,
              req.user
            )
          )
          .then(() => ldaphelper.fetchUser(user.dn, true, true));
      })
      .then(discoursehelper.syncUser)
      .then((user) => res.send({ user: user }))
      .catch(next);
  }
);

// DELETE USER

router.delete(
  "/api/user/delete/:dn",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    return ldaphelper
      .fetchUser(req.params.dn, false, true)
      .then((user) => {
        if (!req.user.isAdmin) {
          var notOwnedGroups = user.memberGroups
            .filter((memberGroup) => {
              return !req.user.owner.includes(memberGroup.dn);
            })
            .map((g) => g.o);
          if (notOwnedGroups.length > 0) {
            throw {
              status: 400,
              message:
                "Benutzer*in ist Mitglied in anderen von dir nicht verwalteten Gruppen (" +
                notOwnedGroups.join(", ") +
                "). Falls der Account auch für diese Gruppen gesperrt werden soll, kontaktiere bitte die Gruppenadmin@s der anderen Gruppen. Alternativ zur Löschung kannst du die Gruppenrechte für deine Gruppen entziehen",
            };
          }
        }
        return ldaphelper
          .removeUserFromGroups(user.dn, "member", user.member)
          .then(() =>
            ldaphelper.removeUserFromGroups(user.dn, "owner", user.owner)
          )
          .then(() => ldaphelper.remove(user.dn))
          .then(() => {
            return discoursehelper
              .deleteOrSuspendUser(user.uid)
              .catch((error) => {
                throw {
                  status: 400,
                  message:
                    "Discourse user konnte nicht gelöscht werden, bitte kontaktiere den*die Systemadmin@: " +
                    error,
                };
              });
          })
          .then((result) => {
            var status = "success";
            var text = "Account " + user.cn + " gelöscht.";
            if (result.notFound) {
              status = "notFound";
              text +=
                " Discourse account wurde nicht gefunden, Schritt wurde übersprungen.";
            } else if (result.suspended) {
              status = "suspended";
              text +=
                " Discourse account konnte nicht gelöscht werden und wurde stattdessen deaktiviert.";
            }
            res.send({ status: status, message: text });
          });
      })
      .catch(next);
  }
);

// INVITE VALIDATIONS

const isAuthorizedForInvite = function (tokenId, user) {
  return activation.getToken(tokenId).then((token) => {
    if (!user.isAdmin) {
      // if token is by other user check if token groups are within users admin groups
      if (
        token.currentUser &&
        token.currentUser.dn !== user.dn &&
        token.data.member
      ) {
        var notAuthorizedGroups = [];
        []
          .concat(token.data.owner)
          .concat(token.data.member)
          .forEach((group) => {
            if (!user.owner.includes(group)) {
              notAuthorizedGroups.push(group);
            }
          });
        if (notAuthorizedGroups.length > 0) {
          throw {
            status: 400,
            message:
              "Keine Berechtigungen für die Einladung an " +
              token.data.mail +
              ". Du hast nur Berechtigungen für Einladungen zu deinen Gruppen",
          };
        }
      }
    } else {
      return token;
    }
  });
};

// GET INVITES

router.get(
  "/api/user/invites",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    Promise.join(
      activation.getInvites(),
      ldaphelper.fetchGroups(req.user.owner),
      (invites, groups) => {
        if (req.user.isGroupAdmin && !req.user.isAdmin) {
          invites = invites.filter((invite) => {
            return (
              (invite.currentUser && invite.currentUser.dn === req.user.dn) ||
              invite.data.owner.some((ownr) => req.user.owner.includes(ownr)) ||
              invite.data.member.some((membr) => req.user.owner.includes(membr))
            );
          });
        }
        return res.send({ invites: invites });
      }
    ).catch(next);
  }
);

// SEND INVITE

router.post(
  "/api/user/invite",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    var member = [],
      owner = [];
    return validateEmail(req.body.email)
      .then(() => {
        // filter duplicates
        member = [...new Set(req.body.member)];
        owner = [...new Set(req.body.owner)];
        // when user is group admin check if he/she is group admin of all given groups
        if (!req.user.isAdmin) {
          member.forEach((group) => {
            if (!req.user.owner.includes(group)) {
              throw {
                status: 400,
                message: "Keine Berechtigungen für Gruppe " + group,
              };
            }
          });
          owner.forEach((group) => {
            if (!req.user.owner.includes(group)) {
              throw {
                status: 400,
                message: "Keine Berechtigungen für Gruppe " + group,
              };
            }
          });
        }
        return;
      })
      .then(() => {
        // refresh or create token and send email
        return activation
          .getTokenByData(req.body.email.toLowerCase(), "mail", "invite")
          .then((token) => {
            if (token) {
              throw {
                status: 400,
                message:
                  "Eine Einladung an " +
                  req.body.email +
                  " wurde bereits von " +
                  token.currentUser.cn +
                  " versendet. Du kannst die E-Mail unter Einladungen erneut senden.",
              };
            } else {
              return activation.createAndSaveToken(
                req.user,
                {
                  mail: req.body.email.toLowerCase(),
                  member: member,
                  owner: owner,
                },
                7 * 24,
                "invite"
              );
            }
          })
          .then((token) => mailhelper.sendActivationEmail(token));
      })
      .then(() => {
        res.send({ success: true });
      })
      .catch(next);
  }
);

router.get("/api/user/invite/:token", function (req, res, next) {
  activation
    .isTokenValid(req.params.token)
    .then((token) => {
      return ldaphelper.fetchGroups(token.data.member).then((groups) => {
        res.send({
          valid: true,
          user: {
            mail: token.data.mail,
            member: token.data.member,
            memberGroups: groups,
            owner: [],
            ownerGroups: [],
          },
        });
      });
    })
    .catch((error) => res.send({ valid: false }));
});

// DELETE INVITATION
router.delete(
  "/api/user/invites/delete",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    return Promise.map(req.body.tokens, (token) =>
      isAuthorizedForInvite(token, req.user)
    )
      .then(() => {
        return Promise.map(req.body.tokens, (token) =>
          activation.deleteToken(token)
        ).then(() => res.send({ success: true }));
      })
      .catch(next);
  }
);

// REFRESH INVITATION
router.put(
  "/api/user/invites/repeat",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    return Promise.map(req.body.tokens, (token) =>
      isAuthorizedForInvite(token, req.user)
    )
      .then(() => {
        return Promise.map(req.body.tokens, (token) => {
          return activation
            .refreshToken(req.user, token, 7 * 24)
            .then((token) => mailhelper.sendActivationEmail(token))
            .then((mailResponse) => {
              return token;
            });
        }).then((updatedData) => {
          res.send({ invites: updatedData });
        });
      })
      .catch(next);
  }
);

// GET USERS

router.get("/api/users", auth.isLoggedInGroupAdmin, function (req, res, next) {
  return ldaphelper
    .fetchUsersWithGroups()
    .then((users) => {
      res.send({ users: users });
    })
    .catch(next);
});

// GET USER

router.get(
  "/api/user/:dn",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    return ldaphelper
      .fetchUser(req.params.dn, false, true)
      .then((user) => {
        res.send({ user: user });
      })
      .catch(next);
  }
);

// ENDPOINTS TO CHECK USER NAME AND EMAIL AVAILABILITY

router.get("/api/user/available/cn/:cn/:token", function (req, res, next) {
  activation
    .isTokenValid(req.params.token)
    .then((token) => ldaphelper.getByCN(req.params.cn))
    .then((user) => {
      if (user) {
        res.send({ available: false });
      } else {
        res.send({ available: true });
      }
    })
    .catch(next);
});

router.get(
  "/api/user/available/cn/:cn",
  auth.isLoggedIn,
  function (req, res, next) {
    ldaphelper
      .getByCN(req.params.cn)
      .then((user) => {
        if (user) {
          res.send({ available: false });
        } else {
          res.send({ available: true });
        }
      })
      .catch(next);
  }
);

router.get(
  "/api/user/available/uid/:uid",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    ldaphelper
      .getByUID(req.params.uid)
      .then((user) => {
        if (user) {
          res.send({ available: false });
        } else {
          res.send({ available: true });
        }
      })
      .catch(next);
  }
);

router.get("/api/user/available/uid/:uid/:token", function (req, res, next) {
  activation
    .isTokenValid(req.params.token)
    .then((token) => ldaphelper.getByUID(req.params.uid))
    .then((user) => {
      if (user) {
        res.send({ available: false });
      } else {
        res.send({ available: true });
      }
    })
    .catch(next);
});

router.get(
  "/api/user/available/mail/:mail",
  auth.isLoggedInGroupAdmin,
  function (req, res, next) {
    ldaphelper
      .getByEmail(req.params.mail)
      .then((user) => {
        if (user && user.length > 0) {
          res.send({ available: false });
        } else {
          res.send({ available: true });
        }
      })
      .catch(next);
  }
);

router.get("/api/user/available/mail/:mail/:token", function (req, res, next) {
  activation
    .isTokenValid(req.params.token)
    .then((token) => ldaphelper.getByEmail(req.params.mail))
    .then((user) => {
      if (user && user.length > 0) {
        res.send({ available: false });
      } else {
        res.send({ available: true });
      }
    })
    .catch(next);
});

module.exports = router;
