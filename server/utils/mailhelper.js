var nodemailer = require('nodemailer');
var activation = require('./activation');
var config = require('../config/config.json');
var jsonfile = require('jsonfile');
var path = require('path');

var Promise = require("bluebird");
if (config.smtp.authMethod == 'none') {
  config.smtp.auth = undefined;
}


var storeFile = path.join(__dirname, '../data/emailTemplateStore.json');

var readStore = function() {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(storeFile, function(err, obj) {
      if (!err) {
        resolve(obj);
      } else {
        resolve({});
      }
    })
  });
}

var saveStore = function (store) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(storeFile, store, function (err) {
      if (!err) {
        resolve(store);
      } else {
        reject(err);
      }
    })
  })
}

sendMail = function(options) {
  return new Promise((resolve, reject) => {
    nodemailer.createTransport(config.smtp).sendMail(options, (error, info) => {
        if (error) {
            reject(error);
        } else {
            resolve(info);
        }
    });
  });
}

exports.getDefaultSubject = function(template) {
	if (template === 'passwd') {
		return config.settings.general.title + ' Passwort wurde zurückgesetzt';
	} else if (template === 'invite') {
		return 'Einladung zu ' + config.settings.general.title;
	} else {
		return 'N/A';
	}
}


exports.getTitle = function(template) {
	if (template === 'passwd') {
		return 'Passwort Zurücksetzen';
	} else if (template === 'invite') {
		return 'Einladung';
	} else {
		return 'N/A';
	}
}


exports.renderHtml = function (res, template, data) {
    return new Promise((resolve, reject) => {
        res.render(template, data, (err, html) => {
          if (err) {
            reject(err);
          } else {
            resolve(html);
          }
        });
    });
};

exports.saveCustomTemplate = function(template, email) {
	return readStore()
		.then(store => {
			store[template] = email;
			return saveStore(store);
		})
}


exports.renderEmail = function (res, template, data, useCustomIfExists = false) {
	return readStore()
		.then(store => {
			if (store[template] && (store[template].activated || useCustomIfExists)) {
				var email = store[template]
				Object.keys(data).forEach(key => {
					email.body = email.body.split('{{' + key + '}}').join(data[key])
				})
				email.label=exports.getTitle(template);
				return email;
			} else {
				return exports.renderHtml(res, template, data)
					.then(body => {
						return {subject: exports.getDefaultSubject(template), body: body, label: exports.getTitle(template)};
					})
			}
		})
}

exports.sendMail = function(req, res, to, template, data) {
    return exports.renderEmail(res, template, data)
      .then((email) => {

          var mailOptions = {
            from: (config.settings.activation.email_from || 'no-reply@habidat.org'),
            to: to,
            subject: email.subject,
            html: email.body
          }

          return sendMail(mailOptions);
    })

};

exports.sendPasswordResetEmail = function(req, res, user) {
    return activation.createAndSaveToken(req.user, {uid: user.uid, dn: user.dn})
      .then(token => {
          var link = config.settings.activation.base_url + '/passwd/' + user.uid + '/'+token.token;
          return exports.sendMail(req, res, user.mail, 'passwd', { passwdLink: link })
    })

};