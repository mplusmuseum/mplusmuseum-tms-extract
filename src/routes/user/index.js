const fs = require('fs')
const path = require('path')
const langDir = path.join(__dirname, '../../../lang')

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
