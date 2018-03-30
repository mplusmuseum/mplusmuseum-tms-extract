const express = require('express')
const passport = require('passport')
const router = express.Router()
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn()

// Break out all the seperate parts of the site
/* eslint-disable import/no-unresolved */
const admin = require('./admin')
const developer = require('./developer')
const item = require('./item')
const main = require('./main')
const user = require('./user')

router.get('/', main.status)
router.post('/', main.status)
router.get('/config', ensureLoggedIn, main.config)
router.post('/config', ensureLoggedIn, main.config)
router.get('/settings', ensureLoggedIn, user.settings)
router.get('/admin', ensureLoggedIn, admin.index)
router.get('/admin/users', ensureLoggedIn, admin.users)
router.get('/admin/user/:hash', ensureLoggedIn, admin.user)
router.post('/admin/user/:hash', ensureLoggedIn, admin.user)
router.get('/developer', ensureLoggedIn, developer.index)
router.get('/developer/fields/:index', ensureLoggedIn, developer.fields)
router.get('/developer/field/:index/:field', ensureLoggedIn, developer.field)

router.get('/view/:item/:id', ensureLoggedIn, item.index)

// Perform the login
router.get(
  '/login',
  passport.authenticate('auth0', {
    clientID: process.env.AUTH0_CLIENT_ID,
    domain: process.env.AUTH0_DOMAIN,
    redirectUri: process.env.AUTH0_CALLBACK_URL,
    audience: 'https://' + process.env.AUTH0_DOMAIN + '/userinfo',
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
  function (req, res) {
    res.redirect(req.session.returnTo || '/')
  }
)

module.exports = router
