const xml2js = require('xml2js')
const {
  pd
} = require('pretty-data')
const colours = require('colors')
const fs = require('fs')
const crypto = require('crypto')
const artisanalints = require('../../../lib/artisanalints')
const parseObject = require('./parsers/object')
const elasticsearch = require('elasticsearch')
const progress = require('cli-progress')
const tools = require('../../modules/tools')
const cloudinary = require('cloudinary')
const moment = require('moment')

colours.setTheme({
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  alert: 'magenta',
  wow: 'rainbow'
})

const parser = new xml2js.Parser({
  trim: true,
  explicitArray: false,
  explicitRoot: false,
  mergeAttrs: true
})

const rootDir = process.cwd()
let startTime = new Date().getTime()
let totalItemsToUpload = null
let itemsUploaded = 0
let esLive = false
let forceBulk = false
let forceResetIndex = false
let forceIngest = false
let isInvokedFromServer = true

const config = tools.getConfig()

//  Make sure we have an elasticsearch thingy to connect to
if (!('elasticsearch' in config)) {
  console.error('')
  console.error('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.wow)
  console.error('No elasticsearch host set in config.json'.error)
  console.error('Try adding it as shown in config.json.example or'.error)
  console.error('visting the web admin tool to enter it there.'.error)
  console.error('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.wow)
  console.error('')
  if (isInvokedFromServer === false) {
    process.exit(1)
  }
}

const esclient = new elasticsearch.Client(config.elasticsearch)

/*
TODO: If we are using AWS Lambda then all of this has to go into the /tmp
scratch disk.
*/
let dataDir = null
let xmlDir = null
let tmsDir = null

if (config.onLambda) {
  console.error('We need Lambda code here')
  if (isInvokedFromServer === false) {
    process.exit(1)
  }
} else {
  dataDir = `${rootDir}/app/data`
  xmlDir = tools.getXmlDir()
  tmsDir = `${dataDir}/tms`

  // Make sure all the folders we need to use exist
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
  if (!fs.existsSync(xmlDir)) fs.mkdirSync(xmlDir)
  if (!fs.existsSync(tmsDir)) fs.mkdirSync(tmsDir)
}

const uploadImage = async (filename) => {
  const mediaDir = tools.getMediaDir()
  const mediaFile = `${mediaDir}/${filename}`

  //  Check to see if the image exists
  if (!fs.existsSync(mediaFile)) {
    return null
  }
  if (!('cloudinary' in config)) {
    return null
  }

  cloudinary.config(config.cloudinary)
  return new Promise((resolve) => {
    cloudinary.uploader.upload(mediaFile, (result) => {
      resolve(result)
    })
  })
}

/**
 * This dumps the counts information down to disc
 * @param {Object} counts the counts JSON object
 * TODO: We should really check if we are running on Lambda and store the
 * counts somewhere else if we need to.
 */
const saveCounts = (counts) => {
  const newCounts = counts
  newCounts.lastSave = new Date().getTime()
  const countsJSONPretty = JSON.stringify(newCounts, null, 4)
  fs.writeFileSync(`${dataDir}/counts.json`, countsJSONPretty, 'utf-8')
}

/**
 * This is the end of everything wrap-up
 * @param {Object} counts An object that holds the counts to be displayed
 */
const finish = (counts) => {
  const newCounts = counts
  newCounts.lastFinished = new Date().getTime()
  saveCounts(newCounts)
  console.log(counts)

  const countsDir = `${dataDir}/counts`
  if (!fs.existsSync(countsDir)) fs.mkdirSync(countsDir)
  const datetime = moment().format('YYYY-MM-DD-HH-mm-ss')
  const countsJSONPretty = JSON.stringify(counts, null, 4)
  fs.writeFileSync(`${countsDir}/${datetime}.json`, countsJSONPretty, 'utf-8')

  console.log('Done!')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.wow)
  console.log('')
  if (isInvokedFromServer === false) {
    process.exit(1)
  }
}

/**
 * This converts an xml chunk into the JSON format we want
 * @param {string} xml the xml text we want to have parsed
 * @returns {Object} the JSON obeject representation of the xml
 */
const parseString = async (source, xml) => {
  try {
    const json = await new Promise((resolve, reject) =>
      parser.parseString(xml, (err, result) => {
        if (err) {
          reject(err)
        }
        resolve(result)
      }))

    //  Select the parser to use based on the source
    let parserLib = null
    switch (source) {
      case 'object':
        parserLib = parseObject
        break
      default:
        parserLib = parseObject
    }

    const index = Object.keys(json)[0]
    const [type, objects] = Object.entries(json[index])[0]
    const cleanjson = {
      [index]: objects.map(object => ({
        [type]: parserLib.parseJson(object)
      }))
    }
    return cleanjson
  } catch (err) {
    return null
  }
  /*
   */
}

/**
 * This goes and fetches the hash table for this source type, if there is
 * no hash table it creates one
 *
 * @param {string} source   the string defining the source type (from config)
 * @returns {Object}        The Hash fetchHashTable
 */
const fetchHashTable = async (source) => {
  if (config.onLambda) {
    //  TODO: Fetch hash table from remote source
    return {}
  }
  const sourceDir = `${tmsDir}/${source}`
  const hsFile = `${sourceDir}/hash_table.json`
  if (fs.existsSync(hsFile)) {
    const hashTable = fs.readFileSync(hsFile, 'utf-8')
    return JSON.parse(hashTable)
  }

  return {}
}

/**
 * This stores the hash table for this source type.
 *
 * @param {string} source     the string defining the source type (from config)
 * @param {Object} hashTable  The hasTable to store
 */
const storeHashTable = async (source, hashTable) => {
  if (config.onLambda) {
    //  TODO: Fetch hash table from remote source
  } else {
    const sourceDir = `${tmsDir}/${source}`
    const hsFile = `${sourceDir}/hash_table.json`
    const hashTableJSONPretty = JSON.stringify(hashTable, null, 4)
    if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir)
    fs.writeFileSync(hsFile, hashTableJSONPretty, 'utf-8')
  }
}

