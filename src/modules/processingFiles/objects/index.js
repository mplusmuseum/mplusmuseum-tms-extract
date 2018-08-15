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

/*
const knownFields = {
  areacategories: true,
  areacategory_concat: true,
  authors: true,
  authors_concat: true,
  copyrightcreditlines: true,
  creditlines: true,
  datebegin: true,
  dated: true,
  dateend: true,
  dimensions: true,
  exhibitions: true,
  exhibitions_concat: true,
  exhlabels: true,
  id: true,
  medias: true,
  mediums: true,
  MPlusRights: true,
  MPlusRightsFlexFields: true,
  objectnumber: true,
  objectstatus: true,
  PublicAccess: true,
  summaries: true,
  titles: true
}
*/

/* Current GraphQL query
{
  artwork(id: 1814) {
    id
    objectNumber
    area {
      id
    }
    areacategories {
      rank
      type
    }
    dated
    category {
      id
    }
    creditLines {
      lang
      text
    }
    dated
    dateEnd
    dateBegin
    dimensions {
      lang
      text
    }
    makers {
      id
      birthyear_yearformed
      deathyear
      name
      rank
      roles {
        lang
        text
      }
    }
    medium {
      id
      artworks {
        id
      }
      makers {
        id
      }
      name {
        lang
        text
      }

    }
    medias {
      rank
      primarydisplay
      filename
      exists
      remote
      width
      height
      baseUrl
      squareUrl
      smallUrl
      mediumUrl
      largeUrl
    }
    objectNumber
    objectStatus {
      lang
      text
    }
    titles {
      lang
      text
    }
  }
}
*/

/* areacategories */
const parseAreaCategory = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.rank
    delete item.type
    delete item.areacat
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      rank: parseInt(item.rank, 10),
      type: item.type,
      areacat: item.areacat ? item.areacat.map(parseText) : null
    }
  })
  return rtnArray
}

/* areacategory_concat */
const parseAreaCategoryConcat = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.value
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      value: item.value
    }
  })
  return rtnArray
}

/* authors (called makers) */
const parseAuthors = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.rank
    delete item.author
    delete item.authornameid
    delete item.nationality
    delete item.name
    delete item.birthyear_yearformed
    delete item.deathyear
    delete item.roles
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      rank: parseInt(item.rank, 10),
      maker: parseInt(item.author, 10),
      makernameid: parseInt(item.authornameid, 10),
      nationality: item.nationality,
      name: item.name,
      birthyear_yearformed: parseInt(item.birthyear_yearformed, 10),
      deathyear: parseInt(item.deathyear, 10),
      roles: parseObjectOrArray(item.roles, parseText)
    }
  })
  return rtnArray
}

/* authors_concat (called makers) */
const parseAuthorsConcat = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.ID
    delete item.authorNames
    delete item.authorNationalities
    delete item.authorBeginDate
    delete item.authorEndDate
    delete item.authors
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      id: item.ID,
      makerNames: item.authorNames,
      makerNationalities: item.authorNationalities,
      makerBeginDate: item.authorBeginDate,
      makerEndDate: item.authorEndDate,
      makers: item.authors
    }
  })
  return rtnArray
}

/* exhibitions */
const parseExhibitions = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.begindate
    delete item.enddate
    delete item.title
    delete item.venues
    delete item.ExhibitionID
    delete item.Section
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      begindate: parseDate(item.begindate),
      enddate: parseDate(item.enddate),
      ExhibitionID: item.ExhibitionID,
      Section: item.Section,
      title: parseObjectOrArray(item.title, parseText),
      venues: parseObjectOrArray(item.venues, parseVenues)
    }
  })
  return rtnArray
}

/* exhibitions > venues */
const parseVenues = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.begindate
    delete item.enddate
    delete item.name
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      begindate: parseDate(item.begindate),
      enddate: parseDate(item.enddate),
      name: parseObjectOrArray(item.name, parseText)
    }
  })
  return rtnArray
}

/* exhibitions_concat */
const parseExhibitionsConcat = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.ObjectID
    delete item.exhinfo
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      ObjectID: item.ObjectID,
      exhinfo: item.exhinfo
    }
  })
  return rtnArray
}

/* exhlabels */
const parseExhlabels = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item._
    delete item.lang
    delete item.purpose
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      text: item._,
      lang: item.lang,
      purpose: item.purpose
    }
  })
  return rtnArray
}

/* medias */
const parseMedia = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.rank
    delete item.primarydisplay
    delete item.filename
    delete item.PublicAccess
    delete item.imagecreditlines
    delete item.imagecaption
    delete item.alttext
    if (Object.entries(item).length > 0) console.log(item)
    */
    const rtnObject = {
      rank: parseInt(item.rank, 10),
      PublicAccess: parseInt(item.PublicAccess, 10) === 1,
      primarydisplay: parseInt(item.primarydisplay, 10) === 1,
      filename: item.filename,
      alttext: item.alttext ? parseText(item.alttext.alttext) : null
    }

    if (item.imagecreditlines) {
      rtnObject.imagecreditlines = parseText(
        item.imagecreditlines.imagecreditline
      )
    } else {
      rtnObject.imagecreditlines = null
    }

    if (item.imagecaption) {
      rtnObject.imagecaption = parseText(item.imagecaption.imagecaption)
    } else {
      rtnObject.imagecaption = null
    }

    return rtnObject
  })
  return rtnArray
}

