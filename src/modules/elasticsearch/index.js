const Config = require('../../classes/config')
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const logging = require('../logging')
const elasticsearch = require('elasticsearch')

const upsertItem = async (type, tms, id) => {
  const tmsLogger = logging.getTMSLogger()

  //  Check to see that we have elasticsearch configured
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    return
  }

  //  Check to make sure the file exists
  const subFolder = String(Math.floor(id / 1000) * 1000)
  const processFilename = path.join(rootDir, type, tms, 'process', subFolder, `${id}.json`)
  if (!fs.existsSync(processFilename)) return
  //  And the matching perfect file
  const perfectFilename = path.join(rootDir, type, tms, 'perfect', subFolder, `${id}.json`)
  if (!fs.existsSync(perfectFilename)) return

  //  Read in the processFile
  const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
  const processFile = JSON.parse(processFileRaw)

  //  Read in the perfectFile
  const perfectFileRaw = fs.readFileSync(perfectFilename, 'utf-8')
  const perfectFile = JSON.parse(perfectFileRaw)

  const upsertItem = processFile
  //  Copy the fields from the perfect file into the one we are going to upsert
  upsertItem.artInt = perfectFile.artInt

  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const startTime = new Date().getTime()

  //  Create the index if we need to
  const index = `${type}_${tms}`
  const exists = await esclient.indices.exists({
    index
  })
  if (exists === false) {
    await esclient.indices.create({
      index
    })
  }

  //  Upsert the item
  esclient.update({
    index,
    type,
    id,
    body: {
      doc: upsertItem,
      doc_as_upsert: true
    }
  }).then(() => {
    //  Move it from the process to the processed folder
    const processedFilename = path.join(rootDir, type, tms, 'processed', subFolder, `${id}.json`)
    if (!fs.existsSync(path.join(rootDir, type, tms, 'processed'))) fs.mkdirSync(path.join(rootDir, type, tms, 'processed'))
    if (!fs.existsSync(path.join(rootDir, type, tms, 'processed', subFolder))) fs.mkdirSync(path.join(rootDir, type, tms, 'processed', subFolder))

    fs.renameSync(processFilename, processedFilename)
    const endTime = new Date().getTime()
    tmsLogger.object(`Upserted item for ${type} ${id} for ${tms}`, {
      action: `upserted_${type}`,
      id: id,
      tms: tms,
      ms: endTime - startTime
    })

    //  We are going to reset the timeout to update the aggrigations
    /*
    clearTimeout(global.update_aggrigations)
    global.update_aggrigations = setTimeout(() => {
      aggregateObjects(tms)
      aggregateObjects(tms)
    }, 60 * 1000 * 2) // Do it in two minutes time
    */
  })
}

const checkItems = async () => {
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  const tmsLogger = logging.getTMSLogger()

  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'checkingProcess'
    })
    return
  }

  //  Only carry on if we have a data and tms directory
  if (!fs.existsSync(rootDir)) {
    tmsLogger.object(`No data or data found`, {
      action: 'checkingProcess'
    })
    return
  }

  const types = ['objects', 'constituents']
  const tmsses = config.get('tms')

  //  Now we need to look through all the folders in the data/[something]/[tms]perfect/[number]
  //  folder looking for ones that need uploading
  let foundItemToUpload = false
  types.forEach((type) => {
    if (foundItemToUpload === true) return
    tmsses.forEach((tms) => {
      if (foundItemToUpload === true) return
      const tmsDir = path.join(rootDir, type, tms.stub, 'process')
      const tmsPerfectDir = path.join(rootDir, type, tms.stub, 'perfect')
      if (fs.existsSync(tmsDir)) {
        if (foundItemToUpload === true) return
        const subFolders = fs.readdirSync(tmsDir)
        subFolders.forEach((subFolder) => {
          if (foundItemToUpload === true) return
          const files = fs.readdirSync(path.join(tmsDir, subFolder)).filter(file => {
            const fileFragments = file.split('.')
            if (fileFragments.length !== 2) return false
            if (fileFragments[1] !== 'json') return false
            return true
          })
          files.forEach((file) => {
            if (foundItemToUpload === true) return

            //  Read in the perfect version of the file, because we want to see if the remote
            //  data has been set yet, or if it and the source is null, in either case we can upsert the
            //  file. Otherwise we are going to skip it.
            const perfectFilename = path.join(tmsPerfectDir, subFolder, file)
            if (!(fs.existsSync(perfectFilename))) return
            const perfectFileRaw = fs.readFileSync(perfectFilename, 'utf-8')
            const perfectFile = JSON.parse(perfectFileRaw)

            //  If we don't have an artInt then we don't upload the file
            if (!('artInt' in perfectFile) || perfectFile.artInt === null || perfectFile.artInt === '') return

            foundItemToUpload = true
            upsertItem(type, tms.stub, file.split('.')[0])
          })
        })
      }
    })
  })
}

exports.startUpserting = () => {
  //  Remove the old interval timer
  clearInterval(global.elasticsearchTmr)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  const timers = config.get('timers')
  let interval = 20000
  if (timers !== null && 'elasticsearch' in timers) {
    interval = parseInt(timers.elasticsearch, 10)
  }
  global.elasticsearchTmr = setInterval(() => {
    checkItems()
  }, interval)
  checkItems()
}