/**
 * This bit of code looks to see if the ES index for this index doesn't exist,
 * and if it doesn't it'll re-create it. It'll also recreate it if we have been
 * pass in the --resetindex flag on the command line.
 *
 * @param {string} index  The name of the index to check/build
 */
const checkIndexes = async (index) => {
  let resetIndex = false
  if (forceResetIndex === true) {
    console.log('We have been told to reset the index.'.warn)
    resetIndex = true
  }

  //  Check the indexes here, if one doesn't already exist then we *must*
  //  create one, otherwise only re-create on if we've been forced to by
  //  the command line
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    console.log(`Creating new index for ${index}`)
    await esclient.indices.create({
      index
    })
  }

  if (resetIndex === true && exists === true) {
    console.log(`Removing old index for ${index}`)
    await esclient.indices.delete({
      index
    })
    console.log(`Creating new index for ${index}`)
    await esclient.indices.create({
      index
    })
  }
}

/**
 * This takes the json and looks to see if we need to do a bulk upload which
 * only happens on the 1st run. After that we skip the bulk and just upload
 * seperate files.
 * @param {Object} json     The convereted from XML json
 * @return {Boolean}        If we did a bulk upload or not
 */
const bulkUpload = async (index, type, json) => {
  const outputDir = `${tmsDir}/${index}`
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
  let doBulkUpload = false

  //  If we are forcing a bulk upload then we do that here
  if (forceBulk === true) {
    console.log('We have been told to force a new bulk upload.'.warn)
    doBulkUpload = true
  }

  if (doBulkUpload === true) {
    //  Only bulk upload if we know we can reach ES
    if (esLive === false) {
      console.log('Skipping bulk upload as ES is unreachable.'.warn)
      return false
    }

    const bulkJSONPretty = JSON.stringify(json, null, 4)
    fs.writeFileSync(`${outputDir}/bulk.json`, bulkJSONPretty, 'utf-8')
    const body = [].concat(...json.objects.map(object => [{
      update: {
        _id: object.object.id
      }
    },
    {
      doc: object.object,
      doc_as_upsert: true
    }
    ]))

    console.log('Doing bulk upload')
    await esclient.bulk({
      body,
      type,
      index
    })
    return true
  }

  return false
}

