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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = verifyToken(req);
    const { animeId } = req.query; // Untuk Vercel, params ada di query

    if (!animeId) {
      return res.status(400).json({ error: 'animeId is required' });
    }

    const historyKey = `history:${userId}`;
    
    const existing = await redis.lrange(historyKey, 0, -1);
    let history = existing.map(item => JSON.parse(item));
    history = history.filter(item => item.animeId !== animeId);
    
    await redis.del(historyKey);
    for (const item of history) {
      await redis.rpush(historyKey, JSON.stringify(item));
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error.message === 'No token' || error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('History delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}