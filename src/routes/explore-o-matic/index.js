exports.index = (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redriect('/')
  return res.render('explore-o-matic/index', req.templateValues)
}
