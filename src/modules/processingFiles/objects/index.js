const Config = require('../../../classes/config')
const xml2js = require('xml2js')
const xmlformat = require('xml-formatter')
const parser = new xml2js.Parser({
  trim: true,
  explicitArray: false,
  explicitRoot: false,
  mergeAttrs: true
})
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../logging')
const artisanalints = require('../../artisanalints')

// #########################################################################
/*
These are all the cool parse functions to get the data into the right format
*/
// #########################################################################

const getConsituents = authors => {
  const consituentsObj = {
    ids: [],
    idsToRoleRank: {}
  }
  if (authors === null || authors === undefined) return null
  if (!('author' in authors)) return null
  if (authors.author === null) return null

  if (!Array.isArray(authors.author)) authors.author = [authors.author]
  authors.author.forEach((author) => {
    //  Populate the ids and idsToRoleRank with the author IDs
    if ('author' in author) {
      const authorId = parseInt(author.author, 10)
      if (!consituentsObj.ids.includes(authorId)) consituentsObj.ids.push(authorId)
      if (!(authorId in consituentsObj.idsToRoleRank)) consituentsObj.idsToRoleRank[authorId] = {}

      //  Now do the ranks
      if ('rank' in author) {
        const rank = parseInt(author.rank, 10)
        consituentsObj.idsToRoleRank[authorId].rank = rank
      }

      //  And do the same for the role
      if ('roles' in author) {
        const roles = author.roles
        if ('role' in roles) {
          const role = roles.role
          if ('_' in role && role._ !== null && role._ !== undefined && role._ !== '' && 'lang' in role && role.lang !== null && role.lang !== undefined && role.lang !== '') {
            consituentsObj.idsToRoleRank[authorId].role = {}
            consituentsObj.idsToRoleRank[authorId].role[role.lang] = role._
          }
        }
      }
    }
  })
  consituentsObj.idsToRoleRank = [consituentsObj.idsToRoleRank]
  return consituentsObj
}

const getSortnumber = objectNumber => {
  //  We have a sort number, if the objectNumber is numeric then we can use
  //  it for the sort number, if it's not then we just leave it null
  let sortNumber = null
  if (!isNaN(parseFloat(objectNumber))) {
    sortNumber = parseFloat(objectNumber)
  }
  return sortNumber
}

const getClassifications = classifications => {
  const classificationsObj = {}
  if ('areacategory' in classifications) {
    if (!Array.isArray(classifications.areacategory)) classifications.areacategory = [classifications.areacategory]
    classifications.areacategory.forEach((area) => {
      if ('type' in area) {
        const areaLower = area.type.toLowerCase()
        if (!(areaLower in classificationsObj)) {
          classificationsObj[areaLower] = {}
        }
        if ('rank' in area) {
          classificationsObj[areaLower].rank = parseInt(area.rank, 10)
        }
        if ('areacat' in area) {
          if (!Array.isArray(area.areacat)) area.areacat = [area.areacat]
          classificationsObj[areaLower].areacat = {}
          area.areacat.forEach((area) => {
            classificationsObj[areaLower].areacat[area.lang] = area._
          })
        }
      }
    })
  }
  return classificationsObj
}

//  Extract all the languages out of the data object we have been passed
const getTextByLanguage = (objThing, key) => {
  //  Make sure the key actually exists
  if (objThing === null || objThing === undefined || !(key in objThing)) return null
  if (!Array.isArray(objThing[key])) objThing[key] = [objThing[key]]
  const rtnObj = {}
  objThing[key].forEach((textLang) => {
    if ('lang' in textLang && '_' in textLang && textLang.lang !== null && textLang.lang !== '' && textLang._ !== null && textLang._ !== '') {
      rtnObj[textLang.lang] = textLang._
    }
  })
  return rtnObj
}

// #########################################################################
/*
 * The actual object parsing
 */
// #########################################################################
const parseObject = o => {
  const newObject = {
    objectID: parseInt(o.id, 10),
    publicAccess: parseInt(o.PublicAccess, 10) === 1,
    objectNumber: o.objectnumber,
    sortNumber: getSortnumber(o.objectnumber),
    classification: getClassifications(o.areacategories),
    consituents: getConsituents(o.authors),
    title: getTextByLanguage(o.titles, 'title'),
    displayDate: o.dated,
    beginDate: parseFloat(o.datebegin),
    endDate: parseFloat(o.dateend),
    dimension: getTextByLanguage(o.dimensions, 'dimensions'),
    medium: getTextByLanguage(o.mediums, 'medium'),
    creditLine: getTextByLanguage(o.creditlines, 'creditline'),
    id: parseInt(o.id, 10)
  }
  return newObject
}

