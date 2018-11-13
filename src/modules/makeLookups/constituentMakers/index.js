const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../../modules/logging')
const elasticsearch = require('elasticsearch')

exports.updateConstituentsAsMakers = async (tms) => {
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
                objectCount: 0
              }
            }
            constituents[role.id].objectCount++ // Tally up the number of objects "made" by this constituent

            if (role.roles) {
              Object.entries(role.roles).forEach((langRole) => {
                const thisRole = langRole[1]
                if (thisRole in records && records[thisRole] === true) {
                  constituents[role.id].isMaker = true // Mark the constituent as a "maker"
                }
              })
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
      index: {
        _id: id
      }
    })
    bulkThisArray.push({
      id: id,
      isMaker: data.isMaker,
      objectCount: data.objectCount
    })
    if (bulkThisArray.length > 0) {
      esclient.bulk({
        index: `constituents_${tms}`,
        type: 'constituent',
        body: bulkThisArray
      })
    }
  })
}
