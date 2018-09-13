const fs = require('fs')
const path = require('path')
const Config = require('../../classes/config')
const xmlformat = require('xml-formatter')
const processObjects = require('./objects')
const processConstituents = require('./constituents')
const processExhibitions = require('./exhibitions')
const processConcepts = require('./concepts')
const rootDir = path.join(__dirname, '../../../data')
const xml2js = require('xml2js')
const parser = new xml2js.Parser({
  trim: true,
  explicitArray: false,
  explicitRoot: false,
  mergeAttrs: true
})

exports.processFile = async (tms) => {
  console.log('Checking for XML file')
  const config = new Config()
  let filepath = null
  console.log('processing file for tms: ', tms)
  if ('tms' in config) {
    config.tms.forEach((t) => {
      if ('stub' in t && t.stub === tms && 'filepath') {
        console.log('We have found the right one')
        filepath = t.filepath
      }
    })
  }
  if (filepath === null) return
  if (!fs.existsSync(filepath)) return

  console.log('Trying to parse: ', filepath)

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
    console.log('looking for: ', element.parent)
    const xmlSplit = xml.split(`<${element.parent}>`)
    if (xmlSplit.length === 1) {
      console.log('No element found')
    } else {
      const xmlTail = xmlSplit.pop()
      const xmlTailSplit = xmlTail.split(`</${element.parent}>`)
      if (xmlTailSplit.length === 1) {
        console.log('No closing element found')
      } else {
        console.log('Found elements')
        const XMLRaw = xmlTailSplit[0]
        const itemCount = xmlTailSplit[0].split(`</${element.child}>`).length
        console.log(`Found ${itemCount} items`)

        //  Construct the XML output diretories
        if (!fs.existsSync(path.join(rootDir, 'imports'))) fs.mkdirSync(path.join(rootDir, 'imports'))
        if (!fs.existsSync(path.join(rootDir, 'imports', element.parent))) fs.mkdirSync(path.join(rootDir, 'imports', element.parent))
        if (!fs.existsSync(path.join(rootDir, 'imports', element.parent, tms))) fs.mkdirSync(path.join(rootDir, 'imports', element.parent, tms))
        if (!fs.existsSync(path.join(rootDir, 'imports', element.parent, tms, 'xml'))) fs.mkdirSync(path.join(rootDir, 'imports', element.parent, tms, 'xml'))

        //  Before we do anything with the JSON version, I want to split the
        //  XML up into seperate chunks so we can store those too.
        const splitRaw = XMLRaw.split(`</${element.child}>`)
          .map((xml) => {
            if (xml !== null && xml !== undefined && xml !== '') {
              return `${xml}</${element.child}>`
            }
            return null
          }).filter(Boolean)

        // const startTime = new Date().getTime()

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

        const XMLRestructured = `<${element.parent}>${splitRaw.join('')}</${element.parent}>`
        fs.writeFileSync(path.join(rootDir, 'imports', element.parent, tms, 'items.xml'), XMLRestructured, 'utf-8')
        parser.parseString(XMLRestructured, (err, result) => {
          if (err) {
            console.log(err)
          } else {
            console.log('ok')
            const fileJSONPretty = JSON.stringify(result, null, 4)
            const filename = path.join(rootDir, 'imports', element.parent, tms, 'items.json')
            fs.writeFileSync(filename, fileJSONPretty, 'utf-8')

            //  Now call the thing that's going to parse the objects
            if (element.parent === 'Objects') {
              processObjects.processJsonFile(tms, element.parent, element.child)
            }
            if (element.parent === 'Constituents') {
              processConstituents.processJsonFile(tms, element.parent, element.child)
            }
            if (element.parent === 'Exhibitions') {
              processExhibitions.processJsonFile(tms, element.parent, element.child)
            }
            if (element.parent === 'Concepts') {
              processConcepts.processJsonFile(tms, element.parent, element.child)
            }
          }
        })
      }
    }
  })
}
