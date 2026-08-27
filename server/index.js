require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const {
  getProfile,
  buildLowProfileBody,
  buildLabCreateBody,
  buildLabResultBody,
} = require('./profiles');
const { createLowProfile, getLpResult, publicPayload, responseSummary } = require('./cardcom');

const app = express();

app.use(cors());
app.use(express.json());
app.use(
  '/cardcom-hosted',
  express.static(path.join(__dirname, '..', 'cardcom-hosted'))
);
app.use(
  '/cardcom-preview',
  express.static(path.join(__dirname, '..', 'cardcom-preview'))
);
app.use(
  '/cardcom-production',
  express.static(path.join(__dirname, '..', 'cardcom-production'))
);
app.use(
  '/templates',
  express.static(path.join(__dirname, '..', 'templates'))
);
app.use(
  '/competition-template',
  express.static(path.join(__dirname, '..', 'competition-template'))
);
app.use(
  '/Images/Bit',
  express.static(path.join(__dirname, '..', 'cardcom-preview', 'assets'))
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
    const language = req.body.language;
    const profile = getProfile(req.body.profileId);
    const payload = buildLowProfileBody(profile, amount, language);

    console.log({
      profileId: profile.id,
      TerminalNumber: payload.TerminalNumber,
      ApiName: payload.ApiName,
      Amount: payload.Amount,
      Language: payload.Language,
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

    console.log(responseSummary(data));

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

app.post('/lab/create', async (req, res) => {
  try {
    const profile = getProfile(req.body && req.body.profileId);
    const { body, amount, includeDocument } = buildLabCreateBody(profile, req.body);

    console.log({
      lab: 'create',
      profileId: profile.id,
      sent: publicPayload(body),
    });

    const cardcom = await createLowProfile(body);
    console.log({ lab: 'create', cardcom: responseSummary(cardcom) });

    res.json({
      sent: {
        Amount: amount,
        Language: body.Language,
        Operation: body.Operation,
        includeDocument,
        productCount: body.Document && body.Document.Products ? body.Document.Products.length : 0,
        request: publicPayload(body),
      },
      cardcom,
    });
  } catch (error) {
    console.log(error);
    if (error.statusCode === 400) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(error.statusCode === 502 ? 502 : 500).json({
      message: error.message || 'Cardcom request failed',
      raw: error.raw,
    });
  }
});

app.post('/lab/result', async (req, res) => {
  try {
    const profile = getProfile(req.body && req.body.profileId);
    const body = buildLabResultBody(profile, req.body && req.body.lowProfileId);

    console.log({
      lab: 'result',
      profileId: profile.id,
      sent: publicPayload(body),
    });

    const cardcom = await getLpResult(body);
    console.log({ lab: 'result', cardcom: responseSummary(cardcom) });

    res.json({ cardcom });
  } catch (error) {
    console.log(error);
    if (error.statusCode === 400) {
      res.status(400).json({ message: error.message });
      return;
    }
    res.status(error.statusCode === 502 ? 502 : 500).json({
      message: error.message || 'Cardcom request failed',
      raw: error.raw,
    });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
