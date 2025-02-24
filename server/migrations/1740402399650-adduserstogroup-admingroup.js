"use strict";

const { groupAdminCn } = require("../utils/constants");
const ldaphelper = require("../utils/ldaphelper");

module.exports.up = async function (next) {
  try {
    await ldaphelper.createGroup({
      cn: groupAdminCn,
      description: "Gruppe für alle Gruppenadmins (automatisch generiert)",
      o: "Gruppenadmins",
      member: [],
      owner: [],
    });
  } catch (error) {
    console.log("skipping group creation");
  }
  const users = await ldaphelper.fetchUsersWithGroups();
  for (const user of users) {
    if (
      user.owner.length > 0 &&
      !user.member.find(
        (memberDn) => memberDn === ldaphelper.groupCnToDn(groupAdminCn)
      )
    ) {
      await ldaphelper.addUserToGroups(user.dn, "member", [
        ldaphelper.groupCnToDn(groupAdminCn),
      ]);
    } else if (
      user.owner.length === 0 &&
      user.member.find(
        (memberDn) => memberDn === ldaphelper.groupCnToDn(groupAdminCn)
      )
    ) {
      await ldaphelper.removeUserFromGroups(user.dn, "member", [
        ldaphelper.groupCnToDn(groupAdminCn),
      ]);
    }
  }
};

module.exports.down = async function (next) {};
