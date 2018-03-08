const fs = require('fs')
const tools = require('../../modules/tools')

exports.index = (request, response) => {
  const templateValues = {}
  templateValues.msg = 'Hello world!'

  const config = tools.getConfig()

  //  Check to see if we have an id, if not then redirect back to root
  //  TODO: in the future we'll redirect to /objects
  if (!('params' in request) || !('id' in request.params)) {
    return response.redirect('/')
  }

  //  Grab the id
  const { id } = request.params
  const itemName = request.params.item
  let itemTitle = 'Unknown'
  switch (itemName) {
    case 'objects':
      itemTitle = 'Object'
      break
    case 'authors':
      itemTitle = 'Author'
      break
    default:
      itemTitle = 'Unknown'
  }

  //  Setup all the directory stuff
  const rootDir = process.cwd()
  const dataDir = `${rootDir}/app/data/tms/${itemName}`
  const jsonFile = `${dataDir}/json/id_${id}.json`
  const xmlFile = `${dataDir}/xml/id_${id}.xml`

  //  Go grab the JSON file
  let itemJSON = null
  if (fs.existsSync(jsonFile)) {
    itemJSON = fs.readFileSync(jsonFile, 'utf-8')
  }

  //  Go grab the XML file
  let itemXML = null
  if (fs.existsSync(xmlFile)) {
    itemXML = fs.readFileSync(xmlFile, 'utf-8')
  }

  let showResults = true
  if (itemJSON === null && itemXML === null) {
    showResults = false
  }

  const GraphQLQuery = `{
  author(id: ${id}) {
    id
  }
}`
  const encodedQuery = encodeURIComponent(GraphQLQuery)
  let encodedQL = null
  let encodedAPI = null

  let showQL = false
  if ('graphql' in config && 'host' in config.graphql) {
    showQL = true
    encodedQL = `${config.graphql.host}/graphql?query=${encodedQuery}`
    encodedAPI = `${config.graphql.host}/api-explorer?query=${encodedQuery}`
  }
  templateValues.id = id
  templateValues.showResults = showResults
  templateValues.itemTitle = itemTitle
  templateValues.itemJSON = itemJSON
  templateValues.itemXML = itemXML
  templateValues.GraphQLQuery = GraphQLQuery
  templateValues.encodedQL = encodedQL
  templateValues.encodedAPI = encodedAPI
  templateValues.showQL = showQL
  templateValues.pingData = tools.getPingData()
  templateValues.config = config
  return response.render('item/index', templateValues)
}
