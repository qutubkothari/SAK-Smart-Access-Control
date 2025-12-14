# SAK WhatsApp bot example (Node/Express)

This is a minimal inbound webhook receiver that replies back via SAK WhatsApp Gateway.

## Setup

```powershell
cd tools\whatsapp-bot-node
npm install
```

Set env vars (example):

```powershell
$env:SAK_BASE_URL = "http://13.126.37.210"
$env:SAK_SESSION_ID = "default"
$env:SAK_API_KEY = "<YOUR_SESSION_API_KEY>"
$env:INBOUND_SECRET = "<RANDOM_STRING>"
$env:PORT = "3005"
```

Run:

```powershell
npm start
```

## Point SAK session webhook to your bot

When creating the session in SAK, set the webhook URL to:

`https://your-public-domain/sak/inbound/<INBOUND_SECRET>`

Notes:
- The current SAK gateway code posts JSON to the webhook with no signature header.
- Using a secret in the URL path is the simplest protection.
