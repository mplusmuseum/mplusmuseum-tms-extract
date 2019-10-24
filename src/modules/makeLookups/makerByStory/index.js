const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../../modules/logging')
// const utils = require('../../../modules/utils')
const elasticsearch = require('elasticsearch')

const makeMakerByStory = async (tms) => {
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`starting getAreas`, {
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
      action: 'finished makeMakersByStory',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  const referenceIds = []
  const referenceIdsToStory = {}

  //  Look through all the processed files grabbing the ids of publicAccess objects
  const tmsObjectProcessedDir = path.join(rootDir, 'imports', 'Objects', tms, 'processed')
  const tmsBibiolographicDataProcessedDir = path.join(rootDir, 'imports', 'BibiolographicData', tms, 'processed')

  //  Don't do anything if the folder doesn't exist
  if (!fs.existsSync(tmsObjectProcessedDir) || !fs.existsSync(tmsBibiolographicDataProcessedDir)) {
    tmsLogger.object(`No elasticsearch tmsProcessedDir or tmsBibiolographicDataProcessedDir for tms ${tms}`, {
      action: 'finished createRandomSelection',
      tms,
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  const subFolders = fs.readdirSync(tmsBibiolographicDataProcessedDir)
  subFolders.forEach((subFolder) => {
    const files = fs.readdirSync(path.join(tmsBibiolographicDataProcessedDir, subFolder)).filter(file => {
      const fileFragments = file.split('.')
      if (fileFragments.length !== 2) return false
      if (fileFragments[1] !== 'json') return false
      return true
    })

    //  Now read in each file and find the keywords
    files.forEach((file) => {
      const bibiolographicRaw = fs.readFileSync(path.join(tmsBibiolographicDataProcessedDir, subFolder, file), 'utf-8')
      const bibiolographicJSON = JSON.parse(bibiolographicRaw)
      if (bibiolographicJSON.subTitle && bibiolographicJSON.subTitle.includes('stories.mplus.org.hk')) {
        //  Now that we have a story make a note of the id that will look it up
        referenceIds.push(bibiolographicJSON.id)
        const story = bibiolographicJSON.subTitle.split(' ')[0]
        referenceIdsToStory[bibiolographicJSON.id] = story
      }
    })
  })
  const bulkThisArray = []

  //  If we have any ids to look up, then do that here
  if (referenceIds.length > 0) {
    const subFolders = fs.readdirSync(tmsObjectProcessedDir)
    subFolders.forEach((subFolder) => {
      const files = fs.readdirSync(path.join(tmsObjectProcessedDir, subFolder)).filter(file => {
        const fileFragments = file.split('.')
        if (fileFragments.length !== 2) return false
        if (fileFragments[1] !== 'json') return false
        return true
      })
      files.forEach((file) => {
        const objectRaw = fs.readFileSync(path.join(tmsObjectProcessedDir, subFolder, file), 'utf-8')
        const objectJSON = JSON.parse(objectRaw)
        if (objectJSON.references && objectJSON.references.ids) {
          if (!Array.isArray(objectJSON.references.ids)) objectJSON.references.ids = [objectJSON.references.ids]
          objectJSON.references.ids.forEach((id) => {
            if (referenceIds.includes(id)) {
              if (objectJSON.consituents && objectJSON.consituents.ids) {
                if (!Array.isArray(objectJSON.consituents.ids)) objectJSON.consituents.ids = [objectJSON.consituents.ids]
                objectJSON.consituents.ids.forEach((constid) => {
                  bulkThisArray.push({
                    update: {
                      _id: constid
                    }
                  })
                  bulkThisArray.push({
                    doc: {
                      storyUrl: referenceIdsToStory[id]
                    }
                  })
                })
              }
            }
          })
        }
      })
    })
  }

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const exists = await esclient.indices.exists({
    index: `constituents_${tms}`
  })
  if (exists !== true) {
    tmsLogger.object(`No constituents_${tms} found`, {
      action: 'finished makeMakersByStory',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }
  if (bulkThisArray.length > 0) {
    const body = {
      index: `constituents_${tms}`,
      type: 'constituent',
      body: bulkThisArray
    }
    esclient.bulk(body)
  }
}

exports.startMakeMakerByStory = () => {
  //  Remove the old interval timer
  // clearInterval(global.findConstituentRoles)
  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  if (!config) return
  if (!config.tms) return
  // const interval = 1000 * 60 * 60 * 24 // 24 hours
  config.tms.forEach((tms) => {
    setInterval(() => {
      makeMakerByStory(tms.stub)
    }, 1000 * 60 * 60 * 6.1)
  })
}