const processFile = async (tms, filename) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newObjects = 0
  let modifiedObjects = 0
  let totalObjects = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  //  We need to read in the XML file and convert it to JSON
  const XMLRaw = fs.readFileSync(filename, 'utf-8')

  //  Before we do anything with the JSON version, I want to split the
  //  XML up into seperate chunks so we can store those too.
  const splitRaw = XMLRaw
    .replace('<?xml version="1.0" encoding="utf-8"?><ExportForMPlus><objects>', '')
    .replace('</objects></ExportForMPlus>', '')
    .split('</object>')
    .map((xml) => `${xml}</object>`)

  //  Now we need to make sure an XML directory exists to put these files into
  if (!fs.existsSync(path.join(rootDir, 'objects'))) fs.mkdirSync(path.join(rootDir, 'objects'))
  if (!fs.existsSync(path.join(rootDir, 'objects', tms))) fs.mkdirSync(path.join(rootDir, 'objects', tms))
  if (!fs.existsSync(path.join(rootDir, 'objects', tms, 'xml'))) fs.mkdirSync(path.join(rootDir, 'objects', tms, 'xml'))

  splitRaw.forEach((xml) => {
    const xmlSplit = xml.split('"')
    if (xmlSplit.length > 2) {
      const id = parseInt(xmlSplit[1], 10)
      if (!isNaN(id)) {
        const subFolder = String(Math.floor(id / 1000) * 1000)
        if (!fs.existsSync(path.join(rootDir, 'objects', tms, 'xml', subFolder))) fs.mkdirSync(path.join(rootDir, 'objects', tms, 'xml', subFolder))
        const filename = path.join(rootDir, 'objects', tms, 'xml', subFolder, `${id}.xml`)
        fs.writeFileSync(filename, xmlformat(xml), 'utf-8')
      }
    }
  })

  //  Add try catch here
  let objectsJSON = null
  try {
    const json = await new Promise((resolve, reject) =>
      parser.parseString(XMLRaw, (err, result) => {
        if (err) {
          reject(err)
        }
        resolve(result)
      }))
    objectsJSON = json.objects.object.map((object) => parseObject(object))
  } catch (er) {
    console.log(er)
    tmsLogger.object(`Failed to parse that file tms ${tms}`, {
      action: 'error',
      stub: tms
    })
    return {
      status: 'error',
      msg: 'Sorry, we failed to parse that file, please try again.'
    }
  }

  tmsLogger.object(`New objectFile uploaded for tms ${tms}`, {
    action: 'upload',
    stub: tms,
    ms: new Date().getTime() - startTime
  })

  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */
  //  In theory we now have a valid(ish) objects file. Let's go through
  //  it now and work out how many objects are new or modified
  objectsJSON.forEach((object) => {
    totalObjects += 1
    const id = parseInt(object.id, 10)
    const subFolder = String(Math.floor(id / 1000) * 1000)
    const filename = path.join(rootDir, 'objects', tms, 'processed', subFolder, `${id}.json`)

    //  See if the files exists in processed, if it doesn't then it's a new file
    let needToUpload = false
    if (!fs.existsSync(filename)) {
      tmsLogger.object(`Creating process file for object ${id} for ${tms}`, {
        action: 'new',
        id: id,
        stub: tms
      })
      newObjects += 1
      needToUpload = true
    } else {
      //  We need to read in the file and compare to see if it's different
      const processedFileRaw = fs.readFileSync(filename, 'utf-8')
      const processedFile = JSON.stringify(JSON.parse(processedFileRaw))
      const thisObject = JSON.stringify(object)
      //  If there's a difference between the objects then we know it's been modified
      //  and we need to upload it.
      if (thisObject !== processedFile) {
        needToUpload = true
        modifiedObjects += 1
        //  Remove it from the processed fold, to force us to reupload it
        fs.unlinkSync(filename)
        tmsLogger.object(`Found changed object JSON for object ${id} for ${tms}`, {
          action: 'modified',
          id: id,
          stub: tms
        })
      }
    }

    //  If we need to upload the file then pop it into the process folder
    if (needToUpload === true) {
      if (!fs.existsSync(path.join(rootDir, 'objects'))) {
        fs.mkdirSync(path.join(rootDir, 'objects'))
      }
      if (!fs.existsSync(path.join(rootDir, 'objects', tms))) {
        fs.mkdirSync(path.join(rootDir, 'objects', tms))
      }
      if (!fs.existsSync(path.join(rootDir, 'objects', tms, 'process'))) {
        fs.mkdirSync(path.join(rootDir, 'objects', tms, 'process'))
      }
      if (!fs.existsSync(path.join(rootDir, 'objects', tms, 'process', subFolder))) {
        fs.mkdirSync(path.join(rootDir, 'objects', tms, 'process', subFolder))
      }
      const newFilename = path.join(rootDir, 'objects', tms, 'process', subFolder, `${id}.json`)
      const processedFileJSONPretty = JSON.stringify(object, null, 4)
      fs.writeFileSync(newFilename, processedFileJSONPretty, 'utf-8')
    }
  })

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in
  let objectFields = []
  const objectsFieldsFilename = path.join(rootDir, 'objects', tms, 'objectFields.json')
  if (fs.existsSync(objectsFieldsFilename)) {
    objectFields = fs.readFileSync(objectsFieldsFilename, 'utf-8')
    objectFields = JSON.parse(objectFields)
  }
  const objectFieldsMap = {}

  //  Now go through all the objects looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new
  objectsJSON.forEach((object) => {
    Object.keys(object).forEach((key) => {
      //  If we don't have a record, then add it to the fields
      if (!objectFields.includes(key)) {
        objectFields.push(key)
        //  If we don't already have it in the fields, then it's
        //  all new
        if (!(key in objectFieldsMap)) {
          objectFieldsMap[key] = true
        }
      } else {
        //  If we don't have it, then we need to add it to the map
        //  but it's not new as it already exists in the array
        if (!(key in objectFieldsMap)) {
          objectFieldsMap[key] = false
        }
      }
    })
  })

  //  Now write the fields back out so we can compare against them next time
  const objectFieldsJSONPretty = JSON.stringify(objectFields, null, 4)
  fs.writeFileSync(objectsFieldsFilename, objectFieldsJSONPretty, 'utf-8')

  const endTime = new Date().getTime()
  tmsLogger.object(`Finished uploading object JSON file for object ${tms}`, {
    action: 'finished',
    stub: tms,
    newObjects: newObjects,
    modifiedObjects: modifiedObjects,
    totalObjects: totalObjects,
    ms: endTime - startTime
  })

  return {
    fields: objectFieldsMap,
    type: 'objects',
    newObjects,
    modifiedObjects,
    totalObjects,
    ms: endTime - startTime
  }
}
exports.processFile = processFile

