exports.schema = `query {
  __schema {
    types {
      description
      fields {
        args {
          name
          type {
            name
          }
          defaultValue
        }
        description
        name
        type {
          name
        }
      }
      kind
      name
    }
  }
}`

exports.type = `query {
  __type[[]] {
    name
    kind
    description
    fields {
      args {
        description
        defaultValue
      }
      description
      name
      type {        
        possibleTypes {
          name
          description
        }
        name
        description
      }
    }
  }
}`

exports.artworks = `query {
  artworks[[]] {
    id
  }
}`

exports.artwork = `query {
  artwork[[]] {
    id
    areacategories {
      rank
      type
      areacat {
        lang
        text
      }
    }
    areacategory_concat {
      value
    }
    makers {
      maker
      rank
      nationality
      name
      makernameid
      birthyear_yearformed
      deathyear
      roles {
        lang
        text
      }
    }
    makers_concat {
      id
      makerNames
      makerNationalities
      makerBeginDate
      makerEndDate
      makers
    }
    copyrightcreditlines {
      lang
      text
    }
    creditlines {
      lang
      text
    }
    datebegin
    dateend
    dimensions {
      lang
      text
    }
    exhibitions {
      begindate
      enddate
      ExhibitionID
      Section
      title {
        lang
        text
      }
      venues {
        begindate
        enddate
        name {
          lang
          text
        }
      }
    }
    exhibitions_concat {
      ObjectID
      exhinfo
    }
    exhlabels {
      text
      lang
      purpose
    }
    medias {
      rank
      PublicAccess
      primarydisplay
      filename
      alttext
      imagecreditlines
      imagecaption
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
    mediums {
      lang
      text
    }
    MPlusRights {
      ObjRightsID
      ObjectID
      ObjRightsTypeID
      ObjRightsType
      ContractNumber
      CopyrightRegNumber
      Copyright
      Restrictions
      AgreementSentISO
      AgreementSignedISO
      ExpirationISODate
      CreditLineRepro
    }
    MPlusRightsFlexFields {
      RightGroup
      Value
      Date
      Remarks
    }
    MPlusRightsFlexFieldsConcat {
      Rights
    }
    objectnumber
    objectstatus {
      lang
      text
    }
    PublicAccess
    summaries
    titles {
      lang
      text
    }
    dated
  }
}`

exports.artworksMedium = `query {
  artworks[[]] {
    id
    areacategories {
      rank
      type
      areacat {
        lang
        text
      }
    }
    makers {
      maker
      rank
      nationality
      name
      makernameid
      birthyear_yearformed
      deathyear
      roles {
        lang
        text
      }
    }
    exhibitions {
      begindate
      enddate
      ExhibitionID
      title {
        lang
        text
      }
    }
    medias {
      rank
      PublicAccess
      primarydisplay
      filename
      alttext
      imagecreditlines
      imagecaption
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
    mediums {
      lang
      text
    }
    objectnumber
    objectstatus {
      lang
      text
    }
    titles {
      lang
      text
    }
  }
}`

exports.artworksLong = `query {
  artworks[[]] {
    id
    areacategories {
      rank
      type
      areacat {
        lang
        text
      }
    }
    areacategory_concat {
      value
    }
    makers {
      maker
      rank
      nationality
      name
      makernameid
      birthyear_yearformed
      deathyear
      roles {
        lang
        text
      }
    }
    makers_concat {
      id
      makerNames
      makerNationalities
      makerBeginDate
      makerEndDate
      makers
    }
    copyrightcreditlines {
      lang
      text
    }
    creditlines {
      lang
      text
    }
    datebegin
    dateend
    dimensions {
      lang
      text
    }
    exhibitions {
      begindate
      enddate
      ExhibitionID
      Section
      title {
        lang
        text
      }
      venues {
        begindate
        enddate
        name {
          lang
          text
        }
      }
    }
    exhibitions_concat {
      ObjectID
      exhinfo
    }
    exhlabels {
      text
      lang
      purpose
    }
    medias {
      rank
      PublicAccess
      primarydisplay
      filename
      alttext
      imagecreditlines
      imagecaption
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
    mediums {
      lang
      text
    }
    MPlusRights {
      ObjRightsID
      ObjectID
      ObjRightsTypeID
      ObjRightsType
      ContractNumber
      CopyrightRegNumber
      Copyright
      Restrictions
      AgreementSentISO
      AgreementSignedISO
      ExpirationISODate
      CreditLineRepro
    }
    MPlusRightsFlexFields {
      RightGroup
      Value
      Date
      Remarks
    }
    MPlusRightsFlexFieldsConcat {
      Rights
    }
    objectnumber
    objectstatus {
      lang
      text
    }
    PublicAccess
    summaries
    titles {
      lang
      text
    }
    dated
  }
}`

exports.makers = `query {
  makers[[]] {
    id
  }
}`

exports.maker = `query {
  maker[[]] {
    id
    birthyear_yearformed
    deathyear
    type
    publicaccess
    nationality
    names {
      id
      lang
      firstname
      lastname
      alphasort
      displayname
      institution
    }
    places {
      type
      placename {
        lang
        text
      }
      placenamesearch {
        lang
        text
      }
      nation {
        lang
        text
      }
      continent {
        lang
        text
      }
    }
    bios {
      lang
      text
    }
  }
}`

exports.categories = `query {
  categories[[]] {
    text
    lang
  }
}`

exports.mediums = `query {
  mediums[[]] {
    text
    lang
  }
}`

exports.areas = `query {
  areas[[]] {
    text
    lang
  }
}`
