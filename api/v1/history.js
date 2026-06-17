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

  const historyKey = `history:${userId}`;

  if (req.method === 'GET') {
    try {
      const history = await redis.lrange(historyKey, 0, -1);
      const parsedHistory = history.map(item => JSON.parse(item));
      res.json({ data: parsedHistory });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }

  if (req.method === 'POST') {
    const { animeId, animeTitle } = req.body;
    
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
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save history' });
    }
  }

  if (req.method === 'DELETE') {
    const { animeId } = req.query;
    
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