/**
 * This is going to split the json into individual item to dump down to disk.
 * Actually it's going to do a bit more than that, so we should probably rename
 * it at some point. This takes the JSON and breaks it down into each item,
 * which we _will_ check to see if we already have. If we don't it'll be new,
 * and need to be ingested. If it's different it'll need to be updated. But
 * if we already have it we don't have to ingest it.
 * @param {string} source   the string defining the source type (from config)
 * @param {Object} items    the collection of items to be split up
 * @returns {number}        how many json items we found
 */
const splitJson = async (source, items) => {
  //  We need to make sure the folder we are going to spit these out into
  //  exists
  if (config.onLambda) {
    console.error('We need Lambda code here')
    return 0
  }
  const outputDir = `${tmsDir}/${source}`
  const jsonDir = `${outputDir}/json`
  const ingestDir = `${outputDir}/ingest`
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
  if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir)
  if (!fs.existsSync(ingestDir)) fs.mkdirSync(ingestDir)

  //  Grab where the images are supposed to be kept
  const mediaDir = tools.getMediaDir()

  //  Now we need to fetch the hash table for this source
  const hashTable = await fetchHashTable(source)

  //  Now loop through the items writing out the JSON files
  //  TODO: Here I'm hardcoding the name of the node we want to pull out
  //  as we start dealing with other collections we'll define this based
  //  on the source
  const seekRoot = 'object'
  const counter = {
    total: 0,
    new: 0,
    modified: 0
  }

  if (items.length === 1) {
    console.log(`Splitting JSON into ${items.length} separate file.`.help)
  } else {
    console.log(`Splitting JSON into ${items.length} separate files.`.help)
  }

  items.forEach((item) => {
    const itemJSONPretty = JSON.stringify(item[seekRoot], null, 4)
    const itemHash = crypto
      .createHash('md5')
      .update(itemJSONPretty)
      .digest('hex')

    //  This is handy debug code.
    const itemId = item[seekRoot].id
    if (itemId === 123 || itemId === 4151) {
      // console.log(itemJSONPretty);
    }

    //  Check in the hashtable to see if this item already exist.
    //  If it doesn't already exist then we need to add it to the hashTable
    //  and write it into the `ingest` folder.
    let writeJSONFile = false

    if (!(itemId in hashTable)) {
      counter.new += 1
      hashTable[itemId] = {
        hash: itemHash,
        brlyInt: null,
        discovered: new Date().getTime(),
        updated: new Date().getTime()
      }
      writeJSONFile = true
    }

    //  Now we check to see if the hash is different, if so then it's been
    //  updated and we need to send the file to be ingested
    if (itemHash !== hashTable[itemId].hash) {
      counter.modified += 1
      //  update the hash_table
      hashTable[itemId].hash = itemHash
      hashTable[itemId].updated = new Date().getTime()
      //  Put the file into the `ingest` folder.
      writeJSONFile = true
    }

    //  And now we're going to look at the media tag and see if there's supposed
    //  to be some images uploaded, if so we'll need to do a bunch of checks.
    //  At some point this should be broken up into it's own function
    if ('medias' in item[seekRoot] && item[seekRoot].medias !== null) {
      const {
        medias
      } = item[seekRoot]

      //  Check to see if a medias entry exists in the hashTable
      if (!('medias' in hashTable[itemId])) {
        hashTable[itemId].medias = {}
        writeJSONFile = true
      }

      //  Grab the filename if there is one and strip off the file prefix
      medias.forEach((media) => {
        //  If the clean version of the filename doesn't exist in the hashTable
        //  then we'll need to add it
        if (
          'filename' in media &&
          media.filename !== null &&
          media.filename !== undefined
        ) {
          //  If we have a dir prefix then we want to strip it out here
          let mediaFile = media.filename
          const mediaDirPrefix = tools.getMediaDirPrefix()
          mediaFile = media.filename.replace(mediaDirPrefix, '')

          //  If we don't have an entry, add it and flag the file for upserting
          if (!(mediaFile in hashTable[itemId].medias)) {
            hashTable[itemId].medias[mediaFile] = {
              discovered: new Date().getTime(),
              updated: null,
              remote: null,
              size: null,
              mtime: null,
              exists: false,
              checked: false,
              doUpload: false
            }
            writeJSONFile = true
          }

          //  Set the need to upload to false.
          hashTable[itemId].medias[mediaFile].doUpload = false

          //  Now we want to see if the file data or size if different, if it
          //  is then once again we'll need to upsert the file.
          if (fs.existsSync(`${mediaDir}/${mediaFile}`)) {
            //  If the file didn't previously exist, but does now, then we
            //  once again mark the file for upserting
            if (hashTable[itemId].medias[mediaFile].exists === false) {
              hashTable[itemId].medias[mediaFile].exists = true
              hashTable[itemId].medias[mediaFile].doUpload = true
              writeJSONFile = true
            }

            //  Grab the stats for the file and see if they are different
            //  from what we already have, if so then we need to upsert the file
            const stats = fs.statSync(`${mediaDir}/${mediaFile}`)
            const mtime = parseInt(stats.mtimeMs, 10)
            const {
              size
            } = stats
            //  Check to see if the modified time is different
            //  TODO: Note, it *may* be that the images are written out by
            //  TMS each and every time, so this will always be the case and
            //  will always trigger a file update. We should probably rely
            //  just on size, which *may* sometimes be the same but it more
            //  likely a better check than mtime.
            if (hashTable[itemId].medias[mediaFile].mtime !== mtime) {
              hashTable[itemId].medias[mediaFile].mtime = mtime
              // writeJSONFile = true; NOTE: don't rely on mtime!
            }

            //  Check the size of the file, if it's changed then it's likely
            //  that the image has changed. This is based on the assumption
            //  that somehow the headers on the file when it's spat out by
            //  TMS don't always change the file.
            //  Otherwise we're going to have to be super amazing at telling
            //  when a media file has changed, lets hope we don't ever have to
            //  do that!
            if (hashTable[itemId].medias[mediaFile].size !== size) {
              hashTable[itemId].medias[mediaFile].size = size
              hashTable[itemId].medias[mediaFile].doUpload = true
              writeJSONFile = true
            }
          }
          hashTable[itemId].medias[mediaFile].checked = true
        }
      })
    }

    if (forceIngest === true) {
      hashTable[itemId].updated = new Date().getTime()
      //  Put the file into the `ingest` folder.
      writeJSONFile = true
    }

    if (writeJSONFile === true) {
      fs.writeFileSync(
        `${ingestDir}/id_${itemId}.json`,
        itemJSONPretty,
        'utf-8'
      )
    }

    //  Now write out the file to the json directory
    fs.writeFileSync(`${jsonDir}/id_${itemId}.json`, itemJSONPretty, 'utf-8')
    counter.total += 1
  })

  await storeHashTable(source, hashTable)

  if (counter.new === 1) {
    console.log('1 new item found'.help)
  } else {
    console.log(`${counter.new} new items found`.help)
  }
  if (counter.modified === 1) {
    console.log('1 modified item found'.help)
  } else {
    console.log(`${counter.new} modified items found`.help)
  }

  return counter
}

