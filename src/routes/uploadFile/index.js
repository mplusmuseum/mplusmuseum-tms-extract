const Config = require('../../classes/config')
const formidable = require('formidable')
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const logging = require('../../modules/logging')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  //  Check to see if we've been passed a configuration option
  if ('action' in req.body) {

  }

  return res.render('uploadFile/index', req.templateValues)
}

exports.getfile = (req, res) => {
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
      processObjectFile(req, res, tms, files.objectFile.path)
    }

    if ('authorsFile' in files) {
      processAuthorsFile(req, res, tms, files.eventsFile.path)
    }
  })
}

const processObjectFile = (req, res, tms, filename) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newObjects = 0
  let modifiedObjects = 0
  let totalObjects = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in

  //  Now go through all the objects looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new

  //  Now write the fields back out so we can compare against them next time
}

const processAuthorsFile = (req, res, tms, filename) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newEvents = 0
  let modifiedEvents = 0
  let totalEvents = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in

  //  Now go through all the objects looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new

  //  Now write the fields back out so we can compare against them next time
}
