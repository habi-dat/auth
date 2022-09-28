const express = require('express')

// creating an express instance
const app = express()
const path = require('path');
const session = require('express-session')
const SessionFileStore = require('session-file-store')(session);
const bodyParser = require('body-parser')
const passport = require('passport')
const config = require('./config/config.json')
const auth = require('./utils/auth');
const moment = require('moment');
const Promise = require("bluebird");

if (config.debug) {
  Promise.config({
    longStackTraces: true
  })
}

// getting the local authentication type
const LocalStrategy = require('passport-local').Strategy

const publicRoot = './dist'

app.use(express.static(publicRoot))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded())

var fileStoreOptions = {
  path: './data/sessions',
  ttl: 3600
};
app.use(session({
    store: new SessionFileStore(fileStoreOptions),
    secret: 'somethingsecretgoeshere',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // CHANGE TO TRUE FOR PRODUCTION
}));

app.use(passport.initialize());
app.use(passport.session());

app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'pug');
// inject useful parameters to email template rendering
app.use(function(req,res,next){
    res.locals.session = req.session;
    if (req.user) {
        res.locals.currentUser = req.user;
        res.locals.currentUser.loggedIn = true;
    } else {
        res.locals.currentUser = { loggedIn: false};
    }
    res.locals.baseUrl = req.protocol+"://"+req.headers.host;
    res.locals.config = config;
    res.locals.moment = moment;
    next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/user'));
app.use('/', require('./routes/group'));
app.use('/', require('./routes/category'));
app.use('/', require('./routes/saml'));
app.use('/', require('./routes/apps'));
app.use('/', require('./routes/settings'));

app.get("/", (req, res, next) => {
  res.sendFile("index.html", { root: publicRoot })
})

app.use((err, req, res, next) => {
  if (typeof err === 'string') {
    res.status(400).send({error: {message: err}})
  } else if (err && err.status === 400) {
    res.status(400).send({error: {message: err.message}})
  } else if (err.message) {
    console.error('error', err.stack)
    res.status(500).send({error: {message: err.message}})
  }
  else {
    console.error('unknown error', err)
    res.status(500).send({error: 'Serverfehler'})
  }
})

app.listen(3000, () => {
  console.log("Example app listening on port 3000")
})