const express = require('express')
const passport = require('passport')
const router = express.Router()
const User = require('../classes/user')
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn()
const Config = require('../classes/config')

// Break out all the seperate parts of the site
/* eslint-disable import/no-unresolved */
const admin = require('./admin')
const config = require('./config')
const developer = require('./developer')
const item = require('./item')
const main = require('./main')
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
  req.templateValues = {}
  const configObj = new Config()
  req.config = configObj
  req.templateValues.config = req.config
  req.templateValues.NODE_ENV = process.env.NODE_ENV
  if (req.user === undefined) {
    req.user = null
  } else {
    //  Shortcut the roles
    if ('user_metadata' in req.user && 'roles' in req.user.user_metadata) {
      req.user.roles = req.user.user_metadata.roles
      req.user.apitoken = req.user.user_metadata.apitoken
    } else {
      req.user.roles = {
        isAdmin: false,
        isDeveloper: false,
        isStaff: false
      }
    }
  }
  req.templateValues.user = req.user

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

router.get('/', main.status)
router.post('/', main.status)
router.get('/config', ensureLoggedIn, config.index)
router.post('/config', ensureLoggedIn, config.index)
router.get('/settings', ensureLoggedIn, user.settings)
router.get('/admin', ensureLoggedIn, admin.index)
router.get('/admin/users', ensureLoggedIn, admin.users)
router.get('/admin/user/:id', ensureLoggedIn, admin.user)
router.post('/admin/user/:id', ensureLoggedIn, admin.user)
router.get('/developer', ensureLoggedIn, developer.index)
router.post('/developer', ensureLoggedIn, developer.index)
router.get('/developer/fields/:index', ensureLoggedIn, developer.fields)
router.get('/developer/field/:index/:field', ensureLoggedIn, developer.field)
router.get('/stats', ensureLoggedIn, stats.index)
// router.get('/stats/logs', ensureLoggedIn, stats.logs)
// router.post('/stats', ensureLoggedIn, stats.index)

router.get('/view/:item/:id', ensureLoggedIn, item.index)

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

module.exports = router
