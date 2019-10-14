const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../../modules/logging')
const elasticsearch = require('elasticsearch')
const utils = require('../../../modules/utils')

const updateConstituentsAsMakers = async (tms) => {
  //  Start the logger
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`starting updateConstituentsAsMakers for ${tms}`, {
    action: 'start updateConstituentsAsMakers',
    status: 'info'
  })

  const startTime = new Date().getTime()
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'finished updateConstituentsAsMakers',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }
  //  Now go and fetch all the isMakers data
  const index = `config_ismakers_${tms}`
  const type = `config_isMaker`
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const exists = await esclient.indices.exists({
    index
  })
  if (exists !== true) {
    tmsLogger.object(`No config_ismakers_${tms} found`, {
      action: 'finished updateConstituentsAsMakers',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Go and grab all the things that are "makers" from the database
  const body = {
    size: 100
  }
  const records = await esclient.search({
    index,
    type,
    body
  })
  const makers = {}
  if (records !== null && records.hits && records.hits.hits) {
    const dbMakers = records.hits.hits.map((record) => record._source)
    dbMakers.forEach((maker) => {
      makers[maker.id] = false
      if (maker.value === 'true') records[maker.id] = true
    })
  } else {
    tmsLogger.object(`No records for ${tms} found`, {
      action: 'finished updateConstituentsAsMakers',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Now we have all the makers we need to go and crawl all the processed objects
  //  and work out which constituent is a maker and which isn't and how many objects
  //  they are connected to
  const constituents = {}
  const tmsProcessedDir = path.join(rootDir, 'imports', 'Objects', tms, 'processed')
  if (fs.existsSync(tmsProcessedDir)) {
    const subFolders = fs.readdirSync(tmsProcessedDir)
    subFolders.forEach((subFolder) => {
      const files = fs.readdirSync(path.join(tmsProcessedDir, subFolder)).filter(file => {
        const fileFragments = file.split('.')
        if (fileFragments.length !== 2) return false
        if (fileFragments[1] !== 'json') return false
        return true
      })
      files.forEach((file) => {
        const objectRaw = fs.readFileSync(path.join(tmsProcessedDir, subFolder, file), 'utf-8')
        const objectJSON = JSON.parse(objectRaw)
        if (objectJSON.consituents && objectJSON.consituents.idsToRoleRank) {
          const objectsRoles = JSON.parse(objectJSON.consituents.idsToRoleRank)
          objectsRoles.forEach((role) => {
            //  Add the constituent ID into the constituents obejct so we can flag them as
            //  a maker or not, by default they aren't until, well, they are.
            if (!(role.id in constituents)) {
              constituents[role.id] = {
                isMaker: false,
                objectCount: 0,
                objectCountPublic: 0,
                roles: [],
                aggregateCounts: {
                  lang: {
                    'en': {
                      categoriesAgg: {},
                      areasAgg: {},
                      collectionAgg: {}
                    },
                    'zh-hant': {
                      categoriesAgg: {},
                      areasAgg: {},
                      collectionAgg: {}

                    }
                  }
                }
              }
            }

            constituents[role.id].objectCount++ // Tally up the number of objects "made" by this constituent
            if ('publicAccess' in objectJSON && objectJSON.publicAccess === true) constituents[role.id].objectCountPublic++
            let isMakerOfObject = false
            if (role.roles) {
              Object.entries(role.roles).forEach((langRole) => {
                const thisRole = langRole[1]
                if (thisRole in records && records[thisRole] === true) {
                  constituents[role.id].isMaker = true // Mark the constituent as a "maker"
                  isMakerOfObject = true
                }
                //  If this role isn't in the list of roles yet, then add it
                if (!constituents[role.id].roles.includes(thisRole)) {
                  constituents[role.id].roles.push(thisRole)
                }
              })
            }

            //  If we are the maker of this object then we need to update the agg counts at the same time
            if (objectJSON.publicAccess === true && isMakerOfObject === true) {
              if (objectJSON.classification) {
                //  Categories
                if (objectJSON.classification.category && Array.isArray(objectJSON.classification.category)) {
                  objectJSON.classification.category.forEach((category) => {
                    if (category.areacat) {
                      if (category.areacat['en']) {
                        if (!constituents[role.id].aggregateCounts.lang['en'].categoriesAgg[category.areacat['en']]) {
                          constituents[role.id].aggregateCounts.lang['en'].categoriesAgg[category.areacat['en']] = {
                            title: category.areacat['en'],
                            slug: utils.slugify(category.areacat['en']),
                            count: 0
                          }
                        }
                        constituents[role.id].aggregateCounts.lang['en'].categoriesAgg[category.areacat['en']].count++

                        if (category.areacat['zh-hant']) {
                          if (!constituents[role.id].aggregateCounts.lang['zh-hant'].categoriesAgg[category.areacat['zh-hant']]) {
                            constituents[role.id].aggregateCounts.lang['zh-hant'].categoriesAgg[category.areacat['zh-hant']] = {
                              title: category.areacat['zh-hant'],
                              slug: utils.slugify(category.areacat['en']),
                              count: 0
                            }
                          }
                          constituents[role.id].aggregateCounts.lang['zh-hant'].categoriesAgg[category.areacat['zh-hant']].count++
                        }
                      }
                    }
                  })
                }

                //  Areas
                if (objectJSON.classification.area && Array.isArray(objectJSON.classification.area)) {
                  objectJSON.classification.area.forEach((area) => {
                    if (area.areacat) {
                      if (area.areacat['en']) {
                        if (!constituents[role.id].aggregateCounts.lang['en'].areasAgg[area.areacat['en']]) {
                          constituents[role.id].aggregateCounts.lang['en'].areasAgg[area.areacat['en']] = {
                            title: area.areacat['en'],
                            slug: utils.slugify(area.areacat['en']),
                            count: 0
                          }
                        }
                        constituents[role.id].aggregateCounts.lang['en'].areasAgg[area.areacat['en']].count++

                        if (area.areacat['zh-hant']) {
                          if (!constituents[role.id].aggregateCounts.lang['zh-hant'].areasAgg[area.areacat['zh-hant']]) {
                            constituents[role.id].aggregateCounts.lang['zh-hant'].areasAgg[area.areacat['zh-hant']] = {
                              title: area.areacat['zh-hant'],
                              slug: utils.slugify(area.areacat['en']),
                              count: 0
                            }
                          }
                          constituents[role.id].aggregateCounts.lang['zh-hant'].areasAgg[area.areacat['zh-hant']].count++
                        }
                      }
                    }
                  })
                }

                //  collectionAgg
                if (objectJSON.collectionName) {
                  if (!constituents[role.id].aggregateCounts.lang['en'].collectionAgg[objectJSON.collectionName]) {
                    constituents[role.id].aggregateCounts.lang['en'].collectionAgg[objectJSON.collectionName] = {
                      title: objectJSON.collectionName,
                      slug: objectJSON.collectionName,
                      count: 0
                    }
                  }
                  constituents[role.id].aggregateCounts.lang['en'].collectionAgg[objectJSON.collectionName].count++

                  if (!constituents[role.id].aggregateCounts.lang['zh-hant'].collectionAgg[objectJSON.collectionName]) {
                    constituents[role.id].aggregateCounts.lang['zh-hant'].collectionAgg[objectJSON.collectionName] = {
                      title: objectJSON.collectionName,
                      slug: objectJSON.collectionName,
                      count: 0
                    }
                  }
                  constituents[role.id].aggregateCounts.lang['zh-hant'].collectionAgg[objectJSON.collectionName].count++
                }
              }
            }
          })
        }
      })
    })
  }

  const bulkThisArray = []
  Object.entries(constituents).forEach((constituent) => {
    const id = constituent[0]
    const data = constituent[1]
    bulkThisArray.push({
      update: {
        _id: id
      }
    })
    bulkThisArray.push({
      doc: {
        isMaker: data.isMaker,
        objectCount: data.objectCount,
        objectCountPublic: data.objectCountPublic,
        roles: data.roles,
        aggregateCounts: JSON.stringify(data.aggregateCounts)
      }
    })
  })
  if (bulkThisArray.length > 0) {
    esclient.bulk({
      index: `constituents_${tms}`,
      type: 'constituent',
      body: bulkThisArray
    })
  }
}
exports.updateConstituentsAsMakers = updateConstituentsAsMakers

exports.startUpdateConstituentsAsMakers = () => {
  //  Remove the old interval timer
  // clearInterval(global.findConstituentRoles)
  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  if (!config) return
  if (!config.tms) return
  const interval = 1000 * 60 * 60 * 6 // Every 6 hours
  config.tms.forEach((tms) => {
    updateConstituentsAsMakers(tms.stub)
    setTimeout(() => {
      updateConstituentsAsMakers(tms.stub)
    }, interval)
  })
}