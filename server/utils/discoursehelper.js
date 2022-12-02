const config = require('../config/config.json');
const request = require('request-promise');
const querystring = require('query-string');
const ldaphelper = require('../utils/ldaphelper');
const cacheManager = require('cache-manager');
const crypto = require('crypto');
const _ = require('lodash');
const Promise = require("bluebird");

var cache = undefined;

cacheManager.caching('memory', {
  max: 100,
  ttl: 10 * 1000 /*miliseconds*/,
}).then(c => cache = c);

const invalidateCache = function(id = undefined) {
  return cache.del('categories')
    .then(() => !id || cache.del(`cat___${id}`))
}

var buildOptions = function (method, url, parameters = undefined) {
  var options = {
    method: method,
    uri: config.discourse.APIURL + '/' + url,
    headers: {
      'User-Agent': 'habiDAT-User-Module',
      'Api-Key': config.discourse.APIKEY,
      'Api-Username': config.discourse.USERNAME
    },
    json: true
  }
  if (parameters && method == 'GET') {
    options.uri += querystring.stringify(parameters)
  } else if (parameters) {
    options.form = parameters;
  }
  options.strictSSL = false;
  return options;
}

exports.put = function (url, parameters) {
  return request(buildOptions('PUT', url, parameters));
}

exports.get = function (url, parameters) {
  return request(buildOptions('GET', url, parameters));
};

exports.del = function (url, parameters) {
  return request(buildOptions('DELETE', url, parameters));
};

exports.post = function (url, parameters) {
  return request(buildOptions('POST', url, parameters));
};

Array.prototype.insensitiveIndexOf = function (searchElement, fromIndex) {
  return this.map(function (value) {
    return value.toLowerCase();
  }).indexOf(searchElement.toLowerCase(), fromIndex);
};

exports.syncUser = function (user) {
  var groups = user.memberGroups.map(group => { return group.cn; });
  var hmac = crypto.createHmac("sha256", config.discourse.SSOSECRET);
  var params = {
    external_id: user.uid,
    email: user.mail,
    username: user.uid,
    name: user.cn,
    title: user.title,
    groups: groups.join(',')
  }
  var payload = new Buffer(querystring.stringify(params), 'utf8').toString("base64");
  hmac.update(payload);
  var postParams = {
    'sso': payload,
    'sig': hmac.digest('hex')
  }
  return exports.post('admin/users/sync_sso', postParams)
    .then(() => { return user; })
}

exports.getUser = function (uid, fetchEmail = false) {
  return exports.get('users/' + uid + '.json')
    .catch(error => {
      return exports.get('u/by-external/' + uid + '.json')
    })
    .then(response => {
      if (fetchEmail) {
        return exports.get('users/' + response.user.username + '/emails.json', { context: 'admin/users/' + response.user.id + '/' + response.user.username })
          .then(emailObject => {
            response.user.email = emailObject.email;
            return response.user;
          });
      } else {
        return response.user;
      }
    })
    .catch(error => { return; })
};

exports.deleteOrSuspendUser = function (uid) {
  return exports.getUser(uid, false)
    .then(discourseUser => {
      if (discourseUser) {
        return exports.del('admin/users/' + discourseUser.id + '.json', { context: '/admin/users/' + discourseUser.id + '/' + discourseUser.username })
          .then(() => { return { deleted: true } })
          .catch(error => exports.put('admin/users/' + discourseUser.id + '/suspend', { suspend_until: '3018-01-01', reason: 'Gelöscht durch User Tool' })
            .then(() => { return { suspended: true } })
          )
      } else {
        return { notFound: true }
      }
    })
    .catch(error => { throw 'Discourse user konnte nicht gelöscht werden: ' + error })
};

var resolveGroupMembers = function (groups, users, group, members, resolvedGroups) {
  if (!resolvedGroups.includes(group.dn)) {
    group.member.forEach(dn => {
      if (!ldaphelper.isGroup(dn) && !members.includes(dn)) {
        members.push(dn);
      }
    });
    resolvedGroups.push(group.dn);
    group.member.forEach(dn => {
      if (ldaphelper.isGroup(dn)) {
        var subGroup = groups.find(group => { return group.dn === dn; });
        resolveGroupMembers(groups, users, subGroup, members, resolvedGroups);
      }
    });
  }
}

