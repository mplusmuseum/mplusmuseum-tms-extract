const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../../modules/logging')
const elasticsearch = require('elasticsearch')

const createRandomSelection = async (tms) => {
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`starting createRandomSelection`, {
    action: 'start createRandomSelection',
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
      action: 'finished createRandomSelection',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Look through all the processed files grabbing the ids of publicAccess objects
  const tmsProcessedDir = path.join(rootDir, 'imports', 'Objects', tms, 'processed')
  //  Don't do anything if the folder doesn't exist
  if (!fs.existsSync(tmsProcessedDir)) {
    tmsLogger.object(`No elasticsearch tmsProcessedDir for tms ${tms}`, {
      action: 'finished createRandomSelection',
      tms,
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  const subFolders = fs.readdirSync(tmsProcessedDir)

  //  Here's where we're going to collate the constituents with their role
  const objectIds = []

  subFolders.forEach((subFolder) => {
    const files = fs.readdirSync(path.join(tmsProcessedDir, subFolder)).filter(file => {
      const fileFragments = file.split('.')
      if (fileFragments.length !== 2) return false
      if (fileFragments[1] !== 'json') return false
      return true
    })

    //  Now read in each file and find the consitiuents
    files.forEach((file) => {
      const objectRaw = fs.readFileSync(path.join(tmsProcessedDir, subFolder, file), 'utf-8')
      const objectJSON = JSON.parse(objectRaw)
      if (objectJSON.publicAccess) objectIds.push(objectJSON.id)
    })
  })

  //  Grab a random selection from the ids
  const shuffled = objectIds.map(a => [Math.random(), a])
    .sort((a, b) => a[0] - b[0])
    .map(a => a[1])
    .slice(0, 30)

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `randomobjects_${tms}`
  const type = 'randomobjects'
  const exists = await esclient.indices.exists({
    index
  })
  if (exists !== true) {
    await esclient.indices.create({
      index
    })
  }

  const data = {
    id: 0,
    ids: shuffled
  }
  esclient.update({
    index,
    type,
    id: 0,
    body: {
      doc: data,
      doc_as_upsert: true
    }
  })

  tmsLogger.object(`All ids upserted`, {
    action: 'finished createRandomSelection',
    status: 'ok',
    tms,
    ms: new Date().getTime() - startTime
  })
}
exports.createRandomSelection = createRandomSelection

exports.startCreatingRandomSelection = () => {
  //  Remove the old interval timer
  clearInterval(global.findConstituentRoles)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  if (!config) return
  if (!config.tms) return
  const interval = 1000 * 60 * 60 * 24 // 24 hours
  config.tms.forEach((tms) => {
    global.findConstituentRoles = setInterval(() => {
      createRandomSelection(tms.stub)
    }, interval)
    setTimeout(() => {
      createRandomSelection(tms.stub)
    }, 1000 * 60 * 6)
  })
  const tmsLogger = logging.getTMSLogger()
  tmsLogger.object(`In startCreatingRandomSelection`, {
    action: 'startCreatingRandomSelection',
    status: 'info'
  })
}
