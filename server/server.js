const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(session({
  secret: 'discord-auth-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 60000 * 60 * 24 // 1 day
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Discord Strategy
passport.use(new DiscordStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.REDIRECT_URI,
  scope: ['identify', 'email']
}, 
function(accessToken, refreshToken, profile, done) {
  // In a real application, you'd typically save the profile to a database
  return done(null, profile);
}));

// Serialization
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Routes
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
  passport.authenticate('discord', { 
    failureRedirect: '/' 
  }), 
  (req, res) => {
    res.redirect(process.env.CLIENT_REDIRECT);
  }
);

app.get('/api/user', (req, res) => {
  if (req.user) {
    res.json({
      user: req.user
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.get('/api/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('http://localhost:3000');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 