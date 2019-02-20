const fs = require('fs')
const path = require('path')
const Config = require('../../classes/config')
const xmlformat = require('xml-formatter')
const processObjects = require('./objects')
const processConstituents = require('./constituents')
const processExhibitions = require('./exhibitions')
const processConcepts = require('./concepts')
const processBibiolographicaData = require('./bibiolographicData')
const rootDir = path.join(__dirname, '../../../data')
const logging = require('../../modules/logging')
const xml2js = require('xml2js')
const parser = new xml2js.Parser({
  trim: true,
  explicitArray: false,
  explicitRoot: false,
  mergeAttrs: true
})

const processFile = async (tms) => {
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`Called processFile for tms: ${tms}`, {
    action: 'processFile',
    status: 'info',
    tms
  })

  const config = new Config()
  let filepath = null

  if ('tms' in config) {
    config.tms.forEach((t) => {
      if ('stub' in t && t.stub === tms && 'filepath') {
        filepath = t.filepath
      }
    })
  }
  const veryStartTime = new Date().getTime()

  if (filepath === null || !fs.existsSync(filepath)) {
    tmsLogger.object(`Missing file for processing for tms: ${tms}`, {
      action: `processFile`,
      status: 'warning',
      filepath,
      tms
    })
    return
  }

  tmsLogger.object(`Found file for processing for tms: ${tms}`, {
    action: `Start processFile`,
    status: 'ok',
    filepath,
    tms
  })

  const xml = fs.readFileSync(filepath, 'utf-8')

  //  Grab the Objects
  const elements = [{
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

  elements.forEach((element) => {
    tmsLogger.object(`looking for: ${element.parent}`, {
      action: 'Checking element',
      status: 'info',
      element: element.parent,
      filepath,
      tms
    })
    const xmlSplit = xml.split(`<${element.parent}>`)
    if (xmlSplit.length === 1) {
      tmsLogger.object(`looking for: ${element.parent}`, {
        action: 'No element found',
        status: 'warning',
        element: element.parent,
        filepath,
        tms
      })
    } else {
      const xmlTail = xmlSplit.pop()
      const xmlTailSplit = xmlTail.split(`</${element.parent}>`)
      if (xmlTailSplit.length === 1) {
        tmsLogger.object(`looking for: ${element.parent}`, {
          action: 'No closing element found',
          status: 'warning',
          element: element.parent,
          filepath,
          tms
        })
      } else {
        const XMLRaw = xmlTailSplit[0]
        const spiltStartTime = new Date().getTime()
        const itemCount = xmlTailSplit[0].split(`</${element.child}>`).length
        const splitEndTime = new Date().getTime()
        let totalms = splitEndTime - spiltStartTime
        if (totalms <= 1) totalms = 1

        tmsLogger.object(`found ${itemCount} ${element.parent}`, {
          action: `Element found`,
          status: 'info',
          element: element.parent,
          filepath,
          tms,
          ms: totalms
        })

        //  Construct the XML output diretories
        if (!fs.existsSync(path.join(rootDir, 'imports'))) fs.mkdirSync(path.join(rootDir, 'imports'))
        if (!fs.existsSync(path.join(rootDir, 'imports', element.parent))) fs.mkdirSync(path.join(rootDir, 'imports', element.parent))
        if (!fs.existsSync(path.join(rootDir, 'imports', element.parent, tms))) fs.mkdirSync(path.join(rootDir, 'imports', element.parent, tms))
        if (!fs.existsSync(path.join(rootDir, 'imports', element.parent, tms, 'xml'))) fs.mkdirSync(path.join(rootDir, 'imports', element.parent, tms, 'xml'))

        const xmlStartTime = new Date().getTime()

        //  Before we do anything with the JSON version, I want to split the
        //  XML up into seperate chunks so we can store those too.
        const splitRaw = XMLRaw.split(`</${element.child}>`)
          .map((xml) => {
            if (xml !== null && xml !== undefined && xml !== '') {
              return `${xml}</${element.child}>`
            }
            return null
          }).filter(Boolean)

        //  Write out the XML files
        splitRaw.forEach((xml) => {
          const xmlSplit = xml.split('<')
          if (xmlSplit[2] !== undefined) {
            const idSplit = xmlSplit[2].split('>')
            if (idSplit[1] !== undefined) {
              const id = parseInt(idSplit[1], 10)
              if (!isNaN(id)) {
                const subFolder = String(Math.floor(id / 1000) * 1000)
                if (!fs.existsSync(path.join(rootDir, 'imports', element.parent, tms, 'xml', subFolder))) fs.mkdirSync(path.join(rootDir, 'imports', element.parent, tms, 'xml', subFolder))
                const filename = path.join(rootDir, 'imports', element.parent, tms, 'xml', subFolder, `${id}.xml`)
                fs.writeFileSync(filename, xmlformat(xml), 'utf-8')
              }
            }
          }
        })
        tmsLogger.object(`split XML for: ${element.parent}`, {
          action: `Splitting XML`,
          status: 'info',
          element: element.parent,
          filepath,
          tms,
          ms: new Date().getTime() - xmlStartTime
        })

        const XMLRestructured = `<${element.parent}>${splitRaw.join('')}</${element.parent}>`
        fs.writeFileSync(path.join(rootDir, 'imports', element.parent, tms, 'items.xml'), XMLRestructured, 'utf-8')
        const parseStartTime = new Date().getTime()
        parser.parseString(XMLRestructured, (err, result) => {
          if (err) {
            tmsLogger.object(`failed to parse XML into JSON`, {
              action: `Parsing XML`,
              status: 'error',
              element: element.parent,
              filepath,
              tms,
              ms: new Date().getTime() - parseStartTime
            })
          } else {
            tmsLogger.object(`parsed XML into JSON`, {
              action: `Parsing XML`,
              status: 'ok',
              element: element.parent,
              filepath,
              tms,
              ms: new Date().getTime() - parseStartTime
            })
            const fileJSONPretty = JSON.stringify(result, null, 4)
            const filename = path.join(rootDir, 'imports', element.parent, tms, 'items.json')
            fs.writeFileSync(filename, fileJSONPretty, 'utf-8')

            //  Now call the thing that's going to parse the objects
            if (element.parent === 'Objects') {
              setTimeout(() => {
                processObjects.processJsonFile(tms, element.parent, element.child)
              }, 100)
            }
            if (element.parent === 'Constituents') {
              setTimeout(() => {
                processConstituents.processJsonFile(tms, element.parent, element.child)
              }, 200)
            }
            if (element.parent === 'BibiolographicData') {
              setTimeout(() => {
                processBibiolographicaData.processJsonFile(tms, element.parent, element.child)
              }, 200)
            }
            if (element.parent === 'Exhibitions') {
              setTimeout(() => {
                processExhibitions.processJsonFile(tms, element.parent, element.child)
              }, 300)
            }
            if (element.parent === 'Concepts') {
              setTimeout(() => {
                processConcepts.processJsonFile(tms, element.parent, element.child)
              }, 400)
            }
          }
        })
      }
    }
  })

  tmsLogger.object(`Finished processFile for tms: ${tms}`, {
    action: 'processFile',
    status: 'ok',
    tms,
    ms: new Date().getTime() - veryStartTime
  })
}
exports.processFile = processFile

exports.startProcessingMainXml = () => {
  //  Remove the old interval timer
  clearInterval(global.processMainXml)

  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  if (!config) return
  if (!config.tms) return
  const interval = 1000 * 60 * 60 * 1 // 1 hour
  config.tms.forEach((tms) => {
    global.processMainXml = setInterval(() => {
      processFile(tms.stub)
    }, interval)
  })
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`In startProcessingMainXml`, {
    action: 'startProcessingMainXml',
    status: 'info'
  })
}
