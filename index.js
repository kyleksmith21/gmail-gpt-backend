const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Set up the Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI // e.g. https://your-app.onrender.com/oauth2callback
);

// 🔐 Step 1: Begin OAuth flow
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/gmail.readonly']
  });

  // Redirect the user to Google's OAuth consent screen
  res.redirect(authUrl);
});

// 🔁 Step 2: Handle OAuth callback and capture refresh token
app.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // ⛳️ Log the refresh token (you should store this securely or add it to your Render env vars)
    if (tokens.refresh_token) {
      console.log("✅ Your refresh token:", tokens.refresh_token);
    }

    res.send('✅ Authorization complete. You can now query emails using the /emails endpoint.');
  } catch (err) {
    console.error('OAuth error:', err);
    res.status(500).send('❌ OAuth failed.');
  }
});

// 📬 Step 3: Gmail email search endpoint (GPT calls this)
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
      q: query,
      maxResults: 10
    });

    const messageIds = listRes.data.messages || [];

    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        });

        const headers = msgRes.data.payload?.headers || [];

        return {
          id: msg.id,
          snippet: msgRes.data.snippet,
          subject: headers.find(h => h.name === 'Subject')?.value || '',
          from: headers.find(h => h.name === 'From')?.value || '',
          date: headers.find(h => h.name === 'Date')?.value || ''
        };
      })
    );

    res.json(messages);
  } catch (err) {
    console.error('Email fetch error:', err);
    res.status(500).send('Failed to fetch emails');
  }
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