/**
 * This splits the XML into individual parts and saves them to disk, using
 * _very_ ropey splits rather than anything clever. It should be good enough
 * for the moment
 * @param {string} source   the string defining the source type (from config)
 * @param {string} xml      the xml to split up
 * @returns {number}        how many xml items we found
 */
const splitXml = (source, xml) => {
  //  We need to make sure the folder we are going to spit these out into
  //  exists
  if (config.onLambda) {
    console.error('We need Lambda code here')
    return 0
  }
  const outputDir = `${tmsDir}/${source}`
  const outxmlDir = `${outputDir}/xml`
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir)
  if (!fs.existsSync(outxmlDir)) fs.mkdirSync(outxmlDir)

  //  THIS IS BAD HARDCODED CODE BASED ON EXTERNAL SPECIFICATIONS
  const trimmedXml = xml
    .trim()
    .replace('<ExportForMPlus><objects>', '')
    .replace('</objects></ExportForMPlus>', '')
    .replace('<?xml version="1.0" encoding="utf-8"?>', '')
  const xmls = trimmedXml.split('</object>').map(chunk => `${chunk}</object>`)

  //  Now dump all the xml files
  let counter = 0
  xmls.forEach((fragment) => {
    //  Because this is easier than REGEX ;)
    const id = fragment.split('"')[1]
    if (id) {
      fs.writeFileSync(`${outxmlDir}/id_${id}.xml`, pd.xml(fragment), 'utf-8')
      counter += 1
    }
  })
  return counter
}

