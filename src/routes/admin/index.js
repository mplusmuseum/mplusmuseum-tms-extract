const fs = require('fs')
const path = require('path')
const User = require('../../classes/user')
const Users = require('../../classes/users')
const Config = require('../../classes/config')
const logging = require('../../modules/logging')
const processingFiles = require('../../modules/processingFiles')
const elasticsearch = require('elasticsearch')
const myElasticsearch = require('../../modules/elasticsearch')
const rootDir = path.join(__dirname, '../../../data')
const constituentMakers = require('../../modules/makeLookups/constituentMakers')
exports.translations = require('./translations')

exports.index = (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  if ('action' in req.body) {
    if (req.body.action === 'reimport') {
      setTimeout(() => {
        processingFiles.processFile(req.body.tms)
      }, 50)
      req.templateValues.notification = {
        type: 'info',
        msg: `The import process for ${req.body.tms} has been started`
      }
    }
  }

  return res.render('admin/index', req.templateValues)
}

exports.users = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')
  const users = await new Users().get()
  req.templateValues.users = users.reverse()
  return res.render('admin/users', req.templateValues)
}

exports.user = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')
  const userObj = await new User()

  const selectedUser = await userObj.get(req.params.id)

  if ('action' in req.body) {
    if (req.body.action === 'update') {
      const roles = {
        isAdmin: 'admin' in req.body,
        isStaff: 'staff' in req.body,
        isVendor: 'vendor' in req.body,
        isDeveloper: 'developer' in req.body
      }
      await userObj.setRoles(selectedUser.user_id, roles)
      return res.redirect(`/admin/user/${req.params.id}`)
    }
  }

  req.templateValues.selectedUser = selectedUser
  return res.render('admin/user', req.templateValues)
}

exports.blowaway = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  const startTime = new Date().getTime()

  const tmsLogger = logging.getTMSLogger()

  //  Check to see that we have elasticsearch configured
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    return res.redirect('/admin')
  }
  const esclient = new elasticsearch.Client(elasticsearchConfig)

  //  Deletes the index if we need to
  const index = req.params.index
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === true) {
    await esclient.indices.delete({
      index
    })
  }

  const endTime = new Date().getTime()
  tmsLogger.object(`Deleting index for ${index}`, {
    action: 'deleteIndex',
    index: index,
    ms: endTime - startTime
  })

  return res.redirect('/admin')
}

exports.aggrigateObjects = async (req, res) => {
  myElasticsearch.aggregateObjects(req.params.tms)
  return res.redirect('/admin')
}

exports.isMakers = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  //  Start the logger
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`starting admin.isMakers`, {
    action: 'start admin.isMakers',
    status: 'info'
  })

  const startTime = new Date().getTime()
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')

  const baseTMS = config.getRootTMS()

  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null || baseTMS === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'finished admin.isMakers',
      status: 'info',
      tms: baseTMS,
      ms: new Date().getTime() - startTime
    })
    return res.render('admin/isMakers', req.templateValues)
  }

  //  Now go and fetch all the isMakers data
  const index = `config_ismakers_${baseTMS}`
  const type = `config_isMaker`
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const exists = await esclient.indices.exists({
    index
  })
  if (exists !== true) {
    await esclient.indices.create({
      index
    })
  }

  //  Now see if we've been passed new maker data to go and update
  if (req.body.action) {
    const bulkThisArray = []
    Object.entries(req.body).forEach((record) => {
      const recordSplit = record[0].split('_')
      if (recordSplit.length !== 2 || recordSplit[0] !== 'maker') return
      const maker = recordSplit[1]
      const value = record[1]
      bulkThisArray.push({
        index: {
          _id: maker
        }
      })
      bulkThisArray.push({
        id: maker,
        value
      })
    })
    if (bulkThisArray.length > 0) {
      await esclient.bulk({
        index,
        type,
        body: bulkThisArray
      })
      // Note that we want to rebuld the constituents
      setTimeout(() => {
        constituentMakers.updateConstituentsAsMakers(baseTMS)
      }, 5000)
      //  And redirect back to this page
      return res.redirect('/admin/isMakers')
    }
  }

  //  Go and get the data we've previous stored about what is a "maker" and what isn't
  const body = {
    size: 100
  }
  let records = null
  try {
    records = await esclient.search({
      index,
      type,
      body
    })
  } catch (er) {
    records = null
  }
  if (records !== null && records.hits && records.hits.hits) {
    const dbMakers = records.hits.hits.map((record) => record._source)
    records = {}
    dbMakers.forEach((maker) => {
      records[maker.id] = false
      if (maker.value === 'true') records[maker.id] = true
    })
  } else {
    records = {}
  }

  //  Now loop through all the objects getting all the different type
  //  of makers
  const makers = {}
  const tmsProcessedDir = path.join(rootDir, 'imports', 'Objects', baseTMS, 'processed')
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
            if (role.roles) {
              Object.entries(role.roles).forEach((langRole) => {
                const thisRole = langRole[1]
                if (!(thisRole in makers)) {
                  makers[thisRole] = false
                }
                if (thisRole in records && records[thisRole] === true) {
                  makers[thisRole] = true
                }
              })
            }
          })
        }
      })
    })
  }

  //  Convert the makers into a form that's easier for the template to handle
  req.templateValues.isMakers = []
  Object.entries(makers).forEach((maker) => {
    req.templateValues.isMakers.push({
      maker: maker[0],
      value: maker[1]
    })
  })

  return res.render('admin/isMakers', req.templateValues)
}

