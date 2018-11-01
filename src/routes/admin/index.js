const User = require('../../classes/user')
const Users = require('../../classes/users')
const Config = require('../../classes/config')
const logging = require('../../modules/logging')
const processingFiles = require('../../modules/processingFiles')
const elasticsearch = require('elasticsearch')
const myElasticsearch = require('../../modules/elasticsearch')

exports.index = (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

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
  if (req.user.roles.isAdmin !== true) return res.redriect('/')
  const users = await new Users().get()
  req.templateValues.users = users.reverse()
  return res.render('admin/users', req.templateValues)
}

exports.user = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')
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
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

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