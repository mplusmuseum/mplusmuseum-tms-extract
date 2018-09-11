const Config = require('../../../classes/config')
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

const getVenues = venues => {
  if (venues === null || venues === undefined) return null
  if (typeof (venues) === 'string') {
    venues = [{
      _: venues
    }]
  }
  if (!Array.isArray(venues)) venues = [venues]
  const venuesObj = {
    titles: {
      'en': [],
      'zh-hant': []
    },
    venues: {
      'en': [],
      'zh-hant': []
    }
  }
  venues.forEach((venue) => {
    if ('_' in venue) {
      const venueObj = {
        title: venue._
      }
      if ('VenueBeginDate' in venue) {
        venueObj.beginDate = new Date(venue.VenueBeginDate)
        venueObj.beginDateStr = venue.VenueBeginDate
      }
      if ('VenueEndDate' in venue) {
        venueObj.endDate = new Date(venue.VenueEndDate)
        venueObj.endDateStr = venue.VenueEndDate
      }
      venuesObj.titles['en'].push(venue._)
      venuesObj.venues['en'].push(venueObj)
    }
  })
  return venuesObj
}

// #########################################################################
/*
 * The actual constituent parsing
 */
// #########################################################################

const parseItem = item => {
  const newItem = {
    exhibitionID: parseInt(item.ExhibitionID, 10),
    type: 'ExhibitionType' in item ? item.ExhibitionType : null,
    title: {},
    venues: getVenues(item.Venue),
    beginDate: 'ExhibitionBeginDate' in item ? new Date(item.ExhibitionBeginDate) : null,
    beginDateStr: 'ExhibitionBeginDate' in item ? item.ExhibitionBeginDate : null,
    endDate: 'ExhibitonEndDate' in item ? new Date(item.ExhibitonEndDate) : null,
    endDateStr: 'ExhibitonEndDate' in item ? item.ExhibitonEndDate : null,
    id: parseInt(item.ExhibitionID, 10)
  }

  if ('ExhTitle' in item) newItem.title['en'] = item.ExhTitle
  if ('ExhTitleTC' in item) newItem.title['zh-hant'] = item.ExhTitleTC

  return newItem
}

const processJsonFile = async (tms, parentNode, childNode) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newItems = 0
  let modifiedItems = 0
  let totalItems = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  const filename = path.join(rootDir, 'imports', parentNode, tms, 'items.json')
  if (!fs.existsSync(filename)) {
    console.log('Cant find file: ', filename)
  }
  const itemsRAW = fs.readFileSync(filename, 'utf-8')
  const itemsJSON = JSON.parse(itemsRAW)[childNode].map((item) => parseItem(item))
  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */
  //  In theory we now have a valid(ish) objects file. Let's go through
  //  it now and work out how many objects are new or modified
  itemsJSON.forEach((item) => {
    totalItems += 1
    const id = parseInt(item.id, 10)
    const subFolder = String(Math.floor(id / 1000) * 1000)
    const filename = path.join(rootDir, 'imports', parentNode, tms, 'processed', subFolder, `${id}.json`)

    //  See if the files exists in processed, if it doesn't then it's a new file
    let needToUpload = false
    if (!fs.existsSync(filename)) {
      tmsLogger.object(`Creating process file for ${childNode} ${id} for ${tms}`, {
        action: 'new',
        type: childNode,
        id: id,
        stub: tms
      })
      newItems += 1
      needToUpload = true
    } else {
      //  We need to read in the file and compare to see if it's different
      const processedFileRaw = fs.readFileSync(filename, 'utf-8')
      const processedFile = JSON.stringify(JSON.parse(processedFileRaw))
      const thisItem = JSON.stringify(item)
      //  If there's a difference between the objects then we know it's been modified
      //  and we need to upload it.
      if (thisItem !== processedFile) {
        needToUpload = true
        modifiedItems += 1
        //  Remove it from the processed fold, to force us to reupload it
        fs.unlinkSync(filename)
        tmsLogger.object(`Found changed ${childNode} JSON for ${childNode} ${id} for ${tms}`, {
          action: 'modified',
          type: childNode,
          id: id,
          stub: tms
        })
      }
    }

    //  If we need to upload the file then pop it into the process folder
    if (needToUpload === true) {
      if (!fs.existsSync(path.join(rootDir, 'imports'))) {
        fs.mkdirSync(path.join(rootDir, 'imports'))
      }
      if (!fs.existsSync(path.join(rootDir, 'imports', parentNode))) {
        fs.mkdirSync(path.join(rootDir, 'imports', parentNode))
      }
      if (!fs.existsSync(path.join(rootDir, 'imports', parentNode, tms))) {
        fs.mkdirSync(path.join(rootDir, 'imports', parentNode, tms))
      }
      if (!fs.existsSync(path.join(rootDir, 'imports', parentNode, tms, 'process'))) {
        fs.mkdirSync(path.join(rootDir, 'imports', parentNode, tms, 'process'))
      }
      if (!fs.existsSync(path.join(rootDir, 'imports', parentNode, tms, 'process', subFolder))) {
        fs.mkdirSync(path.join(rootDir, 'imports', parentNode, tms, 'process', subFolder))
      }
      const newFilename = path.join(rootDir, 'imports', parentNode, tms, 'process', subFolder, `${id}.json`)
      const processedFileJSONPretty = JSON.stringify(item, null, 4)
      fs.writeFileSync(newFilename, processedFileJSONPretty, 'utf-8')
    }
  })

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in
  let itemFields = []
  const itemFieldsFilename = path.join(rootDir, 'imports', parentNode, tms, 'fields.json')
  if (fs.existsSync(itemFieldsFilename)) {
    itemFields = fs.readFileSync(itemFieldsFilename, 'utf-8')
    itemFields = JSON.parse(itemFields)
  }
  const itemFieldsMap = {}

  //  Now go through all the objects looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new
  itemsJSON.forEach((item) => {
    Object.keys(item).forEach((key) => {
      //  If we don't have a record, then add it to the fields
      if (!itemFields.includes(key)) {
        itemFields.push(key)
        //  If we don't already have it in the fields, then it's
        //  all new
        if (!(key in itemFieldsMap)) {
          itemFieldsMap[key] = true
        }
      } else {
        //  If we don't have it, then we need to add it to the map
        //  but it's not new as it already exists in the array
        if (!(key in itemFieldsMap)) {
          itemFieldsMap[key] = false
        }
      }
    })
  })

  //  Now write the fields back out so we can compare against them next time
  const itemFieldsJSONPretty = JSON.stringify(itemFields, null, 4)
  fs.writeFileSync(itemFieldsFilename, itemFieldsJSONPretty, 'utf-8')

  const endTime = new Date().getTime()
  tmsLogger.object(`Finished uploading ${parentNode} JSON file for ${childNode} ${tms}`, {
    action: 'finished',
    stub: tms,
    type: parentNode,
    newItems,
    modifiedItems,
    totalItems,
    ms: endTime - startTime
  })

  return {
    fields: itemFieldsMap,
    type: parentNode,
    newItems,
    modifiedItems,
    totalItems,
    ms: endTime - startTime
  }
}
exports.processJsonFile = processJsonFile

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
    const tmsProcessDir = path.join(rootDir, 'imports', 'Exhibitions', tms.stub, 'process')
    const tmsPerfectDir = path.join(rootDir, 'imports', 'Exhibitions', tms.stub, 'perfect')
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
