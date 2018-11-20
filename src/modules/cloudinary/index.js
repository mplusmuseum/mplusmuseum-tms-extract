const Config = require('../../classes/config')

const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const cloudinary = require('cloudinary')
const logging = require('../logging')
const utils = require('../utils')
const elasticsearch = require('elasticsearch')

/**
 * This method tries to grab a record of an object that has an image that needs
 * uploading and has a go at uploading, if it manages it then it puts the resulting
 * information back into the perfect file, otherwise it needs to mark it as failed
 * somehow
 * @param {String} stub The name of the TMS folder we are going to look in
 * @param {String} id The id of the object we want to upload
 */
const uploadImage = (stub, type, id) => {
  const tmsLogger = logging.getTMSLogger()
  const startTime = new Date().getTime()

  tmsLogger.object(`starting uploading ${type} ${id} for ${stub}`, {
    action: 'start uploadImage',
    status: 'info',
    type: type,
    tms: stub,
    id
  })

  //  Check to see that we have cloudinary configured
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    tmsLogger.object(`No cloudinary found`, {
      action: 'finished uploadImage',
      status: 'warning',
      type: type,
      tms: stub,
      id,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Grab the perfect file to find out which image we need to upload
  const subFolder = String(Math.floor(id / 1000) * 1000)
  const perfectFilename = path.join(rootDir, 'imports', type, stub, 'perfect', subFolder, `${id}.json`)
  if (!fs.existsSync(perfectFilename)) {
    tmsLogger.object(`No perfectFilename found, ${type} ${id} for ${stub}`, {
      action: 'finished uploadImage',
      status: 'error',
      type: type,
      tms: stub,
      id,
      filename: perfectFilename,
      ms: new Date().getTime() - startTime
    })
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
    perfectFileJSON.remote.images[imageSrc].status = 'missing'
    const perfectFileJSONPretty = JSON.stringify(perfectFileJSON, null, 4)
    fs.writeFileSync(perfectFilename, perfectFileJSONPretty, 'utf-8')
    return
  }

  //  Set up cloudinary
  cloudinary.config(cloudinaryConfig)

  tmsLogger.object(`Uploading image for ${type} ${id} for ${stub}`, {
    action: 'uploadImage',
    id,
    stub,
    type,
    source: imageSrc
  })

  if (global.uploading && global.uploading === true) {
    tmsLogger.object(`already uploading image, ${type} ${id} for ${stub}`, {
      action: 'finished uploadImage',
      status: 'warning',
      type: type,
      tms: stub,
      id,
      ms: new Date().getTime() - startTime
    })
    return
  }
  global.uploading = true

  cloudinary.uploader.upload(fullImagePath, (result) => {
    //  Check to see if we had an error, if so we add that to the perfect file
    //  instead, so maybe we can go back and retry them
    const endTime = new Date().getTime()
    global.uploading = false
    if ('error' in result) {
      perfectFileJSON.remote.images[imageSrc].status = 'error'
      perfectFileJSON.remote.images[imageSrc].status = result.error.message
      perfectFileJSON.remote.images[imageSrc].status = result.error.https_code
      tmsLogger.object(`Failed uploading image for ${type} ${id} for ${stub}`, {
        action: 'finished upsertTheItem',
        status: 'error',
        id,
        stub,
        type,
        source: imageSrc,
        ms: endTime - startTime,
        error: result
      })
    } else {
      tmsLogger.object(`Finished uploading image for ${type} ${id} for ${stub}`, {
        action: 'finished upsertTheItem',
        status: 'ok',
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

  tmsLogger.object(`starting checkImages`, {
    action: 'start checkImages',
    status: 'info'
  })

  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    tmsLogger.object(`No cloudinary configured`, {
      action: 'finished checkImages',
      status: 'warning'
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
 * This method tries to find images that have been uploaded and then grab the colour
 * information
 */
const colorImage = (type, tms, id, imageId) => {
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  const tmsLogger = logging.getTMSLogger()
  const startTime = new Date().getTime()

  tmsLogger.object(`Coloring ${type.parent} image ${id}, id: ${imageId} for ${tms}`, {
    action: 'started colorImage',
    status: 'info',
    element: type.child,
    tms,
    id,
    imageId
  })

  if (cloudinaryConfig === null) {
    tmsLogger.object(`No cloudinary configured`, {
      action: 'finished colorImage',
      status: 'info',
      element: type.child,
      tms,
      id,
      imageId,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Check to see that we have elasticsearch configured
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'finished colorImage',
      status: 'info',
      element: type.child,
      tms,
      id,
      imageId,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Check to make sure the file exists
  const subFolder = String(Math.floor(id / 1000) * 1000)
  const filename = path.join(rootDir, 'imports', type.parent, tms, 'perfect', subFolder, `${id}.json`)
  if (!fs.existsSync(filename)) {
    tmsLogger.object(`No perfect file exists`, {
      action: 'finished colorImage',
      status: 'info',
      element: type.child,
      tms,
      id,
      imageId,
      filename,
      ms: new Date().getTime() - startTime
    })
    return
  }

  //  Read in the perfectFile
  const perfectFileRaw = fs.readFileSync(filename, 'utf-8')
  const perfectFile = JSON.parse(perfectFileRaw)
  if (!perfectFile.remote || !perfectFile.remote.images || !(imageId in perfectFile.remote.images) || (perfectFile.remote.status && perfectFile.remote.status !== 'ok') || (perfectFile.remote && perfectFile.remote.colors)) {
    tmsLogger.object(`remote data in image file not ready for uploading`, {
      action: 'finished colorImage',
      status: 'info',
      element: type.child,
      tms,
      id,
      imageId,
      filename,
      ms: new Date().getTime() - startTime
    })
    return
  }

  cloudinary.config(cloudinaryConfig)

  tmsLogger.object(`About to fetch color information for ${type.parent} image ${id}, id: ${imageId} for ${tms}`, {
    action: 'fetch color information',
    status: 'info',
    element: type.child,
    tms,
    id,
    imageId,
    filename
  })

  cloudinary.api.resource(perfectFile.remote.images[imageId].public_id,
    function (result) {
      if ('error' in result) {
        const endTime = new Date().getTime()
        tmsLogger.object(`Failed to fecth color information for ${type.parent} image ${id}, id: ${imageId} for ${tms}`, {
          action: 'finished colorImage',
          status: 'error',
          element: type.child,
          tms,
          id,
          imageId,
          ms: endTime - startTime
        })
        return
      }
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
      const index = `${type.parent}_${tms}`.toLowerCase()
      const upsertItem = {
        id: parseInt(id, 10),
        color: {
          predominant: newColors,
          search: predominant
        }
      }
      const esclient = new elasticsearch.Client(elasticsearchConfig)

      esclient.update({
        index,
        type: type.child.toLowerCase(),
        id,
        body: {
          doc: upsertItem,
          doc_as_upsert: true
        }
      }).then(() => {
        //  Write out the file
        perfectFile.remote.colors = {
          predominant: newColors,
          search: predominant
        }
        const perfectFileJSONPretty = JSON.stringify(perfectFile, null, 4)
        fs.writeFileSync(filename, perfectFileJSONPretty, 'utf-8')

        const endTime = new Date().getTime()
        tmsLogger.object(`Upserted color information for ${type.parent} image ${id}, id: ${imageId} for ${tms}`, {
          action: 'finished colorImage',
          status: 'ok',
          element: type.child,
          tms,
          id,
          imageId,
          ms: endTime - startTime
        })
      }).catch((err) => {
        console.error(err)

        const endTime = new Date().getTime()
        tmsLogger.object(`Failed upserted color information for ${type.parent} image ${id}, id: ${imageId} for ${tms}`, {
          action: 'finished colorImage',
          status: 'error',
          element: type.child,
          tms,
          id,
          imageId,
          error: err,
          ms: endTime - startTime
        })
      })
    }, {
      colors: true
    })
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
  const startTime = new Date().getTime()

  tmsLogger.object(`Looking for images to colour`, {
    action: 'started coloringImages',
    status: 'info'
  })

  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    tmsLogger.object(`No cloudinary configured`, {
      action: 'finished coloringImages',
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  const elements = [{
    parent: 'Objects',
    child: 'Object'
  }]

  elements.forEach((element) => {
    //  Only carry on if we have a data and tms directory
    const itemPath = path.join(rootDir, 'imports', element.parent)
    if (!fs.existsSync(itemPath)) {
      tmsLogger.object(`looking for: ${element.parent}`, {
        action: 'finished coloringImages',
        status: 'error',
        element: element.parent,
        itemPath,
        ms: new Date().getTime() - startTime
      })
      return
    }

    //  Now we need to look through all the folders in the tms/[something]/perfect/[number]
    //  folder looking for one that has an image that needs uploading, but hasn't been uploaded
    //  yet.
    let foundImageToColor = false
    const tmsses = config.tms
    tmsses.forEach((tms) => {
      if (foundImageToColor === true) return
      //  Check to see if a 'perfect' directory exists
      const tmsDir = path.join(itemPath, tms.stub, 'perfect')
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
            //  If we don't have a remote entry, or we *do* have a remote entry and it
            //  already has colors then we don't need to do it again
            if (!perfectFile.remote) return
            if (!perfectFile.remote.images) return
            if (perfectFile.remote.status && perfectFile.remote.status !== 'ok') return
            if (perfectFile.remote && perfectFile.remote.colors) return

            //  Otherwise, check to see if we have a primary image and that image is ok
            Object.entries(perfectFile.remote.images).forEach((imageArr) => {
              if (foundImageToColor === true) return
              const image = imageArr[1]
              if (image.primaryDisplay === true && image.status && image.status === 'ok') {
                foundImageToColor = true
                colorImage(element, tms.stub, file.split('.')[0], imageArr[0])
              }
            })
          })
        })
      }
    })

    if (foundImageToColor === false) {
      tmsLogger.object(`No new images found to color for: ${element.parent}`, {
        action: 'finished coloringImages',
        status: 'info',
        element: element.parent,
        ms: new Date().getTime() - startTime
      })
    } else {
      tmsLogger.object(`Found an image to color for (and colored it): ${element.parent}`, {
        action: 'finished coloringImages',
        status: 'info',
        element: element.parent,
        ms: new Date().getTime() - startTime
      })
    }
  })
}

/**
 * This function looks for images that have colour information but don't
 * have HSL data yet
 */
const checkImagesHSL = () => {
  const config = new Config()
  const tmsLogger = logging.getTMSLogger()
  const startTime = new Date().getTime()

  tmsLogger.object(`Looking for images to HBL convert`, {
    action: 'started checkImagesHSL',
    status: 'info'
  })

  const elements = [{
    parent: 'Objects',
    child: 'Object'
  }]

  const elasticsearchConfig = config.get('elasticsearch')
  if (elasticsearchConfig === null || elasticsearchConfig === undefined) {
    tmsLogger.object(`No elasticsearch defined`, {
      action: 'finished checkImagesHSL',
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  elements.forEach((element) => {
    //  Only carry on if we have a data and tms directory
    const itemPath = path.join(rootDir, 'imports', element.parent)
    if (!fs.existsSync(itemPath)) {
      tmsLogger.object(`looking for: ${element.parent}`, {
        action: 'finished checkImagesHSL',
        status: 'error',
        element: element.parent,
        itemPath,
        ms: new Date().getTime() - startTime
      })
      return
    }
    let foundImageToHSL = false
    const tmsses = config.tms
    tmsses.forEach((tms) => {
      if (foundImageToHSL === true) return
      //  Check to see if a 'perfect' directory exists
      const tmsDir = path.join(itemPath, tms.stub, 'perfect')
      if (fs.existsSync(tmsDir)) {
        if (foundImageToHSL === true) return
        const subFolders = fs.readdirSync(tmsDir)
        //  Loop through the subFolders
        subFolders.forEach((subFolder) => {
          if (foundImageToHSL === true) return
          const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
            const fileFragments = file.split('.')
            if (fileFragments.length !== 2) return false
            if (fileFragments[1] !== 'json') return false
            return true
          })
          //  Loop through the files
          files.forEach((file) => {
            if (foundImageToHSL === true) return
            const perfectFilename = path.join(tmsDir, subFolder, file)
            const perfectFileRaw = fs.readFileSync(perfectFilename, 'utf-8')
            const perfectFileJSON = JSON.parse(perfectFileRaw)
            //  If we have a perfect file with color info but not HSL then we need to
            //  do the conversion
            if (perfectFileJSON.remote && perfectFileJSON.remote.colors && perfectFileJSON.remote.colors.predominant && !perfectFileJSON.remote.colors.hsl) {
              foundImageToHSL = true
              //  Grab the predominant colours
              const predoms = JSON.parse(perfectFileJSON.remote.colors.predominant)
              //  Grab the first one
              const firstColour = Object.entries(predoms)[0][0]
              //  Convert it to HSB
              const hsl = utils.hexToHsl(firstColour)
              //  Put it back into the JSON
              perfectFileJSON.remote.colors.hsl = {
                h: hsl[0],
                s: hsl[1],
                l: hsl[2]
              }
              //  Write the perfect file back out
              const perfectFileJSONPretty = JSON.stringify(perfectFileJSON, null, 4)
              fs.writeFileSync(perfectFilename, perfectFileJSONPretty, 'utf-8')
              //  Create an upsert object so we can update the database
              const id = parseInt(file.split('.')[0], 10)
              const index = `${element.parent}_${tms.stub}`.toLowerCase()
              const upsertItem = {
                id,
                colorHSL: {
                  h: hsl[0],
                  s: hsl[1],
                  l: hsl[2]
                }
              }

              //  But the data back into the database
              const esclient = new elasticsearch.Client(elasticsearchConfig)
              esclient.update({
                index,
                type: element.child.toLowerCase(),
                id,
                body: {
                  doc: upsertItem,
                  doc_as_upsert: true
                }
              })
            }
          })
        })
      }
    })
  })
}
exports.checkImagesHSL = checkImagesHSL

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
    checkImagesHSL()
  }, interval)
  checkImagesColor()
  checkImagesHSL()
}
