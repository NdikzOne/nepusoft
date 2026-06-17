import cookie from 'cookie';

export default async function handler(req, res) {
  // Clear the token cookie
  res.setHeader('Set-Cookie', cookie.serialize('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0 // Expire immediately
  }));

  res.json({ success: true });
}