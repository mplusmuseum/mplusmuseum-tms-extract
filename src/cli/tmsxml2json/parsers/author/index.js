const parseLangText = (text) => {
  const rtnText = {}
  if ('_' in text) rtnText.text = text._
  if ('lang' in text) rtnText.lang = text.lang
  return rtnText
}

/*
 * This function is for dealing with a very specific set of "things"
 * where the format is...
 * <things>
 *   <thing lang="en">foo</thing>
 *   <thing lang="en">bar</thing>
 *   <thing lang="es">baz</thing>
 * </things>
 * ...because we pass each item over to parseLangText which is looking
 * for the 'lang' and the content.
 *
 * Due to how we get things back from the XML -> JSON parser it has in
 * its wisdom decided that if there's a number of the same items it'll
 * give us an array of objects back. _But_ if there's only one item
 * then it'll just give us the object, this checks the "thing" and
 * decideds if it's an array or not, if not it turns it into one.
 * NOTE: There's an assuption going on here that the object is the
 * same as the items that would normally be in an array.
 *
 * We do have other places where we may have an array or object, but
 * we need to handle those in their own way
 */
const arrayObject = (thing) => {
  let mapThis = thing
  if (Array.isArray(mapThis) === false) mapThis = [mapThis]
  const newThing = mapThis.map((p) => {
    return parseLangText(p)
  })
  return newThing
}

const cleanNotNullText = (text) => {
  if (typeof text === 'string') {
    return text
  }
  return null
}

const parseObjectOrArray = (obj, fn) => {
  if (obj === null || obj === undefined) return null
  let rtnObject = null

  //  If we already have an array then we can just throw it at the function
  if (Array.isArray(obj)) {
    rtnObject = obj.map(fn)
  } else {
    //  Otherwise things can be a little trick, it seem that if it isn't an
    //  array then it should just be an object, but can we ever really make
    //  that assumption?
    if (typeof obj === 'object') {
      //  This is what happens when we have just a single item, we don't
      //  up with an array of length 1 (that would be too useful) we
      //  end up with a single element from what would be the array.
      //  Here I'm kind of cheating and just throwing it into an array
      //  but we should probably do a little bit more checking around
      //  this first.
      rtnObject = [obj].map(fn)
    }
  }

  //  Now we have to do a slightly crazy check here to make sure we haven't
  //  somehow ended up with nested arrays [[hello!]] of a single element,
  //  when all we really want is just [hello].
  //  The correct thing to do is sort out why we're getting nested arrays
  //  but for the moment lets just unpack them.
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

  //  Grab all the easy to grab things
  newName.id = name.id
  newName.lang = name.lang
  newName.firstname = cleanNotNullText(name.firstname)
  newName.lastname = cleanNotNullText(name.lastname)
  newName.institution = cleanNotNullText(name.institution)
  newName.alphasort = cleanNotNullText(name.alphasort)
  newName.displayname = cleanNotNullText(name.displayname)

  if (newName.firstname === null) delete newName.firstname
  if (newName.lastname === null) delete newName.lastname
  if (newName.institution === null) delete newName.institution
  if (newName.alphasort === null) delete newName.alphasort
  if (newName.displayname === null) delete newName.displayname

  return newName
}

const parsePlace = (place) => {
  const newPlace = {}

  //  Grab all the easy to grab things
  newPlace.type = place.type

  if ('placename' in place) {
    newPlace.placename = arrayObject(place.placename)
  }

  if ('placenamesearch' in place) {
    newPlace.placenamesearch = arrayObject(place.placenamesearch)
  }

  if ('nation' in place) {
    newPlace.nation = arrayObject(place.nation)
  }

  if ('continent' in place) {
    newPlace.continent = arrayObject(place.continent)
  }

  if (newPlace.type === null) delete newPlace.type

  return newPlace
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
  }

  if ('deathyear' in a) {
    newAuthor.deathyear = parseInt(a.deathyear, 10)
  }

  newAuthor.nationality = a.Nationality
  newAuthor.type = a.type

  if ('names' in a && 'name' in a.names) {
    newAuthor.names = parseObjectOrArray(a.names.name, parseName)
  }

  if ('bios' in a && 'bio' in a.bios) {
    newAuthor.bios = arrayObject(a.bios.bio)
  }

  if ('places' in a && 'place' in a.places) {
    newAuthor.places = parseObjectOrArray(a.places.place, parsePlace)
  }

  if ('PublicAccess' in a) {
    newAuthor.publicaccess = parseInt(a.PublicAccess, 10)
  }

  return newAuthor
}

exports.parseJson = json => parseAuthor(json)
