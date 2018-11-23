/** Class representing a collection of queries. */
class Queries {
  /**
   * Create a collection of queries
   */
  constructor () {
    this.object = `query {
      object[[]] {
        id
        title
        displayDate
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
      }
    }`

    this.objectsRandom = `query {
      randomobjects[[]] {
        id
        title
        displayDate
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
      }
    }`

    this.constituent = `query {
      constituent[[]] {
        id
        name
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
          displayDate
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
            rank
            role
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
        displayDate
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
      makertypes {
        title
      }
    }`

    this.areas = `query {
      areas[[]] {
        title
      }
    }`

    this.categories = `query {
      categories[[]] {
        title
      }
    }`

    this.mediums = `query {
      mediums[[]] {
        title
      }
    }`

    this.exhibitions = `query {
      exhibitions {
        id
        title
      }
    }`

    this.exhibition = `query {
      exhibition[[]] {
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
        objects {
          id
          title
          displayDate
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
            rank
            role
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
