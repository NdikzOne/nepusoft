import { OAuth2Client } from 'google-auth-library';

export default async function handler(req, res) {
const redirectUri = `${process.env.VERCEL_URL}/api/v1/auth/callback`;

const oauth2Client = new OAuth2Client(
process.env.GOOGLE_CLIENT_ID,
process.env.GOOGLE_CLIENT_SECRET,
redirectUri
);

const authorizeUrl = oauth2Client.generateAuthUrl({
access_type: 'offline',
prompt: 'consent',
scope: [
'https://www.googleapis.com/auth/userinfo.profile',
'https://www.googleapis.com/auth/userinfo.email'
]
});

res.redirect(authorizeUrl);
}