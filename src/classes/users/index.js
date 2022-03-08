const request = require('request-promise')
const auth0 = require('../../modules/auth0')
const Config = require('../config')

class Users {
  async get (role = null, page = 0, perPage = 100) {
    const auth0Token = await auth0.getAuth0Token()
    const payload = {}

    const config = new Config()
    const auth0info = config.get('auth0')
    if (auth0info === null) {
      return ['error', 'No auth0 set in config']
    }

    const headers = {
      'content-type': 'application/json',
      Authorization: `bearer ${auth0Token}`
    }

    let allUsers = []

    const pages = [0, 1, 2]

    for (const page of pages) {
      const qs = {
        per_page: perPage,
        page,
        search_engine: 'v3'
      }
      const users = await request({
        url: `https://${auth0info.AUTH0_DOMAIN}/api/v2/users`,
        method: 'GET',
        headers,
        json: payload,
        qs
      })
        .then(response => {
          return response
        })
        .catch(error => {
          return [error]
        })
      if (users && Array.isArray(users) && users.length > 0 && users[0].user_id) {
        allUsers = allUsers.concat(users)
      }
    }
    return allUsers
  }
}
module.exports = Users
