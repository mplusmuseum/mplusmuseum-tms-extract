const Config = require('../../classes/config')

const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const cloudinary = require('cloudinary')
const logging = require('../logging')
// const elasticsearch = require('elasticsearch')

/**
 * This method tries to grab a record of an object that has an image that needs
 * uploading and has a go at uploading, if it manages it then it puts the resulting
 * information back into the perfect file, otherwise it needs to mark it as failed
 * somehow
 * @param {String} stub The name of the TMS folder we are going to look in
 * @param {String} id The id of the object we want to upload
 */
const uploadImage = (stub, type, id) => {
  console.log(`Image uploading ${id}`)
  const tmsLogger = logging.getTMSLogger()

  //  Check to see that we have cloudinary configured
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    return
  }

  //  Grab the perfect file to find out which image we need to upload
  const subFolder = String(Math.floor(id / 1000) * 1000)
  const perfectFilename = path.join(rootDir, 'imports', type, stub, 'perfect', subFolder, `${id}.json`)
  if (!fs.existsSync(perfectFilename)) {
    console.log('Perfect file not found')
    return
  }
  const perfectFileRaw = fs.readFileSync(perfectFilename, 'utf-8')
  const perfectFileJSON = JSON.parse(perfectFileRaw)

  //  And get the file path
  let imagePath = null
  if (!config.tms == null) return
  config.tms.forEach((imageTms) => {
    if (imageTms.stub === stub) imagePath = imageTms.imagePath
  })

  //  Loop through the remote looking for an image to upload
  let fullImagePath = null
  let imageSrc = null
  if (perfectFileJSON.remote && perfectFileJSON.remote.images) {
    Object.entries(perfectFileJSON.remote.images).forEach((remoteImage) => {
      const imageObj = remoteImage[1]
      if (imageObj.status === 'upload') {
        imageSrc = imageObj.src
        fullImagePath = path.join(imagePath, imageObj.src)
      }
    })
  }

  // If the file is missing then we mark it as missing
  if (!fs.existsSync(fullImagePath)) {
    console.log('File not found: ', fullImagePath)
    perfectFileJSON.remote.images[imageSrc].status = 'missing'
    const perfectFileJSONPretty = JSON.stringify(perfectFileJSON, null, 4)
    fs.writeFileSync(perfectFilename, perfectFileJSONPretty, 'utf-8')
    return
  }

  //  Set up cloudinary
  cloudinary.config(cloudinaryConfig)

  const startTime = new Date().getTime()
  tmsLogger.object(`Uploading image for ${type} ${id} for ${stub}`, {
    action: 'uploadImage',
    id,
    stub,
    type,
    source: imageSrc
  })

  if (global.uploading && global.uploading === true) {
    console.log('Already uploading image ', id)
    return
  }
  global.uploading = true
  console.log(`about to upload image for ${id}`)
  cloudinary.uploader.upload(fullImagePath, (result) => {
    //  Check to see if we had an error, if so we add that to the perfect file
    //  instead, so maybe we can go back and retry them
    const endTime = new Date().getTime()
    console.log(`Uploaded id: ${id} in ${endTime - startTime}ms`)
    global.uploading = false
    if ('error' in result) {
      perfectFileJSON.remote.images[imageSrc].status = 'error'
      perfectFileJSON.remote.images[imageSrc].status = result.error.message
      perfectFileJSON.remote.images[imageSrc].status = result.error.https_code
      tmsLogger.object(`Failed uploading image for ${type} ${id} for ${stub}`, {
        action: 'error',
        id,
        stub,
        type,
        source: imageSrc,
        ms: endTime - startTime,
        error: result
      })
    } else {
      tmsLogger.object(`Uploaded image for ${type} ${id} for ${stub}`, {
        action: 'uploadedImage',
        id,
        stub,
        type,
        source: imageSrc,
        ms: endTime - startTime
      })
      perfectFileJSON.remote.images[imageSrc].status = 'ok'
      perfectFileJSON.remote.images[imageSrc].original_image_src = imageSrc
      perfectFileJSON.remote.images[imageSrc].public_id = result.public_id
      perfectFileJSON.remote.images[imageSrc].version = result.version
      perfectFileJSON.remote.images[imageSrc].signature = result.signature
      perfectFileJSON.remote.images[imageSrc].width = result.width
      perfectFileJSON.remote.images[imageSrc].height = result.height
      perfectFileJSON.remote.images[imageSrc].format = result.format
    }
    const perfectFileJSONPretty = JSON.stringify(perfectFileJSON, null, 4)
    fs.writeFileSync(perfectFilename, perfectFileJSONPretty, 'utf-8')
  })
}

