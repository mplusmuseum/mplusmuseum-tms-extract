const fs = require('fs');
const elasticsearch = require('elasticsearch');
const crypto = require('crypto');

/**
 * Converts a time difference in ms into an easier to read form
 * @param {number} duration The time in milliseconds to convert
 * @return {string}         The nice text string
 */
const msToTime = (duration) => {
  let seconds = parseInt((duration / 1000) % 60, 10);
  let minutes = parseInt((duration / (1000 * 60)) % 60, 10);
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24, 10);

  hours = hours < 10 ? `0${hours}` : hours;
  minutes = minutes < 10 ? `0${minutes}` : minutes;
  seconds = seconds < 10 ? `0${seconds}` : seconds;

  if (parseInt(hours, 10) > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (parseInt(minutes, 10) > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};
exports.msToTime = msToTime;

/**
 * This reads the config from wherever it's kept and turns it into JSON
 * before passing it back.
 * We may also be fetching this from some other place over the network than
 * the local file system
 * @return {Object}        The config json
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
 * Grabs the xml directory from config and returns it or the default value
 * @return {string}   The absolute directory of the xml
 */
const getXmlDir = () => {
  const config = getConfig();
  if ('xmlPath' in config) {
    return config.xmlPath;
  }
  const rootDir = process.cwd();
  return `${rootDir}/app/data/xml`;
};
exports.getXmlDir = getXmlDir;

/**
 * Grabs the mediaDir directory from config and returns it or the default value
 * @return {string}   The absolute directory of the mediaDir
 */
const getMediaDir = () => {
  const config = getConfig();
  if ('mediaPath' in config) {
    return config.mediaPath;
  }
  const rootDir = process.cwd();
  return `${rootDir}/app/data/media`;
};
exports.getMediaDir = getMediaDir;

/**
 * Grabs the prefix we want to remove off filenames to be able to find them
 * correctly
 * @return {string}   The absolute directory of the mediaDir
 */
const getMediaDirPrefix = () => {
  const config = getConfig();
  if ('mediaDirPrefix' in config) {
    return config.mediaDirPrefix;
  }
  return '';
};
exports.getMediaDirPrefix = getMediaDirPrefix;

/**
 * This reads the counts file from wherever it's kept and turns it into JSON
 * before passing it back.
 * We may also be fetching this from some other place over the network than
 * the local file system
 * @return {Object}        The counts json
 */
const getCounts = () => {
  //  Read in the config file, if there is one
  const rootDir = process.cwd();
  const countsFile = `${rootDir}/app/data/counts.json`;
  let countsJSON = {};
  if (fs.existsSync(countsFile)) {
    const counts = fs.readFileSync(countsFile, 'utf-8');
    countsJSON = JSON.parse(counts);
    if ('startProcessing' in countsJSON && 'lastSave' in countsJSON) {
      countsJSON.processingTime =
        countsJSON.lastSave - countsJSON.startProcessing;
    }
    if ('lastSave' in countsJSON) {
      countsJSON.timeSinceLastSave = new Date().getTime() - countsJSON.lastSave;
    }
  }
  return countsJSON;
};
exports.getCounts = getCounts;

/**
 * This breaks down the counts json object and builds up a bunch more useful
 * details that can be further used by code or the frontend
 * @param {Object} counts  The counts object
 * @return {Object}        The counts json
 */
exports.getStatus = (counts) => {
  const status = {
    xmls: [],
  };
  const configJSON = getConfig();
  const xmlDir = getXmlDir();

  if ('xml' in configJSON) {
    //  Do some checks in each item, i.e. if it even exists and the last
    //  modified time
    configJSON.xml.forEach((item) => {
      const xmlStatus = {
        file: item.file,
        index: item.index,
      };
      if (fs.existsSync(`${xmlDir}/${item.file}`)) {
        xmlStatus.exists = true;
        xmlStatus.stat = fs.statSync(`${xmlDir}/${item.file}`);
      } else {
        xmlStatus.exists = false;
      }

      if ('items' in counts) {
        if (item.index in counts.items) {
          xmlStatus.counts = counts.items[item.index];
        }

        //  If we have count data, then we can work out some other information
        if (item.index in counts.items && xmlStatus.exists) {
          const c = counts.items[item.index];
          const genTime = new Date(xmlStatus.stat.mtime).getTime();
          //  If we started processing the file _before_ the current file
          //  was modified, then we haven't processed the latest file
          if (c.startProcessing < genTime) {
            xmlStatus.processed = false;
          } else {
            xmlStatus.processed = true;
          }

          //  Now we can check to see if the processing has finished, it's
          //  finished if the itemsUploaded === totalItemsToUpload
          xmlStatus.notStarted = false;
          if (
            c.itemsUploaded === c.totalItemsToUpload &&
            c.itemsUploaded !== null &&
            c.itemsUploaded !== undefined
          ) {
            xmlStatus.finished = true;
          } else {
            xmlStatus.finished = false;
            if (c.itemsUploaded !== null && c.itemsUploaded !== undefined) {
              xmlStatus.percent = c.itemsUploaded / c.totalItemsToUpload;
              xmlStatus.percent *= 100;
            } else {
              xmlStatus.notStarted = true;
              xmlStatus.percent = 0;
            }
          }
          if (c.startProcessing && c.lastUpsert) {
            xmlStatus.processingTime = c.lastUpsert - c.startProcessing;
          }

          if (
            'jsonCount' in c &&
            c.jsonCount.new === 0 &&
            c.jsonCount.modified === 0 &&
            xmlStatus.processed === true
          ) {
            xmlStatus.notStarted = false;
            xmlStatus.finished = true;
            xmlStatus.processingTime =
              c.bulkUpload.lastChecked - c.startProcessing;
          }
        }
      }

      status.xmls.push(xmlStatus);
    });
  }
  return status;
};

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
      delete newData.parser;
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
  //  We want to add error suppression to the client so it doesn't throw
  //  errors (which sometimes will) on the ping test. We want to know the
  //  response is 'null', we don't need all the error messages in our logs
  //  TODO: actually we may want the errors in logs and we should change the
  //  `type` to be a log file rather than console
  const client = config.elasticsearch;
  client.log = [
    {
      type: 'stdio',
      levels: [],
    },
  ];
  const esclient = new elasticsearch.Client(client);
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
  //  Ping the ES
  const ms = await pingES();

  //  Grab the current ES server, and record the data into the ping file
  const config = getConfig();
  if ('elasticsearch' in config) {
    //  Grab the ES host and hash it.
    //  NOTE: Even though hashing makes it harder to read by eye we often
    //  have username:password in the hosts URL, and even though that's
    //  kept in the config.json file we probably want to keep plaintext
    //  passwords out of as many files as possible, hence using hashes here.
    const ES = config.elasticsearch.host;
    const EShash = crypto
      .createHash('md5')
      .update(ES)
      .digest('hex');

    //  Grab the pingES file
    const rootDir = process.cwd();
    const pingESFile = `${rootDir}/app/data/esPing.json`;
    let pingESJSON = {
      hosts: {},
    };
    if (fs.existsSync(pingESFile)) {
      const pingEStxt = fs.readFileSync(pingESFile, 'utf-8');
      pingESJSON = JSON.parse(pingEStxt);
    }

    //  Check to see if the host is missing, if so add it
    if (!(EShash in pingESJSON.hosts)) {
      pingESJSON.hosts[EShash] = [];
    }

    //  Push the latest ping onto the start of the array
    pingESJSON.hosts[EShash].unshift({
      timestamp: new Date().getTime(),
      ms,
    });

    //  Trim the array down to the first 30 entries
    pingESJSON.hosts[EShash] = pingESJSON.hosts[EShash].slice(0, 30);

    //  Save the file back out
    const pingESJSONPretty = JSON.stringify(pingESJSON, null, 4);
    fs.writeFileSync(pingESFile, pingESJSONPretty, 'utf-8');
  }

  //  Now clear out the old timer (don't really need to do this, but you know
  //  javascript so it's nice to be sure).
  if ('pingTmr' in global) {
    clearTimeout(global.pingTmr);
  }
  //  Call this again in a while
  global.pingTmr = setTimeout(() => {
    startPinging();
  }, 60 * 1000);
};
exports.startPinging = startPinging;

