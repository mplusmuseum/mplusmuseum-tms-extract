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

const getNames = names => {
  const namesObj = {}
  //  Make sure we have valid names
  if (names === undefined || names === null || !('name' in names)) return namesObj
  if (!Array.isArray(names.name)) names.name = [names.name]
  names.name.forEach((name) => {
    //  Make sure the language is in the namesObj
    if (!(name.lang in namesObj)) namesObj[name.lang] = {}
    namesObj[name.lang].id = name.id
    if ('alphasort' in name && Object.prototype.toString.call(name.alphasort) === '[object String]') {
      namesObj[name.lang].alphasort = name.alphasort
    }
    if ('displayname' in name && Object.prototype.toString.call(name.displayname) === '[object String]') {
      namesObj[name.lang].displayname = name.displayname
    }
  })
  return namesObj
}

const getBios = bios => {
  const biosObj = {}
  //  Make sure we have valid bios
  if (bios === undefined || bios === null || !('bio' in bios)) return biosObj
  if (!Array.isArray(bios.bio)) bios.bio = [bios.bio]
  bios.bio.forEach((bio) => {
    //  Make sure the language is in the namesObj
    if ('_' in bio && bio._ !== '' && bio._ !== null && bio._ !== undefined && 'lang' in bio && bio.lang !== '' && bio.lang !== null && bio.lang !== undefined) {
      if (!(bio.lang in biosObj)) biosObj[bio.lang] = bio._
    }
  })
  return biosObj
}

// #########################################################################
/*
 * The actual constituent parsing
 */
// #########################################################################

const parseConstituent = c => {
  const newConstituent = {
    constituentID: parseInt(c.id, 10),
    publicAccess: c.id === 1,
    name: getNames(c.names),
    type: 'type' in c ? c.type : null,
    gender: 'Gender' in c ? c.Gender : null,
    displayBio: getBios(c.bios),
    beginDate: null,
    deathyear: null,
    id: parseInt(c.id, 10)
  }
  //  Make sure the birth year is actually numeric and not 0
  if ('birthyear_yearformed' in c) {
    const newBirth = parseInt(c.birthyear_yearformed, 10)
    if (!isNaN(newBirth) && newBirth !== 0) newConstituent.beginDate = newBirth
  }

  if ('deathyear' in c) {
    const newDeath = parseInt(c.deathyear, 10)
    if (!isNaN(newDeath) && newDeath !== 0) newConstituent.deathyear = newDeath
  }

  return newConstituent
}