/**
 * All this method does is look through _all_ the tms "perfect" folders
 * looking for the first record it finds where we have an image source
 * but the remote is still 'null' meaning we haven't uploaded it yet.
 * As soon as we find one we stop (kind of, forEach loops just keep going)
 * and call the 'uploadImage' method to actually handle the uploading of it
 * @private
 */
const checkImages = () => {
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  const tmsLogger = logging.getTMSLogger()

  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    tmsLogger.object(`No cloudinary configured`, {
      action: 'checkingImages'
    })
    return
  }

  const tmsses = config.get('tms')
  let foundImageToUpload = null

  const types = [{
    parent: 'Objects',
    child: 'Object'
  }]
  if (tmsses !== null) {
    tmsses.forEach((tms) => {
      if (foundImageToUpload !== null) return

      types.forEach((type) => {
        if (foundImageToUpload !== null) return
        //  Grab the process and perfect folders
        const processDir = path.join(rootDir, 'imports', type.parent, tms.stub, 'process')
        const perfectDir = path.join(rootDir, 'imports', type.parent, tms.stub, 'perfect')
        //  Make sure we have something to
        if (fs.existsSync(processDir)) {
          const subFolders = fs.readdirSync(processDir)
          subFolders.forEach((subFolder) => {
            const jsonFiles = fs.readdirSync(path.join(processDir, subFolder)).filter((file) => {
              const filesSplit = file.split('.')
              if (filesSplit.length !== 2) return false
              if (filesSplit[1] !== 'json') return false
              return true
            }).filter(Boolean)
            jsonFiles.forEach((file) => {
              if (foundImageToUpload !== null) return
              const processFilename = path.join(processDir, subFolder, file)
              const perfectFilename = path.join(perfectDir, subFolder, file)
              //  If we have a process file *and* a perfect file, then we need to read in
              //  the process file to look at the images it has
              if (fs.existsSync(processFilename) && fs.existsSync(perfectFilename)) {
                const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
                const processFileJSON = JSON.parse(processFileRaw)
                if (!processFileJSON.images || processFileJSON.images.length === 0) return
                //  Now we know we have some images, we need to read in the perfect file
                //  and see if any of the images don't exist in the remote part of it
                const perfectFileRaw = fs.readFileSync(perfectFilename, 'utf-8')
                const perfectFileJSON = JSON.parse(perfectFileRaw)
                //  If we don't even have a remote field in the perfect, then we need to
                //  add the remote information
                if (!perfectFileJSON.remote) {
                  perfectFileJSON.remote = {
                    status: 'uploading',
                    images: {}
                  }
                  processFileJSON.images.forEach((image) => {
                    perfectFileJSON.remote.images[image.src] = image
                    perfectFileJSON.remote.images[image.src].status = 'upload'
                    perfectFileJSON.remote.images[image.src].public_id = null
                    perfectFileJSON.remote.images[image.src].version = null
                    perfectFileJSON.remote.images[image.src].signature = null
                    perfectFileJSON.remote.images[image.src].width = null
                    perfectFileJSON.remote.images[image.src].height = null
                    perfectFileJSON.remote.images[image.src].format = null
                  })
                  //  Save the data back out
                  const perfectFileJSONPretty = JSON.stringify(perfectFileJSON, null, 4)
                  fs.writeFileSync(perfectFilename, perfectFileJSONPretty, 'utf-8')
                }

                //  Now look through the remote, looking for an image to upload
                Object.entries(perfectFileJSON.remote.images).forEach((remoteImage) => {
                  const imageObj = remoteImage[1]
                  if (imageObj.status === 'upload') {
                    foundImageToUpload = {
                      tms: tms.stub,
                      type: type.parent,
                      id: processFileJSON.id
                    }
                  }
                })

                //  If we've gotten through all the remote images and still don't have one to
                //  upload then we can mark it as 'ok'
                if (foundImageToUpload === null) {
                  perfectFileJSON.remote.status = 'ok'
                  const perfectFileJSONPretty = JSON.stringify(perfectFileJSON, null, 4)
                  fs.writeFileSync(perfectFilename, perfectFileJSONPretty, 'utf-8')
                }
              }
            })
          })
        }
      })
    })
  }

  if (foundImageToUpload !== null) {
    uploadImage(foundImageToUpload.tms, foundImageToUpload.type, foundImageToUpload.id)
  }
}

