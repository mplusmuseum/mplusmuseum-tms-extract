const tools = require('../../modules/tools')
const User = require('../../modules/user')

exports.index = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  //  If we admin then back
  if (user.admin === false) {
    return response.redirect('/')
  }

  const configJSON = tools.getConfig()

  templateValues.user = user
  templateValues.config = configJSON
  templateValues.pingData = tools.getPingData()

  return response.render('admin/index', templateValues)
}
