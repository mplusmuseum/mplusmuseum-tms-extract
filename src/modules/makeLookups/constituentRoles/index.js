const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../../modules/logging')
const elasticsearch = require('elasticsearch')

const findConstituentRoles = async (tms) => {
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`starting findConstituentRoles`, {
    action: 'start findConstituentRoles',
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
      action: 'finished findConstituentRoles',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Look through all the processed files grabbing the consituent data
  const tmsProcessedDir = path.join(rootDir, 'imports', 'Objects', tms, 'processed')
  //  Don't do anything if the folder doesn't exist
  if (!fs.existsSync(tmsProcessedDir)) {
    tmsLogger.object(`No elasticsearch tmsProcessedDir for tms ${tms}`, {
      action: 'finished findConstituentRoles',
      tms,
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  const subFolders = fs.readdirSync(tmsProcessedDir)

  //  Here's where we're going to collate the constituents with their role
  const constituentRoles = {}
  const roleNames = {}

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
      if (objectJSON.consituents && objectJSON.consituents.idsToRoleRank) {
        const objectsRoles = JSON.parse(objectJSON.consituents.idsToRoleRank)
        objectsRoles.forEach((role) => {
          if (!(role.id in constituentRoles)) {
            constituentRoles[role.id] = {
              id: role.id,
              role: {}
            }
          }
          if (role.roles) {
            //  Make sure the langages are in the data
            Object.entries(role.roles).forEach((langRole) => {
              const lang = langRole[0]
              const thisRole = langRole[1]
              if (!(lang in constituentRoles[role.id].role)) {
                constituentRoles[role.id].role[lang] = {}
              }
              if (!(thisRole in constituentRoles[role.id].role[lang])) {
                constituentRoles[role.id].role[lang][thisRole] = 0
              }
              constituentRoles[role.id].role[lang][thisRole]++
              if (!(thisRole in roleNames)) {
                roleNames[thisRole] = 0
              }
              roleNames[thisRole]++
            })
          }
        })
      }
    })
  })

  //  Check to see if the index that we are going to put all
  //  this records into exists, if not then we make it.
  const bulkThisArray = []
  let bulkIndex = 0
  Object.entries(constituentRoles).forEach((roleRecord) => {
    const id = parseInt(roleRecord[0], 10)
    const record = roleRecord[1]
    Object.entries(record.role).forEach((langRole) => {
      console.log(langRole)
      const lang = langRole[0]
      const roles = langRole[1]
      Object.entries(roles).forEach((roleCount) => {
        const role = roleCount[0]
        const count = roleCount[1]
        bulkThisArray.push({
          index: {
            _id: bulkIndex
          }
        })
        bulkThisArray.push({
          id: bulkIndex,
          constituentId: id,
          lang,
          role,
          count
        })
        bulkIndex++
      })
    })
  })

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `constituentroles_${tms}`
  const type = 'constituentrole'
  const exists = await esclient.indices.exists({
    index
  })
  if (exists !== true) {
    await esclient.indices.create({
      index
    })
  }
  esclient.bulk({
    index,
    type,
    body: bulkThisArray
  }).then(() => {
    tmsLogger.object(`Upserted ${bulkThisArray.length / 2} constituentRoles for ${tms}`, {
      action: 'finished findConstituentRoles',
      status: 'ok',
      tms,
      ms: new Date().getTime() - startTime
    })
  })
  console.log(roleNames)
}
exports.findConstituentRoles = findConstituentRoles

exports.startFindConstituentRoles = () => {
  //  Remove the old interval timer
  clearInterval(global.findConstituentRoles)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  if (!config) return
  if (!config.tms) return
  const interval = 1000 * 60 * 60 * 1 // 1 hour
  config.tms.forEach((tms) => {
    global.findConstituentRoles = setInterval(() => {
      findConstituentRoles(tms.stub)
    }, interval)
    setTimeout(() => {
      findConstituentRoles(tms.stub)
    }, 1000 * 60 * 5) //  In 5 minutes time
  })
  const tmsLogger = logging.getTMSLogger()
  tmsLogger.object(`In startFindConstituentRoles`, {
    action: 'startFindConstituentRoles',
    status: 'info'
  })
}

/*
Artist: 6005
Architectural Firm: 1327
Architect: 1271
Designer: 922
Publisher: 467
Manufacturer: 431
Maker: 270
Subject: 270
Photographer: 268
Commissioned by: 180
Archive Creator: 160
Design Firm: 157
Author: 148
Art Director: 21
Filmmaker: 19
Designer/Producer: 9
Printer: 7
Production Company: 7
Developer: 7
Translator: 1
Producer: 1
Engineer: 1
Organiser: 1
*/
