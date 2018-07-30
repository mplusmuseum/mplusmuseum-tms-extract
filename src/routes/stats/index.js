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
      return res.redirect(`/search/object/${req.body.tms}/${req.body.objectID}`)
    }
    if ('tms' in req.body && 'eventID' in req.body && req.body.eventID !== '') {
      return res.redirect(`/search/event/${req.body.tms}/${req.body.eventID}`)
    }
    if ('tms' in req.body && 'exhibitionID' in req.body && req.body.exhibitionID !== '') {
      return res.redirect(`/search/exhibition/${req.body.tms}/${req.body.exhibitionID}`)
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
      let totalFiles = 0
      let haveImageSources = 0
      let imagesUploaded = 0
      const perfectDir = path.join(rootDir, 'tms', tms.stub, 'perfect')
      if (fs.existsSync(perfectDir)) {
        const subFolders = fs.readdirSync(perfectDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(perfectDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          jsonFiles.forEach((file) => {
            const filename = path.join(perfectDir, subFolder, file)
            const fileRaw = fs.readFileSync(filename, 'utf-8')
            const fileJSON = JSON.parse(fileRaw)
            totalFiles += 1
            if ('tmsSource' in fileJSON && fileJSON.tmsSource !== null) {
              haveImageSources += 1
              if ('remote' in fileJSON && fileJSON.remote !== null) {
                imagesUploaded += 1
              }
            }
          })
        })
      }
      const timers = config.get('timers')

      //  Work out how long it'll take to upload the rest of the images at the current speed
      const imagesRemaining = haveImageSources - imagesUploaded
      let timeToUploadImages = imagesRemaining * 20000 // (20,000 ms is the default time between uploading)
      if (timers !== null && 'cloudinary' in timers) {
        timeToUploadImages = imagesRemaining * parseInt(timers.cloudinary, 10)
      }
      thisTMS.totalFiles = totalFiles
      thisTMS.haveImageSources = haveImageSources
      thisTMS.imagesUploaded = imagesUploaded
      thisTMS.imagesRemaining = imagesRemaining
      thisTMS.timeToUploadImages = timeToUploadImages
      thisTMS.finishAt = new Date().getTime() + timeToUploadImages

      let waitingToBeProcessed = 0
      const processDir = path.join(rootDir, 'tms', tms.stub, 'process')
      if (fs.existsSync(processDir)) {
        const subFolders = fs.readdirSync(processDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(processDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          waitingToBeProcessed += jsonFiles.length
        })
      }
      thisTMS.waitingToBeProcessed = waitingToBeProcessed
      let timeToUpsertItems = waitingToBeProcessed * 20000 // (20,000 ms is the default time between uploading)
      if (timers !== null && 'elasticsearch' in timers) {
        timeToUpsertItems = waitingToBeProcessed * parseInt(timers.elasticsearch, 10)
      }
      thisTMS.timeToUpsertItems = new Date().getTime() + timeToUpsertItems

      //  Now we are doing roughly the same with the events
      let eventsWaitingToBeProcessed = 0
      const processEventsDir = path.join(rootDir, 'events', tms.stub, 'process')
      if (fs.existsSync(processEventsDir)) {
        const subFolders = fs.readdirSync(processEventsDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(processEventsDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          eventsWaitingToBeProcessed += jsonFiles.length
        })
      }
      thisTMS.eventsWaitingToBeProcessed = eventsWaitingToBeProcessed
      let timeToUpsertEvents = eventsWaitingToBeProcessed * 20000 // (20,000 ms is the default time between uploading)
      if (timers !== null && 'elasticsearch' in timers) {
        timeToUpsertEvents = eventsWaitingToBeProcessed * parseInt(timers.elasticsearch, 10)
      }
      thisTMS.timeToUpsertEvents = new Date().getTime() + timeToUpsertEvents

      //  Again but processed
      let eventsProcessed = 0
      const processedEventsDir = path.join(rootDir, 'events', tms.stub, 'processed')
      if (fs.existsSync(processedEventsDir)) {
        const subFolders = fs.readdirSync(processedEventsDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(processedEventsDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          eventsProcessed += jsonFiles.length
        })
      }
      thisTMS.eventsProcessed = eventsProcessed

      //  Now we are doing roughly the same with the exhibitions
      let exhibitionsWaitingToBeProcessed = 0
      const processExhibitionsDir = path.join(rootDir, 'exhibitions', tms.stub, 'process')
      if (fs.existsSync(processExhibitionsDir)) {
        const subFolders = fs.readdirSync(processExhibitionsDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(processExhibitionsDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          exhibitionsWaitingToBeProcessed += jsonFiles.length
        })
      }
      thisTMS.exhibitionsWaitingToBeProcessed = exhibitionsWaitingToBeProcessed
      let timeToUpsertExhibitions = exhibitionsWaitingToBeProcessed * 20000 // (20,000 ms is the default time between uploading)
      if (timers !== null && 'elasticsearch' in timers) {
        timeToUpsertExhibitions = exhibitionsWaitingToBeProcessed * parseInt(timers.elasticsearch, 10)
      }
      thisTMS.timeToUpsertExhibitions = new Date().getTime() + timeToUpsertExhibitions

      let exhibitionsProcessed = 0
      const processedExhibitionsDir = path.join(rootDir, 'exhibitions', tms.stub, 'processed')
      if (fs.existsSync(processedExhibitionsDir)) {
        const subFolders = fs.readdirSync(processedExhibitionsDir)
        subFolders.forEach((subFolder) => {
          const jsonFiles = fs.readdirSync(path.join(processedExhibitionsDir, subFolder)).filter((file) => {
            const filesSplit = file.split('.')
            if (filesSplit.length !== 2) return false
            if (filesSplit[1] !== 'json') return false
            return true
          })
          exhibitionsProcessed += jsonFiles.length
        })
      }
      thisTMS.exhibitionsProcessed = exhibitionsProcessed

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
  const last100ImagesUploaded = []
  const last100PagesReceived = []
  const last100ItemsUpserted = []
  const last100EventsUpserted = []
  const last100ExhibitionsUpserted = []
  const last100ImagesColored = []

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

    //  Now we save the uploaded images here
    if ('action' in data && data.action === 'uploadedImage') {
      last100ImagesUploaded.push(logEntry)
      if (last100ImagesUploaded.length > 100) {
        last100ImagesUploaded.shift()
      }
    }

    //  Now we save the pages recieved
    if ('action' in data && data.action === 'received') {
      last100PagesReceived.push(logEntry)
      if (last100PagesReceived.length > 100) {
        last100PagesReceived.shift()
      }
    }

    //  And the upserted items
    if ('action' in data && data.action === 'upsertedItem') {
      last100ItemsUpserted.push(logEntry)
      if (last100ItemsUpserted.length > 100) {
        last100ItemsUpserted.shift()
      }
    }

    //  And the upserted events
    if ('action' in data && data.action === 'upsertedEvent') {
      last100EventsUpserted.push(logEntry)
      if (last100EventsUpserted.length > 100) {
        last100EventsUpserted.shift()
      }
    }

    //  And the upserted exhibitions
    if ('action' in data && data.action === 'upsertedExhibition') {
      last100ExhibitionsUpserted.push(logEntry)
      if (last100ExhibitionsUpserted.length > 100) {
        last100ExhibitionsUpserted.shift()
      }
    }

    //  And the colored items
    if ('action' in data && data.action === 'coloredImage') {
      last100ImagesColored.push(logEntry)
      if (last100ImagesColored.length > 100) {
        last100ImagesColored.shift()
      }
    }
  })
  lr.on('end', function () {
    req.templateValues.last100Lines = last100Lines.reverse()

    //  Get the total ms spent uploading the images
    const imagesUploadms = last100ImagesUploaded.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upload an image
    if (imagesUploadms.length > 0) {
      req.templateValues.averageImageUploadms = Math.floor(imagesUploadms.reduce((p, c) => p + c, 0) / imagesUploadms.length)
    } else {
      req.templateValues.averageImageUploadms = 0
    }
    req.templateValues.last100ImagesUploaded = last100ImagesUploaded.reverse()

    //  Get the total ms spent uploading the images
    const pagesReceivedms = last100PagesReceived.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upload an image
    if (pagesReceivedms.length > 0) {
      req.templateValues.averagePagesReceivedms = Math.floor(pagesReceivedms.reduce((p, c) => p + c, 0) / pagesReceivedms.length)
    } else {
      req.templateValues.averagePagesReceivedms = 0
    }
    req.templateValues.last100PagesReceived = last100PagesReceived.reverse()

    //  Get the total ms spent uploading the images
    const itemsUpsertedms = last100ItemsUpserted.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upsert an object
    if (itemsUpsertedms.length > 0) {
      req.templateValues.averageItemsUpsertedms = Math.floor(itemsUpsertedms.reduce((p, c) => p + c, 0) / itemsUpsertedms.length)
    } else {
      req.templateValues.averageItemsUpsertedms = 0
    }
    req.templateValues.last100ItemsUpserted = last100ItemsUpserted.reverse()

    //  Get the total ms spent uploading the images
    const eventsUpsertedms = last100EventsUpserted.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upsert an event
    if (eventsUpsertedms.length > 0) {
      req.templateValues.averageEventsUpsertedms = Math.floor(eventsUpsertedms.reduce((p, c) => p + c, 0) / eventsUpsertedms.length)
    } else {
      req.templateValues.averageEventsUpsertedms = 0
    }
    req.templateValues.last100EventsUpserted = last100EventsUpserted.reverse()

    //  Get the total ms spent uploading the images
    const exhibitionsUpsertedms = last100ExhibitionsUpserted.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upsert an exhibition
    if (exhibitionsUpsertedms.length > 0) {
      req.templateValues.averageExhibitionsUpsertedms = Math.floor(exhibitionsUpsertedms.reduce((p, c) => p + c, 0) / exhibitionsUpsertedms.length)
    } else {
      req.templateValues.averageExhibitionsUpsertedms = 0
    }
    req.templateValues.last100ExhibitionsUpserted = last100ExhibitionsUpserted.reverse()

    //  Get the total ms spent uploading the images
    const itemsColoredms = last100ImagesColored.map((record) => {
      return parseInt(record.data.ms, 10)
    })
    //  Get the average time to upload an image
    if (itemsColoredms.length > 0) {
      req.templateValues.averageImagesColoredms = Math.floor(itemsColoredms.reduce((p, c) => p + c, 0) / itemsColoredms.length)
    } else {
      req.templateValues.averageImagesColoredms = 0
    }
    req.templateValues.last100ImagesColored = last100ImagesColored.reverse()

    return res.render('stats/logs', req.templateValues)
  })
}