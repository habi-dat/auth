const ldap = require("ldapjs");
const ssha = require("openldap_ssha");
const config = require("../config/config.json").ldap;
const discourse = require("./discoursehelper");
const mail = require("./mailhelper");
const zxcvbn = require("./zxcvbn");
const Promise = require("bluebird");

var client = ldap.createClient({
  url: config.server.url,
});
client.bind(
  config.server.bindDn,
  config.server.bindCredentials,
  function (err) {
    if (err) {
      console.log("Error connecting LDAP: " + err);
    }
  }
);

const userAttributes = [
  "uid",
  "dn",
  "cn",
  "ou",
  "l",
  "mail",
  "preferredLanguage",
  "description",
  "title",
];
const groupAttributes = ["cn", "dn", "o", "owner", "description", "member"];

exports.remove = function (dn) {
  return new Promise((resolve, reject) => {
    client.del(dn, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

exports.add = function (dn, entry) {
  return new Promise((resolve, reject) => {
    client.add(dn, entry, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

exports.change = function (dn, operation, modification) {
  return new Promise((resolve, reject) => {
    var change = new ldap.Change({
      operation: operation,
      modification: modification,
    });
    //console.log('change', dn, operation, modification, change)
    client.modify(dn, change, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

exports.fetchObject = function (dn, attributes = undefined) {
  return new Promise((resolve, reject) => {
    var opts = {
      attributes,
    };

    var entries = [];

    client.search(dn, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        resolve(entry.object);
      });
      res.on("error", function (err) {
        reject("Error fetching object " + dn + ": " + err.message);
      });
      res.on("end", function (result) {
        reject("LDAP object not found: " + dn);
      });
    });
  });
};

exports.fetchObjectsByFilter = function (filter, base, attributes = undefined) {
  return new Promise((resolve, reject) => {
    var opts = {
      scope: "sub",
      filter: filter,
      attributes,
    };
    var entries = [];
    client.search(base, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        entries.push(entry.object);
      });
      res.on("error", function (err) {
        reject("Error fetching object " + dn + ": " + err.message);
      });
      res.on("end", function (result) {
        resolve(entries);
      });
    });
  });
};

exports.fetchUser = function (
  dn,
  parentGroups = true,
  fetchGroupDetails = false
) {
  return exports.fetchObject(dn, userAttributes).then((user) => {
    return exports.populateUserGroups(user, parentGroups, fetchGroupDetails);
  });
};

exports.populateParentGroups = function (user, groups) {
  return new Promise((resolve, reject) => {
    if (!user.member || user.member.length === 0) {
      resolve(user);
    }
    var filter = "(|";
    groups.forEach((group) => {
      filter += "(member=" + group + ")";
    });
    filter += ")";
    var opts = {
      scope: "sub",
      filter: filter,
      attributes: groupAttributes,
    };

    var entries = [],
      newParentGroups = [];

    client.search("ou=groups," + config.server.base, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        entries.push(entry.object);
      });
      res.on("error", function (err) {
        reject("Error populating parent groups: " + err.message);
      });
      res.on("end", function (result) {
        entries.forEach((group) => {
          if (!user.member.includes(group.dn)) {
            user.member.push(group.dn);
            newParentGroups.push(group.dn);
          }
        });
        if (newParentGroups.length > 0) {
          resolve(exports.populateParentGroups(user, newParentGroups));
        } else {
          resolve(user);
        }
      });
    });
  });
};

exports.populateUserGroups = function (
  user,
  parentGroups = true,
  fetchGroupDetails = false
) {
  return new Promise((resolve, reject) => {
    var opts = {
      scope: "sub",
      filter: new ldap.OrFilter({
        filters: [
          new ldap.EqualityFilter({ attribute: "member", value: user.dn }),
          new ldap.EqualityFilter({ attribute: "owner", value: user.dn }),
        ],
      }),
      attributes: groupAttributes,
    };
    var entries = [];

    client.search("ou=groups," + config.server.base, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        entries.push(entry.object);
      });
      res.on("error", function (err) {
        reject("Error populating user groups: " + err.message);
      });
      res.on("end", function (result) {
        user.member = [];
        user.owner = [];
        if (fetchGroupDetails) {
          user.memberGroups = [];
          user.ownerGroups = [];
        }
        entries.forEach((group) => {
          group.member = exports.ldapAttributeToArray(group.member);
          group.owner = exports.ldapAttributeToArray(group.owner);
          if (group.owner && group.owner.includes(user.dn.toString())) {
            user.owner.push(group.dn);
            if (fetchGroupDetails) user.ownerGroups.push(group);
          }
          console.log(group.member, user.dn);
          if (group.member && group.member.includes(user.dn.toString())) {
            user.member.push(group.dn);
            if (fetchGroupDetails) user.memberGroups.push(group);
          }
        });
        if (user.member.includes("cn=admin,ou=groups," + config.server.base)) {
          user.isAdmin = true;
          user.isGroupAdmin = true;
        } else if (user.owner.length > 0) {
          user.isGroupAdmin = true;
        }
        if (parentGroups) {
          resolve(exports.populateParentGroups(user, user.member));
        } else {
          resolve(user);
        }
      });
    });
  });
};

