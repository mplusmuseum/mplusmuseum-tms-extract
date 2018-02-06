const xml2js = require('xml2js');
const colours = require('colors');
const fs = require('fs');
const config = require('../../../config.json');

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
const dataDir = `${rootDir}/app/data`;
const xmlDir = `${dataDir}/xml`;
const tsmDir = `${dataDir}/tsm`;

// Make sure all the folders we need to use exist
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir);
if (!fs.existsSync(tsmDir)) fs.mkdirSync(tsmDir);

/*
These are all the cool parse functions to get the data into the right format
*/
const parseText = text => ({ text: text._, lang: text.lang });

const parseObjectOrArray = (obj, fn) => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(fn);
  if (typeof obj === 'object') return Object.values(obj).map(fn);
  return null;
};

const parseAreaCategory = areacategory => ({
  rank: parseInt(areacategory.rank, 10),
  type: areacategory.type,
  areacat: areacategory.areacat ? areacategory.areacat.map(parseText) : null,
});

const parseMedia = media => ({
  rank: parseInt(media.rank, 10),
  primarydisplay: parseInt(media.primarydisplay, 10) === 1,
  filename: media.filename,
});

const parseTitles = (titles) => {
  if (Array.isArray(titles)) {
    return parseObjectOrArray(titles, parseText);
  }
  return parseText(titles);
};

const parseAuthor = author => ({
  rank: parseInt(author.rank, 10),
  author: parseInt(author.author, 10),
  authornameid: parseInt(author.authornameid, 10),
  nationality: author.nationality,
  name: author.name,
  birthyear_yearformed: parseInt(author.birthyear_yearformed, 10),
  deathyear: parseInt(author.deathyear, 10),
  roles: parseObjectOrArray(author.roles, parseText),
});

const parseAuthors = authors => parseObjectOrArray(authors, parseAuthor);

const parseDate = date => new Date(date);

const parseVenue = venue => ({
  begindate: parseDate(venue.begindate),
  enddate: parseDate(venue.enddate),
  name: parseObjectOrArray(venue.name, parseText),
});

const parseVenues = venues => parseObjectOrArray(venues, parseVenue);

const parseExhibition = exhibition => ({
  begindate: parseDate(exhibition.begindate),
  enddate: parseDate(exhibition.enddate),
  title: exhibition.title ? parseText(exhibition.title.title) : null,
  venues: parseObjectOrArray(exhibition.venues, parseVenues),
});

const parseObject = o => ({
  id: parseInt(o.id, 10),
  objectnumber: o.objectnumber,
  datebegin: parseFloat(o.datebegin),
  dateend: parseFloat(o.dateend),
  objectstatus: parseObjectOrArray(o.objectstatus.objectstatus, parseText),
  creditlines: parseObjectOrArray(o.creditlines, parseText),
  mediums: parseObjectOrArray(o.mediums, parseText),
  dimensions: parseObjectOrArray(o.dimensions, parseText),
  areacategories: parseObjectOrArray(
    o.areacategories.areacategory,
    parseAreaCategory,
  ),
  authors: parseObjectOrArray(o.authors, parseAuthors),
  medias: parseObjectOrArray(o.medias, parseMedia),
  titles: parseObjectOrArray(o.titles, parseTitles),
  dated: o.dated,
  exhibitions: parseObjectOrArray(o.exhibitions, parseExhibition),
  copyrightcreditlines: parseObjectOrArray(o.copyrightcreditlines, parseText),
  summaries: parseObjectOrArray(o.summaries, parseText),
});

const parseJsonObject = (type, jsonobject) => {
  switch (type) {
    case 'object':
      return parseObject(jsonobject);
    default:
      return null;
  }
};

/**
 * This converts an xml chunk into the JSON format we want
 * @param {string} xml the xml text we want to have parsed
 * @return {Object} the JSON obeject representation of the xml
 */
const parseString = async (xml) => {
  try {
    const json = await new Promise((resolve, reject) =>
      parser.parseString(xml, (err, result) => {
        if (err) {
          reject(err);
        }
        resolve(result);
      }));
    const index = Object.keys(json)[0];
    const [type, objects] = Object.entries(json[index])[0];
    const cleanjson = {
      [index]: objects.map(object => ({
        [type]: parseJsonObject(type, object),
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
    const objectJSONPretty = JSON.stringify(item[seekRoot], null, 4);
    fs.writeFileSync(
      `${jsonDir}/id_${item[seekRoot].id}.json`,
      objectJSONPretty,
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
    const json = await parseString(xml);
    splitJson(source, json.objects);
  });
  return true;
};

processXML();
console.log('Done');
