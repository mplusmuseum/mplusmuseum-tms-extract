const User = require('../../classes/user')
const Users = require('../../classes/users')

exports.index = (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')

  return res.render('admin/index', req.templateValues)
}

exports.users = async (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')
  const users = await new Users().get()
  req.templateValues.users = users
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
        isDeveloper: 'developer' in req.body
      }
      await userObj.setRoles(selectedUser.user_id, roles)
      return res.redirect(`/admin/user/${req.params.id}`)
    }
  }

  req.templateValues.selectedUser = selectedUser
  return res.render('admin/user', req.templateValues)
}
