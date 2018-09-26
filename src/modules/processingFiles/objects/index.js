const Config = require('../../../classes/config')
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../logging')
const artisanalints = require('../../artisanalints')

// #########################################################################
/*
These are all the cool parse functions to get the data into the right format
*/
// #########################################################################

const getConstituents = constituents => {
  const constituentsObj = {
    ids: [],
    idsToRoleRank: []
  }
  if (constituents === null || constituents === undefined) return null
  if (!Array.isArray(constituents)) constituents = [constituents]

  //  We are going to make an array of id/rank/role objects so we can match them
  //  up again on the other side
  constituents.forEach((constituent) => {
    const newConstituentObj = {}

    const constituentId = parseInt(constituent.ConstituentID, 10)
    if (!constituentsObj.ids.includes(constituentId)) constituentsObj.ids.push(constituentId)

    newConstituentObj.id = constituentId
    if ('Displayorder' in constituent) {
      const rank = parseInt(constituent.Displayorder, 10)
      newConstituentObj.rank = rank
    }
    if ('Role' in constituent) {
      newConstituentObj.roles = {
        en: constituent.Role
      }
    }
    //  Add the object to the array of id/rank/roles
    constituentsObj.idsToRoleRank.push(newConstituentObj)
  })
  //  To stop theElasticSearch trying to make a large number of fields
  //  based on this nested data, we're going to store it as a string.
  //  We don't need to ever search on it, we just need to be able to
  //  unpack it again on the other side.
  constituentsObj.idsToRoleRank = JSON.stringify(constituentsObj.idsToRoleRank)

  return constituentsObj
}

const getSortnumber = objectNumber => {
  //  We have a sort number, if the objectNumber is numeric then we can use
  //  it for the sort number, if it's not then we just leave it null
  /*
  let sortNumber = null
  if (!isNaN(parseFloat(objectNumber))) {
    sortNumber = parseFloat(objectNumber)
  }
  return sortNumber
  */
  return objectNumber
}

const getClassifications = classifications => {
  const classificationsObj = {}
  if (!Array.isArray(classifications)) {
    classifications = [classifications]
  }
  classifications.forEach((cat) => {
    //  Get the area or category
    if ('Classification' in cat) {
      const catSplit = cat.Classification.split('-')[0]

      //  If we have an area then put it there
      if (catSplit === 'Area') {
        classificationsObj.area = {
          rank: parseInt(cat.Displayorder, 10),
          areacat: {}
        }
        //  Add the languages if we have them
        if ('Classification' in cat) {
          classificationsObj.area.areacat['en'] = cat.Classification.replace('Area-', '')
        }
        if ('ClassificationTC' in cat) {
          classificationsObj.area.areacat['zh-hant'] = cat.ClassificationTC
        }
      }
      //  If we have an category then put it there
      if (catSplit === 'Category') {
        classificationsObj.category = {
          rank: parseInt(cat.Displayorder, 10),
          areacat: {}
        }
        //  Add the languages if we have them
        if ('Classification' in cat) {
          classificationsObj.category.areacat['en'] = cat.Classification.replace('Category-', '')
        }
        if ('ClassificationTC' in cat) {
          classificationsObj.category.areacat['zh-hant'] = cat.ClassificationTC
        }
      }
    }
  })
  return classificationsObj
}

//  Turn the list of ids into an actual array
const getExhibitionIds = ids => {
  if (ids === undefined || ids === null) return null
  if (!Array.isArray(ids)) ids = [ids]
  return ids.map((id) => {
    //  Sometimes we are a string, sometimes an object
    if (typeof (id) === 'string') return parseInt(id, 10)
    if (typeof (id) === 'object' && '_' in id) return parseInt(id._, 10)
    return null
  }).filter(Boolean)
}

//  Turn the list of ids into an actual array
const getExhibitionSections = ids => {
  if (ids === undefined || ids === null) return null
  if (!Array.isArray(ids)) ids = [ids]
  return JSON.stringify(ids.map((id) => {
    //  Sometimes we are a string, sometimes an object
    if (typeof (id) === 'object' && '_' in id && 'Section' in id) {
      const returnObj = {}
      returnObj[parseInt(id._, 10)] = id.Section
      return returnObj
    }
    return null
  }).filter(Boolean))
}

