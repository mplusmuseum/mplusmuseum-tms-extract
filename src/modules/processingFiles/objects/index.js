const Config = require('../../../classes/config')
const fs = require('fs')
const path = require('path')
const rootDir = path.join(__dirname, '../../../../data')
const logging = require('../../logging')
const artisanalints = require('../../artisanalints')
const utils = require('../../../modules/utils')

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
    if ('Role' in constituent || 'RoleTC' in constituent) {
      newConstituentObj.roles = {}
    }

    if ('Role' in constituent) {
      newConstituentObj.roles['en'] = constituent.Role
    }
    if ('RoleTC' in constituent) {
      newConstituentObj.roles['zh-hant'] = constituent.RoleTC
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

const getReferences = refs => {
  const references = {
    ids: [],
    idsToReference: {}
  }
  if (refs === null || refs === undefined) return null
  if (!Array.isArray(refs)) refs = [refs]
  refs.forEach((reference) => {
    //  If we have a string then we just use it, if we have an object
    //  then we need to break it down more
    if (typeof (reference) === 'string') {
      references.ids.push(parseInt(reference, 10))
    } else {
      if (reference._ && reference.pagenumber) {
        references.ids.push(parseInt(reference._, 10))
        references.idsToReference[parseInt(reference._, 10)] = reference.pagenumber
      }
    }
  })
  references.idsToReference = JSON.stringify(references.idsToReference)
  return references
}

const getRelatedObjects = objects => {
  const relatedObjects = {
    ids: [],
    idsToRelationship: []
  }
  if (objects === null || objects === undefined) return null
  if (!Array.isArray(objects)) objects = [objects]

  objects.forEach((object) => {
    const newObject = {}

    const objectId = parseInt(object._, 10)
    if (!relatedObjects.ids.includes(objectId)) relatedObjects.ids.push(objectId)

    newObject.id = objectId
    if ('RelatedType' in object) {
      newObject.relatedType = object.RelatedType
    }
    if ('SelfType' in object) {
      newObject.selfType = object.SelfType
    }
    relatedObjects.idsToRelationship.push(newObject)
  })

  //  To stop theElasticSearch trying to make a large number of fields
  //  based on this nested data, we're going to store it as a string.
  //  We don't need to ever search on it, we just need to be able to
  //  unpack it again on the other side.
  relatedObjects.idsToRelationship = JSON.stringify(relatedObjects.idsToRelationship)

  return relatedObjects
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

const getDepartment = department => {
  if (department === undefined) return null
  if (department === null) return null
  return department
}

const getCollectionName = collectionName => {
  if (collectionName === undefined) return null
  if (collectionName === null) return null
  return collectionName
}

const getStyle = style => {
  if (style === undefined) return null
  if (style === null) return null
  return style
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
        const areaObj = {
          rank: parseInt(cat.Displayorder, 10),
          areacat: {}
        }
        //  Add the languages if we have them
        if ('Classification' in cat) {
          areaObj.areacat['en'] = cat.Classification.replace('Area-', '')
        }
        if ('ClassificationTC' in cat) {
          areaObj.areacat['zh-hant'] = cat.ClassificationTC
        }
        if (!classificationsObj.area) classificationsObj.area = []
        classificationsObj.area.push(areaObj)
      }

      //  If we have an category then put it there
      if (catSplit === 'Category') {
        const categoryObj = {
          rank: parseInt(cat.Displayorder, 10),
          areacat: {}
        }
        //  Add the languages if we have them
        if ('Classification' in cat) {
          categoryObj.areacat['en'] = cat.Classification.replace('Category-', '')
        }
        if ('ClassificationTC' in cat) {
          categoryObj.areacat['zh-hant'] = cat.ClassificationTC
        }
        if (!classificationsObj.category) classificationsObj.category = []
        classificationsObj.category.push(categoryObj)
      }
      //  If we have an category then put it there
      if (catSplit === 'Archival Level') {
        const archivalLevelObj = {
          rank: parseInt(cat.Displayorder, 10),
          areacat: {}
        }
        //  Add the languages if we have them
        if ('Classification' in cat) {
          archivalLevelObj.areacat['en'] = cat.Classification.replace('Archival Level-', '')
        }
        if ('ClassificationTC' in cat) {
          archivalLevelObj.areacat['zh-hant'] = cat.ClassificationTC
        }
        if (!classificationsObj.archivalLevel) classificationsObj.archivalLevel = []
        classificationsObj.archivalLevel.push(archivalLevelObj)
      }
    }
  })
  return classificationsObj
}

