import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const userId = req.cookies.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const userData = await redis.get(`user:${userId}`);
    if (userData) {
      res.json({ user: JSON.parse(userData) });
    } else {
      res.status(401).json({ error: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}