const fs = require('fs')
const path = require('path')
const langDir = path.join(__dirname, '../../lang')
const express = require('express')
const passport = require('passport')
const router = express.Router()
const User = require('../classes/user')
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn()
const Config = require('../classes/config')
const getDefaultTemplateData = require('../helpers').getDefaultTemplateData

// Break out all the seperate parts of the site
/* eslint-disable import/no-unresolved */
const admin = require('./admin')
const api = require('./api')
const config = require('./config')
const developer = require('./developer')
const exploreomatic = require('./explore-o-matic')
const main = require('./main')
const search = require('./search')
const stats = require('./stats')
const user = require('./user')

//  Redirect to https, make sure...
//  app.enable('trust proxy')
//  is set in server.js
router.use(function (req, res, next) {
  let remoteAccess = true

  //  Because of the way we are hosting we need to do an extra weird check
  //  about coming in from outside or via a ip:port before we tie up the whole
  //  lot in a knot.
  const hostSplit = req.headers['host'].split(':')
  if (hostSplit.length > 1) {
    if (hostSplit[1] === process.env.PORT) {
      remoteAccess = false
    }
  }
  if (!(req.secure) && process.env.REDIRECT_HTTPS === 'true' && remoteAccess === true) {
    var secureUrl = 'https://' + req.headers['host'] + req.url
    res.writeHead(301, {
      Location: secureUrl
    })
    res.end()
  } else {
    next()
  }
})

// ############################################################################
//
/*
 * Always create a templateValues object that gets passed to the
 * templates. The config object from global (this allows use to
 * manipulate it here if we need to) and the user if one exists
 */
//
// ############################################################################
router.use(function (req, res, next) {
  req.templateValues = getDefaultTemplateData()
  const configObj = new Config()
  req.config = configObj
  req.templateValues.config = req.config

  const defaultLang = 'en'
  let selectedLang = 'en'

  if (req.user === undefined) {
    req.user = null
  } else {
    //  Shortcut the roles
    if ('user_metadata' in req.user && 'roles' in req.user.user_metadata) {
      req.user.roles = req.user.user_metadata.roles
    } else {
      req.user.roles = {
        isAdmin: false,
        isDeveloper: false,
        isVendor: false,
        isStaff: false
      }
    }
    if ('user_metadata' in req.user && 'apitoken' in req.user.user_metadata) {
      req.user.apitoken = req.user.user_metadata.apitoken
    } else {
      req.user.apitoken = null
    }
  }

  //  Read in the language files and overlay the selected langage on the
  //  default one
  //  TODO: Cache all this for about 5 minutes
  //  TODO: break the cache if we update strings
  const langs = fs.readdirSync(langDir).filter((lang) => {
    const langSplit = lang.split('.')
    if (langSplit.length !== 3) return false
    if (langSplit[0] !== 'strings' || langSplit[2] !== 'json') return false
    return true
  }).map((lang) => {
    const langSplit = lang.split('.')
    return langSplit[1]
  })
  req.templateValues.langs = langs

  //  If we are *not* on a login, logout or callback url then
  //  we need to check for langage stuff
  const nonLangUrls = ['login', 'logout', 'callback', 'images', 'api']
  const urlClean = req.url.split('?')[0]
  const urlSplit = urlClean.split('/')
  if (urlSplit[0] === '') urlSplit.shift()
  if (!nonLangUrls.includes(urlSplit[0])) {
    //  Check to see if the first entry isn't a language,
    //  if it's not pop the selectedLang into the url
    //  and try again
    if (!(langs.includes(urlSplit[0]))) {
      if (req.user && req.user.lang) {
        return res.redirect(`/${req.user.lang}${req.url}`)
      }
      return res.redirect(`/${defaultLang}${req.url}`)
    } else {
      selectedLang = urlSplit[0]
    }

    //  Now we can work out the *rest* of the URL _without_ the
    //  langage part
    urlSplit.shift()
    req.templateValues.remainingUrl = `/${urlSplit.join('/')}`
  }
  if (req.user !== null) req.user.lang = selectedLang
  req.templateValues.user = req.user

  const i18n = JSON.parse(fs.readFileSync(path.join(langDir, `strings.${defaultLang}.json`)))
  if (selectedLang !== defaultLang) {
    const selectedi18n = JSON.parse(fs.readFileSync(path.join(langDir, `strings.${selectedLang}.json`)))
    Object.entries(selectedi18n).forEach((branch) => {
      const key = branch[0]
      const values = branch[1]
      if (!(key in i18n)) i18n[key] = {}
      Object.assign(i18n[key], values)
    })
  }
  req.templateValues.selectedLang = selectedLang
  req.templateValues.i18n = i18n

  //  If there is no Auth0 setting in config then we _must_
  //  check to see if we are setting Auth0 settings and if
  //  not, redirect to the Auth0 form.
  if (configObj.get('auth0') === null) {
    // Check to see if values are being posted to us
    if (req.method === 'POST') {
      if (
        'action' in req.body &&
        'AUTH0_DOMAIN' in req.body &&
        'AUTH0_CLIENT_ID' in req.body &&
        'AUTH0_SECRET' in req.body &&
        'AUTH0_CALLBACK_URL' in req.body &&
        'elasticsearch' in req.body &&
        'handshake' in req.body &&
        req.body.action === 'save' &&
        req.body.handshake === configObj.get('handshake')
      ) {
        const auth0 = {
          AUTH0_DOMAIN: req.body.AUTH0_DOMAIN,
          AUTH0_CLIENT_ID: req.body.AUTH0_CLIENT_ID,
          AUTH0_SECRET: req.body.AUTH0_SECRET,
          AUTH0_CALLBACK_URL: req.body.AUTH0_CALLBACK_URL
        }
        configObj.set('auth0', auth0)
        configObj.set('elasticsearch', {
          host: req.body.elasticsearch
        })
        setTimeout(() => {
          global.doRestart = true
          process.exit()
        }, 500)
        return res.redirect('/wait')
      }
    }

    //  If not, check to see if we've been passed a handshake
    if ('handshake' in req.query) {
      req.templateValues.handshake = req.query.handshake
    }

    //  Set up a nice handy default callback if we are developing
    if (process.env.NODE_ENV === 'development') {
      req.templateValues.callbackUrl = `http://${process.env.HOST}:${process.env.PORT}/callback`
    }
    req.templateValues.NODE_ENV = process.env.NODE_ENV
    return res.render('config/auth0', req.templateValues)
  }
  next()
})

