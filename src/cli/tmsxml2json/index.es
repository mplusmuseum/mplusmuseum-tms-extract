const xml2js = require('xml2js');
const colours = require('colors');
const fs = require('fs');

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
const objectsDir = `${dataDir}/objects`;
const jsonDir = `${objectsDir}/json`;
const ingestDir = `${objectsDir}/ingest`;
// Make sure all the folders we need to use exist
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir);
if (!fs.existsSync(objectsDir)) fs.mkdirSync(objectsDir);
if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir);
if (!fs.existsSync(ingestDir)) fs.mkdirSync(ingestDir);

//  TODO: the source file may be fed in or fetched from somewhere else
const sourceFile = 'ExportForMPlus_Objects_UCS.xml';

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

/*
This is where we check to see if the directory that the source XML files
should be put in.
*/
console.log('Checking for XML directory'.info);
if (!fs.existsSync(xmlDir)) {
  console.log('There is no /app/data/xml folder.'.alert);
  console.log('Create the folder and add the XML files'.alert);
  process.exit(1);
}
console.log('We have the source directory'.info);

/*
Now we check to see if we have the XML file in there.
*/
console.log('Checking for XML file'.info);
if (!fs.existsSync(`${xmlDir}/${sourceFile}`)) {
  console.log(`Missing file: ${sourceFile}`.alert);
  process.exit(1);
}
console.log('We have the source XML file'.info);

/*
Here we read in the XML file and spit out individual converted JSON files
*/
const processXML = async (xml) => {
  const tmsxmljson = await new Promise((resolve, reject) =>
    parser.parseString(xml, (err, result) => {
      if (err) {
        reject(err);
      }
      resolve(result);
    }));
  const index = Object.keys(tmsxmljson)[0];
  const [type, objects] = Object.entries(tmsxmljson[index])[0];
  const cleanjson = {
    [index]: objects.map(object => ({ [type]: parseJsonObject(type, object) })),
  };

  //  Now I want to write out the files
  cleanjson.objects.forEach((object) => {
    const objectJSONPretty = JSON.stringify(object.object, null, 4);
    fs.writeFileSync(
      `${jsonDir}/object_${object.object.id}.json`,
      objectJSONPretty,
      'utf-8',
    );
  });
};

const tmsxml = fs.readFileSync(`${xmlDir}/${sourceFile}`, 'utf-8');
try {
  processXML(tmsxml);
  console.log('Done');
} catch (er) {
  console.error('Something went wrong while parsing!');
  console.error(er);
}