/**
 * This method tries to grab a record of an object that has an image that needs
 * uploading and has a go at uploading, if it manages it then it puts the resulting
 * information back into the perfect file, otherwise it needs to mark it as failed
 * somehow
 * @param {String} stub The name of the TMS folder we are going to look in
 * @param {String} id The id of the object we want to upload
 */
const colorImage = (stub, id) => {
  const tmsLogger = logging.getTMSLogger()
  // const startTime = new Date().getTime()

  //  Check to see that we have cloudinary configured
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    return
  }

  //  Check to see that we have elasticsearch configured
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    return
  }

  //  Check to make sure the file exists
  const subFolder = String(Math.floor(id / 1000) * 1000)
  const filename = path.join(rootDir, 'tms', stub, 'perfect', subFolder, `${id}.json`)
  if (!fs.existsSync(filename)) return

  //  Read in the perfectFile
  const perfectFileRaw = fs.readFileSync(filename, 'utf-8')
  const perfectFile = JSON.parse(perfectFileRaw)

  //  Make sure we don't have a null source
  if (perfectFile.tmsSource === null) return

  cloudinary.config(cloudinaryConfig)

  tmsLogger.object(`Uploading color information for object ${id} for ${stub}`, {
    action: 'colorImage',
    id: id,
    stub: stub
  })
  /*
  cloudinary.api.resource(perfectFile.remote.public_id,
    function (result) {
      if ('error' in result) {
        const endTime = new Date().getTime()
        tmsLogger.object(`Failed valid cloudinary color check for object ${id} for ${stub}`, {
          action: 'error',
          id: id,
          stub: stub,
          ms: endTime - startTime,
          error: result
        })
        return
      }

      const esclient = new elasticsearch.Client(elasticsearchConfig)
      const colors = {}
      if ('colors' in result) {
        result.colors.forEach((color) => {
          colors[color[0]] = color[1]
        })
      }
      const newColors = JSON.stringify(colors)
      const predominant = {
        google: {},
        cloudinary: {}
      }
      if ('predominant' in result) {
        if ('google' in result.predominant) {
          result.predominant.google.forEach((color) => {
            predominant.google[color[0]] = color[1]
          })
        }
        if ('cloudinary' in result.predominant) {
          result.predominant.cloudinary.forEach((color) => {
            predominant.cloudinary[color[0]] = color[1]
          })
        }
      }
      //  Upsert the item
      const index = 'objects_wcma'
      const type = 'object'
      const upsertItem = {
        id: parseInt(id, 10),
        color: {
          predominant: newColors,
          search: predominant
        }
      }
      esclient.update({
        index,
        type,
        id,
        body: {
          doc: upsertItem,
          doc_as_upsert: true
        }
      }).then(() => {
        //  Write out the file
        perfectFile.color = {
          predominant: newColors,
          search: predominant
        }
        const perfectFileJSONPretty = JSON.stringify(perfectFile, null, 4)
        fs.writeFileSync(filename, perfectFileJSONPretty, 'utf-8')

        const endTime = new Date().getTime()
        tmsLogger.object(`Uploaded color information for object ${id} for ${stub}`, {
          action: 'coloredImage',
          id: id,
          stub: stub,
          ms: endTime - startTime
        })
      }).catch((err) => {
        console.error(err)

        const endTime = new Date().getTime()
        tmsLogger.object(`Failed coloring image for object ${id} for ${stub}`, {
          action: 'error',
          id: id,
          stub: stub,
          ms: endTime - startTime,
          error: result
        })
      })
    }, {
      colors: true
    })
    */
}

