// const parseText = text => ({ text: text._, lang: text.lang })

const cleanNotNullText = (text) => {
  if (typeof text === 'string') {
    return text
  }
  return null
}

const parseObjectOrArray = (obj, fn) => {
  if (obj === null || obj === undefined) return null
  let rtnObject = null

  if (Array.isArray(obj)) {
    rtnObject = obj.map(fn)
  } else {
    if (typeof obj === 'object') {
      rtnObject = [obj].map(fn)
    }
  }
  if (rtnObject !== null) {
    if (Array.isArray(rtnObject) && rtnObject.length === 1 && Array.isArray(rtnObject[0])) {
      [rtnObject] = rtnObject
    }
    return rtnObject
  }
  return null
}

const parseName = (name) => {
  const newName = {}

  newName.id = name.id
  newName.lang = name.lang
  newName.fnord = name.fnord
  newName.institution = cleanNotNullText(name.institution)
  newName.alphasort = cleanNotNullText(name.alphasort)
  newName.displayname = cleanNotNullText(name.displayname)

  if (newName.institution === null) delete newName.institution
  if (newName.alphasort === null) delete newName.displayname
  if (newName.displayname === null) delete newName.displayname

  return newName
}

const parseAuthor = (a) => {
  const newAuthor = {}
  newAuthor.id = parseInt(a.id, 10)
  /*
   * And now we start a whole bunch of very obvious and boring
   * if statements to make sure everything is as it should be.
   * We could shorten all this down as it looks a little funky
   * but we may want to add more checks in at some point.
   */
  if ('birthyear_yearformed' in a) {
    newAuthor.birthyear_yearformed = parseInt(a.birthyear_yearformed, 10)
  } else {
    newAuthor.birthyear_yearformed = null
  }

  if ('deathyear' in a) {
    newAuthor.deathyear = parseInt(a.deathyear, 10)
  } else {
    newAuthor.deathyear = null
  }

  if ('publicaccess' in a) {
    newAuthor.publicaccess = parseInt(a.publicaccess, 10)
  } else {
    newAuthor.publicaccess = null
  }

  if ('type' in a) {
    newAuthor.type = a.type
  } else {
    newAuthor.type = null
  }

  if ('names' in a && 'name' in a.names) {
    newAuthor.names = parseObjectOrArray(a.names.name, parseName)
  } else {
    newAuthor.names = null
  }

  return newAuthor
}

exports.parseJson = json => parseAuthor(json)
