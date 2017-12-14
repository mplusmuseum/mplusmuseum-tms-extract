const xml2js = require('xml2js')
const getStdin = require('get-stdin')

const parser = new xml2js.Parser({
  trim: true,
  explicitArray: false,
  explicitRoot: false,
  mergeAttrs: true
})

const parseText = text => ({text: text._, lang: text.lang})

const parseObjectOrArray = (obj, fn) => {
  if (obj === null || obj === undefined) return null
  if (Array.isArray(obj)) return obj.map(fn)
  if (typeof obj === 'object') return Object.values(obj).map(fn)
}

const parseAreaCategory = areacategory => ({
  rank: parseInt(areacategory.rank),
  type: areacategory.type,
  areacat: areacategory.areacat ? areacategory.areacat.map(parseText) : null
})

const parseMedia = media => ({
  rank: parseInt(media.rank),
  primarydisplay: parseInt(media.primarydisplay),
  filename: media.filename
})

const parseAuthors = authors => {
  return parseObjectOrArray(authors, parseAuthor)
}

const parseTitles = titles => {
  if (Array.isArray(titles)) {
    return parseObjectOrArray(titles, parseText)
  } else {
    return parseText(titles)
  }
}

const parseAuthor = author => {
  return {
    rank: parseInt(author.rank),
    author: parseInt(author.author),
    authornameid: parseInt(author.authornameid),
    nationality: author.nationality,
    name: author.name,
    birthyear_yearformed: parseInt(author.birthyear_yearformed),
    deathyear: parseInt(author.deathyear),
    roles: parseObjectOrArray(author.roles, parseText)
  }
}

const parseDate = date => new Date(date)

const parseVenues = venues => parseObjectOrArray(venues, parseVenue)

const parseVenue = venue => ({
  begindate: parseDate(venue.begindate),
  enddate: parseDate(venue.enddate),
  name: parseObjectOrArray(venue.name, parseText)
})

const parseExhibition = exhibition => ({
  begindate: parseDate(exhibition.begindate),
  enddate: parseDate(exhibition.enddate),
  title: exhibition.title ? parseText(exhibition.title.title) : null,
  venues: parseObjectOrArray(exhibition.venues, parseVenues)
})

const parseObject = o => ({
  id: parseInt(o.id),
  objectnumber: o.objectnumber,
  datebegin: parseFloat(o.datebegin),
  dateend: parseFloat(o.dateend),
  objectstatus: parseObjectOrArray(o.objectstatus.objectstatus, parseText),
  creditlines: parseObjectOrArray(o.creditlines, parseText),
  mediums: parseObjectOrArray(o.mediums, parseText),
  dimensions: parseObjectOrArray(o.dimensions, parseText),
  areacategories: parseObjectOrArray(o.areacategories.areacategory, parseAreaCategory),
  authors: parseObjectOrArray(o.authors, parseAuthors),
  medias: parseObjectOrArray(o.medias, parseMedia),
  titles: parseObjectOrArray(o.titles, parseTitles),
  dated: o.dated,
  exhibitions: parseObjectOrArray(o.exhibitions, parseExhibition),
  copyrightcreditlines: parseObjectOrArray(o.copyrightcreditlines, parseText),
  summaries: parseObjectOrArray(o.summaries, parseText)
})

const parseJsonObject = (type, jsonobject) => {
  switch (type) {
    case 'object':
      return parseObject(jsonobject)
  }
}

const tmsxmljson2cleanjson = (tmsxmljson, callback) => {
  const index = Object.keys(tmsxmljson)[0]
  const [type, objects] = Object.entries(tmsxmljson[index])[0]

  const cleanjson = {
    [index]: objects.map(object => ({ [type]: parseJsonObject(type, object) }))
  }

  callback(null, cleanjson)
}

module.exports = {
  tmsxml2json: function () {
    getStdin()
      .then(tmsxml => {
        parser.parseString(tmsxml, (err, tmsxmljson) => {
          if (err) console.error(err)
          tmsxmljson2cleanjson(tmsxmljson, (err, cleanjson) => {
            if (err) console.error(err)
            console.log(JSON.stringify(cleanjson))
          })
        })
      })
      .catch(err => {
        console.log(err)
        console.log(`tmsxml2json

    takes a TMS-XML file from stdin and prints it via stdout as json

    usage:

        yarn run --silent start tmsxml2json < ../data/ExportForDAM_Objects_UCS.xml`)
      })
  }
}
