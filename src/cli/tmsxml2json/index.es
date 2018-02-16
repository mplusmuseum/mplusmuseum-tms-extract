const xml2js = require('xml2js');
const { pd } = require('pretty-data');
const colours = require('colors');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../../../config.json');
const artisanalints = require('../../../lib/artisanalints');
const parseObject = require('./parsers/object');
const elasticsearch = require('elasticsearch');
const progress = require('cli-progress');

const esclient = new elasticsearch.Client(config.elasticsearch);

colours.setTheme({
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  alert: 'magenta',
});

const parser = new xml2js.Parser({
  trim: true,
  explicitArray: false,
  explicitRoot: false,
  mergeAttrs: true,
});

const rootDir = process.cwd();
let startTime = new Date().getTime();
let totalItemsToUpload = null;
let itemsUploaded = 0;

let forceBulk = false;
let skipBulk = false;
let forceResetIndex = false;
let forceIngest = false;

/*
TODO: If we are using AWS Lambda then all of this has to go into the /tmp
scratch disk.
*/
let dataDir = null;
let xmlDir = null;
let tmsDir = null;

if (config.onLambda) {
  console.error('We need Lambda code here');
  process.exit(1);
} else {
  dataDir = `${rootDir}/app/data`;
  xmlDir = `${dataDir}/xml`;
  tmsDir = `${dataDir}/tms`;

  // Make sure all the folders we need to use exist
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir);
  if (!fs.existsSync(tmsDir)) fs.mkdirSync(tmsDir);
}

/**
 * This converts an xml chunk into the JSON format we want
 * @param {string} xml the xml text we want to have parsed
 * @returns {Object} the JSON obeject representation of the xml
 */
const parseString = async (source, xml) => {
  try {
    const json = await new Promise((resolve, reject) =>
      parser.parseString(xml, (err, result) => {
        if (err) {
          reject(err);
        }
        resolve(result);
      }));

    //  Select the parser to use based on the source
    let parserLib = null;
    switch (source) {
      case 'object':
        parserLib = parseObject;
        break;
      default:
        parserLib = parseObject;
    }

    const index = Object.keys(json)[0];
    const [type, objects] = Object.entries(json[index])[0];
    const cleanjson = {
      [index]: objects.map(object => ({
        [type]: parserLib.parseJson(object),
      })),
    };
    return cleanjson;
  } catch (err) {
    return null;
  }
  /*
  */
};

/**
 * This goes and fetches the hash table for this source type, if there is
 * no hash table it creates one
 *
 * @param {string} source   the string defining the source type (from config)
 * @returns {Object}        The Hash fetchHashTable
 */
const fetchHashTable = async (source) => {
  if (config.onLambda) {
    //  TODO: Fetch hash table from remote source
    return {};
  }
  const sourceDir = `${tmsDir}/${source}`;
  const hsFile = `${sourceDir}/hash_table.json`;
  if (fs.existsSync(hsFile)) {
    const hashTable = fs.readFileSync(hsFile, 'utf-8');
    return JSON.parse(hashTable);
  }

  return {};
};

/**
 * This stores the hash table for this source type.
 *
 * @param {string} source     the string defining the source type (from config)
 * @param {Object} hashTable  The hasTable to store
 */
const storeHashTable = async (source, hashTable) => {
  if (config.onLambda) {
    //  TODO: Fetch hash table from remote source
  } else {
    const sourceDir = `${tmsDir}/${source}`;
    const hsFile = `${sourceDir}/hash_table.json`;
    const hashTableJSONPretty = JSON.stringify(hashTable, null, 4);
    if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir);
    fs.writeFileSync(hsFile, hashTableJSONPretty, 'utf-8');
  }
};

/**
 * This takes the json and looks to see if we need to do a bulk upload which
 * only happens on the 1st run. After that we skip the bulk and just upload
 * seperate files.
 * @param {Object} json     The convereted from XML json
 * @return {Boolean}        If we did a bulk upload or not
 */