const processFile = async (tms, filename) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newConstituents = 0
  let modifiedConstituents = 0
  let totalConstituents = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  //  We need to read in the XML file and convert it to JSON
  const XMLRaw = fs.readFileSync(filename, 'utf-8')

  //  Before we do anything with the JSON version, I want to split the
  //  XML up into seperate chunks so we can store those too.
  const splitRaw = XMLRaw
    .replace('<?xml version="1.0" encoding="utf-8"?><ExportForMPlus><authors>', '')
    .replace('</authors></ExportForMPlus>', '')
    .split('</author>')
    .map((xml) => `${xml}</author>`)

  //  Now we need to make sure an XML directory exists to put these files into
  if (!fs.existsSync(path.join(rootDir, 'constituents'))) fs.mkdirSync(path.join(rootDir, 'constituents'))
  if (!fs.existsSync(path.join(rootDir, 'constituents', tms))) fs.mkdirSync(path.join(rootDir, 'constituents', tms))
  if (!fs.existsSync(path.join(rootDir, 'constituents', tms, 'xml'))) fs.mkdirSync(path.join(rootDir, 'constituents', tms, 'xml'))

  splitRaw.forEach((xml) => {
    const xmlSplit = xml.split('"')
    if (xmlSplit.length > 2) {
      const id = parseInt(xmlSplit[1], 10)
      if (!isNaN(id)) {
        const subFolder = String(Math.floor(id / 1000) * 1000)
        if (!fs.existsSync(path.join(rootDir, 'constituents', tms, 'xml', subFolder))) fs.mkdirSync(path.join(rootDir, 'constituents', tms, 'xml', subFolder))
        const filename = path.join(rootDir, 'constituents', tms, 'xml', subFolder, `${id}.xml`)
        fs.writeFileSync(filename, xmlformat(xml), 'utf-8')
      }
    }
  })

  //  Add try catch here
  let constituentsJSON = null
  try {
    const json = await new Promise((resolve, reject) =>
      parser.parseString(XMLRaw, (err, result) => {
        if (err) {
          reject(err)
        }
        resolve(result)
      }))
    constituentsJSON = json.authors.author.map((constituent) => parseConstituent(constituent))
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

  tmsLogger.object(`New constituentFile uploaded for tms ${tms}`, {
    action: 'upload',
    stub: tms,
    ms: new Date().getTime() - startTime
  })

  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */
  //  In theory we now have a valid(ish) constituents file. Let's go through
  //  it now and work out how many constituents are new or modified
  constituentsJSON.forEach((constituent) => {
    totalConstituents += 1
    const id = parseInt(constituent.id, 10)
    const subFolder = String(Math.floor(id / 1000) * 1000)
    const filename = path.join(rootDir, 'constituents', tms, 'processed', subFolder, `${id}.json`)

    //  See if the files exists in processed, if it doesn't then it's a new file
    let needToUpload = false
    if (!fs.existsSync(filename)) {
      tmsLogger.object(`Creating process file for constituent ${id} for ${tms}`, {
        action: 'new',
        id: id,
        stub: tms
      })
      newConstituents += 1
      needToUpload = true
    } else {
      //  We need to read in the file and compare to see if it's different
      const processedFileRaw = fs.readFileSync(filename, 'utf-8')
      const processedFile = JSON.stringify(JSON.parse(processedFileRaw))
      const thisConstituent = JSON.stringify(constituent)
      //  If there's a difference between the constituents then we know it's been modified
      //  and we need to upload it.
      if (thisConstituent !== processedFile) {
        needToUpload = true
        modifiedConstituents += 1
        //  Remove it from the processed fold, to force us to reupload it
        fs.unlinkSync(filename)
        tmsLogger.object(`Found changed constituent JSON for constituent ${id} for ${tms}`, {
          action: 'modified',
          id: id,
          stub: tms
        })
      }
    }

    //  If we need to upload the file then pop it into the process folder
    if (needToUpload === true) {
      if (!fs.existsSync(path.join(rootDir, 'constituents'))) {
        fs.mkdirSync(path.join(rootDir, 'constituents'))
      }
      if (!fs.existsSync(path.join(rootDir, 'constituents', tms))) {
        fs.mkdirSync(path.join(rootDir, 'constituents', tms))
      }
      if (!fs.existsSync(path.join(rootDir, 'constituents', tms, 'process'))) {
        fs.mkdirSync(path.join(rootDir, 'constituents', tms, 'process'))
      }
      if (!fs.existsSync(path.join(rootDir, 'constituents', tms, 'process', subFolder))) {
        fs.mkdirSync(path.join(rootDir, 'constituents', tms, 'process', subFolder))
      }
      const newFilename = path.join(rootDir, 'constituents', tms, 'process', subFolder, `${id}.json`)
      const processedFileJSONPretty = JSON.stringify(constituent, null, 4)
      fs.writeFileSync(newFilename, processedFileJSONPretty, 'utf-8')
    }
  })

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in
  let constituentFields = []
  const constituentsFieldsFilename = path.join(rootDir, 'constituents', tms, 'constituentFields.json')
  if (fs.existsSync(constituentsFieldsFilename)) {
    constituentFields = fs.readFileSync(constituentsFieldsFilename, 'utf-8')
    constituentFields = JSON.parse(constituentFields)
  }
  const constituentFieldsMap = {}

  //  Now go through all the constituents looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new
  constituentsJSON.forEach((constituent) => {
    Object.keys(constituent).forEach((key) => {
      //  If we don't have a record, then add it to the fields
      if (!constituentFields.includes(key)) {
        constituentFields.push(key)
        //  If we don't already have it in the fields, then it's
        //  all new
        if (!(key in constituentFieldsMap)) {
          constituentFieldsMap[key] = true
        }
      } else {
        //  If we don't have it, then we need to add it to the map
        //  but it's not new as it already exists in the array
        if (!(key in constituentFieldsMap)) {
          constituentFieldsMap[key] = false
        }
      }
    })
  })

  //  Now write the fields back out so we can compare against them next time
  const constituentFieldsJSONPretty = JSON.stringify(constituentFields, null, 4)
  fs.writeFileSync(constituentsFieldsFilename, constituentFieldsJSONPretty, 'utf-8')

  const endTime = new Date().getTime()
  tmsLogger.object(`Finished uploading constituent JSON file for constituent ${tms}`, {
    action: 'finished',
    stub: tms,
    newConstituents,
    modifiedConstituents,
    totalConstituents,
    ms: endTime - startTime
  })

  return {
    fields: constituentFieldsMap,
    type: 'constituents',
    newConstituents,
    modifiedConstituents,
    totalConstituents,
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
