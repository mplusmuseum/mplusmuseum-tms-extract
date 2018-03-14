require('dotenv').config()
const express = require('express')
const colours = require('colors')
const exphbs = require('express-handlebars')
const routes = require('./app/routes')
const helpers = require('./app/helpers')
const http = require('http')
const bodyParser = require('body-parser')
const session = require('express-session')
const FileStore = require('session-file-store')(session)

const tools = require('./app/modules/tools')
const tmsxml2json = require('./app/cli/tmsxml2json')
const passport = require('passport')
const Auth0Strategy = require('passport-auth0')
const cookieParser = require('cookie-parser')

colours.setTheme({
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  alert: 'magenta'
})

const app = express()
const hbs = exphbs.create({
  extname: '.html',
  helpers,
  partialsDir: `${__dirname}/app/templates/includes/`
})

app.engine('html', hbs.engine)
app.set('view engine', 'html')
app.set('views', `${__dirname}/app/templates`)
app.use(
  express.static(`${__dirname}/app/public`, {
    'no-cache': true
  })
)
app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)
app.use(cookieParser())
app.use(
  session({
    // Here we are creating a unique session identifier
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    store: new FileStore({
      ttl: 60 * 60 * 24 * 7
    })
  })
)

// app.use express.favicon __dirname + '/public/img/favicon.ico'
// app.use express.logger 'dev'

// Configure Passport to use Auth0
const strategy = new Auth0Strategy(
  {
    domain: process.env.AUTH0_DOMAIN,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_SECRET,
    callbackURL: process.env.AUTH0_CALLBACK_URL
  },
  (accessToken, refreshToken, extraParams, profile, done) => {
    return done(null, profile)
  }
)

passport.use(strategy)

// This can be used to keep a smaller payload
passport.serializeUser(function (user, done) {
  done(null, user)
})

passport.deserializeUser(function (user, done) {
  done(null, user)
})

app.use(passport.initialize())
app.use(passport.session())

app.use('/', routes)

app.use((request, response) => {
  console.error('ERROR!!')
  response.status(404).render('static/404')
})

if (process.env.NODE_ENV !== 'DEV') {
  app.use((err, req, res) => {
    console.error(err.stack)
    res.status(500).send('Something broke!')
  })
}

//  This is where we are going to do some extra checking
tools.startPinging()

setInterval(() => {
  tmsxml2json.start()
}, 1000 * 60 * 60 * 4) // Check every fours hours, starts after four hours.

console.log(`>> Connect to: http://localhost:${process.env.PORT}`.alert)
http.createServer(app).listen(process.env.PORT)