/**
 * Tries and grabs the ping file for the currently defined in config
 * elastic search host.
 * @return {Array} array of connection speeds and time
 */
const getPings = () => {
  const config = getConfig();
  if ('elasticsearch' in config) {
    const ES = config.elasticsearch.host;
    const EShash = crypto
      .createHash('md5')
      .update(ES)
      .digest('hex');
    const rootDir = process.cwd();
    const pingESFile = `${rootDir}/app/data/esPing.json`;
    if (fs.existsSync(pingESFile)) {
      const pingEStxt = fs.readFileSync(pingESFile, 'utf-8');
      const pingESJSON = JSON.parse(pingEStxt);
      if (EShash in pingESJSON.hosts) {
        return pingESJSON.hosts[EShash];
      }
    }
  }
  return [];
};
exports.getPings = getPings;

/**
 * Grabs the latest ping data for the current ES instance and adds a bunch
 * of extra information useful to both the backend and front end templates.
 * @return {Object}   JSON object with a bunch of data in
 */
exports.getPingData = () => {
  const pings = getPings();
  let timetoLastPing = null;
  let averagePing = null;
  let nullCount = 0;
  let mostRecentIsDead = true;
  let lastFiveAreDead = true;
  let haveData = false;

  if (pings.length > 0) {
    let totalMS = 0;
    let pingCount = 0;
    pings.forEach((ping) => {
      haveData = true;

      if (timetoLastPing === null) {
        timetoLastPing = new Date().getTime() - ping.timestamp;
        timetoLastPing = parseInt(timetoLastPing / 1000, 10);
      }

      if (ping.ms === null) {
        nullCount += 1;
      } else {
        pingCount += 1;
        totalMS += ping.ms;
      }
      //  Check to see if the most recent ping was dead
      if (pingCount + nullCount === 1) {
        if (ping.ms !== null) {
          mostRecentIsDead = false;
        }
      }
      //  Check to see if all the most recent 5 pings were dead
      if (pingCount + nullCount <= 5) {
        if (ping.ms !== null) {
          lastFiveAreDead = false;
        }
      }
    });
    averagePing = parseInt(totalMS / pingCount, 10);
    if (pingCount + nullCount < 5) {
      lastFiveAreDead = false;
    }
    const d = new Date().getTime();
    pings.map((ping) => {
      const newPing = ping;
      const diff = parseInt((d - ping.timestamp) / 1000, 10);
      if (diff < 60) {
        newPing.timeAgo = '1s';
      } else {
        newPing.timeAgo = `${parseInt(diff / 60, 10)}m`;
      }
      return newPing;
    });
  }
  const pingData = {
    haveData,
    nullCount,
    averagePing,
    timetoLastPing,
    mostRecentIsDead,
    lastFiveAreDead,
    pings,
  };
  return pingData;
};
