const xml2js = require('xml2js');
const colours = require('colors');
const fs = require('fs');
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
let tsmDir = null;

if (config.onLambda) {
  console.error('We need Lambda code here');
  process.exit(1);
} else {
  dataDir = `${rootDir}/app/data`;
  xmlDir = `${dataDir}/xml`;
  tsmDir = `${dataDir}/tsm`;

  // Make sure all the folders we need to use exist
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir);
  if (!fs.existsSync(tsmDir)) fs.mkdirSync(tsmDir);
}

/**
 * This converts an xml chunk into the JSON format we want
 * @param {string} xml the xml text we want to have parsed
 * @return {Object} the JSON obeject representation of the xml
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
 * This is going to split the json into individual item to dump down to disk.
 * Actually it's going to do a bit more than that, so we should probably rename
 * it at some point. This takes the JSON and breaks it down into each item,
 * which we _will_ check to see if we already have. If we don't it'll be new,
 * and need to be ingested. If it's different it'll need to be updated. But
 * if we already have it we don't have to ingest it.
 * @param {string} source   the string defining the source type (from config)
 * @param {Object} items    the collection of items to be split up
 */
const splitJson = (source, items) => {
  //  We need to make sure the folder we are going to spit these out into
  //  exists
  if (config.onLambda) {
    console.error('We need Lambda code here');
    return;
  }
  const outputDir = `${tsmDir}/${source}`;
  const jsonDir = `${outputDir}/json`;
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir);

  //  Now loop through the items writing out the XML files
  //  TODO: Here I'm hardcoding the name of the node we want to pull out
  //  as we start dealing with other collections we'll define this based
  //  on the source
  const seekRoot = 'object';
  items.forEach((item) => {
    const itemJSONPretty = JSON.stringify(item[seekRoot], null, 4);
    fs.writeFileSync(
      `${jsonDir}/id_${item[seekRoot].id}.json`,
      itemJSONPretty,
      'utf-8',
    );
  });
};

/**
 * This kicks off the process of looking for the XML and converting it
 * to json.
 * @return {Boolean}
 */
const processXML = async () => {
  //  Check that we have the xml defined in the config
  if (!('xml' in config)) {
    console.error("No 'xml' element defined in config");
    return false;
  }

  //  Loop through them doing the xml conversion for each one
  const sources = Object.entries(config.xml);
  sources.forEach(async (s) => {
    const source = s[0];
    const sourceFile = s[1];
    const xml = fs.readFileSync(`${xmlDir}/${sourceFile}`, 'utf-8');
    const json = await parseString(source, xml);
    //  TODO: This may not be "json.objects" when we start using different
    //  xml imports
    splitJson(source, json.objects);
  });
  return true;
};

processXML();
console.log('Done');
