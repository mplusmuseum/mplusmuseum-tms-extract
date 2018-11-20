/** Class representing a collection of queries. */
class Queries {
  /**
   * Create a collection of queries
   */
  constructor () {
    this.objectsRandom = `query {
      randomobjects {
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
  }

  /**
   *
   * @param {string} query The name of the query, needs to match one of those defined in the constructor, i.e. 'schema', 'hello', places'
   * @param {string} filter The filter we want to apply to the query i.e. '(limit: 20)'
   * @returns {string|null} A representation of the query ready to be used if found, or null if not.
   */
  get (query, filter) {
    if (!(query in this)) return null
    return this[query].replace('[[]]', filter)
  }
}
/** A handy query class that contains a bunch of predefined GraphQL queries */
module.exports = Queries
