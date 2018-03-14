const tools = require('../../modules/tools')
const User = require('../../modules/user')

exports.settings = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  //  If are a dev, staff or admin then get the ping and config data
  if (user.developer === true || user.staff === true || user.admin === true) {
    const configJSON = tools.getConfig()
    templateValues.config = configJSON
    templateValues.pingData = tools.getPingData()
  }

  templateValues.user = user

  return response.render('user/settings', templateValues)
}