const bulkUpload = async (index, type, json) => {
  const outputDir = `${tmsDir}/${index}`;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  let doBulkUpload = false;
  let resetIndex = false;

  //  If a previous bulk upload files doesn't exist, then we are going to
  //  need to do the bulk upload (this normally happens on 1st run);
  if (!fs.existsSync(`${outputDir}/bulk.json`)) {
    console.log('No previous bulk upload found.'.help);
    doBulkUpload = true;
    resetIndex = true;
  }

  //  If we are forcing a bulk upload then we do that here
  if (forceBulk === true) {
    console.log('We have been told to force a new bulk upload.'.warn);
    doBulkUpload = true;
  }

  //  If we are skipping the bulk upload then that takes priority
  if (skipBulk === true) {
    console.log('We have been told to skip a new bulk upload.'.warn);
    doBulkUpload = false;
  }

  if (forceResetIndex === true) {
    console.log('We have been told to reset the index.'.warn);
    resetIndex = true;
  }

  if (doBulkUpload === true) {
    const bulkJSONPretty = JSON.stringify(json, null, 4);
    fs.writeFileSync(`${outputDir}/bulk.json`, bulkJSONPretty, 'utf-8');
    const body = [].concat(...json.objects.map(object => [
      { update: { _id: object.object.id } },
      { doc: object.object, doc_as_upsert: true },
    ]));

    //  Delete any old index
    if (resetIndex === true) {
      const exists = await esclient.indices.exists({ index });
      if (exists) {
        console.log(`Removing old index for ${index}`);
        await esclient.indices.delete({ index });
      }
      console.log(`Creating new index for ${index}`);
      await esclient.indices.create({ index });
    }

    console.log('Doing bulk upload');
    await esclient.bulk({ body, type, index });
    return true;
  }

  if (doBulkUpload === false && resetIndex === true) {
    const exists = await esclient.indices.exists({ index });
    if (exists) {
      console.log(`Removing old index for ${index}`);
      await esclient.indices.delete({ index });
    }
    console.log(`Creating new index for ${index}`);
    await esclient.indices.create({ index });
    return false;
  }

  return false;
};

/**
 * This is going to split the json into individual item to dump down to disk.
 * Actually it's going to do a bit more than that, so we should probably rename
 * it at some point. This takes the JSON and breaks it down into each item,
 * which we _will_ check to see if we already have. If we don't it'll be new,
 * and need to be ingested. If it's different it'll need to be updated. But
 * if we already have it we don't have to ingest it.
 * @param {string} source   the string defining the source type (from config)
 * @param {Object} items    the collection of items to be split up
 * @returns {number}        how many json items we found
 */
const splitJson = async (source, items) => {
  //  We need to make sure the folder we are going to spit these out into
  //  exists
  if (config.onLambda) {
    console.error('We need Lambda code here');
    return 0;
  }
  const outputDir = `${tmsDir}/${source}`;
  const jsonDir = `${outputDir}/json`;
  const ingestDir = `${outputDir}/ingest`;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir);
  if (!fs.existsSync(ingestDir)) fs.mkdirSync(ingestDir);

  //  Now we need to fetch the hash table for this source
  const hashTable = await fetchHashTable(source);

  //  Now loop through the items writing out the JSON files
  //  TODO: Here I'm hardcoding the name of the node we want to pull out
  //  as we start dealing with other collections we'll define this based
  //  on the source
  const seekRoot = 'object';
  const counter = {
    total: 0,
    new: 0,
    modified: 0,
  };

  if (items.length === 1) {
    console.log(`Splitting JSON into ${items.length} separate file.`.help);
  } else {
    console.log(`Splitting JSON into ${items.length} separate files.`.help);
  }
  console.log(`Saving them into: ${jsonDir}`.help);

  items.forEach((item) => {
    const itemJSONPretty = JSON.stringify(item[seekRoot], null, 4);
    const itemHash = crypto
      .createHash('md5')
      .update(itemJSONPretty)
      .digest('hex');

    //  Check in the hashtable to see if this item already exist.
    //  If it doesn't already exist then we need to add it to the hashTable
    //  and write it into the `ingest` folder.
    const itemId = item[seekRoot].id;
    if (itemId === 123 || itemId === 4151) {
      // console.log(itemJSONPretty);
    }
    if (!(itemId in hashTable)) {
      counter.new += 1;
      hashTable[itemId] = {
        hash: itemHash,
        brlyInt: null,
        discovered: new Date().getTime(),
        updated: new Date().getTime(),
      };
      fs.writeFileSync(
        `${ingestDir}/id_${itemId}.json`,
        itemJSONPretty,
        'utf-8',
      );
    }

    //  Now we check to see if the hash is different, if so then it's been
    //  updated and we need to send the file to be ingested
    if (itemHash !== hashTable[itemId].hash) {
      counter.modified += 1;
      //  update the hash_table
      hashTable[itemId].hash = itemHash;
      hashTable[itemId].updated = new Date().getTime();
      //  Put the file into the `ingest` folder.
      fs.writeFileSync(
        `${ingestDir}/id_${itemId}.json`,
        itemJSONPretty,
        'utf-8',
      );
    }

    if (forceIngest === true) {
      hashTable[itemId].updated = new Date().getTime();
      //  Put the file into the `ingest` folder.
      fs.writeFileSync(
        `${ingestDir}/id_${itemId}.json`,
        itemJSONPretty,
        'utf-8',
      );
    }

    //  Now write out the file to the json directory
    fs.writeFileSync(`${jsonDir}/id_${itemId}.json`, itemJSONPretty, 'utf-8');
    counter.total += 1;
  });

  await storeHashTable(source, hashTable);

  if (counter.new === 1) {
    console.log('1 new item found'.help);
  } else {
    console.log(`${counter.new} new items found`.help);
  }
  if (counter.modified === 1) {
    console.log('1 modified item found'.help);
  } else {
    console.log(`${counter.new} modified items found`.help);
  }

  return counter;
};

