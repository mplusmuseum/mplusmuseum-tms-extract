/** Class representing a collection of queries. */
class Queries {
  /**
   * Create a collection of queries
   */
  constructor() {
    this.schema = `query {
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
    this.type = `query {
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

    this.hello = `query {
  hello[[]]
}`

    this.objectMini = `query {
  object[[]] {
    id
  }
}`

    this.objectMedium = `query {
  object[[]] {
    id
    objectNumber
    title
    displayDate
    medium
    classification {
      area
      category
    }
  }
}`

    this.objectLarge = `query {
  object[[]] {
    id
    publicAccess
    objectNumber
    sortNumber
    title
    displayDate
    beginDate
    endDate
    dimension
    creditLine
    medium
    classification {
      area
      category
    }
  }
}`

    this.objectsMini = `query {
  objects[[]] {
    id
  }
}`

    this.objectsMedium = `query {
  objects[[]] {
    id
    objectNumber
    title
    displayDate
    medium
    classification {
      area
      category
    }
  }
}`

    this.objectsLarge = `query {
  objects[[]] {
    id
    publicAccess
    objectNumber
    sortNumber
    title
    displayDate
    beginDate
    endDate
    dimension
    creditLine
    medium
    classification {
      area
      category
    }
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

    this.mediums = `query {
  mediums[[]] {
    title
    count
  }
}`
  }

  /**
   *
   * @param {string} query The name of the query, needs to match one of those defined in the constructor, i.e. 'schema', 'hello', places'
   * @param {string} filter The filter we want to apply to the query i.e. '(limit: 20)'
   * @returns {string|null} A representation of the query ready to be used if found, or null if not.
   */
  get(query, filter) {
    if (!(query in this)) return null
    return this[query].replace('[[]]', filter)
  }
}
/** A handy query class that contains a bunch of predefined GraphQL queries */
module.exports = Queries

/*
exports.schema = `
type Query {
  hello: String
  objects(
    page: Int
    per_page: Int
    lang: String = "en"
    sort: String = "asc"
    sort_field: String = "id"
  ): [Object]
  object(
    id: Int!
    lang: String = "en"
  ): SingleObject
}
type Object {
  id: Int
  publicAccess: Boolean
  objectNumber: String
  title: String
  displayDate: String
  beginDate: Int
  endDate: Int
  dimensions: String
  creditLine: String
  medium: String
}
type SingleObject {
  id: Int
  publicAccess: Boolean
  objectNumber: String
  title: String
  displayDate: String
  beginDate: Int
  endDate: Int
  dimensions: String
  creditLine: String
  medium: String
}
`
*/