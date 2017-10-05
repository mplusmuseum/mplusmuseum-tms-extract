class parse {
  text(text) {
    return {text: text._, lang: text.lang}
  }
}

const parseObjectOrArray = (obj, fn) => {
  if (obj === null) return null
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

const parseAuthor = author => ({
  rank: parseInt(author.rank),
  author: parseInt(author.author),
  authornameid: parseInt(author.authornameid),
  nationality: author.nationality,
  name: author.name,
  birthyear_yearformed: parseInt(author.birthyear_yearformed),
  deathyear: parseInt(author.deathyear),
  roles: parseObjectOrArray(author.roles, parseText)
})

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