exports.populateUserTitle = function (user) {
  return Promise.resolve().then(() => {
    if (!!user.ou) {
      return exports.fetchObject(user.ou, ["o"]).then((group) => {
        user.title = group.o;
        return user;
      });
    } else {
      user.ou = undefined;
      user.title = undefined;
      return user;
    }
  });
};

exports.fetchUsers = function (userDns = undefined) {
  return new Promise((resolve, reject) => {
    var opts = {
      scope: "sub",
      attributes: userAttributes,
    };

    var entries = [];

    client.search("ou=users," + config.server.base, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        if (
          entry.object.cn &&
          (!userDns || userDns.includes(entry.object.dn))
        ) {
          entries.push(entry.object);
        }
      });
      res.on("error", function (err) {
        reject("Error fetching users: " + err.message);
      });
      res.on("end", function (result) {
        entries.filterByDns = function (userDns, inverse = false) {
          return this.filter((user) => {
            if (inverse) {
              return !userDns.includes(user.dn);
            } else {
              return userDns.includes(user.dn);
            }
          });
        };
        entries.findByDn = function (dn) {
          return this.find((user) => {
            return user.dn === dn;
          });
        };
        resolve(entries);
      });
    });
  });
};

exports.fetchUsersWithGroups = function () {
  return exports.fetchGroups("all").then((groups) => {
    return exports.fetchUsers().then((users) => {
      users.forEach((user) => {
        user.member = [];
        user.owner = [];
        // user.memberGroups = [];
        // user.ownerGroups = [];
      });
      // populate Groups
      groups.forEach((group) => {
        group.member.forEach((member) => {
          var user = users.findByDn(member);
          if (user) {
            user.member.push(group.dn);
            // user.memberGroups.push(group)
          }
        });
        group.owner.forEach((owner) => {
          var user = users.findByDn(owner);
          if (user) {
            user.owner.push(group.dn);
            // user.ownerGroups.push(group)
          }
        });
      });
      return users;
    });
  });
};

var findGroup = function (dn) {
  return function (group) {
    return group.dn === dn;
  };
};

exports.fetchGroups = function (ownedGroups, noAdminGroups = false) {
  return new Promise((resolve, reject) => {
    var opts = {
      scope: "sub",
      attributes: groupAttributes,
    };

    var entries = [];

    client.search("ou=groups," + config.server.base, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        if (
          (!noAdminGroups || entry.object.cn !== "admin") &&
          ownedGroups &&
          (ownedGroups == "all" || ownedGroups.includes(entry.object.dn))
        ) {
          entries.push(entry.object);
        }
      });
      res.on("error", function (err) {
        reject("Error fetching groups: " + err.message);
      });
      res.on("end", function (result) {
        entries.sort(function (a, b) {
          if (a.cn) {
            return a.cn.localeCompare(b.cn);
          }
          return 0;
        });
        resolve(
          entries.map((group) => {
            group.member = exports.ldapAttributeToArray(group.member);
            group.owner = exports.ldapAttributeToArray(group.owner);
            group.parentGroups = [];
            return group;
          })
        );
      });
    });
  });
};

