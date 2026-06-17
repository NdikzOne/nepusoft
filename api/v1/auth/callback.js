import { Redis } from '@upstash/redis';
import { OAuth2Client } from 'google-auth-library';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { code } = req.query;

  try {
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173'}/api/v1/auth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const userInfo = await userInfoResponse.json();

    // Save user to Redis
    const user = {
      id: userInfo.id,
      name: userInfo.name,
      email: userInfo.email,
      picture: userInfo.picture,
      accessToken: tokens.access_token,
    };

    await redis.set(`user:${userInfo.id}`, JSON.stringify(user));

    // Set cookie untuk session
    res.setHeader('Set-Cookie', `userId=${userInfo.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);

    // Redirect ke frontend
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/home`);
  } catch (error) {
    console.error('Auth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?error=auth_failed`);
  }
}