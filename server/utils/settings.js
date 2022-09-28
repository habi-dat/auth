const jsonfile = require('jsonfile');
const path = require('path');
const config    = require('../config/config.json');
const moment = require('moment');

const Promise = require("bluebird");

const activationStoreFile = path.join(__dirname, '../data/settingsStore.json');

const readStore = function() {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(activationStoreFile, function(err, obj) {
      if (!err) {
        resolve(obj);
      } else {
        resolve({});
      }
    })
  });
}

const saveStore = function (activationStore) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(activationStoreFile, activationStore, function (err) {
      if (!err) {
        resolve(activationStore);
      } else {
        reject(err);
      }
    })
  })
}

exports.getSettings = () => {
  return readStore()
    .then(settings => {
      if (!settings.theme) {
        settings.theme = {}
      }
      return settings;
    })
}

exports.saveSettings = settings => {
  return saveStore(settings)
}