exports.fetchParentGroups = function (groupDn) {
  return exports.fetchObjectsByFilter(
    "(member=" + groupDn + ")",
    "ou=groups," + config.server.base,
    groupAttributes
  );
};

exports.fetchGroup = function (dn) {
  return exports.fetchObject(dn, groupAttributes).then((group) => {
    group.member = exports.ldapAttributeToArray(group.member);
    group.owner = exports.ldapAttributeToArray(group.owner);
    var subGroups = group.member.filter((member) => {
      return exports.isGroup(member);
    });
    var member = group.member.filter((member) => {
      return !exports.isGroup(member);
    });
    return Promise.join(
      exports.fetchGroups(subGroups),
      exports.fetchUsers(member),
      exports.fetchUsers(group.owner),
      exports.fetchParentGroups(group.dn),
      (subGroups, member, owner, parentGroups) => {
        group.subGroups = subGroups;
        group.member = member;
        group.owner = owner;
        group.parentGroups = parentGroups;
        return group;
      }
    );
  });
};

exports.isGroup = function (dn) {
  return dn.endsWith("ou=groups," + config.server.base);
};

exports.filterSubgroups = function (member) {
  return member.filter((dn) => {
    return exports.isGroup(dn);
  });
};

var populateSubGroups = function (
  parents,
  groups,
  group,
  originalGroup,
  depth
) {
  // copy parents
  var newParents = parents.join("@@").split("@@");
  // add current group to parents list
  newParents.push(group.dn);
  // iterate subgroups of group
  exports.filterSubgroups(group.member).forEach((dn) => {
    // find subgroup in grouplist
    var subGroup = groups.find(findGroup(dn));
    if (subGroup) {
      // add copy subgroup to current group's subgroups
      var subGroupCopy = {
        dn: subGroup.dn,
        cn: subGroup.cn,
        o: subGroup.o,
        description: subGroup.description,
        owner: subGroup.owner,
        member: subGroup.member,
        subGroups: [],
      };
      group.subGroups.push(subGroupCopy);

      // if subGroup is not already in parents list dive deeper
      if (!parents.includes(subGroup.dn)) {
        subGroup.isRoot = false;
        if (depth < 5 && subGroup.dn) {
          populateSubGroups(
            newParents,
            groups,
            subGroupCopy,
            subGroup,
            depth + 1
          );
        }
      } else {
        originalGroup.isRoot = true;
      }
    }
  });
};

var filterOwned = function (groups, ownedGroups) {
  var filteredGroups = [];
  groups.forEach((group) => {
    if (ownedGroups.includes(group.dn)) {
      filteredGroups.push(group);
    } else if (group.subGroups.length > 0) {
      group.subGroups = filterOwned(group.subGroups, ownedGroups);
      if (group.subGroups.length > 0) {
        filteredGroups.push(group);
      }
    }
  });
  return filteredGroups;
};

exports.fetchGroupTree = function (ownedGroups = "all") {
  return exports.fetchGroups("all").then((groups) => {
    groups.forEach((group) => {
      if (group.isRoot === undefined) {
        group.isRoot = true;
      }
      group.subGroups = [];
      populateSubGroups([], groups, group, group, 0);
    });
    var onlyRoot = groups.filter((group) => {
      return group.isRoot && group.cn;
    });
    if (ownedGroups !== "all") {
      onlyRoot = filterOwned(onlyRoot, ownedGroups);
    }
    return onlyRoot;
  });
};