const getThings = (classifications, thing) => {
  const thingsObj = {
    lang: {}
  }
  if (!Array.isArray(classifications)) {
    classifications = [classifications]
  }

  classifications.forEach((cat) => {
    let node = null
    let lang = null
    let title = null
    let catSplit = null

    //  Get the area or category

    //  If we have an area then put it there
    if ('Classification' in cat) {
      node = 'Classification'
      catSplit = cat[node].split('-')[0]
      if (catSplit === thing) {
        lang = 'en'
        if (!(lang in thingsObj.lang)) {
          thingsObj.lang[lang] = {
            slug: [],
            title: []
          }
        }
        title = cat[node].replace(`${thing}-`, '')
        thingsObj.lang[lang].title.push(title)
        thingsObj.lang[lang].slug.push(utils.slugify(title))

        if ('ClassificationTC' in cat) {
          node = 'ClassificationTC'
          lang = 'zh-hant'
          if (!(lang in thingsObj.lang)) {
            thingsObj.lang[lang] = {
              slug: [],
              title: []
            }
          }
          title = cat[node]
          thingsObj.lang[lang].title.push(title)
          thingsObj.lang[lang].slug.push(utils.slugify(title))
        }
      }
    }
  })
  return thingsObj
}

const getArchivalLevelScore = classifications => {
  let score = 0
  if (!Array.isArray(classifications)) {
    classifications = [classifications]
  }
  classifications.forEach((cat) => {
    //  Get the area or category
    if ('Classification' in cat) {
      const catSplit = cat.Classification.split('-')[0]
      //  If we have an category then put it there
      if (catSplit === 'Archival Level') {
        //  Add the languages if we have them
        if ('Classification' in cat) {
          const level = cat.Classification.replace('Archival Level-', '')
          if (level === 'Fonds') score = 50
          if (level === 'Sub-fonds') score = 46
          if (level === 'Series') score = 42
          if (level === 'Subseries') score = 38
          if (level === 'Sub-subseries') score = 34
          if (level === 'Piece') score = 30
          if (level === 'File') score = 26
          if (level === 'Item') score = 22
        }
      }
    }
  })
  return score
}

const getDimensionDetails = dimensionDetails => {
  if (dimensionDetails === undefined || dimensionDetails === null) return null
  if (!Array.isArray(dimensionDetails)) dimensionDetails = [dimensionDetails]
  return dimensionDetails.map((details) => {
    const newDetails = {
      rank: null,
      element: null,
      unit: null,
      height: null,
      width: null
    }
    try {
      newDetails.rank = parseInt(details.Rank)
    } catch (er) {
      newDetails.rank = null
    }
    try {
      newDetails.element = details.Element.trim()
    } catch (er) {
      newDetails.element = null
    }
    try {
      newDetails.unit = details.Unit.trim()
    } catch (er) {
      newDetails.unit = null
    }
    try {
      newDetails.height = parseFloat(details.Height)
    } catch (er) {
      newDetails.height = null
    }
    try {
      newDetails.width = parseFloat(details.Width)
    } catch (er) {
      newDetails.width = null
    }
    try {
      let newDepth = parseFloat(details.Depth)
      if (newDepth !== null) {
        newDetails.depth = parseFloat(details.Depth)
      }
    } catch (er) {
      details.Depth = null // do nothing
    }
    return newDetails
  })
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
    if (typeof (label) === 'object') {
      if ('_' in label && 'Purpose' in label) {
        return {
          'purpose': label.Purpose,
          'text': label._
        }
      }
      if ((label.EL || label.ELHTML || label.ELTC || label.ELTCHTML) && label.Purpose) {
        const newThing = {
          'purpose': label.Purpose
        }
        if (label.ExhibitionID) newThing.exhibitionID = label.ExhibitionID
        if (label.Date) newThing.date = label.Date
        if (label.EL) newThing.text = label.EL
        if (label.ELTC) newThing.text = label.ELTC
        if (label.ELHTML) newThing.html = label.ELHTML
        if (label.ELTCHTML) newThing.html = label.ELTCHTML
        return newThing
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
      //  Turn the media use node into an array if we have it
      if (media.MediaUse !== null && !Array.isArray(media.MediaUse)) {
        media.MediaUse = [media.MediaUse]
      }
      media.mediaUse = media.MediaUse
      delete media._
      delete media.Rank
      delete media.PrimaryDisplay
      delete media.PublicAccess
      delete media.MediaUse
      return media
    }
  }).filter(Boolean)
}

