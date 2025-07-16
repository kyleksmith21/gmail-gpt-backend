const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const open = require('open').default;

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Step 1: Redirect user to Google OAuth
app.get('/auth', async (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',     // this tells Google we want a refresh token
  prompt: 'consent',          // this forces Google to re-prompt the user
  scope: ['https://www.googleapis.com/auth/gmail.readonly']
});
  await open(authUrl);
  res.send('Opened browser for Gmail authorization');
});

// Step 2: OAuth callback handler
app.get('/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    res.send('Authorization complete. You can now query emails using the /emails endpoint.');
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).send('OAuth failed.');
  }
});

// ✅ Secure GPT-accessible email search endpoint
app.get('/emails', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  const query = req.query.q || '';

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query, // e.g., from:someone@gmail.com subject:invoice
      maxResults: 10,
    });

    const messageIds = listRes.data.messages || [];

    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        return {
          id: msg.id,
          snippet: msgRes.data.snippet,
          subject: msgRes.data.payload?.headers?.find(h => h.name === 'Subject')?.value,
          from: msgRes.data.payload?.headers?.find(h => h.name === 'From')?.value,
          date: msgRes.data.payload?.headers?.find(h => h.name === 'Date')?.value,
        };
      })
    );

    res.json(messages);
  } catch (err) {
    console.error('Email fetch error:', err);
    res.status(500).send('Failed to fetch emails');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