exports.getByEmail = function (mail) {
  return new Promise((resolve, reject) => {
    var opts = {
      filter: "(mail=" + mail + "*)",
      scope: "sub",
      attributes: userAttributes,
    };

    var entries = [];

    client.search("ou=users," + config.server.base, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        if (
          entry.object.cn &&
          entry.object.mail &&
          entry.object.mail.toLowerCase() === mail.toLowerCase()
        )
          entries.push(entry.object);
      });
      res.on("error", function (err) {
        reject("Error fetching by e-mail: " + err.message);
      });
      res.on("end", function (result) {
        resolve(entries);
      });
    });
  });
};

exports.getByUID = function (uid) {
  return new Promise((resolve, reject) => {
    var opts = {
      filter: "(uid=" + uid + ")",
      scope: "sub",
      attributes: userAttributes,
    };

    var entries = [];

    client.search("ou=users," + config.server.base, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        entries.push(entry.object);
      });
      res.on("error", function (err) {
        reject("Error fetching user by UID " + uid + ": " + err.message);
      });
      res.on("end", function (result) {
        if (entries.length == 0) {
          resolve(null);
        } else if (entries.length > 1) {
          +reject("Mehrere Benutzer*innen mit UID " + uid + " gefunden");
        } else {
          resolve(entries[0]);
        }
      });
    });
  });
};

exports.getByCN = function (cn) {
  return new Promise((resolve, reject) => {
    var opts = {
      filter: "(cn=" + cn + ")",
      scope: "sub",
      attributes: userAttributes,
    };

    var entries = [];

    client.search("ou=users," + config.server.base, opts, function (err, res) {
      res.on("searchEntry", function (entry) {
        entries.push(entry.object);
      });
      res.on("error", function (err) {
        reject("Error fetching user by CN " + cn + ": " + err.message);
      });
      res.on("end", function (result) {
        if (entries.length == 0) {
          resolve(null);
        } else if (entries.length > 1) {
          +reject("Mehrere Benutzer*innen mit CN " + cn + " gefunden");
        } else {
          resolve(entries[0]);
        }
      });
    });
  });
};

exports.createUser = function (user) {
  return new Promise((resolve, reject) => {
    user.objectClass = [
      "inetOrgPerson",
      "posixAccount",
      "top",
      "organizationalPerson",
    ];
    user.gidNumber = 500;
    user.homeDirectory = "home/users/" + user.uid;
    user.uidNumber = Date.now();

    // filter out undefined attributes
    Object.keys(user).forEach(
      (key) => user[key] === undefined && delete user[key]
    );

    ssha.ssha_pass(user.userPassword, function (err, hash) {
      if (err) {
        reject("Fehler beim Passwortverschlüsseln: " + err);
      }
      user.userPassword = hash;
      client.add(exports.userCnToDn(user.cn), user, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(exports.fetchObject(exports.userCnToDn(user.cn)));
        }
      });
    });
  });
};

exports.updateUserOu = function (oldDN, newDN) {
  return exports
    .fetchObjectsByFilter(
      "(ou=" + oldDN + ")",
      "ou=users," + config.server.base
    )
    .then((users) => {
      return Promise.map(users, (user) => {
        return exports.change(user.dn, "replace", { ou: newDN });
      });
    });
};

exports.updateUserTitle = function (grouDn, o) {
  return exports
    .fetchObjectsByFilter(
      "(ou=" + grouDn + ")",
      "ou=users," + config.server.base
    )
    .then((users) => {
      return Promise.map(users, (user) => {
        return exports.change(user.dn, "replace", { title: o });
      });
    });
};