/**
 * This splits the XML into individual parts and saves them to disk, using
 * _very_ ropey splits rather than anything clever. It should be good enough
 * for the moment
 * @param {string} source   the string defining the source type (from config)
 * @param {string} xml      the xml to split up
 * @returns {number}        how many xml items we found
 */
const splitXml = (source, xml) => {
  //  We need to make sure the folder we are going to spit these out into
  //  exists
  if (config.onLambda) {
    console.error('We need Lambda code here');
    return 0;
  }
  const outputDir = `${tmsDir}/${source}`;
  const outxmlDir = `${outputDir}/xml`;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  if (!fs.existsSync(outxmlDir)) fs.mkdirSync(outxmlDir);

  //  THIS IS BAD HARDCODED CODE BASED ON EXTERNAL SPECIFICATIONS
  const trimmedXml = xml
    .trim()
    .replace('<ExportForMPlus><objects>', '')
    .replace('</objects></ExportForMPlus>', '')
    .replace('<?xml version="1.0" encoding="utf-8"?>', '');
  const xmls = trimmedXml.split('</object>').map(chunk => `${chunk}</object>`);

  //  Now dump all the xml files
  let counter = 0;
  xmls.forEach((fragment) => {
    //  Because this is easier than REGEX ;)
    const id = fragment.split('"')[1];
    if (id) {
      fs.writeFileSync(`${outxmlDir}/id_${id}.xml`, pd.xml(fragment), 'utf-8');
      counter += 1;
    }
  });
  return counter;
};

/**
 * This kicks off the process of looking for the XML and converting it
 * to json.
 * @return {Object} contains counts of converted files
 */
const processXML = async () => {
  //  Check that we have the xml defined in the config
  if (!('xml' in config)) {
    console.error("No 'xml' element defined in config");
    return false;
  }

  //  Loop through them doing the xml conversion for each one
  //  NOTE: we are looping this way because we are firing off an `await`
  //  which modifies our counts object, so we're going to "sequentially"
  //  await the responses
  const counts = {};
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < config.xml.length; i += 1) {
    const { file, index, type } = config.xml[i];
    counts[index] = {
      file,
    };
    console.log(`About to check for ${index} in file ${file}`.help);

    //  TODO: Error check that the file actually exists
    if (fs.existsSync(`${xmlDir}/${file}`)) {
      console.log('Found file.'.warn);
      const xml = fs.readFileSync(`${xmlDir}/${file}`, 'utf-8');
      console.log('Converting XML to JSON, this may take a while.'.alert);
      const json = await parseString(index, xml);
      console.log('Finished conversion.'.alert);
      //  TODO: This may not be "json.objects" when we start using different
      //  xml imports
      counts[index].jsonCount = await splitJson(index, json.objects);
      await bulkUpload(index, type, json);
      counts[index].xmlCount = splitXml(index, xml);
    } else {
      console.log('File not found, skipping.'.error);
      counts[index].jsonCount = -1;
      counts[index].xmlCount = -1;
    }
    console.log('');
  }
  /* eslint-enable no-await-in-loop */

  return counts;
};

/**
 * This triggers a rebuild of indexes
 * @param {Object} counts An object that holds the counts to be displayed
 */
