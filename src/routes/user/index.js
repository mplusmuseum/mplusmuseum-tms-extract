const fs = require('fs')
const path = require('path')
const langDir = path.join(__dirname, '../../../lang')
const User = require('../../classes/user')

exports.settings = (req, res) => {
  //  Grab the languages
  const langs = fs.readdirSync(langDir).filter((lang) => {
    const langSplit = lang.split('.')
    if (langSplit.length !== 3) return false
    if (langSplit[0] !== 'strings' || langSplit[2] !== 'json') return false
    return true
  }).map((lang) => {
    const langSplit = lang.split('.')
    return langSplit[1]
  })
  req.templateValues.langs = langs
  return res.render('user/settings', req.templateValues)
}

exports.setLanguage = async (req, res) => {
  //  I kinda want to go back to the referring page at this point
  //  incase we have the language thing in the footer
  const userObj = await new User()
  const selectedUser = await userObj.get(req.user.user_id)
  if (selectedUser !== null) {
    await userObj.setLang(selectedUser.user_id, req.params.lang)
    req.session.passport.user = await new User().get(selectedUser.user_id)
  }
  if (req.headers.referer) {
    return res.redirect(req.headers.referer)
  }
  return res.redirect('/settings')
}