exports.updateDN = function (oldDN, newDN) {
  return new Promise((resolve, reject) => {
    client.modifyDN(oldDN, newDN, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  }).then(() => {
    if (exports.isGroup(oldDN)) {
      return exports.updateUserOu(oldDN, newDN);
    } else {
      return;
    }
  });
};

exports.updateUser = function (dn, user) {
  var steps = [];
  return exports
    .fetchUser(dn)
    .then((oldUser) => {
      if ("cn" in user) {
        user.dn = exports.userCnToDn(user.cn);
      }
      if ("cn" in user && oldUser.cn !== user.cn) {
        return exports.updateDN(dn, user.dn).then(() => {
          return oldUser;
        });
      } else {
        return oldUser;
      }
    })
    .then((oldUser) => {
      var updateKeys = Object.keys(user).filter((key) => {
        return (
          [
            "cn",
            "ou",
            "title",
            "l",
            "preferredLanguage",
            "description",
            "mail",
          ].includes(key) && user[key] !== undefined
        );
      });
      // delete attributes that are specified as undefined and exist in old user object
      var deleteKeys = Object.keys(user).filter((key) => {
        return user[key] === undefined && oldUser[key] !== undefined;
      });
      return Promise.map(updateKeys, (key) => {
        var modification = {};
        modification[key] = user[key];
        return exports.change(user.dn, "replace", modification);
      }).then(() => {
        return Promise.map(deleteKeys, (key) => {
          var modification = {};
          modification[key] = user[key];
          return exports.change(user.dn, "delete", modification);
        });
      });
    })
    .then(() => exports.fetchUser(user.dn));
};

exports.addUserToGroups = function (userDn, attribute, groupDns) {
  return Promise.map(groupDns, (groupDn) => {
    var parameters = {};
    parameters[attribute] = [userDn];
    return exports.change(groupDn, "add", parameters);
  });
};

exports.removeUserFromGroups = function (userDn, attribute, groupDns) {
  return Promise.map(groupDns, (groupDn) => {
    return exports.fetchObject(groupDn).then((group) => {
      var parameters = {};
      var newUsers = exports
        .ldapAttributeToArray(group[attribute])
        .filter((element) => {
          return element !== userDn;
        });
      if (newUsers.length === 0) {
        newUsers = "";
      }
      parameters[attribute] = newUsers;
      return exports.change(groupDn, "replace", parameters);
    });
  });
};

exports.syncUserGroups = function (
  userDn,
  attribute,
  oldGroupDns,
  newGroupDns,
  currentUser
) {
  return Promise.resolve().then(() => {
    // find groups where user needs to be removed (except current user is group admin and has no rights to remove)
    var removeGroupDns = oldGroupDns.filter((oldGroupDn) => {
      return (
        !newGroupDns.includes(oldGroupDn) &&
        (currentUser.isAdmin || currentUser.owner.includes(oldGroupDn))
      );
    });
    // find groups where user needs to be added (except current user is group admin and has no rights to add)
    var addGroupDns = newGroupDns.filter((newGroupDn) => {
      return (
        !oldGroupDns.includes(newGroupDn) &&
        (currentUser.isAdmin || currentUser.owner.includes(newGroupDn))
      );
    });
    return exports
      .addUserToGroups(userDn, attribute, addGroupDns)
      .then(() =>
        exports.removeUserFromGroups(userDn, attribute, removeGroupDns)
      );
  });
};

exports.createGroup = function (group) {
  return Promise.resolve().then(() => {
    var member = group.member;
    if (member.length === 0) {
      member = "";
    }
    var owner = group.owner;
    if (owner.length === 0) {
      owner = "";
    }
    var entry = {
      cn: group.cn,
      o: group.o,
      description: group.description,
      objectClass: ["groupOfNames", "top"],
      member: member,
      owner: owner,
    };
    return exports
      .add(exports.groupCnToDn(group.cn), entry)
      .then(() =>
        exports.syncParentGroups(
          exports.groupCnToDn(group.cn),
          group.parentGroups
        )
      );
  });
};

exports.syncParentGroups = function (dn, parentGroups) {
  return Promise.resolve().then(() => {
    if (!parentGroups) {
      return;
    } else {
      return exports.fetchParentGroups(dn).then((oldParentGroups) => {
        oldParentGroups = oldParentGroups.map((g) => g.dn);
        var addParents = parentGroups.filter(
          (dn) => !oldParentGroups.includes(dn)
        );
        var delParents = oldParentGroups.filter(
          (dn) => !parentGroups.includes(dn)
        );
        return exports
          .addUserToGroups(dn, "member", addParents)
          .then(() => exports.removeUserFromGroups(dn, "member", delParents));
      });
    }
  });
};

exports.updateGroup = function (dn, group) {
  var steps = [];
  return exports
    .fetchGroup(dn)
    .then((oldGroup) => {
      group.dn = exports.groupCnToDn(group.cn);
      if ("cn" in group && oldGroup.cn !== group.cn) {
        return exports
          .updateDN(dn, group.dn)
          .then(() => exports.updateUserOu(dn, group.dn))
          .then(() => oldGroup);
      } else {
        return oldGroup;
      }
    })
    .then((oldGroup) => {
      var updateKeys = Object.keys(group).filter((key) => {
        return (
          ["o", "description", "member", "owner"].includes(key) &&
          group[key] !== undefined
        );
      });
      if (group.member && group.member.length === 0) {
        group.member = "";
      }
      if (group.owner && group.owner.length === 0) {
        group.owner = "";
      }
      return Promise.map(updateKeys, (key) => {
        var modification = {};
        modification[key] = group[key];
        return exports.change(group.dn, "replace", modification);
      })
        .then(() => {
          if ("o" in group && oldGroup.o !== group.o) {
            return exports.updateUserTitle(group.dn, group.o);
          }
          return;
        })
        .then(() => exports.syncParentGroups(group.dn, group.parentGroups));
    })
    .then(() => exports.fetchGroup(group.dn));
};

var passwordValid = function (password) {
  // console.log("Passwort: " + password + " match: " +password.match('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*_=+-]).{8,30}$'));
  var result = zxcvbn(password);
  if (result.score <= 2) {
    return false;
  } else {
    return true;
  }
};

exports.ldapAttributeToArray = function (ldapAttribute) {
  if (ldapAttribute && ldapAttribute instanceof Array) {
    return ldapAttribute.slice().filter(function (e) {
      return e === 0 || e;
    }); // filter empty array elements
  } else if (ldapAttribute != null && ldapAttribute != "") {
    return [ldapAttribute];
  } else {
    return [];
  }
};

exports.dnToCn = function (dnObject) {
  const dn = dnObject.toString();
  if (dn && dn.includes(",") && dn.includes("=")) {
    return dn.split(",")[0].split("=")[1];
  } else {
    return;
  }
};

exports.userCnToDn = function (cn) {
  return `cn=${cn},ou=users,${config.server.base}`;
};

exports.groupCnToDn = function (cn) {
  return `cn=${cn},ou=groups,${config.server.base}`;
};

exports.dnToUid = function (dns) {
  return exports.fetchUsers().then((users) => {
    uids = [];
    dns.forEach((dn) => {
      var user = users.find((user) => {
        return user.dn.toLowerCase() === dn.toLowerCase();
      });
      if (user) {
        uids.push(user.uid);
      }
    });
    return uids;
  });
};

exports.hashPassword = function (password) {
  return new Promise((resolve, reject) => {
    ssha.ssha_pass(password, function (err, hash) {
      if (err) {
        reject("Fehler beim Passwortverschlüsseln: " + err);
      } else {
        resolve(hash);
      }
    });
  });
};

exports.checkPassword = function (dn, password) {
  return new Promise((resolve, reject) => {
    var clientCheck = ldap.createClient({
      url: config.server.url,
    });
    clientCheck.bind(dn, password, function (err) {
      if (err) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

exports.updatePassword = function (dn, userPassword) {
  return exports
    .hashPassword(userPassword)
    .then((hash) => exports.change(dn, "replace", { userPassword: hash }));
};
