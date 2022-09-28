const auth = require('../utils/auth');
const ldaphelper = require('../utils/ldaphelper');
const discoursehelper = require('../utils/discoursehelper');
const express = require('express');
const Promise = require("bluebird");

const router = express.Router();

const validateGroup = async (group) => {
  return Promise.resolve()
    .then(() => {
      var errors = [];
      if ('cn' in group) {
        if (!(/^[A-Za-z0-9_-]{2,}[A-Za-z0-9]+$/.test(group.cn))) {
          errors.push('Gruppen ID: mindestens 3 Zeichen, keine Sonderzeichen, keine Umlaute, keine Leerzeichen');
        }
      }
      if ('o' in group) {
        if (!(/^.{3,}$/.test(group.o))) {
          errors.push('Anzeigename: mindestens 3 Zeichen');
        }
      }
      if ('description' in group) {
        if (group.description == '') {
          errors.push('Beschreibung: darf nicht leer sein');
        }
      }

      if (errors.length > 0) {
        throw {status: 400, message: errors.join("\n")};
      } else {
        return group;
      }
    })
}

const validateCn = (cn, dn = undefined) => {
  ldaphelper.fetchObject(ldaphelper.groupCnToDn(cn))
    .then(group => {
      if (group && (!dn || group.dn !== group.dn)) {
        throw {status: 400, message: "Gruppen ID: " + cn + ' ist bereits vergeben'};
      }
      return;
    })
    .catch(error => {return;});
}

router.get('/api/group/:dn', auth.isLoggedInGroupAdmin, function(req, res, next) {
  return ldaphelper.fetchGroup(req.params.dn)
    .then(group => res.send({group: group}))
    .catch(next)
})

router.get('/api/groups', auth.isLoggedInGroupAdmin, function(req, res, next) {
  return Promise.resolve()
    .then(() => {
      if (req.user.isAdmin) {
        return ldaphelper.fetchGroupTree()
      } else {
        return ldaphelper.fetchOwnedGroups(req.user)
          .then(groups => {
            return groups.owner;
          });
      }
    })
    .then(groups => {
      return res.send({groups: groups})
    })
    .catch(error => next);
})

router.get('/api/group/available/cn/:cn', auth.isLoggedInAdmin, function(req, res, next) {
    ldaphelper.fetchObject(ldaphelper.groupCnToDn(req.params.cn))
        .then(group => {
          res.send({available: false});
        })
        .catch(error => {
          res.send({available: true});
        });
});


// CREATE GROUP

router.post('/api/group/create', auth.isLoggedInAdmin, function(req, res, next) {
  var member = [].concat(req.body.member.concat(req.body.subGroups)).map(user => {return user.dn});
  var owner = req.body.owner.map(user => {return user.dn});
  var parentGroups = req.body.parentGroups.map(group => group.dn);

  var group = {
      cn: req.body.cn,
      o: req.body.o,
      description: req.body.description,
      member: member,
      owner: owner,
      parentGroups: parentGroups
  };
  return validateGroup(group)
    .then(() => validateCn(group.cn))
    .then(() => ldaphelper.createGroup(group))
    .then(() => {
      group.member = req.body.member.map(user => { return user.uid });
      return discoursehelper.createGroup(group)
    })
    .then(() => res.send({success: true}))
    .catch(next);
});

// UPDATE GROUP

router.post('/api/group/update', auth.isLoggedInAdmin, function(req, res, next) {
  var member = [].concat(req.body.member.concat(req.body.subGroups)).map(user => user.dn);
  var owner = req.body.owner.map(user => user.dn);
  var parentGroups = req.body.parentGroups.map(group => group.dn);

  var group = {
      cn: req.body.cn,
      o: req.body.o,
      description: req.body.description,
      member: member,
      owner: owner,
      parentGroups: parentGroups
  };
  return validateGroup(group)
    .then(() => validateCn(group.cn, req.body.dn))
    .then(() => ldaphelper.updateGroup(req.body.dn, group))
    .then(() => discoursehelper.updateGroup(ldaphelper.dnToCn(req.body.dn), group)
        .then(() => res.send({status: 'success', message: 'Gruppe ' + group.cn + ' wurde geändert.'}))
        .catch(error => res.send({status: 'notFound', message: 'Gruppe ' + group.cn + ' wurde gändert. Discourse Gruppe konnte nicht geändert werden: ' + error})))
    .catch(next);
});

// DELETE GROUP

router.delete('/api/group/:dn', auth.isLoggedInAdmin, function(req, res, next) {
  return ldaphelper.fetchObject(req.params.dn)
    .then(group => {
      return ldaphelper.remove(group.dn)
        .then(() => {
          return discoursehelper.deleteGroup(group)
            .then(() => {
              res.send({status: 'success', message: 'Gruppe ' + group.cn + ' wurde gelöscht.'})
            })
            .catch(error => {
              res.send({status: 'notFound', message: 'Gruppe ' + group.cn + ' wurde gelöscht. Discourse Gruppe konnte nicht gelöscht werden: ' + error})
            })
        })
    })
    .catch(next)
});


module.exports = router;