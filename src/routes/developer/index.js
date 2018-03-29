const tools = require('../../modules/tools')
const User = require('../../modules/user')
const getjsonfields = require('../../cli/getjsonfields')

exports.index = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  const configJSON = tools.getConfig()

  templateValues.user = user
  templateValues.config = configJSON
  templateValues.pingData = tools.getPingData()

  return response.render('developer/index', templateValues)
}

exports.fields = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  let errorMsg = null

  const configJSON = tools.getConfig()
  const index = request.params.field

  //  Make sure we have the index in the xml
  let foundMatch = false
  if ('xml' in configJSON) {
    configJSON.xml.forEach(xml => {
      if (xml.index === index) {
        foundMatch = true
      }
    })
  }

  if (foundMatch === true) {
    const startTime = new Date().getTime()
    const fields = getjsonfields.start(index, false)
    templateValues.index = index
    templateValues.fields = fields
    templateValues.ms = new Date().getTime() - startTime
  } else {
    errorMsg = {
      msg: `Index "${index}" not found in config`
    }
  }

  templateValues.errorMsg = errorMsg
  templateValues.user = user
  templateValues.config = configJSON
  templateValues.pingData = tools.getPingData()

  return response.render('developer/fields', templateValues)
}