//  Grab the label text
const getExhibitionLabelText = labelText => {
  if (labelText === undefined || labelText === null) return null
  if (!Array.isArray(labelText)) labelText = [labelText]
  const labelObj = {
    purposes: [],
    labels: []
  }
  labelObj.purposes = labelText.map((label) => {
    if (typeof (label) === 'object' && 'Purpose' in label) return label.Purpose
    return null
  }).filter(Boolean)
  labelObj.labels = labelText.map((label) => {
    if (typeof (label) === 'string') {
      return {
        'purpose': null,
        'text': label
      }
    }
    if (typeof (label) === 'object' && '_' in label && 'Purpose' in label) {
      return {
        'purpose': label.Purpose,
        'text': label._
      }
    }
    return null
  }).filter(Boolean)
  return labelObj
}

const getMedia = medias => {
  if (medias === undefined || medias === null) return null
  if (!Array.isArray(medias)) medias = [medias]
  if (medias.length === 0) return null
  return medias.map((media) => {
    if (media._) {
      media.src = media._.replace(/\\\\/g, '/').replace(/\\/g, '/')
      media.rank = media.Rank
      media.primaryDisplay = parseInt(media.PrimaryDisplay, 10) === 1
      media.publicAccess = parseInt(media.PublicAccess, 10) === 1
      delete media._
      delete media.Rank
      delete media.PrimaryDisplay
      delete media.PublicAccess
      return media
    }
  }).filter(Boolean)
}

const forceIDArray = ids => {
  if (ids === undefined || ids === null) return null
  if (!Array.isArray(ids)) ids = [ids]
  ids = ids.map((id) => {
    return parseInt(id, 10)
  })
  return ids
}

// #########################################################################
/*
 * The actual object parsing
 */
// #########################################################################
const parseItem = item => {
  const newItem = {
    objectID: parseInt(item.ObjectID, 10),
    publicAccess: parseInt(item.PublicAccess, 10) === 1,
    onView: parseInt(item.OnView, 10) === 1,
    objectNumber: item.ObjectNumber,
    sortNumber: getSortnumber(item.SortNumber),
    classification: getClassifications(item.AreaCat),
    consituents: getConstituents(item.ObjectRelatedConstituents),
    exhibition: {
      ids: getExhibitionIds(item.RelatedExhibitionID),
      sections: getExhibitionSections(item.RelatedExhibitionID),
      exhibitionLabelText: {}
    },
    relatedEventIds: forceIDArray(item.RelatedEventID),
    relatedConceptIds: forceIDArray(item.RelatedConceptID),
    allORC: item.AllORC,
    title: {},
    objectStatus: {},
    displayDate: {},
    beginDate: parseFloat(item.DateBegin),
    endDate: parseFloat(item.Dateend),
    dimension: {},
    medium: {},
    creditLine: {},
    images: getMedia(item.Media),
    id: parseInt(item.ObjectID, 10)
  }
  //  Now drop in all the languages
  if ('TitleEN' in item) newItem.title['en'] = item.TitleEN
  if ('TitleTC' in item) newItem.title['zh-hant'] = item.TitleTC
  if ('Objectstatus' in item) newItem.objectStatus['en'] = item.Objectstatus
  if ('ObjectstatusTC' in item) newItem.objectStatus['zh-hant'] = item.ObjectstatusTC
  if ('Dated' in item) newItem.displayDate['en'] = item.Dated
  if ('DateTC' in item) newItem.displayDate['zh-hant'] = item.DateTC
  if ('Dimensions' in item) newItem.dimension['en'] = item.Dimensions
  if ('DimensionTC' in item) newItem.dimension['zh-hant'] = item.DimensionTC
  if ('Medium' in item) newItem.medium['en'] = item.Medium
  if ('MediumTC' in item) newItem.medium['zh-hant'] = item.MediumTC
  if ('CreditLine' in item) newItem.creditLine['en'] = item.CreditLine
  if ('CreditlineTC' in item) newItem.creditLine['zh-hant'] = item.CreditlineTC
  if ('ExhibitionLabelText' in item) newItem.exhibition.exhibitionLabelText['en'] = getExhibitionLabelText(item.ExhibitionLabelText)
  if ('ExhibitionLabelTextTC' in item) newItem.exhibition.exhibitionLabelText['zh-hant'] = getExhibitionLabelText(item.ExhibitionLabelTextTC)
  return newItem
}