const triggerIndexRebuilds = async (counts) => {
  console.log(counts);
};

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

/**
 * This looks into the ingest folders to see if anything needs to be uploaded
 * @param {Object} counts An object that holds the counts to be displayed
 */
const upsertItems = async (counts, countBar) => {
  //  Count the number of items we have left to upload, making a note of the
  //  first one we find
  let itemsToUpload = 0;
  let itemIndex = null;
  let itemType = null;
  let itemFile = null;

  config.xml.forEach((source) => {
    const { index } = source;
    const ingestDir = `${tmsDir}/${index}/ingest`;
    if (fs.existsSync(ingestDir)) {
      const files = fs
        .readdirSync(ingestDir)
        .filter(file => file.split('.')[1] === 'json');
      itemsToUpload += files.length;
      if (files.length > 0) {
        itemIndex = index;
        itemType = source.type;
        [itemFile] = files;
      }
    }
  });

  //  If we have an itemIndex that isn't null it means
  //  we found at least one thing to upsert
  if (itemIndex !== null && itemType !== null && itemFile !== null) {
    //  Read in the file
    const item = fs.readFileSync(
      `${tmsDir}/${itemIndex}/ingest/${itemFile}`,
      'utf-8',
    );
    const itemJSON = JSON.parse(item);
    const { id } = itemJSON;

    //  Now we need to check to look in the hashTable for an artisanal
    //  integer. If there isn't one, we go fetch one and update the table
    //  If there is one, then we can just use that.
    const hashTable = await fetchHashTable(itemIndex);
    if (hashTable[id].brlyInt === null) {
      const brlyInt = await artisanalints.createArtisanalInt();
      hashTable[id].brlyInt = brlyInt;
      await storeHashTable(itemIndex, hashTable);
    }
    itemJSON.artInt = hashTable[id].brlyInt;

    //  If this is the first time we've called this function then we need to
    //  kick off the progress bar
    if (totalItemsToUpload === null) {
      totalItemsToUpload = itemsToUpload;
      itemsUploaded = 0;
      countBar.start(totalItemsToUpload, itemsUploaded, { myEta: '????ms' });
    }

    //  Now we do the ES upsert
    const index = itemIndex;
    const type = itemType;
    esclient
      .update({
        index,
        type,
        id,
        body: { doc: itemJSON, doc_as_upsert: true },
      })
      .then(() => {
        fs.unlinkSync(`${tmsDir}/${itemIndex}/ingest/${itemFile}`);
        itemsUploaded += 1;
        const timeDiff = new Date().getTime() - startTime;
        const aveTime = timeDiff / itemsUploaded;
        const remainingTime = aveTime * (totalItemsToUpload - itemsUploaded);
        const myEta = msToTime(remainingTime);
        countBar.update(itemsUploaded, {
          myEta,
        });
        setTimeout(() => {
          upsertItems(counts, countBar);
        }, 10);
      });
  } else {
    countBar.stop();
    triggerIndexRebuilds(counts);
  }
};

const start = async () => {
  console.log('About to start processing XML files.'.help);
  const counts = await processXML();
  // const counts = {};
  // reset the start time
  startTime = new Date().getTime();
  console.log('');
  console.log('Finished splitting files and any bulk uploads'.help);
  const countBar = new progress.Bar(
    {
      etaBuffer: 1,
      format: 'progress [{bar}] {percentage}% | ETA: {myEta} | {value}/{total}',
      hideCursor: true,
    },
    progress.Presets.shades_classic,
  );
  console.log('Now checking "ingest" folder for items to upsert'.help);
  upsertItems(counts, countBar);
};

process.argv.forEach((val) => {
  if (val.toLowerCase() === 'forcebulk') {
    forceBulk = true;
  }
  if (val.toLowerCase() === 'skipbulk') {
    skipBulk = true;
  }
  if (val.toLowerCase() === 'forceingest') {
    forceIngest = true;
  }
  if (val.toLowerCase() === 'resetindex') {
    forceResetIndex = true;
  }
  if (
    val.toLowerCase() === '/?' ||
    val.toLowerCase() === '?' ||
    val.toLowerCase() === '-h' ||
    val.toLowerCase() === '--h' ||
    val.toLowerCase() === '-help' ||
    val.toLowerCase() === '--help'
  ) {
    console.log('help text goes here!');
    process.exit(1);
  }
});
start();
