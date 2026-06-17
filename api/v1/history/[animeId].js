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

  if (req.method === 'DELETE') {
    const { animeId } = req.query;
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
      res.status(500).json({ error: 'Failed to delete history' });
    }
  }
}