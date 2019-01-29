const Config = require('../../classes/config')
const fs = require('fs')
const path = require('path')
const elasticsearch = require('elasticsearch')

exports.index = async (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true && req.user.roles.isVendor !== true) {
    return res.redirect('/')
  }

  if ('action' in req.body && req.body.action === 'search') {
    if ('tms' in req.body && 'itemID' in req.body && req.body.itemID !== '' && 'itemType' in req.body) {
      return res.redirect(`/search/${req.body.itemType.toLowerCase()}/${req.body.tms}/${req.body.itemID}`)
    }
  }

  //  Just for fun we are going to find out how many perfect records we
  //  have for each TMS system, see how many have images and how many
  //  images have been uploaded
  const rootDir = path.join(__dirname, '../../../data')
  const config = new Config()
  const tmsses = config.get('tms')
  const newTMS = []

  if (tmsses !== null) {
    tmsses.forEach((tms) => {
      const thisTMS = {
        stub: tms.stub
      }
      //  Grab the image path for this TMS system
      /*
      let imagePath = ''
      if (config.tms) {
        config.tms.forEach((imageTms) => {
          if (imageTms.stub === tms.stub) imagePath = imageTms.imagePath
        })
      }
      */
      const startTime = new Date().getTime()
      const timers = config.get('timers')

      const types = [{
        parent: 'Objects',
        child: 'Object'
      }, {
        parent: 'Constituents',
        child: 'Constituent'
      }, {
        parent: 'Exhibitions',
        child: 'Exhibition'
      }, {
        parent: 'BibiolographicData',
        child: 'Bibiolography'
      }, {
        parent: 'Events',
        child: 'Event'
      }, {
        parent: 'Concepts',
        child: 'Concept'
      }]
      const processingData = {}
      //  Keep track of which objects have images uploaded
      const images = {
        all: {
          hasImage: 0,
          noImage: 0,
          missingImage: 0,
          uploadedImage: 0
        },
        sigg: {
          hasImage: 0,
          noImage: 0,
          missingImage: 0,
          uploadedImage: 0
        }
      }
      types.forEach((type) => {
        processingData[type.parent] = {
          child: type.child,
          waitingToBeProcessed: 0
        }
        const processDir = path.join(rootDir, 'imports', type.parent, tms.stub, 'process')
        if (fs.existsSync(processDir)) {
          const subFolders = fs.readdirSync(processDir)
          subFolders.forEach((subFolder) => {
            const jsonFiles = fs.readdirSync(path.join(processDir, subFolder)).filter((file) => {
              const filesSplit = file.split('.')
              if (filesSplit.length !== 2) return false
              if (filesSplit[1] !== 'json') return false
              return true
            })
            processingData[type.parent].waitingToBeProcessed += jsonFiles.length
          })
        }
        processingData[type.parent].timeToUpsert = processingData[type.parent].waitingToBeProcessed * 20000 // (20,000 ms is the default time between uploading)
        if (timers !== null && 'elasticsearch' in timers) {
          processingData[type.parent].timeToUpsert = processingData[type.parent].waitingToBeProcessed * parseInt(timers.elasticsearch, 10)
        }
        processingData[type.parent].timeToUpsert = new Date().getTime() + processingData[type.parent].timeToUpsert

        //  Again but processed
        const processedDir = path.join(rootDir, 'imports', type.parent, tms.stub, 'processed')
        processingData[type.parent].itemsProcessed = 0
        if (fs.existsSync(processedDir)) {
          const subFolders = fs.readdirSync(processedDir)
          subFolders.forEach((subFolder) => {
            const jsonFiles = fs.readdirSync(path.join(processedDir, subFolder)).filter((file) => {
              const filesSplit = file.split('.')
              if (filesSplit.length !== 2) return false
              if (filesSplit[1] !== 'json') return false
              return true
            })
            processingData[type.parent].itemsProcessed += jsonFiles.length
          })
        }
      })

      thisTMS.processingData = processingData
      thisTMS.images = images
      const endTime = new Date().getTime()
      thisTMS.ms = endTime - startTime
      newTMS.push(thisTMS)
    })
  }
  req.templateValues.tms = newTMS

  //  THIS IS BAD
  //  I'm now going to check all the objects. I should really be doing
  //  this inside the TMS loop, as we may have more than one thing. But for
  //  the moment I'm just going to do it here
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  let publicAccessTrue = null
  let publicAccessFalse = null

  const baseTMS = config.getRootTMS()

  if (elasticsearchConfig !== null && baseTMS !== null) {
    const esclient = new elasticsearch.Client(elasticsearchConfig)
    const index = `objects_${baseTMS}`

    //  Get all the public access files
    try {
      const record = await esclient.count({
        index,
        body: {
          query: {
            term: {
              publicAccess: true
            }
          }
        }
      })
      publicAccessTrue = parseInt(record.count, 10)
    } catch (err) {
      publicAccessTrue = null
    }

    //  Get all the non public access files
    try {
      const record = await esclient.count({
        index,
        body: {
          query: {
            term: {
              publicAccess: false
            }
          }
        }
      })
      publicAccessFalse = parseInt(record.count, 10)
    } catch (err) {
      publicAccessFalse = null
    }
  }

  if (publicAccessTrue !== null && publicAccessFalse !== null) {
    req.templateValues.publicAccess = {
      trueTotal: publicAccessTrue,
      falseTotal: publicAccessFalse,
      total: publicAccessTrue + publicAccessFalse,
      truePercent: Math.ceil(publicAccessTrue / (publicAccessTrue + publicAccessFalse) * 100),
      falsePercent: Math.floor(publicAccessFalse / (publicAccessTrue + publicAccessFalse) * 100)
    }
  }
  return res.render('stats/index', req.templateValues)
}

