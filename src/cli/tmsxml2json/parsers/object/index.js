/*
const knownFields = {
  areacategories: true,
  areacategory_concat: true,
  authors: true,
  authors_concat: true,
  copyrightcreditlines: true,
  creditlines: true,
  datebegin: true,
  dated: true,
  dateend: true,
  dimensions: true,
  exhibitions: true,
  exhibitions_concat: true,
  exhlabels: true,
  id: true,
  medias: true,
  mediums: true,
  MPlusRights: true,
  MPlusRightsFlexFields: true,
  objectnumber: true,
  objectstatus: true,
  PublicAccess: true,
  summaries: true,
  titles: true
}
*/

/* Current GraphQL query
{
  artwork(id: 1814) {
    id
    objectNumber
    area {
      id
    }
    areacategories {
      rank
      type
    }
    dated
    category {
      id
    }
    creditLines {
      lang
      text
    }
    dated
    dateEnd
    dateBegin
    dimensions {
      lang
      text
    }
    makers {
      id
      birthyear_yearformed
      deathyear
      name
      rank
      roles {
        lang
        text
      }
    }
    medium {
      id
      artworks {
        id
      }
      makers {
        id
      }
      name {
        lang
        text
      }

    }
    medias {
      rank
      primarydisplay
      filename
      exists
      remote
      width
      height
      baseUrl
      squareUrl
      smallUrl
      mediumUrl
      largeUrl
    }
    objectNumber
    objectStatus {
      lang
      text
    }
    titles {
      lang
      text
    }
  }
}
*/

/*
These are all the cool parse functions to get the data into the right format
*/
const parseInnerText = text => ({
  text: text._,
  lang: text.lang
})

const parseText = text => {
  if (Array.isArray(text)) {
    return parseObjectOrArray(text, parseInnerText)
  }
  return parseInnerText(text)
}

const parseObjectOrArray = (obj, fn) => {
  if (obj === null || obj === undefined) return null
  let rtnObject = null

  if (Array.isArray(obj)) {
    rtnObject = obj.map(fn)
  }
  if (typeof obj === 'object') {
    rtnObject = Object.values(obj).map(fn)
  }
  if (rtnObject !== null) {
    //  See if we have a single array inside an array
    //  if so pop it up
    if (
      Array.isArray(rtnObject) &&
      rtnObject.length === 1 &&
      Array.isArray(rtnObject[0])
    ) {
      rtnObject = rtnObject[0]
    }
    //  Get rid of empty arrays
    rtnObject = rtnObject.filter(arr => {
      if (Array.isArray(arr) && arr.length === 0) return false
      return true
    })
    //  Check for array in array _again_
    if (
      Array.isArray(rtnObject) &&
      rtnObject.length === 1 &&
      Array.isArray(rtnObject[0])
    ) {
      rtnObject = rtnObject[0]
    }
    return rtnObject
  }
  return null
}

const parseAreaCategory = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.rank
    delete item.type
    delete item.areacat
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      rank: parseInt(item.rank, 10),
      type: item.type,
      areacat: item.areacat ? item.areacat.map(parseText) : null
    }
  })
  return rtnArray
}

const parseAreaCategoryConcat = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.value
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      value: item.value
    }
  })
  return rtnArray
}

const parseMedia = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.rank
    delete item.primarydisplay
    delete item.filename
    delete item.PublicAccess
    delete item.imagecreditlines
    delete item.imagecaption
    delete item.alttext
    if (Object.entries(item).length > 0) console.log(item)
    */
    const rtnObject = {
      rank: parseInt(item.rank, 10),
      PublicAccess: parseInt(item.PublicAccess, 10) === 1,
      primarydisplay: parseInt(item.primarydisplay, 10) === 1,
      filename: item.filename,
      alttext: item.alttext ? parseText(item.alttext.alttext) : null
    }

    if (item.imagecreditlines) {
      rtnObject.imagecreditlines = parseText(
        item.imagecreditlines.imagecreditline
      )
    } else {
      rtnObject.imagecreditlines = null
    }

    if (item.imagecaption) {
      rtnObject.imagecaption = parseText(item.imagecaption.imagecaption)
    } else {
      rtnObject.imagecaption = null
    }

    return rtnObject
  })
  return rtnArray
}

const parseAuthors = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.rank
    delete item.author
    delete item.authornameid
    delete item.nationality
    delete item.name
    delete item.birthyear_yearformed
    delete item.deathyear
    delete item.roles
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      rank: parseInt(item.rank, 10),
      maker: parseInt(item.author, 10),
      makernameid: parseInt(item.authornameid, 10),
      nationality: item.nationality,
      name: item.name,
      birthyear_yearformed: parseInt(item.birthyear_yearformed, 10),
      deathyear: parseInt(item.deathyear, 10),
      roles: parseObjectOrArray(item.roles, parseText)
    }
  })
  return rtnArray
}

const parseAuthorsConcat = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.ID
    delete item.authorNames
    delete item.authorNationalities
    delete item.authorBeginDate
    delete item.authorEndDate
    delete item.authors
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      id: item.ID,
      makerNames: item.authorNames,
      makerNationalities: item.authorNationalities,
      makerBeginDate: item.authorBeginDate,
      makerEndDate: item.authorEndDate,
      makers: item.authors
    }
  })
  return rtnArray
}

