const fs = require('fs')
const path = require('path')
const Config = require('../../../classes/config')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../../modules/logging')
const utils = require('../../../modules/utils')
const elasticsearch = require('elasticsearch')

const makeAutocomplete = async (tms) => {
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`starting getAreas`, {
    action: 'start getAreas',
    status: 'info'
  })

  const startTime = new Date().getTime()

  //  Check to see if we have elastic search configured, if we don't then
  //  there's no point doing anything
  const config = new Config()
  const elasticsearchConfig = config.get('elasticsearch')
  //  If there's no elasticsearch configured then we don't bother
  //  to do anything
  if (elasticsearchConfig === null) {
    tmsLogger.object(`No elasticsearch configured`, {
      action: 'finished createRandomSelection',
      status: 'info',
      tms,
      ms: new Date().getTime() - startTime
    })
    return
  }

  const dict = {
    areas: [],
    categories: [],
    objectNames: [],
    keywords: {},
    constituents: []
  }
  const langs = ['en', 'zh-hant']

  //  Look through all the processed files grabbing the ids of publicAccess objects
  const tmsProcessedDir = path.join(rootDir, 'imports', 'Objects', tms, 'processed')
  //  Don't do anything if the folder doesn't exist
  if (!fs.existsSync(tmsProcessedDir)) {
    tmsLogger.object(`No elasticsearch tmsProcessedDir for tms ${tms}`, {
      action: 'finished createRandomSelection',
      tms,
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  const subFolders = fs.readdirSync(tmsProcessedDir)
  subFolders.forEach((subFolder) => {
    const files = fs.readdirSync(path.join(tmsProcessedDir, subFolder)).filter(file => {
      const fileFragments = file.split('.')
      if (fileFragments.length !== 2) return false
      if (fileFragments[1] !== 'json') return false
      return true
    })

    //  Now read in each file and find the keywords
    const topLevelNodes = ['title', 'baselineDescription', 'creditLine', 'displayDate', 'medium', 'objectStatus']
    files.forEach((file) => {
      const objectRaw = fs.readFileSync(path.join(tmsProcessedDir, subFolder, file), 'utf-8')
      const objectJSON = JSON.parse(objectRaw)
      if (objectJSON.publicAccess) {
        //  Do the classifications
        if (objectJSON.classification) {
          //  Areas
          if (objectJSON.classification.area) {
            if (!Array.isArray(objectJSON.classification.area)) objectJSON.classification.area = [objectJSON.classification.area]
            objectJSON.classification.area.forEach((thing) => {
              if (thing.areacat.en) {
                let slug = utils.slugify(thing.areacat['en'])
                if (!dict.areas.includes(`${thing.areacat['en']}:${slug}`)) dict.areas.push(`${thing.areacat['en']}:${slug}`)
                if ('zh-hant' in thing.areacat) {
                  if (!dict.areas.includes(`${thing.areacat['zh-hant']}:${slug}`)) dict.areas.push(`${thing.areacat['zh-hant']}:${slug}`)
                }
              }
            })
          }
          //  category
          if (objectJSON.classification.category) {
            if (!Array.isArray(objectJSON.classification.category)) objectJSON.classification.category = [objectJSON.classification.category]
            objectJSON.classification.category.forEach((thing) => {
              if (thing.areacat.en) {
                let slug = utils.slugify(thing.areacat['en'])
                if (!dict.categories.includes(`${thing.areacat['en']}:${slug}`)) dict.categories.push(`${thing.areacat['en']}:${slug}`)
                if ('zh-hant' in thing.areacat) {
                  if (!dict.categories.includes(`${thing.areacat['zh-hant']}:${slug}`)) dict.categories.push(`${thing.areacat['zh-hant']}:${slug}`)
                }
              }
            })
          }
        }
        /*
        if (objectJSON.areas && objectJSON.areas.lang[lang] && objectJSON.areas.lang[lang].title) {
          if (!Array.isArray(objectJSON.areas.lang[lang].title)) objectJSON.areas.lang[lang].title = [objectJSON.areas.lang[lang].title]
          objectJSON.areas.lang[lang].title.forEach((title) => {
            let slug = utils.slugify(title)
            if (slug === '') slug = title
            if (!dict.areas.includes(`${title}:${slug}`)) dict.areas.push(`${title}:${slug}`)
          })
        }
        if (objectJSON.category && objectJSON.category.lang[lang] && objectJSON.category.lang[lang].title) {
          if (!Array.isArray(objectJSON.category.lang[lang].title)) objectJSON.category.lang[lang].title = [objectJSON.category.lang[lang].title]
          objectJSON.category.lang[lang].title.forEach((title) => {
            let slug = utils.slugify(title)
            if (slug === '') slug = title
            if (!dict.categories.includes(`${title}:${slug}`)) dict.categories.push(`${title}:${slug}`)
          })
        }
        */

        langs.forEach((lang) => {
          if (objectJSON.objectName && objectJSON.objectName[lang] && objectJSON.objectName[lang] !== '') {
            let slug = utils.slugify(objectJSON.objectName[lang])
            if (slug === '') slug = objectJSON.objectName[lang]
            if (!dict.objectNames.includes(`${objectJSON.objectName[lang]}:${slug}`)) dict.objectNames.push(`${objectJSON.objectName[lang]}:${slug}`)
          }

          let wordArray = null
          topLevelNodes.forEach((node) => {
            if (objectJSON[node] && objectJSON[node][lang] && objectJSON[node][lang] !== '') {
              wordArray = objectJSON[node][lang].toLowerCase().match(/\b[\w']+\b/g)
              if (wordArray !== null && wordArray.length > 0) {
                wordArray.forEach(word => {
                  if (!dict.keywords[word]) dict.keywords[word] = 0
                  dict.keywords[word]++
                })
              }
            }
          })
          //  Exhibition Labels
          if (objectJSON.exhibition && objectJSON.exhibition.exhibitionLabelText && objectJSON.exhibition.exhibitionLabelText[lang] && objectJSON.exhibition.exhibitionLabelText[lang].labels && objectJSON.exhibition.exhibitionLabelText[lang].labels.text && objectJSON.exhibition.exhibitionLabelText[lang].labels.text !== '') {
            wordArray = objectJSON.exhibition.exhibitionLabelText[lang].labels.text.toLowerCase().match(/\b[\w']+\b/g)
            if (wordArray !== null && wordArray.length > 0) {
              wordArray.forEach(word => {
                if (!dict.keywords[`${word}:${word}`]) dict.keywords[`${word}:${word}`] = 0
                dict.keywords[`${word}:${word}`]++
              })
            }
          }
        })

        //  Image stuff
        const imageNodes = ['AltText', 'AltTextTC', 'Copyright']
        imageNodes.forEach((node) => {
          if (objectJSON.images && objectJSON.images[node] && objectJSON.images[node] !== '') {
            const wordArray = objectJSON.images[node].toLowerCase().match(/\b[\w']+\b/g)
            if (wordArray !== null && wordArray.length > 0) {
              wordArray.forEach(word => {
                if (!dict.keywords[`${word}:${word}`]) dict.keywords[`${word}:${word}`] = 0
                dict.keywords[`${word}:${word}`]++
              })
            }
          }
        })
      }
    })
  })

  //  Look through all the processed files grabbing the ids of publicAccess objects
  const tmsConstituentsProcessedDir = path.join(rootDir, 'imports', 'Constituents', tms, 'processed')
  //  Don't do anything if the folder doesn't exist
  if (!fs.existsSync(tmsConstituentsProcessedDir)) {
    tmsLogger.object(`No elasticsearch tmsProcessedDir for tms ${tms}`, {
      action: 'finished createRandomSelection',
      tms,
      status: 'info',
      ms: new Date().getTime() - startTime
    })
    return
  }

  const subConstituentsFolders = fs.readdirSync(tmsConstituentsProcessedDir)
  subConstituentsFolders.forEach((subFolder) => {
    const files = fs.readdirSync(path.join(tmsConstituentsProcessedDir, subFolder)).filter(file => {
      const fileFragments = file.split('.')
      if (fileFragments.length !== 2) return false
      if (fileFragments[1] !== 'json') return false
      return true
    })

    //  Now read in each file and find the keywords
    files.forEach((file) => {
      const constituentRaw = fs.readFileSync(path.join(tmsConstituentsProcessedDir, subFolder, file), 'utf-8')
      const constituentJSON = JSON.parse(constituentRaw)
      if (constituentJSON.publicAccess) {
        langs.forEach((lang) => {
          if (constituentJSON.name && constituentJSON.name[lang] && constituentJSON.name[lang].displayName && constituentJSON.name[lang].displayName !== '' && !dict.constituents.includes(`${constituentJSON.name[lang].displayName}:${utils.slugify(constituentJSON.name['en'].displayName)}`)) dict.constituents.push(`${constituentJSON.name[lang].displayName}:${utils.slugify(constituentJSON.name['en'].displayName)}`)
        })
      }
    })
  })

  const newKeywords = []
  Object.entries(dict.keywords).forEach((wordpair) => {
    const word = wordpair[0]
    const count = wordpair[1]
    if (count > 5 && word.length > 3) {
      newKeywords.push(word)
    }
  })
  dict.keywords = newKeywords
  //  Put the data into the database
  fs.writeFileSync(path.join(rootDir, 'autocomplete.json'), JSON.stringify(dict, null, 4), 'utf-8')
  const esclient = new elasticsearch.Client(elasticsearchConfig)
  const index = `lookups_${tms}`
  const type = 'lookup'
  const exists = await esclient.indices.exists({
    index
  })
  if (exists !== true) {
    await esclient.indices.create({
      index
    })
  }

  const data = {
    id: 'autocomplete',
    data: JSON.stringify(dict)
  }
  esclient.update({
    index,
    type,
    id: 'autocomplete',
    body: {
      doc: data,
      doc_as_upsert: true
    }
  })
}

exports.startMakeAutocomplete = () => {
  //  Remove the old interval timer
  // clearInterval(global.findConstituentRoles)
  //  See if we have an interval timer setting in the
  //  timers part of the config, if not use the default
  //  of 20,000 (20 seconds)
  const config = new Config()
  if (!config) return
  if (!config.tms) return
  // const interval = 1000 * 60 * 60 * 24 // 24 hours
  config.tms.forEach((tms) => {
    makeAutocomplete(tms.stub)
    setTimeout(() => {
      makeAutocomplete(tms.stub)
    }, 1000 * 60 * 60 * 5.8)
  })
}
