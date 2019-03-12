/**
 * This module sets up all the config for the various logging we have and allows
 * us to create an instance of whichever one we need, currently just a tmsLogger
 */
const Config = require('../../classes/config')
const path = require('path')
// const elasticsearch = require('elasticsearch')

const rootDir = __dirname

// Set logging up
const winston = require('winston')
const DailyRotateFile = require('winston-daily-rotate-file')
const {
  format
} = require('winston')
const {
  combine,
  timestamp,
  printf
} = format

const tsFormat = () => (new Date()).toLocaleTimeString()

const myFormat = printf(info => {
  const timestamp = info.timestamp
  delete info.timestamp
  return `${timestamp} [${info.level}]: ${JSON.stringify(info)}`
})

const tmsLogger = winston.createLogger({
  levels: {
    fail: 0,
    object: 1,
    collection: 2
  },
  level: 'fail',
  format: combine(
    timestamp(),
    myFormat
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(rootDir, '../../../logs/tms/results-%DATE%.log'),
      level: 'collection',
      prepend: true,
      datePattern: 'YYYY-MM-DD',
      maxFiles: '7d',
      timestamp: tsFormat
    }),
    new winston.transports.Console({
      level: 'fail',
      json: true,
      timestamp: tsFormat
    })
  ]
})

class ESLogger {
  object (name, data) {
    data.dateTime = new Date()
    data.__name = `>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ${name} <<<<`
    console.log(data)
    /*
    const config = new Config()

    //  See if we have a base TMS system set up yet, if not
    //  then we get out here
    const baseTMS = config.getRootTMS()
    if (baseTMS === null) return

    const elasticsearchConfig = config.get('elasticsearch')
    if (elasticsearchConfig === null) {
      return
    }
    // const esclient = new elasticsearch.Client(elasticsearchConfig)
    // const index = `logs_${baseTMS}_tmsextract`

    data.name = name
    data.datetime = new Date()
    data.timestamp = data.datetime.getTime()
    // const id = `${data.timestamp}.${Math.random()}`
    esclient.update({
      index,
      type: 'log',
      id,
      body: {
        doc: data,
        doc_as_upsert: true
      }
    })
    */
  }
}
/**
 * Gets us access to the TMS logger, which has 4 levels of logging;
 * page, pre, post and fail
 * object is used when deal with objects
 * collection is when we deal with collections
 * fail is when we failed to do something
 * A sample log may look like...
 * tmsLogger.object('fetched', {id: 1234, ms: 24})
 */
exports.getTMSLogger = () => {
  const config = new Config()

  const elasticsearchConfig = config.get('elasticsearch')
  if (elasticsearchConfig === null) {
    return tmsLogger
  }
  return new ESLogger()
}

exports.createIndex = async () => {
  /*
  const config = new Config()

  //  See if we have a base TMS system set up yet, if not
  //  then we get out here
  const baseTMS = config.getRootTMS()
  if (baseTMS === null) return

  const elasticsearchConfig = config.get('elasticsearch')
  if (elasticsearchConfig === null) {
    return
  }
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `logs_${baseTMS}_tmsextract`
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }
  */
}

const cullAPILogs = async () => {
  /*
  const config = new Config()

  //  See if we have a base TMS system set up yet, if not
  //  then we get out here
  const baseTMS = config.getRootTMS()
  if (baseTMS === null) return

  const elasticsearchConfig = config.get('elasticsearch')
  if (elasticsearchConfig === null) {
    return
  }
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `logs_${baseTMS}_graphql`
  const type = 'log'
  const dayAgo = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 1))
  const body = {
    size: 100,
    sort: [{
      timestamp: {
        order: 'asc'
      }
    }],
    query: {
      range: {
        datetime: [{
          lte: dayAgo
        }]
      }
    }
  }
  const graphQLConfig = config.get('graphql')
  if (elasticsearchConfig !== null && baseTMS !== null && graphQLConfig !== null) {
    await esclient.deleteByQuery({
      index,
      type,
      body
    })
  }
  */
}

const cullDashboardLogs = async () => {
  /*
  const config = new Config()

  //  See if we have a base TMS system set up yet, if not
  //  then we get out here
  const baseTMS = config.getRootTMS()
  if (baseTMS === null) return

  const elasticsearchConfig = config.get('elasticsearch')
  if (elasticsearchConfig === null) {
    return
  }
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `logs_${baseTMS}_tmsextract`
  const type = 'log'
  const dayAgo = new Date(new Date().getTime() - (1000 * 60 * 60 * 24 * 7))
  const body = {
    size: 100,
    sort: [{
      timestamp: {
        order: 'asc'
      }
    }],
    query: {
      range: {
        datetime: [{
          lte: dayAgo
        }]
      }
    }
  }
  const graphQLConfig = config.get('graphql')
  if (elasticsearchConfig !== null && baseTMS !== null && graphQLConfig !== null) {
    await esclient.deleteByQuery({
      index,
      type,
      body
    })
  }
  */
}

const cullLogs = () => {
  // Get the logs that are over 1 day old
  cullAPILogs()
  cullDashboardLogs()
}

exports.startCulling = () => {
  //  Remove the old interval timer
  clearInterval(global.cullLogs)
  global.elasticsearchTmr = setInterval(() => {
    cullLogs()
  }, 1000 * 60 * 60) // Once every 60 minutes
  cullLogs()
}