/**
 * This kicks off the process of looking for the XML and converting it
 * to json.
 * @return {Object} contains counts of converted files
 */
const processXML = async () => {
  //  Check that we have the xml defined in the config
  if (!('xml' in config)) {
    console.error("No 'xml' element defined in config".error)
    return false
  }

  console.log('About to start processing XML files.'.help)

  //  Loop through them doing the xml conversion for each one
  //  NOTE: we are looping this way because we are firing off an `await`
  //  which modifies our counts object, so we're going to "sequentially"
  //  await the responses
  const counts = {
    items: {},
    startProcessing: new Date().getTime()
  }

  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < config.xml.length; i += 1) {
    const {
      file,
      index,
      type
    } = config.xml[i]
    counts.items[index] = {
      startProcessing: new Date().getTime(),
      file
    }
    saveCounts(counts)
    console.log(`About to check for ${index} in file ${file}`.help)

    //  TODO: Error check that the file actually exists
    if (fs.existsSync(`${xmlDir}/${file}`)) {
      console.log('Found file.'.warn)
      const xml = fs.readFileSync(`${xmlDir}/${file}`, 'utf-8')
      console.log('Converting XML to JSON, this may take a while.'.alert)
      const json = await parseString(index, xml)
      console.log('Finished conversion.'.alert)
      //  TODO: This may not be "json.objects" when we start using different
      //  xml imports
      counts.items[index].jsonCount = await splitJson(index, json.objects)
      await checkIndexes(index)
      const bulkUploaded = await bulkUpload(index, type, json)
      counts.items[index].bulkUpload = {
        bulkUploaded,
        lastChecked: new Date().getTime()
      }
      counts.items[index].xmlCount = splitXml(index, xml)
      saveCounts(counts)
    } else {
      console.log('File not found, skipping.'.error)
      counts.items[index].jsonCount = -1
      counts.items[index].xmlCount = -1
      saveCounts(counts)
    }
    console.log('')
  }
  /* eslint-enable no-await-in-loop */

  return counts
}

/**
 * This looks into the ingest folders to see if anything needs to be uploaded
 * @param {Object} counts An object that holds the counts to be displayed
 */
