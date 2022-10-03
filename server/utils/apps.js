var jsonfile = require('jsonfile');
var path = require('path');
var config    = require('../config/config.json');
var moment = require('moment');

var Promise = require("bluebird");

var activationStoreFile = path.join(__dirname, '../data/appStore.json');

var readStore = function() {
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

var saveStore = function (activationStore) {
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

exports.getApps = function() {
  return readStore();
}

exports.getApp = function(id) {
  return readStore()
    .then(store => {
      var app = store.find(app => app.id === id);
      return app;
    });
}

exports.createApp = function(app) {
  return readStore()
    .then(store => {
      store.push(app)
      return saveStore(store);
    });
}

exports.updateApp = function(app) {
  return readStore()
    .then(store => {
      var index = store.findIndex(a => a.id === app.id);
      store[index] = app;
      return saveStore(store);
    });
}