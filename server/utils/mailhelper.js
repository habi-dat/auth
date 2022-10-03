var nodemailer = require('nodemailer');
var activation = require('./activation');
var handlebars = require('handlebars')
var settings = require('./settings')
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

var sendMail = function(options) {
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

var supplementGeneralData = function(data) {
  return settings.getSettings()
    .then(settings => {
      data.url = config.settings.activation.base_url;
      data.title = settings.title;
      data.email = config.settings.general.contact;
      return data;
    })
}

exports.getTemplate = function(template) {
  return readStore()
    .then(store => {
      if (store[template]) {
        return store[template];
      } else {
        return store['_' + template];
      }
    })
}

exports.saveCustomTemplate = function(template, email) {
	return readStore()
		.then(store => {
			store[template] = email;
			return saveStore(store);
		})
}


exports.renderEmail = function (template, parameters) {
	return readStore()
		.then(store => {
      var email;
      if (!store[template]  || !store[template].activated) {
        email = store['_' + template];
      } else {
        email = store[template];
      }
      var data = {...parameters}
      return supplementGeneralData(data)
        .then(data => {
          var body = handlebars.compile(email.body)(data);
          var subject = handlebars.compile(email.subject)(data);
          return {
            subject: subject,
            body: body
          }
        })
    })
}

var sendMailTemplate = function(to, template, data) {
  return exports.renderEmail(template, data)
    .then(email => {
      var mailOptions = {
        from: (config.settings.activation.email_from || 'no-reply@habidat.org'),
        to: to,
        subject: email.subject,
        html: email.body
      }
      return sendMail(mailOptions);
  })

};

exports.sendPasswordResetEmail = function(user) {
  return activation.createAndSaveToken(null, {uid: user.uid, dn: user.dn})
    .then(token => {
      var link = config.settings.activation.base_url + '/#/user/setpassword?token='+token.token;
      return sendMailTemplate(user.mail, 'passwordReset', { link: link })
  })
};


exports.sendActivationEmail = function(token) {
  var link = config.settings.activation.base_url+ '/#/user/acceptinvite?token=' + token.token
  return sendMailTemplate(token.data.mail, 'invite', { link: link });
};