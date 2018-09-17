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
const uploadImage = (stub, id) => {
  // const tmsLogger = logging.getTMSLogger()

  //  Check to see that we have cloudinary configured
  const config = new Config()
  const cloudinaryConfig = config.get('cloudinary')
  //  If there's no cloudinary configured then we don't bother
  //  to do anything
  if (cloudinaryConfig === null) {
    return
  }
  console.log('uploading image')
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

  console.log('Checking for images')

  /*
  //  Only carry on if we have a data and tms directory
  if (!fs.existsSync(rootDir) || !fs.existsSync(path.join(rootDir, 'tms'))) {
    tmsLogger.object(`No data or data/tms found`, {
      action: 'checkingImages'
    })
    return
  }

  //  Now we need to look through all the folders in the tms/[something]/perfect/[number]
  //  folder looking for one that has an image that needs uploading, but hasn't been uploaded
  //  yet.
  let foundImageToUpload = false
  const tmsses = fs.readdirSync(path.join(rootDir, 'tms'))
  tmsLogger.object(`Checking for a new image to upload`, {
    action: 'checkingImages'
  })
  tmsses.forEach((tms) => {
    if (foundImageToUpload === true) return
    //  Check to see if a 'perfect' directory exists
    const tmsDir = path.join(rootDir, 'tms', tms, 'perfect')
    if (fs.existsSync(tmsDir)) {
      if (foundImageToUpload === true) return
      const subFolders = fs.readdirSync(tmsDir)
      subFolders.forEach((subFolder) => {
        if (foundImageToUpload === true) return
        const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          if (foundImageToUpload === true) return
          const perfectFileRaw = fs.readFileSync(path.join(tmsDir, subFolder, file), 'utf-8')
          const perfectFile = JSON.parse(perfectFileRaw)
          if (perfectFile.tmsSource !== null && perfectFile.remote === null) {
            foundImageToUpload = true
            uploadImage(tms, file.split('.')[0])
          }
        })
      })
    }
  })
  if (foundImageToUpload === false) {
    tmsLogger.object(`No new images found to upload`, {
      action: 'checkingImages'
    })
  }
  */
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