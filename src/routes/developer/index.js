const fs = require('fs')
const tools = require('../../modules/tools')
const queries = require('../../modules/queries')
const User = require('../../modules/user')
const getjsonfields = require('../../cli/getjsonfields')

exports.index = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  const configJSON = tools.getConfig()

  //  Check to see if the user has a developer key, if not generate one
  if (!('apitoken' in user) ||
    user.apitoken === null ||
    user.apitoken === undefined
  ) {
    user.generateToken()
    user.save()
  }

  //  See if we've been POSTED any data, which could be searching for items,
  //  updating the config and so on... if we have something then work out
  //  what to do with it.
  if ('body' in request) {
    //  If we've been passed an ID then we are probably looking up an item
    //  TODO: we also need to know the 'type'/'index' of the item
    if ('search' in request.body) {
      return response.redirect(
        `/view/${request.body.search}/${request.body.id}`
      )
    }
  }

  templateValues.queries = queries
  templateValues.user = user
  templateValues.config = configJSON
  templateValues.pingData = tools.getPingData()

  return response.render('developer/index', templateValues)
}

exports.fields = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  let errorMsg = null

  const configJSON = tools.getConfig()
  const index = request.params.index

  //  Make sure we have the index in the xml
  let foundMatch = false
  if ('xml' in configJSON) {
    configJSON.xml.forEach(xml => {
      if (xml.index === index) {
        foundMatch = true
      }
    })
  }

  if (foundMatch === true) {
    const startTime = new Date().getTime()
    const fields = getjsonfields.start(index, false)
    templateValues.index = index
    templateValues.fields = fields
    templateValues.ms = new Date().getTime() - startTime
  } else {
    errorMsg = {
      msg: `Index "${index}" not found in config`
    }
  }

  templateValues.errorMsg = errorMsg
  templateValues.user = user
  templateValues.config = configJSON
  templateValues.pingData = tools.getPingData()

  return response.render('developer/fields', templateValues)
}

exports.field = (request, response) => {
  const templateValues = {}
  const user = new User(request.user)

  let errorMsg = null

  const configJSON = tools.getConfig()
  const index = request.params.index
  const field = request.params.field
  const winningIds = []

  const startTime = new Date().getTime()

  //  Make sure we have the index in the xml
  let foundMatch = false
  if ('xml' in configJSON) {
    configJSON.xml.forEach(xml => {
      if (xml.index === index) {
        foundMatch = true
      }
    })
  }

  if (foundMatch === true) {
    //  Ok, this is going to get ugly, we are going to search first
    //  for the root element, then we have to do scary stuff with
    //  the rest of them. Again this could be done with recursion and
    //  it should be, because there _could_ be more then 4 levels
    //  deep. But for the moment this is easier to test, track and debug

    // Grab the files
    const rootDir = process.cwd()
    const dataDir = `${rootDir}/data`
    const tmsDir = `${dataDir}/tms`
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
    if (!fs.existsSync(tmsDir)) fs.mkdirSync(tmsDir)
    const jsonDir = `${tmsDir}/${index}/json`
    if (!fs.existsSync(jsonDir)) {
      errorMsg = {
        msg: `json files not found`
      }
    } else {
      const files = fs.readdirSync(jsonDir).filter(file => {
        const fileFragments = file.split('.')
        if (fileFragments.length !== 2) return false
        if (fileFragments[1] !== 'json') return false
        return true
      })

      files.forEach(file => {
        const fields = field.split('.')
        const rootNode = fields.shift()
        const itemRaw = fs.readFileSync(`${jsonDir}/${file}`)
        const item = JSON.parse(itemRaw)
        const id = item.id
        let foundField = false
        //  See if we have the thing we are looking for
        if (rootNode in item && item[rootNode] !== null) {
          //  If we now need to check the next level do that
          //  otherwise we have found match
          if (fields.length > 0) {
            const level1Root = item[rootNode]
            const level2Item = fields.shift()
            level1Root.forEach(root2Node => {
              if (level2Item in root2Node && root2Node[level2Item] !== null) {
                if (fields.length > 0) {
                  const level2Root = root2Node[level2Item]
                  const level3Item = fields.shift()
                  level2Root.forEach(root3Node => {
                    if (
                      level3Item in root3Node &&
                      root3Node[level3Item] !== null
                    ) {
                      if (fields.length > 0) {
                        const level3Root = root3Node[level3Item]
                        const level4Item = fields.shift()
                        level3Root.forEach(root4Node => {
                          if (
                            level4Item in root4Node &&
                            root4Node[level4Item] !== null
                          ) {
                            foundField = true
                          }
                        })
                      } else {
                        foundField = true
                      }
                    }
                  })
                } else {
                  foundField = true
                }
              }
            })
          } else {
            foundField = true
          }
        }
        if (foundField === true) {
          winningIds.push(id)
        }
      })
    }
  } else {
    errorMsg = {
      msg: `Index "${index}" not found in config`
    }
  }

  //  Reduce the number of results
  if (winningIds.length > 24) {
    templateValues.winningIds = winningIds
      .map(a => [Math.random(), a])
      .sort((a, b) => a[0] - b[0])
      .map(a => a[1])
      .slice(0, 24)
  } else {
    templateValues.winningIds = winningIds
      .map(a => [Math.random(), a])
      .sort((a, b) => a[0] - b[0])
      .map(a => a[1])
  }

  templateValues.totalRecords = winningIds.length
  templateValues.errorMsg = errorMsg
  templateValues.field = field
  templateValues.index = index
  templateValues.user = user
  templateValues.config = configJSON
  templateValues.pingData = tools.getPingData()
  templateValues.ms = new Date().getTime() - startTime

  return response.render('developer/field', templateValues)
}