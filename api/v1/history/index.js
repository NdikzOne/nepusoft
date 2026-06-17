import { Redis } from '@upstash/redis';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Helper: Verify JWT
const verifyToken = (req) => {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies.token;
  
  if (!token) {
    throw new Error('No token');
  }
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  return decoded.userId;
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const userId = verifyToken(req);
    const historyKey = `history:${userId}`;

    // GET - Fetch history
    if (req.method === 'GET') {
      const history = await redis.lrange(historyKey, 0, -1);
      const parsedHistory = history.map(item => JSON.parse(item));
      return res.json({ data: parsedHistory });
    }

    // POST - Save to history
    if (req.method === 'POST') {
      const { animeId, animeTitle } = req.body;
      
      if (!animeId || !animeTitle) {
        return res.status(400).json({ error: 'animeId and animeTitle are required' });
      }

      const existing = await redis.lrange(historyKey, 0, -1);
      let history = existing.map(item => JSON.parse(item));
      
      // Remove if already exists
      const existingIndex = history.findIndex(item => item.animeId === animeId);
      if (existingIndex !== -1) {
        history.splice(existingIndex, 1);
      }
      
      // Add new entry at the beginning
      history.unshift({
        animeId,
        animeTitle,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 50 items
      history = history.slice(0, 50);
      
      // Save back to Redis
      await redis.del(historyKey);
      for (const item of history) {
        await redis.rpush(historyKey, JSON.stringify(item));
      }
      
      return res.json({ success: true, data: history });
    }

    // DELETE - Clear all history
    if (req.method === 'DELETE') {
      await redis.del(historyKey);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('History error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}