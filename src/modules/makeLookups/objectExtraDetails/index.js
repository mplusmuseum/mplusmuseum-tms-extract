const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../../modules/logging')
const elasticsearch = require('elasticsearch')

const getExtraDetails = async (tms) => {
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`starting getExtraDetails`, {
    action: 'start getAreas',
    status: 'info'
  })

  const startTime = new Date().getTime()

  //  Check to see if we have elastic search configured, if we don't then
  //  there's no point doing anything
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'finished getExtraDetails',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Look through all the processed files grabbing the ids of publicAccess objects
  const tmsPerfectDir = path.join(rootDir, 'imports', 'Objects', tms, 'perfect')
  //  Don't do anything if the folder doesn't exist
  if (!fs.existsSync(tmsPerfectDir)) {
    tmsLogger.object(`No elasticsearch tmsPerfectDir for tms ${tms}`, {
      action: 'finished getExtraDetails',
      tms,
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }
  const tmsProcessedDir = path.join(rootDir, 'imports', 'Objects', tms, 'processed')
  if (!fs.existsSync(tmsProcessedDir)) {
    tmsLogger.object(`No elasticsearch tmsProcessedDir for tms ${tms}`, {
      action: 'finished getExtraDetails',
      tms,
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  let doThisFile = null
  let cutoff = new Date().getTime() + (1000 * 60 * 60 * 24)
  const subFolders = fs.readdirSync(tmsPerfectDir)
  subFolders.forEach((subFolder) => {
    const files = fs.readdirSync(path.join(tmsPerfectDir, subFolder)).filter(file => {
      const fileFragments = file.split('.')
      if (fileFragments.length !== 2) return false
      if (fileFragments[1] !== 'json') return false
      return true
    })

    //  Now read in each file and find the keywords
    files.forEach((file) => {
      if (doThisFile === null) {
        const perfectRaw = fs.readFileSync(path.join(tmsPerfectDir, subFolder, file), 'utf-8')
        const perfectJSON = JSON.parse(perfectRaw)
        if (!perfectJSON.lastChecked || perfectJSON.lastChecked >= cutoff) {
          //  Check to see if the processed version exists, as we'll need that one too!
          if (fs.existsSync(path.join(tmsProcessedDir, subFolder, file))) {
            doThisFile = parseInt(file.split('.')[0], 10)
          }
        }
      }
    })
  })

  if (doThisFile !== null) {
    const subFolder = String(Math.floor(doThisFile / 1000) * 1000)
    const perfectRaw = fs.readFileSync(path.join(tmsPerfectDir, subFolder, `${doThisFile}.json`), 'utf-8')
    const perfectJSON = JSON.parse(perfectRaw)
    const processedRaw = fs.readFileSync(path.join(tmsProcessedDir, subFolder, `${doThisFile}.json`), 'utf-8')
    const processedJSON = JSON.parse(processedRaw)
    const processedJSONNew = JSON.parse(processedRaw)

    // #############################################
    // #############################################
    // #############################################
    //
    //  Now we want to check the constituents
    //
    let constituentsToCheck = []
    if (processedJSON.consituents && processedJSON.consituents.ids && processedJSON.consituents.ids.length > 0) {
      constituentsToCheck = processedJSON.consituents.ids
    }

    //  If we have some, then
    const constituentsPublic = []
    const constituentsPrivate = []
    if (constituentsToCheck.length > 0) {
      const constituentsProcessedDir = path.join(rootDir, 'imports', 'Constituents', tms, 'processed')
      constituentsToCheck.forEach((id) => {
        const subFolder = String(Math.floor(id / 1000) * 1000)
        const filename = path.join(constituentsProcessedDir, subFolder, `${id}.json`)
        if (fs.existsSync(filename)) {
          const constituentRaw = fs.readFileSync(filename, 'utf-8')
          const constituentsJSON = JSON.parse(constituentRaw)
          if ('publicAccess' in constituentsJSON) {
            if (constituentsJSON.publicAccess === true) constituentsPublic.push(id)
            if (constituentsJSON.publicAccess === false) constituentsPrivate.push(id)
          }
        }
      })
    }
    //  Now we check to see if the public/private constituents are any different to the
    //  ones we already have in the file
    if (!perfectJSON.constituentsPublic || JSON.stringify(perfectJSON.constituentsPublic !== JSON.stringify(constituentsPublic))) {
      perfectJSON.constituentsPublic = constituentsPublic
      processedJSONNew.constituentsPublic = constituentsPublic
    }
    if (!perfectJSON.constituentsPrivate || JSON.stringify(perfectJSON.constituentsPrivate !== JSON.stringify(constituentsPrivate))) {
      perfectJSON.constituentsPrivate = constituentsPrivate
      processedJSONNew.constituentsPrivate = constituentsPrivate
    }
    //
    // #############################################
    // #############################################
    // #############################################

    //  Now save out the perfect file
    perfectJSON.lastChecked = new Date().getTime()
    fs.writeFileSync(path.join(tmsPerfectDir, subFolder, `${doThisFile}.json`), JSON.stringify(perfectJSON, null, 4), 'utf-8')

    //  See if we need to upload the file
    if (JSON.stringify(processedJSON) !== JSON.stringify(processedJSONNew)) {
      //  Update the database
      const esclient = new elasticsearch.Client(elasticsearchConfig)
      const index = `objects_${tms}`.toLowerCase()
      const exists = await esclient.indices.exists({
        index
      })
      if (exists === false) {
        await esclient.indices.create({
          index
        })
      }
      const updateObj = {
        index,
        type: 'object',
        id: doThisFile,
        refresh: true,
        body: {
          doc: processedJSONNew,
          doc_as_upsert: true
        }
      }
      //  Upsert the item
      esclient.update(updateObj)
    }
  }

  //  Do it again!
  setTimeout(() => {
    getExtraDetails(tms)
  }, 1000)
}

exports.startExtraDetails = () => {
  //  Remove the old interval timer
  // clearInterval(global.findConstituentRoles)
  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  if (!config) return
  if (!config.tms) return
  // const interval = 1000 * 60 * 3 // 20 seconds
  config.tms.forEach((tms) => {
    getExtraDetails(tms.stub)
  })
}
