const jsonfile = require("jsonfile");
const path = require("path");
const config = require("../config/config.json");
const moment = require("moment");

const Promise = require("bluebird");

const activationStoreFile = path.join(__dirname, "../data/settingsStore.json");

const readStore = function () {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(activationStoreFile, function (err, obj) {
      if (!err) {
        resolve(obj);
      } else {
        resolve({});
      }
    });
  });
};

const saveStore = function (activationStore) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(activationStoreFile, activationStore, function (err) {
      if (!err) {
        resolve(activationStore);
      } else {
        reject(err);
      }
    });
  });
};

const setDefault = function (settings, key, defaultValue) {
  if (!settings[key] || settings[key] === "") {
    settings[key] = defaultValue;
  }
};

exports.getSettings = () => {
  return readStore().then((settings) => {
    if (!settings) {
      settings = {};
    }
    setDefault(settings, "theme", {});
    setDefault(settings, "customTheme", false);
    setDefault(
      settings,
      "entryUrl",
      "https://" +
        config.nextcloud.subdomain +
        "." +
        config.settings.general.domain
    );
    setDefault(settings, "title", config.settings.general.title);
    setDefault(settings, "groupIdDelimiter", "_");

    return settings;
  });
};

exports.saveSettings = (settings) => {
  return saveStore(settings);
};