const parseExhibitionsConcat = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.ObjectID
    delete item.exhinfo
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      ObjectID: item.ObjectID,
      exhinfo: item.exhinfo
    }
  })
  return rtnArray
}

const parseDate = date => new Date(date)

const parseVenues = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.begindate
    delete item.enddate
    delete item.name
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      begindate: parseDate(item.begindate),
      enddate: parseDate(item.enddate),
      name: parseObjectOrArray(item.name, parseText)
    }
  })
  return rtnArray
}

const parseExhibitions = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.begindate
    delete item.enddate
    delete item.title
    delete item.venues
    delete item.ExhibitionID
    delete item.Section
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      begindate: parseDate(item.begindate),
      enddate: parseDate(item.enddate),
      ExhibitionID: item.ExhibitionID,
      Section: item.Section,
      title: item.title ? parseText(item.title.title) : null,
      venues: parseObjectOrArray(item.venues, parseVenues)
    }
  })
  return rtnArray
}

const parseMPlusRights = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item.ObjRightsID
    delete item.ObjectID
    delete item.ObjRightsTypeID
    delete item.ObjRightsType
    delete item.ContractNumber
    delete item.CopyrightRegNumber
    delete item.Copyright
    delete item.Restrictions
    delete item.CreditLineRepro
    delete item.AgreementSentISO
    delete item.AgreementSignedISO
    delete item.ExpirationISODate
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      ObjRightsID: parseInt(item.ObjRightsID, 10),
      ObjectID: parseInt(item.ObjectID, 10),
      ObjRightsTypeID: parseInt(item.ObjRightsTypeID, 10),
      ObjRightsType: item.ObjRightsType,
      ContractNumber: item.ContractNumber,
      CopyrightRegNumber: item.CopyrightRegNumber,
      Copyright: item.Copyright,
      Restrictions: item.Restrictions,
      AgreementSentISO: item.AgreementSentISO,
      AgreementSignedISO: item.AgreementSignedISO,
      ExpirationISODate: item.ExpirationISODate,
      CreditLineRepro: item.CreditLineRepro
    }
  })
  return rtnArray
}

const parseExhlabels = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry.map(item => {
    /* A curios way to check we have all the fields
    delete item._
    delete item.lang
    delete item.purpose
    if (Object.entries(item).length > 0) console.log(item)
    */
    return {
      text: item._,
      lang: item.lang,
      purpose: item.purpose
    }
  })
  return rtnArray
}

const parseMPlusRightsFlexFields = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry
    .map(item => {
      /* A curios way to check we have all the fields
      delete item.RightGroup
      delete item.Value
      delete item.Date
      delete item.Remarks
      if (Object.entries(item).length > 0) console.log(item)
      */
      if ('Rights' in item) return null
      return {
        RightGroup: item.RightGroup,
        Value: item.Value,
        Date: item.Value,
        Remarks: item.Value
      }
    })
    .filter(item => item !== null)
  return rtnArray
}

const parseMPlusRightsFlexFieldsConcat = entry => {
  if (entry === null || entry === undefined) return null
  let newEntry = entry
  if (Array.isArray(newEntry) === false) newEntry = [newEntry]
  const rtnArray = newEntry
    .map(item => {
      if (!('Rights' in item)) return null
      return {
        Rights: item.Rights,
        Remarks: item.Value
      }
    })
    .filter(item => item !== null)
  return rtnArray
}

const parseObject = o => {
  const newObject = {
    id: parseInt(o.id, 10),
    areacategories: parseObjectOrArray(o.areacategories, parseAreaCategory),
    areacategory_concat: parseObjectOrArray(
      o.areacategory_concat,
      parseAreaCategoryConcat
    ),
    makers: parseObjectOrArray(o.authors, parseAuthors),
    makers_concat: parseObjectOrArray(o.authors_concat, parseAuthorsConcat),
    copyrightcreditlines: parseObjectOrArray(o.copyrightcreditlines, parseText),
    creditlines: parseObjectOrArray(o.creditlines, parseText),
    datebegin: parseFloat(o.datebegin),
    dated: o.dated,
    dateend: parseFloat(o.dateend),
    dimensions: parseObjectOrArray(o.dimensions, parseText),
    exhibitions: parseObjectOrArray(o.exhibitions, parseExhibitions),
    exhibitions_concat: parseObjectOrArray(
      o.exhibitions_concat,
      parseExhibitionsConcat
    ),
    exhlabels: parseObjectOrArray(o.exhlabels, parseExhlabels),
    medias: parseObjectOrArray(o.medias, parseMedia),
    mediums: parseObjectOrArray(o.mediums, parseText),
    MPlusRights: parseObjectOrArray(o.MPlusRights, parseMPlusRights),
    MPlusRightsFlexFields: parseObjectOrArray(
      o.MPlusRightsFlexFields,
      parseMPlusRightsFlexFields
    ),
    MPlusRightsFlexFields_concat: parseObjectOrArray(
      o.MPlusRightsFlexFields,
      parseMPlusRightsFlexFieldsConcat
    ),
    objectnumber: o.objectnumber,
    objectstatus: parseObjectOrArray(o.objectstatus, parseText),
    PublicAccess: parseInt(o.PublicAccess, 10) === 1,
    summaries: parseObjectOrArray(o.summaries, parseText),
    titles: parseObjectOrArray(o.titles, parseText)
  }
  return newObject
}

exports.parseJson = json => {
  return parseObject(json)
}
