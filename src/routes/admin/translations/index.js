const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../../lang')

exports.index = (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')
  return res.render('admin/translations/index', req.templateValues)
}

exports.site = (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  //  First check to see if the translation files exist, if they don't
  //  then we need to make them
  const siteDir = path.join(rootDir, req.params.site)
  if (!fs.existsSync(siteDir)) fs.mkdirSync(siteDir)

  //  Make sure the strings files exist
  const stringsFile = path.join(siteDir, `strings.json`)
  if (!fs.existsSync(stringsFile)) {
    fs.writeFileSync(stringsFile, JSON.stringify({}, null, 4), 'utf-8')
  }

  //  Now we need to read in the languages
  let strings = JSON.parse(fs.readFileSync(path.join(siteDir, `strings.json`)))

  // Check to see if we've been sent anything to do
  if (req.body.action) {
    let jumpSection = ''
    let writeFilesBackOut = false

    // if we've been given a new section to add, then do that here
    if (req.body.action === 'newSection') {
      const newSection = req.body.section.replace(/[^A-Za-z0-9-]+/g, '')
      if (newSection && newSection !== '' && !strings[newSection]) {
        strings[newSection] = {}
        writeFilesBackOut = true
        jumpSection = `#${newSection}`
      }
    }

    //  If we've passed an 'updateString' action then we need to reconstruct the whole
    //  translations file from what we've been passed
    if (req.body.action === 'updateString') {
      const newStringsJSON = {}

      //  First of all we need to loop through everything, working out what we have
      Object.entries(req.body).forEach((item) => {
        const field = item[0]
        const value = item[1]
        //  Make sure we're dealing with the data we have been passed over
        const fieldSplit = field.split('|')
        let section = fieldSplit[0]
        if (section) section = section.replace(/[^A-Za-z0-9-]+/g, '')
        let stub = fieldSplit[1]
        if (stub) stub = stub.replace(/[^A-Za-z0-9-]+/g, '')
        const lang = fieldSplit[2]

        if (fieldSplit.length === 3) {
          //  First we want to make sure the section exists in the new JSON file
          if (!newStringsJSON[section]) newStringsJSON[section] = {}
          //  See if we've been passed a newStub, if we have then add it to the JSON
          if (stub === 'newStub' && value !== '') {
            //  Add the stub
            const newValue = value.replace(/[^A-Za-z0-9-]+/g, '')
            if (!newStringsJSON[section][value]) newStringsJSON[section][newValue] = {}
            //  Look for strings to go in the stub if we have them
            if (req.body[`${section}|newString|en`] && req.body[`${section}|newString|en`] !== '') newStringsJSON[section][newValue].en = req.body[`${section}|newString|en`]
            if (req.body[`${section}|newString|tc`] && req.body[`${section}|newString|tc`] !== '') newStringsJSON[section][newValue].tc = req.body[`${section}|newString|tc`]
            jumpSection = `#${section}`
            writeFilesBackOut = true
          }

          //  If we've been passed a string thing, then we need to put
          //  that into the new strings too
          if (stub !== 'newStub' && stub !== 'newString') {
            //  Make sure it has the section
            if (!newStringsJSON[section]) newStringsJSON[section] = {}
            //  Make sure it has the stub
            if (!newStringsJSON[section][stub]) newStringsJSON[section][stub] = {}
            //  Make the stub equal to the value
            newStringsJSON[section][stub][lang] = value
            //  Make sure we right the file back out
            writeFilesBackOut = true
          }
        }
      })

      if (writeFilesBackOut === true) {
        strings = newStringsJSON
      }
    }

    if (writeFilesBackOut) {
      fs.writeFileSync(path.join(siteDir, `strings.json`), JSON.stringify(strings, null, 4), 'utf-8')
      return res.redirect(`/admin/translations/${req.params.site}${jumpSection}`)
    }
  }

  //  Now we need to make a "meta" file that conatains all the strings
  req.templateValues.strings = strings
  req.templateValues.site = req.params.site
  return res.render(`admin/translations/site`, req.templateValues)
}

exports.download = (req, res) => {
  //  Make sure we are an admin user
  if (req.user.roles.isAdmin !== true) return res.redirect('/')

  //  First check to see if the translation files exist, if they don't
  //  then we need to make them
  const siteDir = path.join(rootDir, req.params.site)
  if (!fs.existsSync(siteDir)) fs.mkdirSync(siteDir)

  //  Make sure the strings files exist
  const stringsFile = path.join(siteDir, `strings.json`)
  if (!fs.existsSync(stringsFile)) {
    fs.writeFileSync(stringsFile, JSON.stringify({}, null, 4), 'utf-8')
  }

  //  Now we need to read in the languages
  res.set('Content-Type', 'application/octet-stream')
  res.set('Access-Control-Allow-Origin', '*')
  res.set('Content-Disposition', 'attachment; filename=strings.json')
  return res.download(path.join(siteDir, `strings.json`))
}