const fs = require('fs');
const elasticsearch = require('elasticsearch');

/**
 * This reads the config from wherever it's kept and turns it into JSON
 * before passing it back.
 * We may also be fetching this from some other place over the network than
 * the local file system
 * @return {Boolean}        If we did a bulk upload or not
 */
const getConfig = () => {
  //  Read in the config file, if there is one
  const rootDir = process.cwd();
  const configFile = `${rootDir}/config.json`;
  let configJSON = {};
  if (fs.existsSync(configFile)) {
    const configTxt = fs.readFileSync(configFile, 'utf-8');
    configJSON = JSON.parse(configTxt);
  }
  return configJSON;
};
exports.getConfig = getConfig;

/**
 * This takes whatever config file is passed to it, cleans it up from the
 * temporary values we added into it and then saves it. We should proably
 * work around that but for the moment this is easier.
 * We may also be putting this onto some other place over the network than
 * the local file system
 * @param {Object} json     The config XML file
 */
exports.putConfig = (configJSON) => {
  const rootDir = process.cwd();
  const configFile = `${rootDir}/config.json`;
  const newJSON = configJSON;

  //  Clean up the things we want to delete
  if ('xml' in newJSON) {
    newJSON.xml = configJSON.xml.map((itemData) => {
      const newData = itemData;
      delete newData.missing;
      delete newData.exists;
      return newData;
    });
  }

  const configJSONPretty = JSON.stringify(newJSON, null, 4);
  fs.writeFileSync(configFile, configJSONPretty, 'utf-8');
};

/**
 * This pings elastic search to see if it's up
 * @return {null/number} Null if no connection, milliseconds if we did
 */
const pingES = async () => {
  const config = getConfig();
  const esclient = new elasticsearch.Client(config.elasticsearch);
  const startPing = new Date().getTime();
  let diff = null;
  let worked = false;
  try {
    worked = await esclient.ping();
  } catch (er) {
    return diff;
  }
  const endPing = new Date().getTime();
  if (worked === true) {
    diff = endPing - startPing;
  }
  return diff;
};
exports.pingES = pingES;

/**
 * This pings elastic search to see if it's up
 */
const startPinging = async () => {
  const ms = await pingES();
  if ('pingTmr' in global) {
    clearTimeout(global.pingTmr);
  }
  global.pingTmr = setTimeout(() => {
    console.log(`${ms}ms`);
    startPinging();
  }, 1000);
};
exports.startPinging = startPinging;