var getGroupId = function (name) {
  return exports.get('groups/' + name + '.json', {})
    .then(function (result) {
      return result.group.id;
    });
};

exports.syncGroups = function () {
  return Promise.join(ldaphelper.fetchGroups('all'), ldaphelper.fetchUsers(),
    (groups, users) => {
      return Promise.all(groups.map(group => {
        if (group.cn && group.cn !== 'admin') {
          return exports.getGroupMembers(group.cn)
            .then(oldMembers => {
              // get members of subgroups
              var newMembers = [], resolvedGroups = [];
              resolveGroupMembers(groups, users, group, newMembers, resolvedGroups);
              return ldaphelper.dnToUid(newMembers)
                .then(newMembers => {
                  var addMembers = newMembers.filter(member => {
                    return !oldMembers.includes(member);
                  })
                  var removeMembers = oldMembers.filter(member => {
                    return !newMembers.includes(member);
                  })
                  if (addMembers.length > 0 || removeMembers.length > 0) {
                    return getGroupId(group.cn)
                      .then(id => {
                        return exports.addGroupMembers(id, addMembers)
                          .then(exports.removeGroupMembers(id, removeMembers));
                      })
                  } else {
                    return;
                  }
                })
            })
            .catch(error => {
              // catch errors if group does not exist in discourse
              return;
            })
        } else {
          return;
        }
      }))
    });
}

exports.createGroup = function (group) {
  return exports.post('admin/groups', {
    'group[alias_level]': 3,
    'group[automatic]': false,
    'group[automatic_membership_email_domains]': "",
    'group[automatic_membership_retroactive]': false,
    'group[mentionable_level]': 3,
    'group[messageable_level]': 3,
    'group[grant_trust_level]': 0,
    'group[name]': group.cn,
    'group[full_name]': group.o,
    'group[primary_group]': false,
    'group[title]': "",
    'group[visible]': true,
    'group[bio_raw]': group.description,
    'group[usernames]': group.member.join(',')
  })
    .then(exports.syncGroups)
    .catch(error => { throw 'Fehler beim Erstellen der Discourse Gruppe ' + group.cn + ': ' + error });
};

exports.updateGroup = function (cn, group) {
  return getGroupId(cn)
    .then(id => exports.put('groups/' + id + '.json', {
      'group[name]': group.cn,
      'group[full_name]': group.o,
      'group[bio_raw]': group.description
    }))
    .then(exports.syncGroups)
    .catch(error => { throw 'Fehler beim Ändern der Discourse Gruppe ' + group.cn + ': ' + error });
};

exports.deleteGroup = function (group) {
  return getGroupId(group.cn)
    .then(id => exports.del('admin/groups/' + id + '.json', {}))
    .then(exports.syncGroups)
};

exports.createUser = function (name, email, password, username, title) {
  return exports.post('users', { name: name, email: email, password: password, username: username, active: true, approved: true })
    .then(response => {
      if (!response.active || !response.success) {
        throw "Benutzer*in erstellt, konnte aber nicht aktiviert werden: " + response.message;
      } else {
        return exports.put('u/' + username + '.json', { title: title })
          .then(response => {
            return response.user;
          })
      }

    });
};

const categoryProps = ['id', 'name', 'slug', 'color', 'text_color', 'topic_count', 'post_count', 'description', 'parent', 'children']

exports.getCachedCategory = function (id) {
  return cache.get(`cat___${id}`)
    .then(category => {
      return category || exports.get('c/' + id + "/show.json")
        .then(response => {
          return cache.set(`cat___${id}`, response.category)
            .then(() => response.category)
        })
    })
}

exports.getCategory = function (id) {
  return exports.getCachedCategory(id)
    .then(cat => {
      return exports.getCategories()
        .then(categories => {
          var category = _.pick(cat, categoryProps);
          category.children = categories.filter(c => c.parent === category.id);
          category.parent = categories.find(c => c.id === category.id).parent;
          category.groups = cat.group_permissions
            .filter(perm => perm.permission_type === 1 && !['jeder', 'team', 'vertrauensstufe_0', 'vertrauensstufe_1', 'vertrauensstufe_2', 'vertrauensstufe_3', 'vertrauensstufe_4'].includes(perm.group_name))
            .map(perm => perm.group_name);
          return category;

        })
    })
};