// ############################################################################
//
//  Log in and log out tools
//
// ############################################################################

const configObj = new Config()
if (configObj.get('auth0') !== null) {
  const auth0Obj = configObj.get('auth0')
  router.get(
    '/login',
    passport.authenticate('auth0', {
      clientID: auth0Obj.AUTH0_CLIENT_ID,
      domain: auth0Obj.AUTH0_DOMAIN,
      redirectUri: auth0Obj.AUTH0_CALLBACK_URL,
      audience: `https://${auth0Obj.AUTH0_DOMAIN}/userinfo`,
      responseType: 'code',
      scope: 'openid profile'
    }),
    function (req, res) {
      res.redirect('/')
    }
  )

  // Perform session logout and redirect to homepage
  router.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/')
  })

  // Perform the final stage of authentication and redirect to '/user'
  router.get(
    '/callback',
    passport.authenticate('auth0', {
      failureRedirect: '/'
    }),
    async function (req, res) {
      //  Update the user with extra information
      req.session.passport.user = await new User().get(req.user)
      res.redirect(req.session.returnTo || '/')
    }
  )
}

router.get('/:lang', main.status)
router.post('/:lang', main.status)
router.get('/:lang/config', ensureLoggedIn, config.index)
router.post('/:lang/config', ensureLoggedIn, config.index)
router.get('/:lang/settings', ensureLoggedIn, user.settings)
router.get('/:lang/admin', ensureLoggedIn, admin.index)
router.post('/:lang/admin', ensureLoggedIn, admin.index)
router.post('/:lang/admin/blow/away/index/:index', ensureLoggedIn, admin.blowaway)
router.get('/:lang/admin/blow/away/index/:index', ensureLoggedIn, admin.blowaway)
router.post('/:lang/admin/aggregate/:tms', ensureLoggedIn, admin.aggrigateObjects)
router.get('/:lang/admin/users', ensureLoggedIn, admin.users)
router.get('/:lang/admin/user/:id', ensureLoggedIn, admin.user)
router.post('/:lang/admin/user/:id', ensureLoggedIn, admin.user)
router.get('/:lang/admin/isMakers', ensureLoggedIn, admin.isMakers)
router.post('/:lang/admin/isMakers', ensureLoggedIn, admin.isMakers)
router.get('/:lang/developer', ensureLoggedIn, developer.index)
router.get('/:lang/developer/graphql', ensureLoggedIn, developer.graphql)
router.get('/:lang/developer/terms', developer.terms)
router.get('/:lang/developer/graphql/status', ensureLoggedIn, developer.status.graphql)
router.get('/:lang/developer/elasticsearch/status', ensureLoggedIn, developer.status.elasticsearch)
router.get('/:lang/stats', ensureLoggedIn, stats.index)
router.get('/:lang/stats/logs', ensureLoggedIn, stats.logs)
router.post('/:lang/stats', ensureLoggedIn, stats.index)
router.get('/:lang/wait', main.wait)
router.get('/:lang/search/concepts/:tms/:id', ensureLoggedIn, search.concepts.index)
router.get('/:lang/search/constituents/:tms/:id', ensureLoggedIn, search.constituents.index)
router.get('/:lang/search/exhibitions/:tms/:id', ensureLoggedIn, search.exhibitions.index)
router.get('/:lang/search/objects/:tms/:id', ensureLoggedIn, search.objects.index)

router.get('/:lang/explore-o-matic', ensureLoggedIn, exploreomatic.index)
router.get('/:lang/explore-o-matic/constituents', ensureLoggedIn, exploreomatic.constituents)
router.get('/:lang/explore-o-matic/constituents/:makerStub', ensureLoggedIn, exploreomatic.constituents)
router.get('/:lang/explore-o-matic/areas', ensureLoggedIn, exploreomatic.areas)
router.get('/:lang/explore-o-matic/categories', ensureLoggedIn, exploreomatic.categories)
router.get('/:lang/explore-o-matic/mediums', ensureLoggedIn, exploreomatic.mediums)
router.get('/:lang/explore-o-matic/exhibitions', ensureLoggedIn, exploreomatic.exhibitions)
router.get('/:lang/explore-o-matic/object/:filter', ensureLoggedIn, exploreomatic.getObject)
router.get('/:lang/explore-o-matic/colour', ensureLoggedIn, exploreomatic.getColor)
router.get('/:lang/explore-o-matic/colour/:hsl', ensureLoggedIn, exploreomatic.getColor)
router.get('/:lang/explore-o-matic/:thing/:filter', ensureLoggedIn, exploreomatic.getObjectsByThing)

router.get('/:lang/apihelp', ensureLoggedIn, api.index)
router.post('/api/checkToken', api.checkToken)
router.post('/api/ping', api.ping)

module.exports = router
