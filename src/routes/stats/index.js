const Config = require('../../classes/config')
const fs = require('fs')
const path = require('path')
const LineByLineReader = require('line-by-line')

exports.index = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  if ('action' in req.body && req.body.action === 'search') {
    if ('tms' in req.body && 'objectID' in req.body && req.body.objectID !== '') {
      return res.redirect(`/search/objects/${req.body.tms}/${req.body.objectID}`)
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
      const startTime = new Date().getTime()
      const timers = config.get('timers')

      //  Now we are doing roughly the same with the events
      let objectsWaitingToBeProcessed = 0
      const processObjectsDir = path.join(rootDir, 'objects', tms.stub, 'process')
      if (fs.existsSync(processObjectsDir)) {
        const subFolders = fs.readdirSync(processObjectsDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(processObjectsDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          objectsWaitingToBeProcessed += jsonFiles.length
        })
      }
      thisTMS.objectsWaitingToBeProcessed = objectsWaitingToBeProcessed
      let timeToUpsertObjects = objectsWaitingToBeProcessed * 20000 // (20,000 ms is the default time between uploading)
      if (timers !== null && 'elasticsearch' in timers) {
        timeToUpsertObjects = objectsWaitingToBeProcessed * parseInt(timers.elasticsearch, 10)
      }
      thisTMS.timeToUpsertObjects = new Date().getTime() + timeToUpsertObjects

      //  Again but processed
      let objectsProcessed = 0
      const processedObjectsDir = path.join(rootDir, 'objects', tms.stub, 'processed')
      if (fs.existsSync(processedObjectsDir)) {
        const subFolders = fs.readdirSync(processedObjectsDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(processedObjectsDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          objectsProcessed += jsonFiles.length
        })
      }
      thisTMS.objectsProcessed = objectsProcessed

      const endTime = new Date().getTime()
      thisTMS.ms = endTime - startTime
      newTMS.push(thisTMS)
    })
  }
  req.templateValues.tms = newTMS
  return res.render('stats/index', req.templateValues)
}

exports.logs = (req, res) => {
  if (req.user.roles.isAdmin !== true && req.user.roles.isStaff !== true) {
    return res.redirect('/')
  }

  //  Check to see if we have log files
  const rootDir = path.join(__dirname, '../../../logs/tms')
  if (!fs.existsSync(rootDir)) {
    return res.render('stats/logs', req.templateValues)
  }
  const logs = fs.readdirSync(rootDir).filter((file) => {
    const fileSplit = file.split('.')
    if (fileSplit.length !== 2) return false
    if (fileSplit[1] !== 'log') return false
    return true
  })
  const lastLog = logs.pop()

  //  Now we want to get the 100 most recent
  const last100Lines = []
  const last100ObjectsUpserted = []

  const lr = new LineByLineReader(path.join(rootDir, lastLog))
  lr.on('line', function (line) {
    //  Split the line and get the data
    const lineSplit = line.split(' [object]: ')
    const timestamp = new Date(lineSplit[0])
    const data = JSON.parse(lineSplit[1])
    const logEntry = {
      timestamp: timestamp,
      data: data
    }

    //  we record all the entries here
    last100Lines.push(logEntry)
    if (last100Lines.length > 100) {
      last100Lines.shift()
    }

    //  And the upserted items
    if ('action' in data && data.action === 'upserted_objects') {
      last100ObjectsUpserted.push(logEntry)
      if (last100ObjectsUpserted.length > 100) {
        last100ObjectsUpserted.shift()
      }
    }
  })
  lr.on('end', function () {
    req.templateValues.last100Lines = last100Lines.reverse()

    //  Get the total ms spent uploading the images
    const objectsUpsertedms = last100ObjectsUpserted.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upsert an object
    if (objectsUpsertedms.length > 0) {
      req.templateValues.averageObjectsUpsertedms = Math.floor(objectsUpsertedms.reduce((p, c) => p + c, 0) / objectsUpsertedms.length)
    } else {
      req.templateValues.averageObjectsUpsertedms = 0
    }
    req.templateValues.last100ObjectsUpserted = last100ObjectsUpserted.reverse()

    return res.render('stats/logs', req.templateValues)
  })
}