exports.importRecommended = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  /*
  const startTime = new Date().getTime()

  const tmsLogger = logging.getTMSLogger()
  */

  //  Check to see that we have elasticsearch configured
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    return res.redirect('/admin')
  }
  const baseTMS = config.getRootTMS()
  if (baseTMS === null) return res.redirect('/admin')

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `objects_${baseTMS}`

  if (req.body && req.body.csv) {
    const ids = req.body.csv.split('\r\n').map((id) => parseInt(id, 10))
    //  Now make up the bulk action
    const bulkThisArray = []
    ids.forEach((id) => {
      bulkThisArray.push({
        update: {
          _id: id
        }
      })
      bulkThisArray.push({
        doc: {
          isRecommended: true
        }
      })
    })
    if (bulkThisArray.length > 0) {
      const result = esclient.bulk({
        index,
        type: 'object',
        body: bulkThisArray
      })
      console.log(result)
    }
  }
  return res.render('admin/importRecommended', req.templateValues)
}

exports.showColours = async (req, res) => {
  const config = new Config()
  const tmsses = config.tms
  const itemPath = path.join(rootDir, 'imports', 'Objects')
  const colours = {}
  const maxValues = {}
  const colourSources = ['google', 'cloudinary']
  const [r, c] = [18, 5]
  const blocks = Array(r).fill().map(() => Array(c).fill(0))
  let maxBlocks = 0

  tmsses.forEach((tms) => {
    const tmsDir = path.join(itemPath, tms.stub, 'perfect')
    if (fs.existsSync(tmsDir)) {
      const subFolders = fs.readdirSync(tmsDir)
      subFolders.forEach((subFolder) => {
        const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          const perfectFileRaw = fs.readFileSync(path.join(tmsDir, subFolder, file), 'utf-8')
          const perfectFile = JSON.parse(perfectFileRaw)
          if (perfectFile.remote && perfectFile.remote.colors && perfectFile.remote.colors.search) {
            colourSources.forEach((source) => {
              //  Grab the predefined colours
              if (perfectFile.remote.colors.search[source]) {
                // Make sure the source is in the colours and the maxValues
                if (!colours[source]) colours[source] = {}
                if (!maxValues[source]) {
                  maxValues[source] = {
                    tally: {
                      colour: 0,
                      bgw: 0,
                      total: 0
                    },
                    total: {
                      colour: 0,
                      bgw: 0,
                      total: 0
                    }
                  }
                }

                Object.entries(perfectFile.remote.colors.search[source]).forEach((colorRecord) => {
                  const colour = colorRecord[0]
                  const value = colorRecord[1]
                  //  Make sure we have an entry for this colour
                  if (!colours[source][colour]) {
                    colours[source][colour] = {
                      tally: 0,
                      total: 0
                    }
                  }
                  //  Update the tally if the value is >= 40
                  if (value >= 40) colours[source][colour].tally++
                  colours[source][colour].total += value

                  //  Update the max values
                  if (['black', 'gray', 'white'].includes(colour)) {
                    if (colours[source][colour].total > maxValues[source].total.bgw) maxValues[source].total.bgw = colours[source][colour].total
                    if (colours[source][colour].tally > maxValues[source].tally.bgw) maxValues[source].tally.bgw = colours[source][colour].tally
                    if (colours[source][colour].total > maxValues[source].total.total) maxValues[source].total.total = colours[source][colour].total
                    if (colours[source][colour].tally > maxValues[source].tally.total) maxValues[source].tally.total = colours[source][colour].tally
                  } else {
                    if (colours[source][colour].total > maxValues[source].total.colour) maxValues[source].total.colour = colours[source][colour].total
                    if (colours[source][colour].tally > maxValues[source].tally.colour) maxValues[source].tally.colour = colours[source][colour].tally
                    if (colours[source][colour].total > maxValues[source].total.total) maxValues[source].total.total = colours[source][colour].total
                    if (colours[source][colour].tally > maxValues[source].tally.total) maxValues[source].tally.total = colours[source][colour].tally
                  }
                })
              }

              //  Grab the predefined colours
              if (perfectFile.remote.colors.hslInt) {
                const hue = Math.floor(perfectFile.remote.colors.hslInt.h / 20)
                const lum = Math.floor(perfectFile.remote.colors.hslInt.l / 20)
                if (perfectFile.remote.colors.hslInt.s >= 15) {
                  blocks[hue][lum]++
                  if (blocks[hue][lum] > maxBlocks) maxBlocks = blocks[hue][lum]
                }
              }
            })
          }
        })
      })
    }
  })

  req.templateValues.googleColours = ['black', 'white', 'gray', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'brown']
  req.templateValues.cloudinaryColours = ['black', 'white', 'gray', 'red', 'orange', 'yellow', 'lime', 'green', 'olive', 'teal', 'cyan', 'lightblue', 'blue', 'purple', 'pink', 'brown']
  req.templateValues.colours = colours
  req.templateValues.maxValues = maxValues
  req.templateValues.pickedScript = `<script>
  var blocks = ${JSON.stringify(blocks)};
  var maxBlocks = ${maxBlocks};
  document.addEventListener("DOMContentLoaded", function (event) {    
    var thisPalette = new palette();
    thisPalette.draw();
  });
  </script>`

  req.templateValues.bgw = ['black', 'white', 'gray']
  return res.render('admin/colours', req.templateValues)
}

