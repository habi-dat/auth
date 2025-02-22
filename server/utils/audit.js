const { PrismaClient } = require("@prisma/client");
const { omit } = require("lodash");
const ldaphelper = require("./ldaphelper");

const prismaClient = new PrismaClient();

const sanitizeArray = (arr) => {
  return Array.isArray(arr)
    ? arr.map((item) => {
        if (typeof item === "string") {
          return item;
        } else {
          return item.dn;
        }
      })
    : [];
};

const sanitize = (type, obj) => {
  if (type === "GROUP" && typeof obj !== "string") {
    console.log(obj);
    return {
      ...obj,
      member: sanitizeArray(obj.member),
      owner: sanitizeArray(obj.owner),
      subGroups: sanitizeArray(obj.subGroups),
      parentGroups: sanitizeArray(obj.parentGroups),
    };
  }
  if (type === "USER" && typeof obj !== "string") {
    return omit(obj, [
      "memberGroups",
      "ownerGroups",
      "isAdmin",
      "isGroupAdmin",
      "controls",
      "userPassword",
      "objectClass",
      "gidNumber",
      "homeDirectory",
      "uidNumber",
      "givenName",
      "sn",
    ]);
  }
  return obj;
};

exports.logAction = (
  userDn,
  action,
  referenceType,
  referenceDn,
  oldValue,
  newValue
) => {
  return prismaClient.audit
    .create({
      data: {
        userDn,
        action,
        referenceType,
        referenceDn,
        oldValue: JSON.stringify(sanitize(referenceType, oldValue)),
        newValue: JSON.stringify(sanitize(referenceType, newValue)),
      },
    })
    .then(() => newValue);
};

exports.getRecords = async (duration) => {
  const records = await prismaClient.audit.findMany({
    where: {
      ...(duration > 0 && {
        createdAt: {
          gte: new Date(Date.now() - duration),
        },
      }),
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return records.map((record) => {
    return {
      ...record,
      oldValue: record.oldValue !== "" ? JSON.parse(record.oldValue) : {},
      newValue: record.newValue !== "" ? JSON.parse(record.newValue) : {},
      user: [
        {
          dn: record.userDn,
          cn: ldaphelper.dnToCn(record.userDn),
        },
      ],
      text: `${record.action} ${record.referenceType} ${
        record.referenceType !== "INVITE"
          ? ldaphelper.dnToCn(record.referenceDn)
          : record.referenceDn
      }`,
    };
  });
};
