/* eslint-disable no-useless-constructor */
const request = require('request-promise')
const Config = require('../../classes/config')

/** Class allowing us to connect to a GraphQL server. */
class GraphQL {
  /**
   * Once again, wecause we are dealing with async stuff we have an empty constructor
   * so we can have a GraphQL object that we can then drop a handy method onto. We could
   * just turn this into a module, but I suspect we'll need this as a class in the
   * near future. So rather than refactor later I'm putting this here.
   */
  constructor () {}

  /**
   *
   * @param {json} payload The query and any other options to be sent to the GraphQL server
   * @returns {json|Array} The results from GraphQL as a json objects, or an array containing the error if the query failed
   */
  async fetch (payload) {
    const config = new Config()
    const graphql = config.get('graphql')
    if (graphql == null) {
      return ['error', 'No graphQL defined in config']
    }

    return request({
      url: `${graphql.host}/graphql`,
      method: 'POST',
      headers: {
          'content-type': 'application/json',
          Authorization: `bearer ${config.get('handshake')}`
        },
      json: payload
    })
      .then(response => {
        return response
      })
      .catch(error => {
        return [error]
      })
  }
}
module.exports = GraphQL
