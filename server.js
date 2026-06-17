import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Redis } from '@upstash/redis';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Redis setup
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://nefusoft.vercel.app'],
  credentials: true
}));
app.use(express.json());

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/v1/auth/google/callback`
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const user = {
        id: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
        picture: profile.photos[0].value,
        accessToken,
        refreshToken
      };
      
      await redis.set(`user:${profile.id}`, JSON.stringify(user));
      return done(null, user);
    } catch (error) {
      console.error('Google auth error:', error);
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

// Auth routes
app.get('/api/v1/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/api/v1/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173/home');
  }
);

app.get('/api/v1/auth/me', (req, res) => {
  if (req.user) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

app.post('/api/v1/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// History routes with Upstash
app.post('/api/v1/history', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { animeId, animeTitle } = req.body;
  const historyKey = `history:${req.user.id}`;
  
  try {
    const existing = await redis.lrange(historyKey, 0, -1);
    let history = existing.map(item => JSON.parse(item));
    
    const existingIndex = history.findIndex(item => item.animeId === animeId);
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1);
    }
    
    history.unshift({
      animeId,
      animeTitle,
      timestamp: new Date().toISOString()
    });
    
    history = history.slice(0, 50);
    
    await redis.del(historyKey);
    for (const item of history) {
      await redis.rpush(historyKey, JSON.stringify(item));
    }
    
    res.json({ success: true, history });
  } catch (error) {
    console.error('History save error:', error);
    res.status(500).json({ error: 'Failed to save history' });
  }
});

app.get('/api/v1/history', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const history = await redis.lrange(`history:${req.user.id}`, 0, -1);
    const parsedHistory = history.map(item => JSON.parse(item));
    res.json({ data: parsedHistory });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

app.delete('/api/v1/history/:animeId', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { animeId } = req.params;
  const historyKey = `history:${req.user.id}`;
  
  try {
    const existing = await redis.lrange(historyKey, 0, -1);
    let history = existing.map(item => JSON.parse(item));
    history = history.filter(item => item.animeId !== animeId);
    
    await redis.del(historyKey);
    for (const item of history) {
      await redis.rpush(historyKey, JSON.stringify(item));
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('History delete error:', error);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Auth server running on http://localhost:${PORT}`);
});