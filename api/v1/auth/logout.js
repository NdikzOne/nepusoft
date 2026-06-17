import session from 'express-session';
import passport from 'passport';
import express from 'express';

const app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());

export default async function handler(req, res) {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
    } else {
      res.json({ success: true });
    }
  });
}