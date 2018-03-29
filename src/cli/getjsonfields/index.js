const colours = require('colors')
const fs = require('fs')
const tools = require('../../modules/tools')
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

const rootDir = process.cwd()
let startTime = new Date().getTime()
let isInvokedFromServer = true

const config = tools.getConfig()

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

/*
 * This is our main script that runs everything else in order.
 * NOTE: because of the way we run things our last call is to `upsertItems`
 * which then kicks off a timer loop, so this function doesn't actually
 * "finish" the script. That happens in the `upsertItems` function which
 * keeps calling itself until all the files have been processed. We actually
 * end in the `finished()` function.
 */
const start = (index, saveOutput = false) => {
  const fields = {}
  if (!isInvokedFromServer) {
    console.log('saveOutput: ', saveOutput)
    console.log('')
    console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.wow)
  }

  //  Make sure we have the directory all the JSON files are supposed to be in
  const jsonDir = `${tmsDir}/${index}/json`
  if (!fs.existsSync(jsonDir)) {
    console.error(`Missing directory ${jsonDir}`)
  } else {
    //  Grab an array of the json files
    if (!isInvokedFromServer) console.log(`Reading files from: ${jsonDir}`)
    const files = fs.readdirSync(jsonDir).filter(file => {
      const fileFragments = file.split('.')
      if (fileFragments.length !== 2) return false
      if (fileFragments[1] !== 'json') return false
      return true
    })

    /*
    * Now read in each json file and drill down all the nodes
    * NOTE: This is the place where we'd use fancy recursion and pass
    * the contents of each node into a function until there are no
    * more nodes to traverse down.
    * HOWEVER, for the sake of debugging santiy we are going to make
    * a (bad) assumption that there are only 4 levels deep and we are
    * going to drill down in a series of nested loops, which is ugly
    * but easier to follow along.
    * Turning this into recursion is an exercise left to the reader
    * for when they feel brave enough
    */
    if (!isInvokedFromServer) console.log(`Looking at ${files.length} files`)
    files.forEach(file => {
      const itemRaw = fs.readFileSync(`${jsonDir}/${file}`)
      const item = JSON.parse(itemRaw)

      //  Top level nodes, go thru 'em and add them to the fields
      Object.entries(item).forEach(level1Node => {
        // If we don't have a record of it, add it
        if (!(level1Node[0] in fields)) {
          fields[level1Node[0]] = {}
        }
        //  And point to the node we're going to be working from now
        const root1Node = fields[level1Node[0]]

        //  If the second part is an array, then we need to go deeper
        if (Array.isArray(level1Node[1])) {
          //  And now we do the same again...
          level1Node[1].forEach(element => {
            Object.entries(element).forEach(level2Node => {
              if (!(level2Node[0] in root1Node)) {
                root1Node[level2Node[0]] = {}
              }
              const root2Node = (root1Node[level2Node[0]] = {})
              if (Array.isArray(level2Node[1])) {
                // ...and again...
                level2Node[1].forEach(element => {
                  Object.entries(element).forEach(level3Node => {
                    if (!(level3Node[0] in root2Node)) {
                      root2Node[level3Node[0]] = {}
                    }
                    const root3Node = (root2Node[level3Node[0]] = {})
                    if (Array.isArray(level3Node[1])) {
                      // ...and again.
                      level3Node[1].forEach(element => {
                        Object.entries(element).forEach(level4Node => {
                          if (!(level4Node[0] in root3Node)) {
                            root3Node[level4Node[0]] = {}
                          }
                        })
                      })
                    }
                  })
                })
              }
            })
          })
        }
      })
    })
    //  Well, like I said, that was a bit messy and nested, but we
    //  got there in the end. Should we need to go even deeper then
    //  feel free to recurse or just copy and paste another loop :)
    if (!isInvokedFromServer) {
      console.log('>>>>>>> FIELDS DATA >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'.wow)
      console.log(fields)
      console.log('<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<'.wow)
    }

    //  If we have been asked to save the output, then do that here
    if (saveOutput) {
      const saveDir = `${dataDir}/fields`
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir)
      if (!fs.existsSync(`${saveDir}/${index}`)) {
        fs.mkdirSync(`${saveDir}/${index}`)
      }
      const datetime = moment().format('YYYY-MM-DD-HH-mm-ss')
      const fieldsJSONPretty = JSON.stringify(fields, null, 4)
      fs.writeFileSync(
        `${saveDir}/${index}/${datetime}.json`,
        fieldsJSONPretty,
        'utf-8'
      )
    }

    const endTime = new Date().getTime()
    const diff = endTime - startTime
    if (!isInvokedFromServer) {
      console.log(`Processed in ${diff}ms`)
      console.log('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'.wow)
      console.log('')
    }

    if (isInvokedFromServer) {
      return fields
    }
  }
}

let index = null
let saveOutput = false

process.argv.forEach(val => {
  //  If we are being passed an index then we need to look through
  //  and see if any of the parameters match those in the config
  if (val.toLowerCase() === '-index' || val.toLowerCase() === '--index') {
    if ('xml' in config) {
      process.argv.forEach(indexCheck => {
        config.xml.forEach(xml => {
          if (xml.index === indexCheck) {
            index = indexCheck
          }
        })
      })
    }
  }

  if (val.toLowerCase() === '-save' || val.toLowerCase() === '--save') {
    console.log('Setting saveout to true')
    saveOutput = true
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
    start(index, saveOutput)
  }
}