const upsertItems = async (counts, countBar) => {
  //  Count the number of items we have left to upload, making a note of the
  //  first one we find
  let itemsToUpload = 0
  let itemIndex = null
  let itemType = null
  let itemFile = null

  try {
    config.xml.forEach((source) => {
      const {
        index
      } = source
      const ingestDir = `${tmsDir}/${index}/ingest`
      if (fs.existsSync(ingestDir)) {
        const files = fs
          .readdirSync(ingestDir)
          .filter(file => file.split('.')[1] === 'json')
        itemsToUpload += files.length
        if (files.length > 0) {
          itemIndex = index
          itemType = source.type;
          [itemFile] = files
        }
      }
    })

    //  If we have an itemIndex that isn't null it means
    //  we found at least one thing to upsert
    if (itemIndex !== null && itemType !== null && itemFile !== null) {
      //  Read in the file
      const item = fs.readFileSync(
        `${tmsDir}/${itemIndex}/ingest/${itemFile}`,
        'utf-8'
      )
      const itemJSON = JSON.parse(item)
      const {
        id
      } = itemJSON

      const hashTable = await fetchHashTable(itemIndex)

      //  Now we need to check to look in the hashTable for an artisanal
      //  integer. If there isn't one, we go fetch one and update the table
      //  If there is one, then we can just use that.
      if (hashTable[id].brlyInt === null) {
        const brlyInt = await artisanalints.createArtisanalInt()
        hashTable[id].brlyInt = brlyInt
        await storeHashTable(itemIndex, hashTable)
      }
      itemJSON.artInt = hashTable[id].brlyInt

      //  Now we need to check to see if there are any images that
      //  need uploading
      const imagesToUpload = []

      if ('medias' in hashTable[id]) {
        Object.entries(hashTable[id].medias).forEach((media) => {
          const [mediaFile, data] = media
          if (data.doUpload === true) {
            imagesToUpload.push(mediaFile)
          }
        })
      }

      if (imagesToUpload.length > 0) {
        /* eslint-disable no-await-in-loop */
        for (let i = 0; i < imagesToUpload.length; i += 1) {
          const mediaFile = imagesToUpload[i]
          const cloudData = await uploadImage(mediaFile)
          if (cloudData !== null) {
            hashTable[id].medias[mediaFile].remote = `v${cloudData.version}/${
              cloudData.public_id
            }.${cloudData.format}`
            hashTable[id].medias[mediaFile].width = cloudData.width
            hashTable[id].medias[mediaFile].height = cloudData.height
            hashTable[id].medias[mediaFile].updated = new Date().getTime()
            await storeHashTable(itemIndex, hashTable)
          }
        }
        /* eslint-enable no-await-in-loop */
      }

      //  Now check to see if we have entires for this record in the hashTable
      //  if we do then we need to add the data to the JSON that's getting
      //  uploaded to the DB
      if (
        'medias' in itemJSON &&
        'medias' in hashTable[id] &&
        itemJSON.medias !== null
      ) {
        itemJSON.medias = itemJSON.medias.map((media) => {
          const newMedia = media
          if (newMedia.filename !== null && newMedia.filename !== undefined) {
            let mediaFile = newMedia.filename
            const mediaDirPrefix = tools.getMediaDirPrefix()
            mediaFile = newMedia.filename.replace(mediaDirPrefix, '')
            if (mediaFile in hashTable[id].medias) {
              const hshTblMdFl = hashTable[id].medias[mediaFile]
              const {
                remote
              } = hshTblMdFl
              newMedia.filename = mediaFile
              newMedia.remote = remote
              newMedia.exists = hshTblMdFl.exists
              if (
                remote !== null &&
                'cloudinary' in config &&
                'cloud_name' in config.cloudinary
              ) {
                if ('width' in hshTblMdFl) {
                  newMedia.width = hshTblMdFl.width
                }
                if ('height' in hshTblMdFl) {
                  newMedia.height = hshTblMdFl.height
                }
                newMedia.baseUrl = `http://res.cloudinary.com/${
                  config.cloudinary.cloud_name
                }/image/upload/${remote}`
                newMedia.baseUrl = `http://res.cloudinary.com/${
                  config.cloudinary.cloud_name
                }/image/upload/${remote}`
                newMedia.squareUrl = `http://res.cloudinary.com/${
                  config.cloudinary.cloud_name
                }/image/upload/c_fill,g_auto,h_150,w_150/${remote}`
                newMedia.smallUrl = `http://res.cloudinary.com/${
                  config.cloudinary.cloud_name
                }/image/upload/w_480,c_scale/${remote}`
                newMedia.mediumUrl = `http://res.cloudinary.com/${
                  config.cloudinary.cloud_name
                }/image/upload/w_1000,c_scale/${remote}`
                newMedia.largeUrl = `http://res.cloudinary.com/${
                  config.cloudinary.cloud_name
                }/image/upload/w_2048,c_scale/${remote}`
              }
            }
          }
          return newMedia
        })
      }

      //  If this is the first time we've called this function then we need to
      //  kick off the progress bar
      if (totalItemsToUpload === null) {
        totalItemsToUpload = itemsToUpload
        itemsUploaded = 0
        countBar.start(totalItemsToUpload, itemsUploaded, {
          myEta: '????ms'
        })
      }

      //  Now we do the ES upsert
      const index = itemIndex
      const type = itemType
      esclient
        .update({
          index,
          type,
          id,
          body: {
            doc: itemJSON,
            doc_as_upsert: true
          }
        })
        .then(() => {
          fs.unlinkSync(`${tmsDir}/${itemIndex}/ingest/${itemFile}`)
          itemsUploaded += 1
          const timeDiff = new Date().getTime() - startTime
          const aveTime = timeDiff / itemsUploaded
          const remainingTime = aveTime * (totalItemsToUpload - itemsUploaded)
          const myEta = tools.msToTime(remainingTime)
          countBar.update(itemsUploaded, {
            myEta
          })

          const newCounts = counts
          newCounts.items[itemIndex].totalItemsToUpload = totalItemsToUpload
          newCounts.items[itemIndex].itemsUploaded = itemsUploaded
          newCounts.items[itemIndex].lastUpsert = new Date().getTime()

          saveCounts(newCounts)

          setTimeout(() => {
            upsertItems(newCounts, countBar)
          }, 10)
        })
    } else {
      countBar.stop()
      finish(counts)
    }
  } catch (er) {
    try {
      console.log('Filed on file: ', itemFile)
      console.log(er)
      if (itemFile !== null) {
        //  A daft way to move a file, but I may want to do something with the
        //  content before/after the move
        const sourceFile = `${tmsDir}/${itemIndex}/ingest/${itemFile}`
        const fileContent = fs.readFileSync(sourceFile, 'utf-8')
        const failedDir = `${tmsDir}/${itemIndex}/failed`

        //  Create a failed directory if there isn't one
        if (!fs.existsSync(failedDir)) fs.mkdirSync(failedDir)

        fs.writeFileSync(`${failedDir}/${itemFile}`, fileContent, 'utf-8')
        fs.unlinkSync(`${tmsDir}/${itemIndex}/ingest/${itemFile}`)
        setTimeout(() => {
          upsertItems(counts, countBar)
        }, 10)
      } else {
        console.error('Something odd happened, we threw an error')
        console.error('and itemFile is null.')
        if (isInvokedFromServer === false) {
          process.exit(1)
        }
      }
    } catch (er2) {
      console.error('Failed wait ingesting files.')
      console.error('Please look in the logs for details')
      console.error(er2)
      if (isInvokedFromServer === false) {
        process.exit(1)
      }
    }
  }
}

