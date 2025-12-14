import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

const SAK_BASE_URL = process.env.SAK_BASE_URL;
const SAK_SESSION_ID = process.env.SAK_SESSION_ID;
const SAK_API_KEY = process.env.SAK_API_KEY;
const INBOUND_SECRET = process.env.INBOUND_SECRET;
const PORT = Number(process.env.PORT || 3005);

if (!SAK_BASE_URL) throw new Error('Missing env SAK_BASE_URL');
if (!SAK_SESSION_ID) throw new Error('Missing env SAK_SESSION_ID');
if (!SAK_API_KEY) throw new Error('Missing env SAK_API_KEY');
if (!INBOUND_SECRET) throw new Error('Missing env INBOUND_SECRET');

// In-memory dedupe (use Redis for production)
const seen = new Set();

async function sendReply(to, message) {
  const resp = await fetch(`${SAK_BASE_URL}/api/v1/gateway/${SAK_SESSION_ID}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SAK_API_KEY,
    },
    body: JSON.stringify({ to, message }),
  });

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

  console.log('Inbound webhook:', JSON.stringify(body));

  // SAK gateway webhook payload shape (from backend code):
  // { event: 'message_received', sessionId, from, messageId, text, ... }
  if (body.event !== 'message_received') return res.status(200).json({ ok: true });

  const msgId = body.messageId ? String(body.messageId) : '';
  if (msgId && seen.has(msgId)) return res.status(200).json({ ok: true, deduped: true });
  if (msgId) seen.add(msgId);

  const from = body.from ? String(body.from) : '';
  const text = body.text ? String(body.text).trim() : '';
  if (!from || !text) return res.status(200).json({ ok: true });

  // TODO: replace with your real bot logic
  const reply = `Got it: "${text}"`;

  try {
    const result = await sendReply(from, reply);
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`Bot listening on :${PORT}`);
  console.log(`Inbound path: /sak/inbound/${INBOUND_SECRET}`);
  console.log('Health: /health');
});
