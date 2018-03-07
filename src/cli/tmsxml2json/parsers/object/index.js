/*
These are all the cool parse functions to get the data into the right format@@@
*/
const parseText = text => ({ text: text._, lang: text.lang });

const parseObjectOrArray = (obj, fn) => {
  if (obj === null || obj === undefined) return null;
  let rtnObject = null;

  if (Array.isArray(obj)) {
    rtnObject = obj.map(fn);
  }
  if (typeof obj === 'object') {
    rtnObject = Object.values(obj).map(fn);
  }
  if (rtnObject !== null) {
    if (
      Array.isArray(rtnObject) &&
      rtnObject.length === 1 &&
      Array.isArray(rtnObject[0])
    ) {
      [rtnObject] = rtnObject;
    }
    return rtnObject;
  }
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

exports.parseJson = json => parseObject(json);
