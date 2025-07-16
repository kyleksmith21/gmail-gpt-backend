const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const open = require('open').default;

dotenv.config();
const app = express();
const PORT = 3000;

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Step 1: Redirect user to Google OAuth
app.get('/auth', async (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  });
  await open(authUrl);
  res.send('Opened browser for Gmail authorization');
});

// Step 2: OAuth callback
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Fetch latest 5 emails
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults: 5,
  });

  res.send('Authorization complete. Check your terminal for email data.');
  console.log('Recent Emails:', response.data.messages);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}/auth`);
});