/* MPlusRights */
const parseMPlusRights = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.ObjRightsID
    delete item.ObjectID
    delete item.ObjRightsTypeID
    delete item.ObjRightsType
    delete item.ContractNumber
    delete item.CopyrightRegNumber
    delete item.Copyright
    delete item.Restrictions
    delete item.CreditLineRepro
    delete item.AgreementSentISO
    delete item.AgreementSignedISO
    delete item.ExpirationISODate
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      ObjRightsID: parseInt(item.ObjRightsID, 10),
      ObjectID: parseInt(item.ObjectID, 10),
      ObjRightsTypeID: parseInt(item.ObjRightsTypeID, 10),
      ObjRightsType: item.ObjRightsType,
      ContractNumber: item.ContractNumber,
      CopyrightRegNumber: item.CopyrightRegNumber,
      Copyright: item.Copyright,
      Restrictions: item.Restrictions,
      AgreementSentISO: item.AgreementSentISO,
      AgreementSignedISO: item.AgreementSignedISO,
      ExpirationISODate: item.ExpirationISODate,
      CreditLineRepro: item.CreditLineRepro
    }
  })
  return rtnArray
}

/* MPlusRightsFlexFields */
const parseMPlusRightsFlexFields = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry
    .map(item => {
      /* A curios way to check we have all the fields
      delete item.RightGroup
      delete item.Value
      delete item.Date
      delete item.Remarks
      if (Object.entries(item).length > 0) console.log(item)
      */
      if ('Rights' in item) return null
      return {
        RightGroup: item.RightGroup,
        Value: item.Value,
        Date: item.Value,
        Remarks: item.Value
      }
    })
    .filter(item => item !== null)
  return rtnArray
}

/* MPlusRightsFlexFieldsConcat */
const parseMPlusRightsFlexFieldsConcat = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry
    .map(item => {
      if (!('Rights' in item)) return null
      return {
        Rights: item.Rights,
        Remarks: item.Value
      }
    })
    .filter(item => item !== null)
  return rtnArray
}

// #########################################################################
/*
These are all the cool parse functions to get the data into the right format
*/
// #########################################################################
const parseInnerText = text => ({
  text: text._,
  lang: text.lang
})

const parseText = text => {
  if (Array.isArray(text)) {
    return parseObjectOrArray(text, parseInnerText)
  }
  return parseInnerText(text)
}

const parseDate = date => new Date(date)

const parseObjectOrArray = (obj, fn) => {
  if (obj === null || obj === undefined) return null
  let rtnObject = null

  if (Array.isArray(obj)) {
    rtnObject = obj.map(fn)
  }
  if (typeof obj === 'object') {
    rtnObject = Object.values(obj).map(fn)
  }
  if (rtnObject !== null) {
    //  See if we have a single array inside an array
    //  if so pop it up
    if (
      Array.isArray(rtnObject) &&
      rtnObject.length === 1 &&
      Array.isArray(rtnObject[0])
    ) {
      rtnObject = rtnObject[0]
    }
    //  Get rid of empty arrays
    rtnObject = rtnObject.filter(arr => {
      if (Array.isArray(arr) && arr.length === 0) return false
      return true
    })
    //  Check for array in array _again_
    if (
      Array.isArray(rtnObject) &&
      rtnObject.length === 1 &&
      Array.isArray(rtnObject[0])
    ) {
      rtnObject = rtnObject[0]
    }
    return rtnObject
  }
  return null
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
    titles: parseObjectOrArray(o.titles, parseText),
    displayDate: o.dated,
    beginDate: parseFloat(o.datebegin),
    endDate: parseFloat(o.dateend),
    dimensions: parseObjectOrArray(o.dimensions, parseText),
    mediums: parseObjectOrArray(o.mediums, parseText),
    creditLines: parseObjectOrArray(o.creditlines, parseText),
    /*
    areacategories: parseObjectOrArray(o.areacategories, parseAreaCategory),
    areacategory_concat: parseObjectOrArray(
      o.areacategory_concat,
      parseAreaCategoryConcat
    ),
    makers: parseObjectOrArray(o.authors, parseAuthors),
    makers_concat: parseObjectOrArray(o.authors_concat, parseAuthorsConcat),
    copyrightcreditlines: parseObjectOrArray(o.copyrightcreditlines, parseText),
    exhibitions: parseObjectOrArray(o.exhibitions, parseExhibitions),
    exhibitions_concat: parseObjectOrArray(
      o.exhibitions_concat,
      parseExhibitionsConcat
    ),
    exhlabels: parseObjectOrArray(o.exhlabels, parseExhlabels),
    medias: parseObjectOrArray(o.medias, parseMedia),
    MPlusRights: parseObjectOrArray(o.MPlusRights, parseMPlusRights),
    MPlusRightsFlexFields: parseObjectOrArray(
      o.MPlusRightsFlexFields,
      parseMPlusRightsFlexFields
    ),
    MPlusRightsFlexFields_concat: parseObjectOrArray(
      o.MPlusRightsFlexFields,
      parseMPlusRightsFlexFieldsConcat
    ),
    objectstatus: parseObjectOrArray(o.objectstatus, parseText),
    summaries: parseObjectOrArray(o.summaries, parseText),
    */
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
    const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
    const processFileJSON = JSON.parse(processFileRaw)
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
  }, interval / 2)
  makePerfect()
}
exports.startMakingPerfect = startMakingPerfect