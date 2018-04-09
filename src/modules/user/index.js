const fs = require('fs')
const crypto = require('crypto')

class User {
  constructor (auth0id) {
    // Set the auth0 to null
    this.auth0 = null
    this.id = null
    this.hash = null
    this.loggedIn = false
    this.apitoken = null
    this.oldTokens = []

    /*
     * Check to see if we've been passed an object,
     * if so then we've been given the whole auth0
     * object and can go about storing it. Otherwise
     * we have to try and get the auth0 object from
     * having what we assume is just the id.
     */
    if (typeof auth0id === 'object') {
      this.auth0 = auth0id
      this.id = auth0id.id
      this.hash = crypto.createHash('md5').update(this.id).digest('hex')

      /*
      * Now we have the auth0 go and check to see if
      * we have data for it in the data store.
      */
      if (!this.userExists() && this.id !== null) {
        this.save()
      }
    } else {
      //  Assume we've been given a hash
      this.hash = auth0id
    }

    this.load()
  }

  userExists () {
    const userDir = process.cwd()
    if (!fs.existsSync(`${userDir}/app/data`)) {
      fs.mkdirSync(`${userDir}/app/data`)
    }
    if (!fs.existsSync(`${userDir}/app/data/users`)) {
      fs.mkdirSync(`${userDir}/app/data/users`)
    }
    return fs.existsSync(`${userDir}/app/data/users/${this.hash}.json`)
  }

  get () {
    console.log(`Getting user: ${this.id}`)
    return 'fnord'
  }

  /*
   * This checks to see if there are any other users, if not
   * then we are the very first user, make us the admin user
   */
  firstUser () {
    const userDir = `${process.cwd()}/app/data/users`
    if (!fs.existsSync(userDir)) return false
    const users = fs.readdirSync(userDir).filter(file => {
      const fileFragments = file.split('.')
      if (fileFragments.length !== 2) return false
      if (fileFragments[1] === 'json') return true
    })
    return users.length === 0
  }

  /*
   * This will generate a new api token for the user. It will
   * check to see if there's an old on and if so it'll add them
   * to the list of older tokens
   */
  generateToken () {
    const newToken = crypto
      .createHash('md5')
      .update(`${Math.random()}`)
      .digest('hex')
    let oldToken = null
    if (
      'apitoken' in this &&
      this.apitoken !== null &&
      this.apitoken !== undefined
    ) {
      if (
        !('oldTokens' in this) ||
        this.oldTokens === null ||
        this.oldTokens === undefined
      ) {
        this.oldTokens = []
      }
      oldToken = this.apitoken
      this.oldTokens.push(oldToken)
    }
    this.apitoken = newToken

    //  TODO: we need to tell the graphQL server, if it's set up
    //  that this is a valid token. Rather like this...
    //  GraphQL.registerApiToken(newToken, oldToken)
  }

  save () {
    //  Do the dates/times
    if (!('created' in this)) this.created = new Date().getTime()
    this.updated = new Date().getTime()

    //  Set user roles
    if (!('developer' in this)) this.developer = true
    if (!('staff' in this)) this.staff = false
    if (!('admin' in this)) this.admin = false
    if (this.firstUser()) {
      this.admin = true
    }

    //  Make sure we have an apitoken
    if (!('apitoken' in this)) {
      this.generateToken()
    }

    const userDir = `${process.cwd()}/app/data/users`
    const userJSONPretty = JSON.stringify(this, null, 4)
    fs.writeFileSync(`${userDir}/${this.hash}.json`, userJSONPretty, 'utf-8')
  }

  load () {
    const userDir = `${process.cwd()}/app/data/users`
    const userFile = `${userDir}/${this.hash}.json`
    if (this.hash !== null && fs.existsSync(userFile)) {
      const userPretty = fs.readFileSync(userFile, 'utf-8')
      const user = JSON.parse(userPretty)
      //  You would think destructuring but nope!
      this.id = user.id
      this.hash = user.hash
      this.auth0 = user.auth0
      this.created = user.created
      this.updated = user.updated
      this.developer = user.developer
      this.staff = user.staff
      this.admin = user.admin
      this.apitoken = user.apitoken
      this.oldTokens = user.oldTokens
      this.loggedIn = true
    }
  }
}
module.exports = User