exports.redoColours = async (req, res) => {
  const config = new Config()
  const tmsses = config.tms
  const itemPath = path.join(rootDir, 'imports', 'Objects')
  tmsses.forEach((tms) => {
    const tmsDir = path.join(itemPath, tms.stub, 'perfect')
    if (fs.existsSync(tmsDir)) {
      const subFolders = fs.readdirSync(tmsDir)
      subFolders.forEach((subFolder) => {
        const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          const perfectFileRaw = fs.readFileSync(path.join(tmsDir, subFolder, file), 'utf-8')
          const perfectFile = JSON.parse(perfectFileRaw)
          if (perfectFile.remote && perfectFile.remote.colors) {
            delete perfectFile.remote.colors
          }
          const perfectFileJSONPretty = JSON.stringify(perfectFile, null, 4)
          fs.writeFileSync(path.join(tmsDir, subFolder, file), perfectFileJSONPretty, 'utf-8')
        })
      })
    }
  })
  return res.redirect('/admin')
}

exports.deleteIndexByIds = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  /*
  const startTime = new Date().getTime()

  const tmsLogger = logging.getTMSLogger()
  */

  const indexMap = {
    Objects: 'object',
    Constituents: 'constituent',
    Exhibitions: 'exhibition',
    BibiolographicData: 'bibiolography',
    Events: 'event',
    Concepts: 'concept'
  }

  if (!req.params || !req.params.index || !(req.params.index in indexMap)) {
    return res.redirect('/')
  }

  //  Check to see that we have elasticsearch configured
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    return res.redirect('/admin')
  }
  const baseTMS = config.getRootTMS()
  if (baseTMS === null) return res.redirect('/admin')

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `${req.params.index.toLowerCase()}_${baseTMS}`

  if (req.body && req.body.deleteme) {
    const ids = req.body.deleteme.split('\r\n').map((id) => parseInt(id, 10))
    //  Now make up the bulk action
    const bulkThisArray = []
    console.log('About to delete these records')
    console.log(ids)
    ids.forEach((id) => {
      bulkThisArray.push({
        delete: {
          _id: id
        }
      })
    })
    if (bulkThisArray.length > 0) {
      await esclient.bulk({
        index,
        type: indexMap[req.params.index],
        body: bulkThisArray
      })

      // Now delete those files
      ids.forEach((id) => {
        const subDirs = ['perfect', 'process', 'processed']
        const subFolder = String(Math.floor(id / 1000) * 1000)
        subDirs.forEach((subDir) => {
          const idFilename = path.join(rootDir, 'imports', req.params.index, 'mplus', subDir, subFolder, `${id}.json`)
          if (fs.existsSync(idFilename)) {
            fs.unlinkSync(idFilename)
          }
        })
      })
      return res.redirect('/admin')
    }
  }

  //  Now we are here, we need to work out which ids we have a file for that we don't have an id for in the list
  const idsFilename = path.join(rootDir, 'imports', req.params.index, 'mplus', 'ids.json')
  const missingIds = []
  if (fs.existsSync(idsFilename)) {
    const ids = JSON.parse(fs.readFileSync(idsFilename, 'utf-8'))
    //  Loop through all the possible directories to see if we have files that aren't in the missingIds
    const subDirs = ['perfect', 'process', 'processed']
    subDirs.forEach((subDir) => {
      if (fs.existsSync(path.join(rootDir, 'imports', req.params.index, 'mplus', subDir))) {
        fs.readdirSync(path.join(rootDir, 'imports', req.params.index, 'mplus', subDir)).forEach((subSubDir) => {
          fs.readdirSync(path.join(rootDir, 'imports', req.params.index, 'mplus', subDir, subSubDir)).forEach((file) => {
            const fileSplit = file.split('.')
            if (fileSplit.length === 2) {
              const id = parseInt(fileSplit[0])
              if (!isNaN(id)) {
                if (!(ids.includes(id)) && !(missingIds.includes(id))) missingIds.push(id)
              }
            }
          })
        })
      }
    })
  }

  req.templateValues.missingIds = missingIds.join(',\n')
  req.templateValues.indexLower = req.params.index.toLowerCase()
  return res.render('admin/deleteIndexByIds', req.templateValues)
}