exports.getCategories = function () {
  return cache.get('categories')
    .then(categories => {
      return categories || exports.get('categories.json?include_subcategories=true')
        .then(categoriesObject => categoriesObject.category_list.categories)
        .then(categoryTree => {
          // turn tree into flat array
          var categoriesFlat = [];
          categoryTree.filter(cat => !cat.is_uncategorized && !['team', 'lounge', 'feedback'].includes(cat.slug)).forEach(rootCategory => {
            categoriesFlat.push(_.pick(rootCategory, categoryProps))
            categoriesFlat[categoriesFlat.length - 1].parent = -1
            categoriesFlat[categoriesFlat.length - 1].children = [];
            if (rootCategory.subcategory_list) {
              categoriesFlat[categoriesFlat.length - 1].children = rootCategory.subcategory_list.map(cat => cat.id);
              rootCategory.subcategory_list.forEach(subCategory => {
                categoriesFlat.push(_.pick(subCategory, categoryProps))
                categoriesFlat[categoriesFlat.length - 1].parent = rootCategory.id;
                categoriesFlat[categoriesFlat.length - 1].children = [];
              })
            }
          })
          return cache.set('categories', categoriesFlat)
            .then(() => categoriesFlat)
        })
    })
};

exports.populateCategoryGroups = function (categories) {
  return Promise.each(categories, category => {
    return exports.getCachedCategory(category.id)
      .then(category => {
        category.groups = category.group_permissions
          .filter(perm => perm.permission_type === 1 && !['jeder', 'team', 'vertrauensstufe_0', 'vertrauensstufe_1', 'vertrauensstufe_2', 'vertrauensstufe_3', 'vertrauensstufe_4'].includes(perm.group_name))
          .map(perm => perm.group_name);
        return category;
      })
  })
}

const buildCategory = function (category) {
  return new Promise((resolve, reject) => {
    var post = {
      name: category.name,
      slug: category.slug,
      text_color: category.text_color,
      color: category.color,
      parent_category_id: ''
    };
    if (category.parent && category.parent != '-1') {
      post.parent_category_id = category.parent;
    }
    if (category.groups && Array.isArray(category.groups)) {
      category.groups.forEach(function (group) {
        post['permissions[' + group + ']'] = 1;
      });
      if (category.groups.length === 0) {
        post['permissions[jeder]'] = 1;
      }
    }
    resolve(post);
  });
};

exports.createCategory = function (category) {
  return buildCategory(category)
    .then(category => {
      category.allow_badges = true
      category.sort_order = ''
      category.topic_featured_link_allowed = true
      category.default_view = 'latest'
      category.default_top_period = 'all'
      return category
    })
    .then(catObject => invalidateCache().then(() => exports.post('categories', catObject)))
};

exports.updateCategory = function (category) {
  return buildCategory(category)
    .then(catObject => invalidateCache(category.id).then(() => exports.put('categories/' + category.id, catObject)))
};

exports.deleteCategory = function (id) {
  return exports.del('categories/' + id, {})
    .then(() => invalidateCache(id))
};

exports.getGroupMembers = function (groupName) {
  return exports.get('groups/' + groupName + '/members.json?limit=1000')
    .then(result => {
      return result.members.map(member => {
        return member.username;
      });
    })
}

exports.addGroupMembers = function (groupId, newMembers) {
  return Promise.resolve()
    .then(() => {
      if (newMembers.length > 0) {
        return exports.put('groups/' + groupId + '/members.json', { usernames: newMembers.join(',') });
      } else {
        return;
      }
    });
}

exports.removeGroupMembers = function (groupId, members) {
  return Promise.resolve()
    .then(() => {
      if (members.length > 0) {
        return exports.del('groups/' + groupId + '/members.json', { usernames: members.join(',') });
      } else {
        return;
      }
    });
}
