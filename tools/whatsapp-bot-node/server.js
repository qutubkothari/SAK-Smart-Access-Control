import 'dotenv/config';
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

const app = express();

// Parse JSON bodies
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const SAK_BASE_URL = process.env.SAK_BASE_URL;
const SAK_SESSION_ID = process.env.SAK_SESSION_ID;
const SAK_API_KEY = process.env.SAK_API_KEY;
const INBOUND_SECRET = process.env.INBOUND_SECRET;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.SAK_WEBHOOK_SECRET;
const PORT = Number(process.env.PORT || 3005);

if (!SAK_BASE_URL) throw new Error('Missing env SAK_BASE_URL');
if (!SAK_SESSION_ID) throw new Error('Missing env SAK_SESSION_ID');
if (!SAK_API_KEY) throw new Error('Missing env SAK_API_KEY');
if (!INBOUND_SECRET) throw new Error('Missing env INBOUND_SECRET');
if (!WEBHOOK_SECRET) throw new Error('Missing env WEBHOOK_SECRET (or SAK_WEBHOOK_SECRET)');

function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function normalizeHexToken(value) {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().replace(/[^0-9a-f]/g, '');
}

function normalizeSecretForCompare(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.replace(/\r/g, '').trim();
  const asHex = normalizeHexToken(trimmed);
  return asHex || trimmed;
}

function splitSecrets(raw) {
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOffByOneHexMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length === b.length) return false;
  if (Math.abs(a.length - b.length) !== 1) return false;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  // Try deleting 1 char from the longer string to see if it matches the shorter.
  for (let i = 0; i < longer.length; i += 1) {
    if (longer.slice(0, i) + longer.slice(i + 1) === shorter) return true;
  }
  return false;
}

function secretsEquivalent(providedHex, expectedHex) {
  if (!providedHex || !expectedHex) return false;
  if (timingSafeEqualString(providedHex, expectedHex)) return true;
  // Defensive tolerance: handle accidental 1-char hex mismatch (e.g., bad copy/paste in env).
  return isOffByOneHexMatch(providedHex, expectedHex);
}

function maskSecret(value) {
  if (typeof value !== 'string') return String(value);
  const normalized = normalizeHexToken(value);
  if (!normalized) return `"" (rawLen=${value.length})`;
  const start = normalized.slice(0, 6);
  const end = normalized.slice(-6);
  return `${start}…${end} (len=${normalized.length})`;
}

// In-memory dedupe (use Redis for production)
const seen = new Set();

async function sendReply(to, message) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.SAK_SEND_TIMEOUT_MS || 12000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let resp;
  try {
    resp = await fetch(`${SAK_BASE_URL}/api/v1/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SAK_API_KEY,
        // Required for `sak_live_*` keys. Safe to send for session-scoped keys too.
        'x-session-id': SAK_SESSION_ID,
      },
      body: JSON.stringify({ sessionId: SAK_SESSION_ID, to, text: message }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!resp.ok) {
    throw new Error(`SAK send failed: ${resp.status} ${text}`);
  }

  return json;
}

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.post(`/sak/inbound/${INBOUND_SECRET}`, async (req, res) => {
  const body = req.body || {};

  // Auth: allow either exact secret header OR signature header (HMAC-SHA256(rawBody))
  const expectedSecretRaw = typeof WEBHOOK_SECRET === 'string' ? WEBHOOK_SECRET : '';
  const expectedSecretsRaw = splitSecrets(expectedSecretRaw);
  const expectedSecrets = expectedSecretsRaw.map(normalizeSecretForCompare).filter(Boolean);
  const providedSecretRaw = req.header('x-webhook-secret');
  const providedSecret = normalizeSecretForCompare(providedSecretRaw || '');
  const providedSigRaw = req.header('x-webhook-signature');

  const secretOk = expectedSecrets.some((s) => secretsEquivalent(providedSecret, s));
  let sigOk = false;
  if (providedSigRaw) {
    const normalizedSig = providedSigRaw.startsWith('sha256=') ? providedSigRaw : `sha256=${providedSigRaw}`;
    sigOk = expectedSecretsRaw.some((secret) => {
      const key = typeof secret === 'string' ? secret.replace(/\r/g, '').trim() : '';
      if (!key) return false;
      const expectedHex = createHmac('sha256', key)
        .update(req.rawBody || Buffer.from(''))
        .digest('hex');
      const expectedSig = `sha256=${expectedHex}`;
      return timingSafeEqualString(normalizedSig, expectedSig);
    });
  }

  if (!secretOk && !sigOk) {
    console.log('Invalid webhook secret/signature.', {
      hasSecret: !!providedSecretRaw,
      secret: maskSecret(String(providedSecretRaw || '')),
      expected: expectedSecretsRaw.map(maskSecret).join(', '),
      hasSignature: !!providedSigRaw,
    });
    return res.status(401).json({ ok: false, error: 'Invalid webhook secret/signature' });
  }

  console.log('Inbound webhook:', JSON.stringify(body));

  // SAK gateway webhook payload shape (from backend code):
  // { event: 'message.received', sessionId, from, messageId, text, ... }
  if (body.event !== 'message.received') {
    console.log(`Ignoring event: ${body.event}`);
    return res.status(200).json({ ok: true });
  }

  const msgId = body.messageId ? String(body.messageId) : '';
  if (msgId && seen.has(msgId)) return res.status(200).json({ ok: true, deduped: true });
  if (msgId) seen.add(msgId);

  const from = body.from ? String(body.from) : '';
  const text = body.text ? String(body.text).trim().toLowerCase() : '';
  
  // Ignore status broadcasts and empty messages
  if (!from || from.includes('broadcast') || !text) {
    console.log(`Ignoring message from: ${from}, text: ${text}`);
    return res.status(200).json({ ok: true });
  }

  let reply = '';

  // Bot commands
  if (text.includes('hello') || text.includes('hi') || text.includes('start')) {
    reply = `👋 Welcome to SAK Access Control!\n\nCommands:\n• "status" - Check your visit status\n• "meeting" - View your meetings\n• "help" - Show this menu`;
  } else if (text.includes('status')) {
    reply = `🔍 Checking your visit status...\n\nYou can check in by scanning the QR code provided by your host.`;
  } else if (text.includes('meeting')) {
    reply = `📅 Your scheduled meetings:\n\n• No upcoming meetings found.\n\nContact your host for meeting details and QR code.`;
  } else if (text.includes('help')) {
    reply = `📋 SAK Access Control Help\n\nCommands:\n• "status" - Check visit status\n• "meeting" - View meetings\n• "help" - This menu\n\nFor assistance, contact reception.`;
  } else {
    reply = `I understand you said: "${text}"\n\nType "help" for available commands.`;
  }

  // ACK immediately to avoid SAK webhook timeouts/retries; send reply asynchronously.
  res.status(200).json({ ok: true, accepted: true });

  console.log(`Sending reply to ${from}: ${reply.substring(0, 50)}...`);
  void sendReply(from, reply)
    .then((result) => {
      console.log('Reply sent successfully:', JSON.stringify(result));
    })
    .catch((e) => {
      console.error('Send reply error:', e);
    });
});

app.listen(PORT, () => {
  console.log(`Bot listening on :${PORT}`);
  console.log(`Inbound path: /sak/inbound/${INBOUND_SECRET}`);
  console.log('Health: /health');
  console.log(`Webhook secret lens: ${splitSecrets(String(WEBHOOK_SECRET || '')).map((s) => normalizeSecretForCompare(s).length).join(', ')}`);
});
