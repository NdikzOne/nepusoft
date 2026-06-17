import { Redis } from '@upstash/redis';
import session from 'express-session';
import passport from 'passport';
import express from 'express';

const app = express();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

app.use(express.json());
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
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const history = await redis.lrange(`history:${req.user.id}`, 0, -1);
      const parsedHistory = history.map(item => JSON.parse(item));
      res.json({ data: parsedHistory });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }

  if (req.method === 'POST') {
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
      res.status(500).json({ error: 'Failed to save history' });
    }
  }
}