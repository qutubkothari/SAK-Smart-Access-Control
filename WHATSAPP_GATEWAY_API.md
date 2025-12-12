# WhatsApp Gateway API - Your Own Maytapi Alternative

## 🎯 Overview

Build your own **multi-tenant WhatsApp API service** like Maytapi, but:
- ✅ **Free** (no monthly fees)
- ✅ **Self-hosted** (full control)
- ✅ **Multi-tenant** (serve multiple clients)
- ✅ **No limits** (unlimited messages)
- ✅ **Webhooks** (incoming message notifications)
- ✅ **Message queue** (retry failed messages)

## 🏗️ Architecture

```
Your App ──API──> WhatsApp Gateway ──Baileys──> WhatsApp Web
                        │
                        ├─ Session 1 (Client A)
                        ├─ Session 2 (Client B)
                        └─ Session 3 (Client C)
```

Each session = Independent WhatsApp connection with its own:
- QR code pairing
- Auth credentials
- Phone number
- API key
- Webhook URL

## 📡 API Endpoints

### 1. Create New Session (WhatsApp Instance)

```http
POST /api/v1/gateway/sessions
Content-Type: application/json

{
  "sessionId": "client-abc",
  "name": "Client ABC Company",
  "apiKey": "abc-secret-key-123",
  "webhook": "https://client-abc.com/whatsapp-webhook"
}

Response:
{
  "success": true,
  "sessionId": "client-abc",
  "qrCode": "2@abc123xyz...",
  "message": "Session created successfully"
}
```

### 2. Get Session Status

```http
GET /api/v1/gateway/client-abc/status
Headers:
  x-api-key: abc-secret-key-123

Response:
{
  "success": true,
  "data": {
    "exists": true,
    "connected": true,
    "phoneNumber": "919876543210",
    "qrCode": null
  }
}
```

### 3. Get QR Code (for pairing)

```http
GET /api/v1/gateway/client-abc/qr
Headers:
  x-api-key: abc-secret-key-123

Response:
{
  "success": true,
  "data": {
    "qrCode": "2@abc123...",
    "message": "Scan this QR code with WhatsApp"
  }
}
```

### 4. Send Text Message

```http
POST /api/v1/gateway/client-abc/send
Headers:
  x-api-key: abc-secret-key-123
  Content-Type: application/json

{
  "to": "+919876543210",
  "message": "Hello! Your meeting is confirmed."
}

Response:
{
  "success": true,
  "messageId": "3EB0C7F8F2B1234567"
}
```

### 5. Send Image

```http
POST /api/v1/gateway/client-abc/send-image
Headers:
  x-api-key: abc-secret-key-123
  Content-Type: multipart/form-data

Form Data:
  to: +919876543210
  caption: Here is your QR code
  image: [file upload]

Response:
{
  "success": true,
  "messageId": "3EB0C7F8F2B1234567"
}
```

### 6. Send Document

```http
POST /api/v1/gateway/client-abc/send-document
Headers:
  x-api-key: abc-secret-key-123
  Content-Type: multipart/form-data

Form Data:
  to: +919876543210
  caption: Your meeting invitation
  document: [PDF file upload]

Response:
{
  "success": true,
  "messageId": "3EB0C7F8F2B1234567"
}
```

### 7. Delete Session

```http
DELETE /api/v1/gateway/client-abc
Headers:
  x-api-key: abc-secret-key-123

Response:
{
  "success": true,
  "message": "Session deleted"
}
```

### 8. List All Sessions

```http
GET /api/v1/gateway/sessions/list

Response:
{
  "success": true,
  "data": [
    {
      "sessionId": "client-abc",
      "name": "Client ABC Company",
      "phoneNumber": "919876543210",
      "apiKey": "***3123",
      "isActive": true
    }
  ]
}
```

## 🔔 Webhooks

When you configure a webhook URL, you'll receive events:

### Incoming Message
```json
{
  "event": "message_received",
  "sessionId": "client-abc",
  "from": "919876543210@s.whatsapp.net",
  "messageId": "3EB0C7F8F2B1234567",
  "timestamp": 1702987654,
  "type": "conversation",
  "text": "Hello, I need help",
  "hasMedia": false
}
```

### Connection Status
```json
{
  "event": "connected",
  "sessionId": "client-abc",
  "phoneNumber": "919876543210"
}

{
  "event": "disconnected",
  "sessionId": "client-abc",
  "shouldReconnect": true
}
```

### QR Code Generated
```json
{
  "event": "qr_code",
  "sessionId": "client-abc",
  "qrCode": "2@abc123..."
}
```

## 💼 Business Model

### Option 1: Internal Use
Use it for your own apps (like SAK Access Control)

### Option 2: WhatsApp API as a Service
Sell to other businesses:
- **Setup fee**: $50-100 (one-time per client)
- **Monthly fee**: $10-20/month per phone number
- **Pay-as-you-go**: $0.01 per message (optional)