/*
 * This is our main script that runs everything else in order.
 * NOTE: because of the way we run things our last call is to `upsertItems`
 * which then kicks off a timer loop, so this function doesn't actually
 * "finish" the script. That happens in the `upsertItems` function which
 * keeps calling itself until all the files have been processed. We actually
 * end in the `finished()` function.
 */
const start = async () => {
  console.log('')
  console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.wow)

  console.log('Pinging ElasticSearch...')
  const ping = await tools.pingES()
  if (ping === null) {
    console.log('Could not ping ES server'.error)
  } else {
    esLive = true
    console.log(`Pinged ES server in ${ping}ms`)
  }

  const counts = await processXML()

  if (counts === false) {
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.wow)
    console.log('')
    if (isInvokedFromServer === false) {
      process.exit(1)
    }
  }

  // const counts = {};
  // reset the start time
  startTime = new Date().getTime()
  console.log('')
  console.log('Finished splitting files and any bulk uploads'.help)
  const countBar = new progress.Bar(
    {
      etaBuffer: 1,
      format: 'progress [{bar}] {percentage}% | ETA: {myEta} | {value}/{total}',
      hideCursor: true
    },
    progress.Presets.shades_classic
  )
  console.log('Now checking "ingest" folder for items to upsert'.help)
  if (esLive === true) {
    upsertItems(counts, countBar)
  } else {
    console.log("Can't connect to ES server, skipping upserting".warn)
    const newCounts = counts
    newCounts.error = "Can't connect to ES server, skipping upserting"
    finish(counts)
  }
}

process.argv.forEach((val) => {
  if (
    val.toLowerCase() === 'forcebulk' ||
    val.toLowerCase() === '--forcebulk'
  ) {
    forceBulk = true
  }

  if (
    val.toLowerCase() === 'forceingest' ||
    val.toLowerCase() === '--forceingest'
  ) {
    forceIngest = true
  }
  if (
    val.toLowerCase() === 'resetindex' ||
    val.toLowerCase() === '--resetindex'
  ) {
    forceResetIndex = true
  }
  if (
    val.toLowerCase() === '/?' ||
    val.toLowerCase() === '?' ||
    val.toLowerCase() === '-h' ||
    val.toLowerCase() === '--h' ||
    val.toLowerCase() === '-help' ||
    val.toLowerCase() === '--help'
  ) {
    console.log('help text goes here!')
    process.exit(1)
  }
})
exports.start = start

//  Stupid hack to see if we are being run on the command line or from
//  server.js. If we are being called on the command line then we need
//  to fire off the `start()` otherwise we leave that to server.js to call
if ('mainModule' in process && 'filename' in process.mainModule) {
  const whereAreWeFrom = process.mainModule.filename.split('/').pop()
  if (whereAreWeFrom === 'index.js') {
    isInvokedFromServer = false
    start()
  }
}