const processJsonFile = (tms, parentNode, childNode) => {
  //  TODO: Check what type of XML file we have been passed, we will do this
  //  based on the 'action' field. And will then validate (as best we can)
  //  the contents of the file based on what we've been passed
  let newItems = 0
  let modifiedItems = 0
  let totalItems = 0
  const startTime = new Date().getTime()
  const tmsLogger = logging.getTMSLogger()

  tmsLogger.object(`Starting processing ${parentNode} JSON file for ${childNode} ${tms}`, {
    action: 'Start processJsonFile',
    status: 'info',
    tms,
    type: parentNode
  })

  const filename = path.join(rootDir, 'imports', parentNode, tms, 'items.json')
  if (!fs.existsSync(filename)) {
    console.log('Cant find file: ', filename)
  }
  const itemsRAW = fs.readFileSync(filename, 'utf-8')
  const itemsJSON = JSON.parse(itemsRAW)[childNode].map((item) => parseItem(item))
  /* ##########################################################################

  This is where the PROCESSING STARTS

  ########################################################################## */
  //  In theory we now have a valid(ish) objects file. Let's go through
  //  it now and work out how many objects are new or modified
  itemsJSON.forEach((item) => {
    totalItems += 1
    const id = parseInt(item.id, 10)
    const subFolder = String(Math.floor(id / 1000) * 1000)
    const filename = path.join(rootDir, 'imports', parentNode, tms, 'processed', subFolder, `${id}.json`)

    //  See if the files exists in processed, if it doesn't then it's a new file
    let needToUpload = false
    if (!fs.existsSync(filename)) {
      tmsLogger.object(`Creating process file for ${childNode} ${id} for ${tms}`, {
        action: 'new',
        type: childNode,
        id: id,
        stub: tms
      })
      newItems += 1
      needToUpload = true
    } else {
      //  We need to read in the file and compare to see if it's different
      const processedFileRaw = fs.readFileSync(filename, 'utf-8')
      const processedFile = JSON.stringify(JSON.parse(processedFileRaw))
      const thisItem = JSON.stringify(item)
      //  If there's a difference between the objects then we know it's been modified
      //  and we need to upload it.
      if (thisItem !== processedFile) {
        needToUpload = true
        modifiedItems += 1
        //  Remove it from the processed fold, to force us to reupload it
        fs.unlinkSync(filename)
        tmsLogger.object(`Found changed ${childNode} JSON for ${childNode} ${id} for ${tms}`, {
          action: 'modified',
          type: childNode,
          id: id,
          stub: tms
        })
      }
    }

    //  If we need to upload the file then pop it into the process folder
    if (needToUpload === true) {
      if (!fs.existsSync(path.join(rootDir, 'imports'))) {
        fs.mkdirSync(path.join(rootDir, 'imports'))
      }
      if (!fs.existsSync(path.join(rootDir, 'imports', parentNode))) {
        fs.mkdirSync(path.join(rootDir, 'imports', parentNode))
      }
      if (!fs.existsSync(path.join(rootDir, 'imports', parentNode, tms))) {
        fs.mkdirSync(path.join(rootDir, 'imports', parentNode, tms))
      }
      if (!fs.existsSync(path.join(rootDir, 'imports', parentNode, tms, 'process'))) {
        fs.mkdirSync(path.join(rootDir, 'imports', parentNode, tms, 'process'))
      }
      if (!fs.existsSync(path.join(rootDir, 'imports', parentNode, tms, 'process', subFolder))) {
        fs.mkdirSync(path.join(rootDir, 'imports', parentNode, tms, 'process', subFolder))
      }
      const newFilename = path.join(rootDir, 'imports', parentNode, tms, 'process', subFolder, `${id}.json`)
      const processedFileJSONPretty = JSON.stringify(item, null, 4)
      fs.writeFileSync(newFilename, processedFileJSONPretty, 'utf-8')
    }
  })

  /* ##########################################################################

  This is where the PROCESSING ENDS

  ########################################################################## */

  //  As a seperate thing, I want to see all the fields that exist
  //  and let us know if we've found any new ones

  //  Check to see if we already have a file containing all the fields, if so read it in
  let itemFields = []
  const itemFieldsFilename = path.join(rootDir, 'imports', parentNode, tms, 'fields.json')
  if (fs.existsSync(itemFieldsFilename)) {
    itemFields = fs.readFileSync(itemFieldsFilename, 'utf-8')
    itemFields = JSON.parse(itemFields)
  }
  const itemFieldsMap = {}

  //  Now go through all the objects looking at all the keys
  //  checking to see if we already have a record of them, if so
  //  mark them as new
  itemsJSON.forEach((item) => {
    Object.keys(item).forEach((key) => {
      //  If we don't have a record, then add it to the fields
      if (!itemFields.includes(key)) {
        itemFields.push(key)
        //  If we don't already have it in the fields, then it's
        //  all new
        if (!(key in itemFieldsMap)) {
          itemFieldsMap[key] = true
        }
      } else {
        //  If we don't have it, then we need to add it to the map
        //  but it's not new as it already exists in the array
        if (!(key in itemFieldsMap)) {
          itemFieldsMap[key] = false
        }
      }
    })
  })

  //  Now write the fields back out so we can compare against them next time
  const itemFieldsJSONPretty = JSON.stringify(itemFields, null, 4)
  fs.writeFileSync(itemFieldsFilename, itemFieldsJSONPretty, 'utf-8')

  const endTime = new Date().getTime()
  tmsLogger.object(`Finished processing ${parentNode} JSON file for ${childNode} ${tms}`, {
    action: 'finished processJsonFile',
    status: 'ok',
    tms,
    type: parentNode,
    newItems,
    modifiedItems,
    totalItems,
    ms: endTime - startTime
  })

  return {
    fields: itemFieldsMap,
    type: parentNode,
    newItems,
    modifiedItems,
    totalItems,
    ms: endTime - startTime
  }
}
exports.processJsonFile = processJsonFile

