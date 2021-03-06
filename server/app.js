/* eslint-disable no-unused-vars */

import newrelic from 'newrelic';
import express from 'express';
import mongoose from 'mongoose';
import config from './_config';
import bodyParser from 'body-parser';
import cors from 'cors';
import passport from 'passport';
import router from './router';
import authInit from './authentication';
import session from 'express-session';

const MongoStore = require('connect-mongo')(session);

const app = express();
module.exports.app = app;

// load environment variables
require('dotenv').load();

mongoose.connect(config.mongoURI[process.env.NODE_ENV], (err, res) => {
  if (err) {
    console.log(`Error connecting to the database: ${err}`);
  } else {
    console.log(`Connected to Database: ${config.mongoURI[app.settings.env]}`);
  }
});
mongoose.Promise = global.Promise;

// never delete this! this is to ensure that we own notist.herokuapp.com
app.get('/googled7468666290ac0de.html', (req, res) => {
  res.send('google-site-verification: googled7468666290ac0de.html');
});

// passport google oauth initialization
app.use(session({
  secret: process.env.SESSION_SECRET,
  saveUninitialized: false, // don't create session until something stored
  resave: false, // don't save session if unmodified
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    touchAfter: 24 * 3600, // time period in seconds to forced session resave
  }),
}));
app.use(passport.initialize());
app.use(passport.session());
authInit(passport);

app.get('/auth/google', passport.authenticate('google', { scope: [
  'https://www.googleapis.com/auth/plus.login',
  'https://www.googleapis.com/auth/plus.profile.emails.read',
] }));

app.get('/auth/google/callback', passport.authenticate('google', {
  successRedirect: config.frontEndHost,
  failureRedirect: `${config.frontEndHost}/login`,
}));
app.get('/login/facebook', passport.authenticate('facebook', { scope: ['email'] }));
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', {
    successRedirect: config.frontEndHost,
    failureRedirect: `${config.frontEndHost}/login`,
  }));

// enable/disable cross origin resource sharing if necessary
const corsOptions = {
  origin: config.frontEndHost,
  credentials: true,
};
app.use(cors(corsOptions));

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// api routes
app.use('/', router);

// START THE SERVER
// =============================================================================
const port = process.env.PORT;
app.listen(port);

export { app };

console.log(`listening on: ${port}`);
