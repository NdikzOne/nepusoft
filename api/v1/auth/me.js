import { Redis } from '@upstash/redis';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    // Parse cookies
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const userId = decoded.userId;

    // Get user from Redis
    const userData = await redis.get(`user:${userId}`);
    if (userData) {
      res.json({ user: JSON.parse(userData) });
    } else {
      res.status(401).json({ error: 'User not found' });
    }
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      console.error('Me error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}