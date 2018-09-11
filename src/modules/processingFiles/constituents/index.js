const Config = require('../../../classes/config')
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../logging')
const artisanalints = require('../../artisanalints')

// #########################################################################
/*
 * The actual constituent parsing
 */
// #########################################################################

const parseItem = item => {
  const newItem = {
    constituentID: parseInt(item.AuthorID, 10),
    publicAccess: parseInt(item.PublicAccess, 10) === 1,
    name: {},
    type: 'ConstituentType' in item ? item.ConstituentType : null,
    gender: {},
    displayBio: {},
    nationality: {},
    region: {},
    activeCity: {},
    birthCity: {},
    deathCity: {},
    beginDate: null,
    deathyear: null,
    id: parseInt(item.AuthorID, 10)
  }

  //  Make sure the birth year is actually numeric and not 0
  if ('BeginDate' in item) {
    const newBirth = parseInt(item.BeginDate, 10)
    if (!isNaN(newBirth) && newBirth !== 0) newItem.beginDate = newBirth
  }

  if ('EndDate' in item) {
    const newDeath = parseInt(item.EndDate, 10)
    if (!isNaN(newDeath) && newDeath !== 0) newItem.EndDate = newDeath
  }

  // Grab extra name information
  if ('Name' in item) {
    newItem.name['en'] = {
      'displayName': item.Name
    }
    if ('AlphaSort' in item) {
      newItem.name['en'].alphasort = item.AlphaSort
    }
  }
  if ('NameTC' in item) {
    newItem.name['zh-hant'] = {
      'displayName': item.NameTC
    }
    if ('AlphaSortTC' in item) {
      newItem.name['zh-hant'].alphasort = item.AlphaSortTC
    } else {
      newItem.name['zh-hant'].alphasort = item.NameTC
    }
  }

  if ('Gender' in item) newItem.gender['en'] = item.Gender
  if ('GenderTC' in item) newItem.gender['zh-hant'] = item.GenderTC
  if ('DisplayBio' in item) newItem.displayBio['en'] = item.DisplayBio
  if ('DisplayBioTC' in item) newItem.displayBio['zh-hant'] = item.DisplayBioTC
  if ('Nationality' in item) newItem.nationality['en'] = item.Nationality
  if ('NationalityTC' in item) newItem.nationality['zh-hant'] = item.NationalityTC
  if ('Region' in item) newItem.region['en'] = item.Region
  if ('RegionTC' in item) newItem.region['zh-hant'] = item.RegionTC
  if ('ActiveCity' in item) newItem.activeCity['en'] = item.ActiveCity
  if ('ActiveCityTC' in item) newItem.activeCity['zh-hant'] = item.ActiveCityTC
  if ('BirthCity' in item) newItem.birthCity['en'] = item.BirthCity
  if ('BirthCityTC' in item) newItem.birthCity['zh-hant'] = item.BirthCity
  if ('DeathCity' in item) newItem.deathCity['en'] = item.DeathCity
  if ('DeathCityTC' in item) newItem.deathCity['zh-hant'] = item.DeathCityTC

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

  const filename = path.join(rootDir, 'imports', parentNode, tms, 'files.json')
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
    const tmsProcessDir = path.join(rootDir, 'constituents', tms.stub, 'process')
    const tmsPerfectDir = path.join(rootDir, 'constituents', tms.stub, 'perfect')
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
