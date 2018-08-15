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

/*
exports.config = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  //  If we are not staff or admin then back
  //  to the index page
  if (user.admin === false) {
    return response.redirect('/')
  }

  //  Read in the config file, if there is one
  const configJSON = tools.getConfig()

  //  Go through the config checking that the xml files we are looking for
  //  actually exists, we'll check for the parse files here too.
  //  NOTE: The missing/exists may seem redundant, but we're just making it
  //  easier for the front end to toggle displays
  //  NOTE: Checking to see if parsing code exists for the object like this
  //  is kinda bad as we are asking the code to check on itself kinda. But it
  //  is useful to give a less technical user who's just using the front end
  //  feedback if they register a new XML data source for which we haven't
  //  actually written parsers for.
  const rootDir = process.cwd()
  if ('xml' in configJSON) {
    configJSON.xml = configJSON.xml.map(itemData => {
      const newItem = itemData

      //  Check the xml file
      const xmlFile = tools.getXmlDir()
      if (fs.existsSync(`${xmlFile}/${newItem.file}`)) {
        newItem.missing = false
        newItem.exists = true
      } else {
        newItem.missing = true
        newItem.exists = false
      }

      //  Check the parsing code
      //  NOTE: this is a _bit_ bad :)
      const parseCode = `${rootDir}/app/cli/tmsxml2json/parsers/${itemData.type}/index.js`
      if (fs.existsSync(parseCode)) {
        newItem.parser = true
      } else {
        newItem.parser = false
      }

      return newItem
    })
  }

  //  See if we've been POSTED any data, which could be searching for items,
  //  updating the config and so on... if we have something then work out
  //  what to do with it.
  if ('body' in request) {
    //  We have been passed an action, which could be all sorts of things, in
    //  here we'll figure out which action we have been passed and then act
    //  on it.
    if ('action' in request.body) {
      let saveConfig = false

      //  If we are updating the hosts info, then we do that here
      if (request.body.action === 'updatehosts') {
        //  Do the elastic search part
        if ('elasticsearch' in request.body) {
          if (!('elasticsearch' in configJSON)) {
            configJSON.elasticsearch = {
              host: ''
            }
          }
          if (request.body.elasticsearch !== configJSON.elasticsearch.host) {
            saveConfig = true
            configJSON.elasticsearch.host = request.body.elasticsearch
          }
          if (configJSON.elasticsearch.host === '') {
            saveConfig = true
            delete configJSON.elasticsearch
          }
          //  If we've updated the ElasticSearch then stop any currently
          //  set up pinging timer and fire off a new ping.
          if (saveConfig) {
            if ('pingTmr' in global) {
              clearTimeout(global.pingTmr)
            }
            tools.startPinging()
          }
        }
        //  Do the graphQL part
        if ('graphql' in request.body) {
          if (!('graphql' in configJSON)) {
            configJSON.graphql = {
              host: ''
            }
          }
          if (request.body.graphql !== configJSON.graphql.host) {
            saveConfig = true
            configJSON.graphql.host = request.body.graphql
          }
          if (configJSON.graphql.host === '') {
            saveConfig = true
            delete configJSON.graphql
          }
        }
      }

      //  If we have been passed the action to delete an xml entry then we
      //  do that here
      if (request.body.action.split(':')[0] === 'delete') {
        const xmlFile = request.body.action.split(':')[1]
        configJSON.xml = configJSON.xml.filter(itemData => {
          if (itemData.file === xmlFile) {
            return false
          }
          return true
        })
        saveConfig = true
      }

      //  If we have been passed the action to add an xml entry then we
      //  do that here
      if (request.body.action.split(':')[0] === 'add') {
        //  Grab all the data.
        //  TODO: Note we are making assuptions that these fields exist,
        //  because we control the HTML and it's auth protected, so why would
        //  someone be trying to mess around with fudging input data. Regardless
        //  we should put some more error checking in.
        const xmlFile = request.body.action.split(':')[1]
        const index = request.body[`index:${xmlFile}`]
        const type = request.body[`type:${xmlFile}`]
        //  If the index or type is empty don't do anything.
        //  TODO: add error message
        if (index === '' || type === '') {
          return response.redirect('/')
        }
        if (!('xml' in configJSON)) {
          configJSON.xml = []
        }
        //  TODO: check the entry doesn't already exist so we don't enter
        //  duplate values
        configJSON.xml.push({
          file: xmlFile,
          index,
          type
        })
        saveConfig = true
      }

      //  If we've been passed an absolute directory then we check it exists
      //  and the update the config file
      if (request.body.action === 'addDataDir') {
        const { xmlPath } = request.body
        if (!fs.existsSync(xmlPath)) {
          return response.redirect('/')
        }
        configJSON.xmlPath = xmlPath
        saveConfig = true
      }

      //  If we've been told to remove the absolute directory we do that here
      if (request.body.action === 'removeDataDir') {
        delete configJSON.xmlPath
        saveConfig = true
      }

      //  This is all media stuff here

      //  First add/remove the media directory
      if (request.body.action === 'addMediaDir') {
        const { mediaPath } = request.body
        if (!fs.existsSync(mediaPath)) {
          return response.redirect('/')
        }
        configJSON.mediaPath = mediaPath
        saveConfig = true
      }

      //  If we've been told to remove the absolute directory we do that here
      if (request.body.action === 'removeMediaDir') {
        delete configJSON.mediaPath
        saveConfig = true
      }

      //  If we are updating the Media Dir Prefix then do that here
      if (request.body.action === 'updateMediaDirPrefix') {
        if (configJSON.mediaDirPrefix !== request.body.mediaDirPrefix) {
          configJSON.mediaDirPrefix = request.body.mediaDirPrefix
          saveConfig = true
        }
      }

      //  If we are updating the cloudinary info then we do that here
      if (request.body.action === 'updatecloudinary') {
        configJSON.cloudinary = {
          cloud_name: request.body.cloud_name,
          api_key: request.body.api_key,
          api_secret: request.body.api_secret
        }
        if (
          configJSON.cloudinary.cloud_name === '' &&
          configJSON.cloudinary.api_key === '' &&
          configJSON.cloudinary.api_secret === ''
        ) {
          delete configJSON.cloudinary
        }
        saveConfig = true
      }

      if (saveConfig === true) {
        tools.putConfig(configJSON)
        return response.redirect('/config')
      }
    }
  }

  //  Now we want to look in the app/data/xml folder to see if there are any
  //  files in there that aren't in the config file, if so it means we can
  //  offer them up to be added
  let existingFiles = []
  if ('xml' in configJSON) {
    existingFiles = configJSON.xml.map(itemData => itemData.file)
  }
  let addableFiles = null
  let dataDirExists = false
  const dataDir = tools.getXmlDir()
  if (fs.existsSync(dataDir)) {
    dataDirExists = true
    const files = fs
      .readdirSync(dataDir)
      .filter(file => file.split('.')[1] === 'xml')
      .filter(file => !existingFiles.includes(file))
    addableFiles = files
  }

  //  Check to see if we're using an absolute path or not
  let usingAbsolutePath = false
  if ('xmlPath' in configJSON) {
    usingAbsolutePath = true
  }

  //  Check to see if we're using an absolute path or not
  let usingMediaAbsolutePath = false
  if ('mediaPath' in configJSON) {
    usingMediaAbsolutePath = true
  }
  const mediaDir = tools.getMediaDir()

  templateValues.user = user
  templateValues.pingData = tools.getPingData()
  templateValues.addableFiles = addableFiles
  templateValues.dataDirExists = dataDirExists
  templateValues.usingAbsolutePath = usingAbsolutePath
  templateValues.usingMediaAbsolutePath = usingMediaAbsolutePath
  templateValues.dataDir = dataDir
  templateValues.mediaDir = mediaDir
  templateValues.config = configJSON
  return response.render('main/config', templateValues)
}
*/
