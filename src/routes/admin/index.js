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