/*
   ##################################################################################
   ##################################################################################
   ##################################################################################
   ##################################################################################

   The code below deals with getting the extra "perfect" details that come from
   outside of the system. Such as artisanal integers, and in the future the
   images.

   A file can only be upserted when a perfect file exists. So these go to the effort
   of making perfect files for each file waiting to be processed, once a perfect
   file has been made, then the upsert can happen.

   ##################################################################################
   ##################################################################################
   ##################################################################################
   ##################################################################################
*/

//  Go look in the process folder for files that we need to make a perfect version of
//  and make sure we have all the information in there we need
const makePerfect = async () => {
  const config = new Config()
  const tmsses = config.get('tms')

  if (tmsses === null) return

  let foundItemToUpload = false
  let processFilename = null
  let perfectFilename = null

  tmsses.forEach((tms) => {
    if (foundItemToUpload === true) return
    const tmsProcessDir = path.join(rootDir, 'objects', tms.stub, 'process')
    const tmsPerfectDir = path.join(rootDir, 'objects', tms.stub, 'perfect')
    if (fs.existsSync(tmsProcessDir)) {
      if (foundItemToUpload === true) return
      const subFolders = fs.readdirSync(tmsProcessDir)
      subFolders.forEach((subFolder) => {
        if (foundItemToUpload === true) return
        const files = fs.readdirSync(path.join(tmsProcessDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          if (foundItemToUpload === true) return
          //  Make sure the directories exists
          if (!fs.existsSync(tmsPerfectDir)) fs.mkdirSync(tmsPerfectDir)
          if (!fs.existsSync(path.join(tmsPerfectDir, subFolder))) fs.mkdirSync(path.join(tmsPerfectDir, subFolder))
          const testPerfectFilename = path.join(tmsPerfectDir, subFolder, file)
          if (!(fs.existsSync(testPerfectFilename))) {
            foundItemToUpload = true
            processFilename = path.join(tmsProcessDir, subFolder, file)
            perfectFilename = path.join(tmsPerfectDir, subFolder, file)
          }
        })
      })
    }
  })

  if (foundItemToUpload && processFilename !== null) {
    const processFileJSON = {}
    processFileJSON.artInt = await artisanalints.createArtisanalInt()
    const perfectFilePretty = JSON.stringify(processFileJSON, null, 4)
    fs.writeFileSync(perfectFilename, perfectFilePretty, 'utf-8')
  }
}

const startMakingPerfect = () => {
  const config = new Config()
  const timers = config.get('timers')
  let interval = 20000
  if (timers !== null && 'elasticsearch' in timers) {
    interval = parseInt(timers.elasticsearch, 10)
  }
  setInterval(() => {
    makePerfect()
  }, interval / 1.5)
  makePerfect()
}
exports.startMakingPerfect = startMakingPerfect