import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Redis } from '@upstash/redis';
import session from 'express-session';
import express from 'express';

const app = express();

// Setup Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Session middleware
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

// Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/v1/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = {
        id: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        picture: profile.photos[0].value,
        accessToken,
      };
      
      await redis.set(`user:${profile.id}`, JSON.stringify(user));
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const userData = await redis.get(`user:${id}`);
    if (userData) {
      done(null, JSON.parse(userData));
    } else {
      done(null, null);
    }
  } catch (error) {
    done(error, null);
  }
});

export default async function handler(req, res) {
  return new Promise((resolve, reject) => {
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, (err) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return resolve();
      }
      resolve();
    });
  });
}