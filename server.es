require('dotenv').config();
const express = require('express');
const colours = require('colors');
const exphbs = require('express-handlebars');
const routes = require('./app/routes');
const helpers = require('./app/helpers');
const http = require('http');

const auth = require('http-auth');

const basic = auth.basic({
  realm: 'Private area',
  file: `${__dirname}/htpasswd`,
});

colours.setTheme({
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red',
  alert: 'magenta',
});

const app = express();
app.use(auth.connect(basic));
const hbs = exphbs.create({
  extname: '.html',
  helpers,
  partialsDir: `${__dirname}/app/templates/includes/`,
});

app.engine('html', hbs.engine);
app.set('view engine', 'html');
app.set('views', `${__dirname}/app/templates`);
app.use(express.static(`${__dirname}/app/public`, { 'no-cache': true }));

// app.use express.favicon __dirname + '/public/img/favicon.ico'
// app.use express.logger 'dev'

app.get('/', routes.main.index);

app.use((request, response) => {
  console.error('ERROR!!');
  response.status(404).render('static/404');
});

if (process.env.NODE_ENV !== 'DEV') {
  app.use((err, req, res) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });
}

console.log(`>> Connect to: http://localhost:${process.env.PORT}`.alert);
http.createServer(app).listen(process.env.PORT);