const getObjectRights = objectRights => {
  if (objectRights === undefined || objectRights === null) return null
  if (Array.isArray(objectRights)) objectRights = objectRights[0]
  const objectRightsObj = {
    type: objectRights.ObjRightsType,
    copyright: objectRights.CopyRight,
    concatRights: objectRights.ConcatRights,
    concatRemark: objectRights.ConcatRightsRemark,
    currentStatus: null,
    rights: null
  }
  if (objectRights.ObjectRights) {
    if (!Array.isArray(objectRights.ObjectRights)) objectRights.ObjectRights = [objectRights.ObjectRights]
    objectRightsObj.rights = []
    objectRights.ObjectRights.forEach((right) => {
      if (right.RightsGroup === 'Current status') {
        objectRightsObj.currentStatus = right._
      } else {
        objectRightsObj.rights.push({
          title: right._,
          group: right.RightsGroup
        })
      }
    })
  }
  return objectRightsObj
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
    objectNumberSlug: utils.slugify(item.ObjectNumber),
    sortNumber: getSortnumber(item.SortNumber),
    department: getDepartment(item.Department),
    collectionName: getCollectionName(item.CollectionName),
    style: getStyle(item.Style),
    classification: getClassifications(item.AreaCat),
    areas: getThings(item.AreaCat, 'Area'),
    category: getThings(item.AreaCat, 'Category'),
    archivalLevel: getThings(item.AreaCat, 'Archival Level'),
    archivalLevelScore: getArchivalLevelScore(item.AreaCat),
    consituents: getConstituents(item.ObjectRelatedConstituents),
    exhibition: {
      ids: getExhibitionIds(item.RelatedExhibitionID),
      sections: getExhibitionSections(item.RelatedExhibitionID),
      exhibitionLabelText: {}
    },
    relatedEventIds: forceIDArray(item.RelatedEventID),
    relatedConceptIds: forceIDArray(item.RelatedConceptID),
    references: getReferences(item.ReferenceID),
    allORC: item.AllORC,
    title: {
      'en': null,
      'zh-hant': null
    },
    titleSlug: {},
    objectStatus: {},
    objectStatusSlug: {},
    displayDate: {},
    beginDate: parseFloat(item.DateBegin),
    endDate: parseFloat(item.Dateend),
    dimension: {},
    dimensionDetails: getDimensionDetails(item.DimensionDetails),
    medium: {},
    mediumSlug: {},
    creditLine: {},
    inscription: {},
    archiveDescription: {},
    objectName: {},
    objectNameSlug: {},
    scopeNContent: {},
    scopeNContentHTML: {},
    randomFact: {},
    randomFactHTML: {},
    baselineDescription: {},
    baselineDescriptionHTML: {},
    images: getMedia(item.Media),
    objectRights: getObjectRights(item.MplusRights),
    id: parseInt(item.ObjectID, 10)
  }

  //  Now drop in all the languages
  if ('TitleEN' in item) newItem.title['en'] = item.TitleEN
  if ('TitleTC' in item) newItem.title['zh-hant'] = item.TitleTC

  const objectNumberSlug = utils.slugify(item.ObjectNumber)
  newItem.slug = `${objectNumberSlug}`
  newItem.titleSlug['en'] = `${objectNumberSlug}`
  newItem.titleSlug['zh-hant'] = `${objectNumberSlug}`

  if ('TitleEN' in item) {
    newItem.slug = `${utils.slugify(item.TitleEN)}-${newItem.slug}`
    newItem.titleSlug['en'] = `${utils.slugify(item.TitleEN)}-${newItem.titleSlug['en']}`
  }
  if ('TitleTC' in item) newItem.titleSlug['zh-hant'] = `${utils.slugify(item.TitleTC)}-${newItem.titleSlug['zh-hant']}`

  if ('Objectstatus' in item) newItem.objectStatus['en'] = item.Objectstatus
  if ('ObjectstatusTC' in item) newItem.objectStatus['zh-hant'] = item.ObjectstatusTC
  if ('Objectstatus' in item) newItem.objectStatusSlug['en'] = utils.slugify(item.Objectstatus)
  if ('ObjectstatusTC' in item) newItem.objectStatusSlug['zh-hant'] = utils.slugify(item.ObjectstatusTC)
  if ('Dated' in item) newItem.displayDate['en'] = item.Dated
  if ('DateTC' in item) newItem.displayDate['zh-hant'] = item.DateTC
  if ('Dimensions' in item) newItem.dimension['en'] = item.Dimensions
  if ('DimensionTC' in item) newItem.dimension['zh-hant'] = item.DimensionTC
  if ('Medium' in item) newItem.medium['en'] = item.Medium
  if ('MediumTC' in item) newItem.medium['zh-hant'] = item.MediumTC
  if ('Medium' in item) newItem.mediumSlug['en'] = utils.slugify(item.Medium)
  if ('MediumTC' in item) newItem.mediumSlug['zh-hant'] = utils.slugify(item.MediumTC)
  if ('CreditLine' in item) newItem.creditLine['en'] = item.CreditLine
  if ('CreditlineTC' in item) newItem.creditLine['zh-hant'] = item.CreditlineTC
  if ('ExhibitionLabelText' in item) newItem.exhibition.exhibitionLabelText['en'] = getExhibitionLabelText(item.ExhibitionLabelText)
  if ('ExhibitionLabelTextTC' in item) newItem.exhibition.exhibitionLabelText['zh-hant'] = getExhibitionLabelText(item.ExhibitionLabelTextTC)
  if ('Inscription' in item) newItem.inscription['en'] = item.Inscription
  if ('InscriptionTC' in item) newItem.inscription['zh-hant'] = item.InscriptionTC
  if ('ArchiveDescription' in item) newItem.archiveDescription['en'] = item.ArchiveDescription
  if ('ArchiveDescriptionTC' in item) newItem.archiveDescription['zh-hant'] = item.ArchiveDescriptionTC
  if ('ObjectName' in item) newItem.objectName['en'] = item.ObjectName
  if ('ObjectNameTC' in item) newItem.objectName['zh-hant'] = item.ObjectNameTC
  if ('ObjectName' in item) newItem.objectNameSlug['en'] = utils.slugify(item.ObjectName)
  if ('ObjectNameTC' in item) newItem.objectNameSlug['zh-hant'] = item.ObjectNameTC

  if ('ScopeNContent' in item) {
    //  If we have languages within the baselineDescription then we need to handle it
    if (typeof (item.ScopeNContent) === 'string') {
      newItem.scopeNContent['en'] = item.ScopeNContent
    } else {
      //  If it's an object then we need to check for normal and HTML inside it
      if (typeof (item.ScopeNContent) === 'object') {
        if (item.ScopeNContent.SNC) newItem.scopeNContent['en'] = item.ScopeNContent.SNC
        if (item.ScopeNContent.SNCHTML) newItem.scopeNContentHTML['en'] = item.ScopeNContent.SNCHTML
      }
    }
  }

  if ('ScopeNContentTC' in item) {
    //  If we have languages within the baselineDescription then we need to handle it
    if (typeof (item.ScopeNContentTC) === 'string') {
      newItem.scopeNContent['zh-hant'] = item.ScopeNContentTC
    } else {
      //  If it's an object then we need to check for normal and HTML inside it
      if (typeof (item.ScopeNContentTC) === 'object') {
        if (item.ScopeNContentTC.SNCTC) newItem.scopeNContent['zh-hant'] = item.ScopeNContentTC.SNCTC
        if (item.ScopeNContentTC.SNCTCHTML) newItem.scopeNContentHTML['zh-hant'] = item.ScopeNContentTC.SNCTCHTML
      }
    }
  }

  if ('RandomFact' in item) {
    //  If we have languages within the baselineDescription then we need to handle it
    if (typeof (item.RandomFact) === 'string') {
      newItem.randomFact['en'] = item.RandomFact
    } else {
      //  If it's an object then we need to check for normal and HTML inside it
      if (typeof (item.RandomFact) === 'object') {
        if (item.RandomFact.RF) newItem.randomFact['en'] = item.RandomFact.RF
        if (item.RandomFact.RFHTML) newItem.randomFactHTML['en'] = item.RandomFact.RFHTML
      }
    }
  }

  if ('RandomFactTC' in item) {
    //  If we have languages within the baselineDescription then we need to handle it
    if (typeof (item.RandomFactTC) === 'string') {
      newItem.randomFact['zh-hant'] = item.RandomFactTC
    } else {
      //  If it's an object then we need to check for normal and HTML inside it
      if (typeof (item.RandomFactTC) === 'object') {
        if (item.RandomFactTC.RFTC) newItem.randomFact['zh-hant'] = item.RandomFactTC.RFTC
        if (item.RandomFactTC.RFTCHTML) newItem.randomFactHTML['zh-hant'] = item.RandomFactTC.RFTCHTML
      }
    }
  }

  if ('BaselineDescription' in item) {
    //  If we have languages within the baselineDescription then we need to handle it
    if (typeof (item.BaselineDescription) === 'string') {
      newItem.baselineDescription['en'] = item.BaselineDescription
    } else {
      //  If it's an object then we need to check for normal and HTML inside it
      if (typeof (item.BaselineDescription) === 'object') {
        if (item.BaselineDescription.BLD) newItem.baselineDescription['en'] = item.BaselineDescription.BLD
        if (item.BaselineDescription.BLDHTML) newItem.baselineDescriptionHTML['en'] = item.BaselineDescription.BLDHTML
      }
    }
  }

  if ('BaselineDescriptionTC' in item) {
    //  If we have languages within the baselineDescription then we need to handle it
    if (typeof (item.BaselineDescriptionTC) === 'string') {
      newItem.baselineDescription['zh-hant'] = item.BaselineDescriptionTC
    } else {
      //  If it's an object then we need to check for normal and HTML inside it
      if (typeof (item.BaselineDescriptionTC) === 'object') {
        if (item.BaselineDescriptionTC.BLDTC) newItem.baselineDescription['zh-hant'] = item.BaselineDescriptionTC.BLDTC
        if (item.BaselineDescriptionTC.BLDTCHTML) newItem.baselineDescriptionHTML['zh-hant'] = item.BaselineDescriptionTC.BLDTCHTML
      }
    }
  }

  if (Object.entries(newItem.title).length === 0) newItem.title = null
  if (Object.entries(newItem.objectStatus).length === 0) newItem.objectStatus = null
  if (Object.entries(newItem.displayDate).length === 0) newItem.displayDate = null
  if (Object.entries(newItem.dimension).length === 0) newItem.dimension = null
  if (Object.entries(newItem.medium).length === 0) newItem.medium = null
  if (Object.entries(newItem.creditLine).length === 0) newItem.creditLine = null

  //  Related objects
  if (item.RelatedObjectID) {
    newItem.relatedObjectIds = getRelatedObjects(item.RelatedObjectID)
  }

  // Do the collection type
  if (item.ObjectNumber.length >= 2) {
    const possibleCollectionType = item.ObjectNumber.slice(0, 2)
    if (possibleCollectionType === 'CA' || possibleCollectionType === 'CL') {
      newItem.collectionType = possibleCollectionType
    }
    if (possibleCollectionType === 'CA') {
      const collectionCodeSplit = item.ObjectNumber.split('/')
      newItem.collectionCode = collectionCodeSplit[0]
    }
  }

  //  CollectionName
  if (item.CollectionName) newItem.collectionName = item.CollectionName
  if (newItem.collectionName === null || newItem.collectionName === undefined || newItem.collectionName === '') {
    if (newItem.department === 'Archives') newItem.collectionName = 'M+ Collection Archives'
    if (newItem.department === 'Library') newItem.collectionName = 'M+ Library Special Collection'
    if (newItem.department === 'Collection') newItem.collectionName = 'M+ Collection'
  }

  newItem.departmentSlug = utils.slugify(newItem.department)
  newItem.collectionNameSlug = utils.slugify(newItem.collectionName)
  newItem.styleSlug = utils.slugify(newItem.style)

  //  Clean up empty fields
  const emptyJSON = '{}'
  const fieldsToScrub = ['scopeNContent', 'scopeNContentHTML']
  fieldsToScrub.forEach((field) => {
    if (newItem[field] && JSON.stringify(newItem[field]) === emptyJSON) newItem[field] = null
  })

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
    action: 'start processJsonFile',
    status: 'info',
    tms,
    type: parentNode
  })

  const filename = path.join(rootDir, 'imports', parentNode, tms, 'items.json')
  if (!fs.existsSync(filename)) {
    tmsLogger.object(`Failed processing ${parentNode} JSON file for ${childNode} ${tms}`, {
      action: `finished processJsonFile`,
      status: 'error',
      tms,
      type: parentNode,
      filename,
      ms: new Date().getTime() - startTime
    })
    return
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
        //  Remove it from the processed fold, to force us to reupload it
        fs.unlinkSync(filename)
        modifiedItems += 1
        needToUpload = true
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