/**
 * All this method does is look through _all_ the tms "perfect" folders
 * looking for the first record it finds where we have an image source
 * with remote information, but no colour information. Then trigger
 * a colour information fetch
 * @private
 */
const checkImagesColor = () => {
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  const tmsLogger = logging.getTMSLogger()

  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    tmsLogger.object(`No cloudinary configured`, {
      action: 'coloringImages'
    })
    return
  }

  //  Only carry on if we have a data and tms directory
  if (!fs.existsSync(rootDir) || !fs.existsSync(path.join(rootDir, 'tms'))) {
    tmsLogger.object(`No data or data/tms found`, {
      action: 'coloringImages'
    })
    return
  }

  //  Now we need to look through all the folders in the tms/[something]/perfect/[number]
  //  folder looking for one that has an image that needs uploading, but hasn't been uploaded
  //  yet.
  let foundImageToColor = false
  const tmsses = fs.readdirSync(path.join(rootDir, 'tms'))
  tmsLogger.object(`Checking for a new image to upload`, {
    action: 'coloringImages'
  })
  tmsses.forEach((tms) => {
    if (foundImageToColor === true) return
    //  Check to see if a 'perfect' directory exists
    const tmsDir = path.join(rootDir, 'tms', tms, 'perfect')
    if (fs.existsSync(tmsDir)) {
      if (foundImageToColor === true) return
      const subFolders = fs.readdirSync(tmsDir)
      subFolders.forEach((subFolder) => {
        if (foundImageToColor === true) return
        const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          if (foundImageToColor === true) return
          const perfectFileRaw = fs.readFileSync(path.join(tmsDir, subFolder, file), 'utf-8')
          const perfectFile = JSON.parse(perfectFileRaw)
          if (
            perfectFile.tmsSource !== null &&
            perfectFile.remote !== null &&
            'status' in perfectFile.remote &&
            perfectFile.remote.status !== 'error' &&
            (!('color' in perfectFile) || perfectFile.color.predominant === '{}')
          ) {
            foundImageToColor = true
            colorImage(tms, file.split('.')[0])
          }
        })
      })
    }
  })
  if (foundImageToColor === false) {
    tmsLogger.object(`No new images found to color`, {
      action: 'coloringImages'
    })
  }
}

exports.startUploading = () => {
  //  Remove the old interval timer
  clearInterval(global.cloudinaryTmr)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  const timers = config.get('timers')
  let interval = 20000
  if (timers !== null && 'cloudinary' in timers) {
    interval = parseInt(timers.cloudinary, 10)
  }
  global.cloudinaryTmr = setInterval(() => {
    checkImages()
  }, interval)
  checkImages()
}

exports.startColoring = () => {
  //  Remove the old interval timer
  clearInterval(global.cloudinaryColoringTmr)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  const timers = config.get('timers')
  let interval = 20000
  if (timers !== null && 'cloudinaryColoring' in timers) {
    interval = parseInt(timers.cloudinaryColoring, 10)
  }
  global.cloudinaryColoringTmr = setInterval(() => {
    checkImagesColor()
  }, interval)
  checkImagesColor()
}
