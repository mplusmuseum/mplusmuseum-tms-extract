const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../logging')
const utils = require('../../../modules/utils')
const elasticsearch = require('elasticsearch')

const makeMakersBio = async (tms) => {
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`starting makeMakersBio`, {
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

  const index = `constituents_${tms}`
  const type = `constituent`
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const exists = await esclient.indices.exists({
    index
  })
  if (exists !== true) {
    tmsLogger.object(`No constituents_${tms} found`, {
      action: 'finished makeMakersBio',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  const constituentsBios = {}
  const objectNames = {}
  const notObjectNames = ['Fonds', 'Series', 'Sub-fonds', 'Sub-subseries', 'Subseries']

  const subFolders = fs.readdirSync(tmsProcessedDir)
  subFolders.forEach((subFolder) => {
    const files = fs.readdirSync(path.join(tmsProcessedDir, subFolder)).filter(file => {
      const fileFragments = file.split('.')
      if (fileFragments.length !== 2) return false
      if (fileFragments[1] !== 'json') return false
      return true
    })

    //  Now read in each file and find the categories
    files.forEach((file) => {
      const objectRaw = fs.readFileSync(path.join(tmsProcessedDir, subFolder, file), 'utf-8')
      const objectJSON = JSON.parse(objectRaw)
      if (objectJSON.publicAccess && objectJSON.objectName) {
        if (!objectNames[objectJSON.objectName]) {
          console.log(objectJSON.objectName)
          objectNames[objectJSON.objectName] = true
        }
        //  Now push the constituent IDs onto the stack
        if (objectJSON.consituents && objectJSON.consituents.ids) {
          objectJSON.consituents.ids.forEach((id) => {
            //  If we don't have a constituent yet, then add one
            if (!constituentsBios[id]) constituentsBios[id] = {}

            //  Now we want to know the object type
            let isObject = true
            if (objectJSON.archivalLevel && objectJSON.archivalLevel.lang && objectJSON.archivalLevel.lang.en && objectJSON.archivalLevel.lang.en.title) {
              objectJSON.archivalLevel.lang.en.title.forEach((title) => {
                if (notObjectNames.includes(title)) isObject = false
              })
            }

            //  Only do this stuff if we are an actual object
            if (isObject) {
              //  And work out what collection it's from
              if (objectJSON.collectionName) {
                if (!constituentsBios[id].collections) constituentsBios[id].collections = {}
                if (!constituentsBios[id].collections[objectJSON.collectionName]) {
                  constituentsBios[id].collections[objectJSON.collectionName] = {
                    categoriesKey: {
                      en: [],
                      'zh-hant': []
                    },
                    categories: {
                      en: [],
                      'zh-hant': []
                    },
                    count: 0
                  }
                }
                //  Increase the count for this collection
                constituentsBios[id].collections[objectJSON.collectionName].count++
                //  Work on the categories
                if (objectJSON.category && objectJSON.category.lang) {
                  if (objectJSON.category.lang.en && objectJSON.category.lang.en.title) {
                    objectJSON.category.lang['en'].title.forEach((title) => {
                      if (!(constituentsBios[id].collections[objectJSON.collectionName].categoriesKey['en'].includes(title))) {
                        constituentsBios[id].collections[objectJSON.collectionName].categoriesKey['en'].push(title)
                        constituentsBios[id].collections[objectJSON.collectionName].categories['en'].push({
                          title,
                          stub: utils.slugify(title)
                        })
                      }
                    })
                    objectJSON.category.lang['zh-hant'].title.forEach((title) => {
                      if (!(constituentsBios[id].collections[objectJSON.collectionName].categoriesKey['zh-hant'].includes(title))) {
                        constituentsBios[id].collections[objectJSON.collectionName].categoriesKey['zh-hant'].push(title)
                        constituentsBios[id].collections[objectJSON.collectionName].categories['zh-hant'].push({
                          title,
                          stub: utils.slugify(title)
                        })
                      }
                    })
                  }
                }
              }
            }
          })
        }
      }
    })
  })

  const bulkThisArray = []
  Object.entries(constituentsBios).forEach((constituent) => {
    const id = constituent[0]
    const data = constituent[1]
    bulkThisArray.push({
      update: {
        _id: id
      }
    })
    bulkThisArray.push({
      doc: {
        makerBioCounts: JSON.stringify(data)
      }
    })
  })
  if (bulkThisArray.length > 0) {
    esclient.bulk({
      index,
      type,
      body: bulkThisArray
    })
  }
}

exports.startMakeMakersBio = () => {
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
    makeMakersBio(tms.stub)
    setInterval(() => {
      makeMakersBio(tms.stub)
    }, 1000 * 60 * 60 * 6)
  })
}