### Option 3: White Label
Package and sell as your own product to agencies/developers

## 🚀 Deployment

### As SaaS on VPS

1. **Server Requirements**:
   - 2GB RAM minimum
   - 20GB disk space (for sessions)
   - Ubuntu 20.04+

2. **Setup**:
```bash
# Install dependencies
npm install

# Set environment
export WHATSAPP_GATEWAY_API_KEY=master-key-for-creating-sessions

# Run with PM2
pm2 start dist/server.js --name whatsapp-gateway -i 2
pm2 save
```

3. **Nginx Configuration**:
```nginx
server {
    listen 443 ssl;
    server_name gateway.yourdomain.com;

    location /api/v1/gateway {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. **Scaling**:
   - Each session = ~50MB RAM
   - Can handle 100+ sessions on 4GB VPS
   - Load balance multiple servers for 1000+ sessions

## 📊 Features Comparison

| Feature | Your Gateway | Maytapi | Baileys Direct |
|---------|-------------|---------|----------------|
| Cost | Free | $20+/mo | Free |
| Multi-tenant | ✅ Yes | ✅ Yes | ❌ No |
| API | ✅ REST | ✅ REST | ❌ Code only |
| Message Queue | ✅ Yes | ✅ Yes | ❌ No |
| Webhooks | ✅ Yes | ✅ Yes | ⚠️ Manual |
| Scaling | ✅ Easy | ⚠️ Limited | ❌ Hard |
| Control | ✅ Full | ❌ Limited | ✅ Full |
| Setup | ⚠️ Technical | ✅ Easy | ⚠️ Technical |

## 🔐 Security

### API Key Authentication
Each session has unique API key passed via `x-api-key` header

### Rate Limiting (Recommended)
```typescript
import rateLimit from 'express-rate-limit';

const gatewayLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 100 // 100 requests per minute
});

app.use('/api/v1/gateway', gatewayLimiter);
```

### IP Whitelisting
Allow only specific IPs to access gateway

### SSL/TLS
Always use HTTPS in production

## 📈 Monitoring

### Session Health Check
```bash
# Check all sessions
curl https://gateway.yourdomain.com/api/v1/gateway/sessions/list

# Check specific session
curl -H "x-api-key: abc-key" \
  https://gateway.yourdomain.com/api/v1/gateway/client-abc/status
```

### Logs
```bash
pm2 logs whatsapp-gateway
```

### Metrics to Track
- Active sessions count
- Messages sent per session
- Failed message rate
- Connection uptime
- Response time

## 💡 Use Cases

### 1. Agency/Reseller
Provide WhatsApp API to multiple clients, each with their own session

### 2. Multi-brand Company
One gateway serving multiple company brands

### 3. Development Platform
Offer WhatsApp integration as part of low-code platform

### 4. Automation Hub
Central WhatsApp service for all your automation projects

## 🛠️ Advanced Features (TODO)

- [ ] Message templates
- [ ] Scheduled messages
- [ ] Bulk messaging
- [ ] Analytics dashboard
- [ ] Message history storage
- [ ] Contact management
- [ ] Group messaging
- [ ] Status updates
- [ ] Rich media (location, contacts)
- [ ] Database integration for sessions

## 📝 Example: Using in Your App

```typescript
// Your SAK Access Control can use it like Maytapi

const axios = require('axios');

async function sendWhatsAppInvite(phone, message, qrImage) {
  // Send text
  await axios.post('http://localhost:5000/api/v1/gateway/default/send', {
    to: phone,
    message: message
  }, {
    headers: {
      'x-api-key': 'default-key-change-this'
    }
  });

  // Send QR image
  const formData = new FormData();
  formData.append('to', phone);
  formData.append('caption', 'Your meeting QR code');
  formData.append('image', qrImage);

  await axios.post('http://localhost:5000/api/v1/gateway/default/send-image', 
    formData,
    {
      headers: {
        'x-api-key': 'default-key-change-this',
        ...formData.getHeaders()
      }
    }
  );
}
```

## 🎯 Next Steps

1. **Test locally**: Start server, create session, scan QR, send messages
2. **Deploy to VPS**: Use PM2 + Nginx
3. **Add monitoring**: Set up health checks and alerts
4. **Document API**: Create Postman collection for clients
5. **Add billing**: Integrate Stripe for paid tiers (optional)
6. **Scale**: Add Redis for message queue, PostgreSQL for session storage

## 💰 Revenue Potential

If you sell this as a service:
- 50 clients × $15/month = **$750/month**
- 100 clients × $15/month = **$1,500/month**
- 500 clients × $15/month = **$7,500/month**

Server cost: ~$20-40/month for VPS

**Profit margin**: 95%+ 🚀

---

**You just built your own Maytapi!** 🎉
