const Config = require('../../classes/config')
const formidable = require('formidable')
const logging = require('../../modules/logging')
const processObjects = require('../../modules/processingFiles/objects')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  //  Check to see if we've been passed a configuration option
  if ('action' in req.body) {

  }

  return res.render('uploadFile/index', req.templateValues)
}

exports.getfile = async (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  const config = new Config()
  const form = new formidable.IncomingForm()

  const tmsLogger = logging.getTMSLogger()

  form.parse(req, (err, fields, files) => {
    //  If there was an error, let the user know
    if (err) {
      req.templateValues.error = {
        msg: 'An error occured when uploaded the file.'
      }
      tmsLogger.object(`An error occured when uploaded a file`, {
        action: 'error',
        err: err
      })
      return res.render('uploadFile/results', req.templateValues)
    }

    //  Make sure the tms we have been passed is valid
    const tmsses = config.get('tms').map((tms) => {
      return tms.stub
    })
    if (!('tms' in fields) || tmsses.includes(fields.tms) === false) {
      req.templateValues.error = {
        msg: 'Sorry, an invalid TMS system was passed in, please try again.'
      }
      tmsLogger.object(`Invalid TMS system passed in when uploading file`, {
        action: 'error',
        stub: fields.tms
      })
      return res.render('uploadFile/results', req.templateValues)
    }

    const tms = fields.tms
    if ('objectFile' in files) {
      //  TODO: Wrap this in a promise!!
      new Promise((resolve, reject) => {
        resolve(processObjects.processFile(tms, files.objectFile.path))
      }).then((results) => {
        req.templateValues.fields = results.fields
        req.templateValues.type = results.type
        req.templateValues.newObjects = results.newObjects
        req.templateValues.modifiedObjects = results.modifiedObjects
        req.templateValues.totalObjects = results.totalObjects
        req.templateValues.ms = results.ms
        return res.render('uploadFile/results', req.templateValues)
      })
    }
  })
}
