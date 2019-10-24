const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../logging')
const utils = require('../../../modules/utils')
const elasticsearch = require('elasticsearch')

const getMakersByCategory = async (tms) => {
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
      action: 'finished createRandomSelection',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  const dict = {
    categories: {
      lang: {
        'en': {},
        'zh-hant': {}
      }
    }
  }
  const langs = ['en', 'zh-hant']

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

  const constituentProcessedDir = path.join(rootDir, 'imports', 'Constituents', tms, 'processed')
  if (!fs.existsSync(constituentProcessedDir)) {
    tmsLogger.object(`No elasticsearch constituentProcessedDir for tms ${tms}`, {
      action: 'finished createRandomSelection',
      tms,
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Grab all the type of things that are valid makers
  let records = null
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  try {
    records = await esclient.search({
      index: `config_ismakers_${tms}`,
      type: 'config_isMaker',
      body: {
        size: 100
      }
    })
  } catch (er) {
    records = null
  }
  const validMakers = []
  if (records !== null && records.hits && records.hits.hits) {
    const dbMakers = records.hits.hits.map((record) => record._source)
    dbMakers.forEach((type) => {
      if (type.value === 'true') validMakers.push(type.id)
    })
  }

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
      if (objectJSON.publicAccess) {
        //  Do the classifications
        if (objectJSON.classification) {
          //  category
          if (objectJSON.classification.category) {
            if (!Array.isArray(objectJSON.classification.category)) objectJSON.classification.category = [objectJSON.classification.category]
            objectJSON.classification.category.forEach((thing) => {
              langs.forEach((lang) => {
                if (thing.areacat[lang]) {
                  if (!(thing.areacat[lang] in dict.categories.lang[lang])) {
                    dict.categories.lang[lang][thing.areacat[lang]] = {
                      ids: [],
                      full: []
                    }
                  }
                  //  Now push the constituent IDs onto the stack
                  if (objectJSON.consituents && objectJSON.consituents.ids && objectJSON.consituents.idsToRoleRank) {
                    const idsToRoleRank = JSON.parse(objectJSON.consituents.idsToRoleRank)
                    if (!Array.isArray(objectJSON.consituents.ids)) objectJSON.consituents.ids = [objectJSON.consituents.ids]
                    const idsToRoleMap = {}
                    if (Array.isArray(idsToRoleRank)) {
                      idsToRoleRank.forEach((row) => {
                        idsToRoleMap[row.id] = row
                      })
                    }
                    objectJSON.consituents.ids.forEach((id) => {
                      if (!dict.categories.lang[lang][thing.areacat[lang]].ids.includes(id) && idsToRoleMap[id] && idsToRoleMap[id].roles && ((idsToRoleMap[id].roles['en'] && validMakers.includes(idsToRoleMap[id].roles['en'])) || (idsToRoleMap[id].roles['zh-hant'] && validMakers.includes(idsToRoleMap[id].roles['zh-hant'])))) {
                        //  Now go and read in the constituent and see if we can add them
                        const constituentFilename = path.join(constituentProcessedDir, String(Math.floor(id / 1000) * 1000), `${id}.json`)
                        if (fs.existsSync(constituentFilename)) {
                          const constituentRaw = fs.readFileSync(constituentFilename, 'utf-8')
                          const constituentJSON = JSON.parse(constituentRaw)
                          if (constituentJSON.publicAccess === true) {
                            if (constituentJSON.name[lang] && constituentJSON.name[lang].displayName) {
                              dict.categories.lang[lang][thing.areacat[lang]].ids.push(id)
                              dict.categories.lang[lang][thing.areacat[lang]].full.push({
                                id: id,
                                name: constituentJSON.name[lang].displayName,
                                slug: utils.slugify(constituentJSON.name['en'].displayName),
                                type: constituentJSON.type
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
          }
        }
      }
    })
  })

  //  Put the data into the database
  fs.writeFileSync(path.join(rootDir, 'makersByCategory.json'), JSON.stringify(dict, null, 4), 'utf-8')
  const index = `lookups_${tms}`
  const type = 'lookup'
  const exists = await esclient.indices.exists({
    index
  })
  if (exists !== true) {
    await esclient.indices.create({
      index
    })
  }

  const data = {
    id: 'makersByCategory',
    data: JSON.stringify(dict)
  }
  esclient.update({
    index,
    type,
    id: 'makersByCategory',
    body: {
      doc: data,
      doc_as_upsert: true
    }
  })
}

exports.startMakersByCategory = () => {
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
    getMakersByCategory(tms.stub)
    setInterval(() => {
      getMakersByCategory(tms.stub)
    }, 1000 * 60 * 60 * 6)
  })
}
