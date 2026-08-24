require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { getProfile, buildLowProfileBody } = require('./profiles');

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  '/cardcom-hosted',
  express.static(path.join(__dirname, '..', 'cardcom-hosted'))
);

app.get('/', (req, res) => {
  res.redirect('/cardcom-hosted/');
});

app.get('/test', (req, res) => {
  res.json({ message: 'Server works' });
});

app.post('/payment', async (req, res) => {
  try {
    const amount = req.body.amount;
    const profile = getProfile(req.body.profileId);
    const payload = buildLowProfileBody(profile, amount);

    console.log({
      profileId: profile.id,
      TerminalNumber: payload.TerminalNumber,
      ApiName: payload.ApiName,
      Amount: payload.Amount,
      Operation: payload.Operation,
    });

    const cardcomResponse = await fetch(
      'https://secure.cardcom.solutions/api/v11/LowProfile/Create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await cardcomResponse.json();

    console.log(data);

    res.json(data);
  } catch (error) {
    console.log(error);

    if (error.statusCode === 400) {
      res.status(400).json({ message: error.message });
      return;
    }

    res.status(500).json({
      message: 'Cardcom request failed',
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
