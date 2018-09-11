const Config = require('../../classes/config')

const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const elasticsearch = require('elasticsearch')
const Queries = require('../../classes/queries')
const GraphQL = require('../../classes/graphQL')

exports.index = async (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  const startms = new Date().getTime()

  //  First of all look to see if we have the data in process, processed and perfect
  let processJSON = null
  let processedJSON = null
  let perfectJSON = null
  let xmlXML = null

  const tms = req.params.tms
  const id = req.params.id

  const subFolder = String(Math.floor(id / 1000) * 1000)
  const processFilename = path.join(rootDir, 'imports', 'Objects', tms, 'process', subFolder, `${id}.json`)
  const processedFilename = path.join(rootDir, 'imports', 'Objects', tms, 'processed', subFolder, `${id}.json`)
  const perfectFilename = path.join(rootDir, 'imports', 'Objects', tms, 'perfect', subFolder, `${id}.json`)
  const xmlFilename = path.join(rootDir, 'imports', 'Objects', tms, 'xml', subFolder, `${id}.xml`)

  if (fs.existsSync(processFilename)) {
    const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
    processJSON = JSON.parse(processFileRaw)
  }

  if (fs.existsSync(processedFilename)) {
    const processedFileRaw = fs.readFileSync(processedFilename, 'utf-8')
    processedJSON = JSON.parse(processedFileRaw)
  }

  if (fs.existsSync(perfectFilename)) {
    const perfectFileRaw = fs.readFileSync(perfectFilename, 'utf-8')
    perfectJSON = JSON.parse(perfectFileRaw)
  }

  if (fs.existsSync(xmlFilename)) {
    xmlXML = fs.readFileSync(xmlFilename, 'utf-8')
  }

  req.templateValues.processJSON = processJSON
  req.templateValues.processedJSON = processedJSON
  req.templateValues.perfectJSON = perfectJSON
  req.templateValues.xmlXML = xmlXML

  //  Now get the results from elastic search
  let elasticSearchJSON = null
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig !== null) {
    const esclient = new elasticsearch.Client(elasticsearchConfig)
    const index = `objects_${tms}`
    const type = 'object'
    try {
      const record = await esclient.get({
        index,
        type,
        id
      })
      elasticSearchJSON = record
    } catch (err) {
      elasticSearchJSON = err
    }
  }
  req.templateValues.elasticSearchJSON = elasticSearchJSON

  //  Grab the query used to ask for an object
  const queries = new Queries()
  const searchFilter = `(id: ${id})`
  const query = queries.get('objectLarge', searchFilter)

  //  Now we need to actually run the query
  const graphQL = new GraphQL()
  const payload = {
    query
  }
  const results = await graphQL.fetch(payload)
  req.templateValues.graphQLresults = results

  req.templateValues.searchFilter = searchFilter
  req.templateValues.queries = queries

  req.templateValues.id = id

  req.templateValues.executionTime = new Date().getTime() - startms

  return res.render('search/objects', req.templateValues)
}