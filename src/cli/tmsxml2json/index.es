const xml2js = require('xml2js');
const { pd } = require('pretty-data');
const colours = require('colors');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../../../config.json');
const parseObject = require('./parsers/object');

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
      }),
    );

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
const fetchHashTable = async source => {
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

  //  Now loop through the items writing out the XML files
  //  TODO: Here I'm hardcoding the name of the node we want to pull out
  //  as we start dealing with other collections we'll define this based
  //  on the source
  const seekRoot = 'object';
  const counter = {
    total: 0,
    new: 0,
    modified: 0,
  };
  items.forEach(item => {
    const itemJSONPretty = JSON.stringify(item[seekRoot], null, 4);
    const itemHash = crypto
      .createHash('md5')
      .update(itemJSONPretty)
      .digest('hex');

    //  Check in the hashtable to see if this item already exist.
    //  If it doesn't already exist then we need to add it to the hashTable
    //  and write it into the `ingest` folder.
    const itemId = item[seekRoot].id;
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

    //  Now write out the file to the json directory
    fs.writeFileSync(`${jsonDir}/id_${itemId}.json`, itemJSONPretty, 'utf-8');
    counter.total += 1;
  });

  await storeHashTable(source, hashTable);

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
  xmls.forEach(fragment => {
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
  const sources = Object.entries(config.xml).map(v => v[0]);
  const counts = {};
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    const sourceFile = config.xml[source];
    counts[source] = {
      file: sourceFile,
    };

    //  TODO: Error check that the file actually exists
    if (fs.existsSync(`${xmlDir}/${sourceFile}`)) {
      const xml = fs.readFileSync(`${xmlDir}/${sourceFile}`, 'utf-8');
      const json = await parseString(source, xml);
      //  TODO: This may not be "json.objects" when we start using different
      //  xml imports
      counts[source].jsonCount = await splitJson(source, json.objects);
      counts[source].xmlCount = splitXml(source, xml);
    } else {
      counts[source].jsonCount = -1;
      counts[source].xmlCount = -1;
    }
  }
  /* eslint-enable no-await-in-loop */

  return counts;
};

const start = async () => {
  const counts = await processXML();
  console.log('Done:');
  console.log(counts);
};
start();