/*
   ##################################################################################
   ##################################################################################
   ##################################################################################
   ##################################################################################

   The code below deals with getting the extra "perfect" details that come from
   outside of the system. Such as artisanal integers, and in the future the
   images.

   A file can only be upserted when a perfect file exists. So these go to the effort
   of making perfect files for each file waiting to be processed, once a perfect
   file has been made, then the upsert can happen.

   ##################################################################################
   ##################################################################################
   ##################################################################################
   ##################################################################################
*/

//  Go look in the process folder for files that we need to make a perfect version of
//  and make sure we have all the information in there we need
const makePerfect = async () => {
  const config = new Config()
  const tmsses = config.get('tms')

  if (tmsses === null) return

  let foundItemToUpload = false
  let processFilename = null
  let perfectFilename = null

  tmsses.forEach((tms) => {
    if (foundItemToUpload === true) return
    const tmsProcessDir = path.join(rootDir, 'imports', 'Objects', tms.stub, 'process')
    const tmsPerfectDir = path.join(rootDir, 'imports', 'Objects', tms.stub, 'perfect')
    if (fs.existsSync(tmsProcessDir)) {
      if (foundItemToUpload === true) return
      const subFolders = fs.readdirSync(tmsProcessDir)
      subFolders.forEach((subFolder) => {
        if (foundItemToUpload === true) return
        const files = fs.readdirSync(path.join(tmsProcessDir, subFolder)).filter(file => {
          const fileFragments = file.split('.')
          if (fileFragments.length !== 2) return false
          if (fileFragments[1] !== 'json') return false
          return true
        })
        files.forEach((file) => {
          if (foundItemToUpload === true) return
          //  Make sure the directories exists
          if (!fs.existsSync(tmsPerfectDir)) fs.mkdirSync(tmsPerfectDir)
          if (!fs.existsSync(path.join(tmsPerfectDir, subFolder))) fs.mkdirSync(path.join(tmsPerfectDir, subFolder))
          const testPerfectFilename = path.join(tmsPerfectDir, subFolder, file)
          if (!(fs.existsSync(testPerfectFilename))) {
            foundItemToUpload = true
            processFilename = path.join(tmsProcessDir, subFolder, file)
            perfectFilename = path.join(tmsPerfectDir, subFolder, file)
          }
        })
      })
    }
  })

  if (foundItemToUpload && processFilename !== null) {
    const processFileJSON = {}
    processFileJSON.artInt = await artisanalints.createArtisanalInt()
    const perfectFilePretty = JSON.stringify(processFileJSON, null, 4)
    fs.writeFileSync(perfectFilename, perfectFilePretty, 'utf-8')
  }
}

const startMakingPerfect = () => {
  const config = new Config()
  const timers = config.get('timers')
  let interval = 20000
  if (timers !== null && 'elasticsearch' in timers) {
    interval = parseInt(timers.elasticsearch, 10)
  }
  setInterval(() => {
    makePerfect()
  }, interval / 1.5)
  makePerfect()
}
exports.startMakingPerfect = startMakingPerfect