exports.logs = async (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  const esclient = new elasticsearch.Client(elasticsearchConfig)

  const baseTMS = config.getRootTMS()

  const index = `logs_${baseTMS}_tmsextract`
  const type = 'log'
  const basebody = {
    size: 100,
    sort: [{
      timestamp: {
        order: 'desc'
      }
    }]
  }

  let records = {}
  if (elasticsearchConfig !== null && baseTMS !== null) {
    records = await esclient.search({
      index,
      type,
      body: basebody
    })
  }
  req.templateValues.last100Lines = null
  if (records && records.hits && records.hits.hits) {
    req.templateValues.last100Lines = records.hits.hits.map((record) => record._source)
  }

  req.templateValues.last100Upserted = {}

  const upsertBody = JSON.parse(JSON.stringify(basebody))
  upsertBody.query = {
    bool: {
      must: [{
        term: {
          'action.keyword': 'finished upsertTheItem'
        }
      }]
    }
  }

  const types = [{
    parent: 'Objects',
    child: 'Object'
  }, {
    parent: 'Constituents',
    child: 'Constituent'
  }, {
    parent: 'Exhibitions',
    child: 'Exhibition'
  }, {
    parent: 'BibiolographicData',
    child: 'Bibiolography'
  }, {
    parent: 'Events',
    child: 'Event'
  }, {
    parent: 'Concepts',
    child: 'Concept'
  }]
  req.templateValues.last100Upserted = {}

  for (const type of types) {
    const upsertTypeBody = JSON.parse(JSON.stringify(upsertBody))
    upsertTypeBody.query.bool.must.push({
      match: {
        'type': type.child
      }
    })
    let upsertsRecords = null
    if (elasticsearchConfig !== null && baseTMS !== null) {
      upsertsRecords = await esclient.search({
        index,
        type: 'log',
        body: upsertTypeBody
      })
    }
    req.templateValues.last100Upserted[type.parent] = {}
    if (upsertsRecords && upsertsRecords.hits && upsertsRecords.hits.hits) {
      req.templateValues.last100Upserted[type.parent].items = upsertsRecords.hits.hits.map((record) => record._source)
      const msArray = req.templateValues.last100Upserted[type.parent].items.map((record) => record.ms).filter(Boolean)
      req.templateValues.last100Upserted[type.parent].averageUpsertedms = Math.floor(msArray.reduce((p, c) => p + c, 0) / msArray.length)
      if (isNaN(req.templateValues.last100Upserted[type.parent].averageUpsertedms)) req.templateValues.last100Upserted[type.parent].averageUpsertedms = 0
    }
  }

  req.templateValues.processingMainXML = null
  const processingBody = JSON.parse(JSON.stringify(basebody))
  processingBody.query = {
    bool: {
      must: [{
        term: {
          'action.keyword': 'finished processJsonFile'
        }
      }]
    }
  }
  let processingRecords = null
  if (elasticsearchConfig !== null && baseTMS !== null) {
    processingRecords = await esclient.search({
      index,
      type,
      body: processingBody
    })
  }
  if (processingRecords && processingRecords.hits && processingRecords.hits.hits) {
    req.templateValues.processingMainXML = processingRecords.hits.hits.map((record) => record._source)
  }

  /*
  Now get the most recent graphQL logs
  */
  const body = {
    size: 100,
    sort: [{
      timestamp: {
        order: 'desc'
      }
    }],
    query: {
      bool: {
        must: [{
          match: {
            initialCall: true
          }
        }]
      }
    }
  }

  const graphQLConfig = config.get('graphql')
  let graphQLRecords = null
  if (elasticsearchConfig !== null && baseTMS !== null && graphQLConfig !== null) {
    graphQLRecords = await esclient.search({
      index: `logs_${baseTMS}_graphql`,
      type,
      body
    })
  }
  console.log(graphQLRecords)

  if (graphQLRecords && graphQLRecords.hits && graphQLRecords.hits.total) {
    req.templateValues.totalLogRecords = graphQLRecords.hits.total
  }
  if (graphQLRecords && graphQLRecords.hits && graphQLRecords.hits.hits) {
    req.templateValues.graphQLRecords = graphQLRecords.hits.hits.map((record) => record._source).map((record) => {
      record.argsNice = JSON.stringify(record.args, null, 4)
      return record
    })
  }
  return res.render('stats/logs', req.templateValues)
}
