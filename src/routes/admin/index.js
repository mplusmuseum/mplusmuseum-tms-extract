const tools = require('../../modules/tools')
const User = require('../../modules/user')
const Users = require('../../modules/users')

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

exports.user = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  //  If we admin then back
  if (user.admin === false) {
    return response.redirect('/')
  }

  const configJSON = tools.getConfig()

  const selectedUser = new User(request.params.hash)

  //  Check to see if we have been passed a user hash, if so
  //  then we update the user
  if ('action' in request.body) {
    if (request.body.action === 'update') {
      selectedUser.developer = 'developer' in request.body
      selectedUser.staff = 'staff' in request.body
      selectedUser.admin = 'admin' in request.body
      selectedUser.save()
      return response.redirect(`/admin/user/${selectedUser.hash}`)
    }
  }

  templateValues.user = user
  templateValues.selectedUser = selectedUser
  templateValues.config = configJSON
  templateValues.pingData = tools.getPingData()

  return response.render('admin/user', templateValues)
}

exports.users = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)
  const users = new Users().get()

  //  If we admin then back
  if (user.admin === false) {
    return response.redirect('/')
  }

  const configJSON = tools.getConfig()

  templateValues.user = user
  templateValues.users = users
  templateValues.config = configJSON
  templateValues.pingData = tools.getPingData()

  return response.render('admin/users', templateValues)
}
