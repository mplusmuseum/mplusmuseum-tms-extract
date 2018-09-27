const Config = require('../../classes/config')
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../data')
const logging = require('../logging')
const elasticsearch = require('elasticsearch')

const upsertTheItem = async (type, tms, id) => {
  const startTime = new Date().getTime()

  const tmsLogger = logging.getTMSLogger()
  tmsLogger.object(`starting upserting ${type.child} ${id} for ${tms}`, {
    action: 'start upsertTheItem',
    status: 'info',
    type: type.child,
    tms,
    id
  })

  //  Check to see that we have elasticsearch configured
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No ElasticSearch found`, {
      action: 'finished upsertTheItem',
      status: 'warning',
      type: type.child,
      tms,
      id
    })
    return
  }

  //  Check to make sure the file exists
  const subFolder = String(Math.floor(id / 1000) * 1000)
  const processFilename = path.join(rootDir, 'imports', type.parent, tms, 'process', subFolder, `${id}.json`)
  if (!fs.existsSync(processFilename)) {
    tmsLogger.object(`No ${type.parent} process file found, ${type.child} ${id} for ${tms}`, {
      action: 'finished upsertTheItem',
      status: 'error',
      type: type.child,
      tms,
      id,
      processFilename
    })
    return
  }
  //  And the matching perfect file
  const perfectFilename = path.join(rootDir, 'imports', type.parent, tms, 'perfect', subFolder, `${id}.json`)
  if (!fs.existsSync(perfectFilename)) {
    tmsLogger.object(`No ${type.parent} perfect file found, ${type.child} ${id} for ${tms}`, {
      action: 'finished upsertTheItem',
      status: 'error',
      type: type.child,
      tms,
      id,
      perfectFilename
    })
    return
  }

  //  Read in the processFile
  const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
  const processFile = JSON.parse(processFileRaw)

  //  Read in the perfectFile
  const perfectFileRaw = fs.readFileSync(perfectFilename, 'utf-8')
  const perfectFile = JSON.parse(perfectFileRaw)

  const upsertItem = processFile
  //  Copy the fields from the perfect file into the one we are going to upsert
  upsertItem.artInt = perfectFile.artInt
  if (perfectFile.remote && perfectFile.remote) {
    upsertItem.remote = perfectFile.remote
    if (upsertItem.remote.images) {
      upsertItem.remote.images = JSON.stringify(upsertItem.remote.images)
    }
  }

  const esclient = new elasticsearch.Client(elasticsearchConfig)

  //  Create the index if we need to
  const index = `${type.parent}_${tms}`.toLowerCase()
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
    type: type.child.toLowerCase(),
    id,
    body: {
      doc: upsertItem,
      doc_as_upsert: true
    }
  }).then(() => {
    //  Move it from the process to the processed folder
    const processedFilename = path.join(rootDir, 'imports', type.parent, tms, 'processed', subFolder, `${id}.json`)
    if (!fs.existsSync(path.join(rootDir, 'imports', type.parent, tms, 'processed'))) fs.mkdirSync(path.join(rootDir, 'imports', type.parent, tms, 'processed'))
    if (!fs.existsSync(path.join(rootDir, 'imports', type.parent, tms, 'processed', subFolder))) fs.mkdirSync(path.join(rootDir, 'imports', type.parent, tms, 'processed', subFolder))

    try {
      fs.renameSync(processFilename, processedFilename)
    } catch (er) {
      tmsLogger.object(`Failed to move ${type.parent} file ${type.child} for ${type.child} ${id} for ${tms}, (doing them too quickly?)`, {
        action: `renaming file in upsertTheItem`,
        status: 'error',
        type: type.child,
        tms,
        id,
        processFilename,
        processedFilename
      })
    }

    tmsLogger.object(`Upserted ${type.parent} for ${type.child} ${id} for ${tms}`, {
      action: `finished upsertTheItem`,
      status: 'ok',
      type: type.child,
      tms,
      id,
      ms: new Date().getTime() - startTime
    })
    //  We are going to reset the timeout to update the aggrigations
  })
}

const checkItems = async () => {
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  const tmsLogger = logging.getTMSLogger()
  const startTime = new Date().getTime()

  tmsLogger.object(`in checkItems`, {
    action: 'start checkItems',
    status: 'info'
  })

  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No ElasticSearch found in checkItems`, {
      action: 'finished checkItems',
      status: 'warning'
    })
    return
  }

  //  Only carry on if we have a data and tms directory
  if (!fs.existsSync(rootDir)) {
    tmsLogger.object(`No rootDir found`, {
      action: 'finished checkItems',
      status: 'warning',
      rootDir
    })
    return
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
  const tmsses = config.get('tms')
  if (!tmsses) return

  //  Now we need to look through all the folders in the data/[something]/[tms]perfect/[number]
  //  folder looking for ones that need uploading
  let foundItemToUpload = false
  types.forEach((type) => {
    if (foundItemToUpload === true) return
    tmsses.forEach((tms) => {
      if (foundItemToUpload === true) return
      const tmsDir = path.join(rootDir, 'imports', type.parent, tms.stub, 'process')
      const tmsPerfectDir = path.join(rootDir, 'imports', type.parent, tms.stub, 'perfect')
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

            //  If there is an images node in the process file, but remote hasn't been set in the perfect
            //  file, then we can't upload it yet
            const processFilename = path.join(tmsDir, subFolder, file)
            if (!(fs.existsSync(processFilename))) return
            const processFileRaw = fs.readFileSync(processFilename, 'utf-8')
            const processFile = JSON.parse(processFileRaw)
            //  If we have an images node, then we need to check more stuff
            if ('images' in processFile && processFile.images !== null && processFile.images.length !== 0) {
              if (!perfectFile.remote) return
              if (perfectFile.remote.status !== 'ok') return
            }
            foundItemToUpload = true
            tmsLogger.object(`We found ${type.child} ${file.split('.')[0]} for ${tms.stub} to upload`, {
              action: 'finished checkItems',
              status: 'info',
              type: type.child,
              tms: tms.stub,
              id: file.split('.')[0],
              ms: new Date().getTime() - startTime
            })
            upsertTheItem(type, tms.stub, file.split('.')[0])
          })
        })
      }
    })
  })

  if (!foundItemToUpload) {
    tmsLogger.object(`No item found to upload`, {
      action: 'finished checkItems',
      status: 'info',
      ms: new Date().getTime() - startTime
    })
  }
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

  const tmsLogger = logging.getTMSLogger()
  tmsLogger.object(`In startUpserting`, {
    action: 'startUpserting',
    status: 'info'
  })
}
