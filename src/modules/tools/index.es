const fs = require('fs');
const elasticsearch = require('elasticsearch');
const crypto = require('crypto');
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
