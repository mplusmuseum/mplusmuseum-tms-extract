const decortation = require('../../modules/decoration')

exports.status = (req, res) => {
  // If we are logged out, show the main homepage
  if (req.user === null) {
    const design = decortation.pickLoggedOutDesign()
    req.templateValues.design = design
    return res.render('main/pleaselogin', req.templateValues)
  }

  //  Send staff and admin user to the stats page
  if (req.user.roles.isStaff === true || req.user.roles.isAdmin) {
    return res.redirect('/stats')
  }
  return res.redirect('/developer')
}

exports.wait = (req, res) => {
  const design = decortation.pickLoggedOutDesign()
  req.templateValues.design = design
  return res.render('config/wait', req.templateValues)
}
