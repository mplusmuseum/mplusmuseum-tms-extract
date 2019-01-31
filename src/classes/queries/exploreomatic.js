/** Class representing a collection of queries. */
class Queries {
  /**
   * Create a collection of queries
   */
  constructor () {
    this.killCache = `query {
      killCache[[]]
    }`

    this.object = `query {
      object[[]] {
        id
        publicAccess
        onView
        objectNumber
        sortNumber
        title
        titleOther
        displayDate
        displayDateOther
        beginDate
        endDate
        dimension
        creditLine
        medium
        popularCount
        objectStatus
        inscription
        archiveDescription
        objectName
        scopeNContent
        baselineDescription
        collectionType
        collectionCode
        collectionName
        department
        style
        allORC
        isRecommended
        recommendedBlurb
        blurbExternalUrl
        constituents {
          id
          name
          nameOther
          alphaSortName
          displayBio
          gender
          beginDate
          endDate
          nationality
          roles
          type
          publicAccess
          rank
          isMaker
          role
          activeCity
          artInt
          birthCity
          deathCity
          objectCount
          region
          exhibitionBios {
            purpose
            text
          }
        }
        exhibitions {
          exhibitions {
            id
            title
            type
            beginDate
            endDate
            venues {
              title
              beginDate
              endDate
            }
            section
          }
          labels {
            purpose
            text
          }
        }
        concepts {
          id
          publicAccess
          timeline
          title
          description
          displayDate
          beginDate
          endDate
          conceptUse        
        }
        objectRights {
          type
          copyright
          concatRights
          concatRemark
          currentStatus
          rights {
            title
            group
          }     
        }
        classification {
          area
          category
          archivalLevel
        }
        images {
          rank
          primaryDisplay
          publicAccess
          public_id
          status
          version
          signature
          width
          height
          format
          altText
          mediaUse
        }
        color {
          predominant {
            color
            value
          }
          search {
            google {
              color
              value
            }
            cloudinary {
              color
              value
            }
          }
        }
        relatedObjects {
          id
          relatedType
          selfType
          title
          titleOther
          publicAccess
          displayDate
          displayDateOther
          collectionType
          collectionCode
          collectionName
          department
          style
          objectStatus
          objectName
          popularCount
          classification {
            area
            category
            archivalLevel
          }
          images {
            rank
            primaryDisplay
            publicAccess
            public_id
            status
            version
            signature
            width
            height
            format
            altText
            mediaUse
          }
          color {
            predominant {
              color
              value
            }
          }
        }
        _sys {
          pagination {
            page
            perPage
            total
            maxPage
          }
        }
      }
    }`

    this.objectsRandom = `query {
      randomobjects[[]] {
        id
        title
        objectNumber
        publicAccess
        displayDate
        popularCount
        classification {
          area
          category
          archivalLevel
        }
        medium
        objectName
        objectStatus
        collectionType
        collectionCode
        collectionName
        department
        style
        color {
          predominant {
            color
            value
          }
        }
        images {
          primaryDisplay
          status
          version
          public_id
        }
        constituents {
          id
          name
        }
        relatedObjects {
          id
          relatedType
          selfType
        }
        _sys {
          pagination {
            page
            perPage
            total
            maxPage
          }
        }
      }
    }`

    this.constituent = `query {
      constituent[[]] {
        id
        name
        nameOther
        alphaSortName
        displayBio
        gender
        beginDate
        endDate
        nationality
        roles
        type
        publicAccess
        rank
        isMaker
        roles
        activeCity
        artInt
        birthCity
        deathCity
        objectCount
        region
        objects {
          id
          title
          titleOther
          publicAccess
          displayDate
          popularCount
          classification {
            area
            category
            archivalLevel
          }
          medium
          objectName
          objectStatus
          collectionType
          collectionCode
          collectionName
          department
          style
          color {
            predominant {
              color
              value
            }
          }
          images {
            primaryDisplay
            status
            version
            public_id
          }
          constituents {
            id
            name
          }
          relatedObjects {
            id
            relatedType
            selfType
          }
          _sys {
            pagination {
              page
              perPage
              total
              maxPage
            }
          }
        }
        exhibitionBios {
          purpose
          text
        }
      }
    }`

    this.objects = `query {
      objects[[]] {
        id
        title
        objectNumber
        publicAccess
        displayDate
        popularCount
        classification {
          area
          category
          archivalLevel
        }
        medium
        objectName
        objectStatus
        collectionType
        collectionCode
        collectionName
        department
        style
        color {
          predominant {
            color
            value
          }
        }
        images {
          primaryDisplay
          status
          version
          public_id
        }
        constituents {
          id
          name
        }
        relatedObjects {
          id
          relatedType
          selfType
        }
        _sys {
          pagination {
            page
            perPage
            total
            maxPage
          }
        }
      }
    }`

    this.constituentList = `query {
      constituents[[]] {
        id
        name
        alphaSortName
      }
    }`

    this.makertypes = `query {
      makertypes[[]] {
        title
      }
    }`

    this.areas = `query {
      areas[[]] {
        title
        count
      }
    }`

    this.categories = `query {
      categories[[]] {
        title
        count
      }
    }`

    this.archivalLevels = `query {
      archivalLevels[[]] {
        title
        count
      }
    }`

    this.objectNames = `query {
      names[[]] {
        title
        count
      }
    }`

    this.objectStatuses = `query {
      statuses[[]] {
        title
        count
      }
    }`

    this.collectionTypes = `query {
      collectionTypes[[]] {
        title
        count
      }
    }`

    this.collectionCodes = `query {
      collectionCodes[[]] {
        title
        count
      }
    }`

    this.collectionNames = `query {
      collectionNames[[]] {
        title
        count
      }
    }`

    this.departments = `query {
      departments[[]] {
        title
        count
      }
    }`

    this.styles = `query {
      styles[[]] {
        title
        count
      }
    }`

    this.mediums = `query {
      mediums[[]] {
        title
        count
      }
    }`

    this.exhibitions = `query {
      exhibitions[[]] {
        id
        title
      }
    }`

    this.factoids = `query {
      factoids[[]] {
        id
        text
        textTC
        isConstituent
        isArea
        isCategory
        isMedium
        isArchive
        isColour
        isRecommended
        isCollection
        isPopular
        keyword
      }
    }`

    this.exhibition = `query {
      exhibition[[]] {
        id
        title
        type
        beginDate
        endDate
        artInt
        venues {
          title
          beginDate
          endDate
        }
        objects {
          id
          title
          titleOther
          publicAccess
          displayDate
          popularCount
          classification {
            area
            category
            archivalLevel
          }
          medium
          objectName
          objectStatus
          collectionType
          collectionCode
          color {
            predominant {
              color
              value
            }
          }
          images {
            primaryDisplay
            status
            version
            public_id
          }
          constituents {
            id
            name
          }
          relatedObjects {
            id
            relatedType
            selfType
          }
          _sys {
            pagination {
              page
              perPage
              total
              maxPage
            }
          }
        }
      }
    }`
  }

  /**
   *
   * @param {string} query The name of the query, needs to match one of those defined in the constructor, i.e. 'schema', 'hello', places'
   * @param {string} filter The filter we want to apply to the query i.e. '(limit: 20)'
   * @returns {string|null} A representation of the query ready to be used if found, or null if not.
   */
  get (query, filter) {
    if (!(query in this)) return null
    if (!filter) filter = ''
    return this[query].replace('[[]]', filter)
  }
}
/** A handy query class that contains a bunch of predefined GraphQL queries */
module.exports = Queries
