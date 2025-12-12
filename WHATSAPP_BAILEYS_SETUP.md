# WhatsApp Integration with Baileys

## ✅ Advantages Over Maytapi

### Cost
- **Baileys**: FREE (open-source)
- **Maytapi**: Paid API with monthly subscription

### Features
- Direct WhatsApp Web connection
- No intermediary service
- Full message control
- Media support (images, documents)
- Real-time connection status

### Security
- End-to-end encrypted (WhatsApp native)
- Self-hosted authentication
- No third-party data sharing

## 📦 Installation

Already installed:
```bash
npm install @whiskeysockets/baileys @hapi/boom pino
```

## 🔧 Setup

### 1. First Time Connection

Start your backend server:
```bash
npm run dev
```

The console will show a QR code. Scan it with your WhatsApp:
1. Open WhatsApp on your phone
2. Go to Settings > Linked Devices
3. Click "Link a Device"
4. Scan the QR code shown in terminal

### 2. Authentication Persistence

Once connected, credentials are saved in `whatsapp_auth/` folder:
- `creds.json` - Authentication credentials
- Session files - Active session data

**Important**: Add to `.gitignore`:
```
whatsapp_auth/
```

### 3. Connection Management

The service auto-reconnects if connection drops (unless logged out).

## 🚀 API Endpoints

### Check Connection Status
```http
GET /api/v1/whatsapp/status
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "data": {
    "connected": true,
    "message": "WhatsApp is connected"
  }
}
```

### Get QR Code for Pairing
```http
GET /api/v1/whatsapp/qr-code
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "data": {
    "qrCode": "2@abc123...",
    "message": "Scan this QR code with WhatsApp on your phone"
  }
}
```

### Reconnect WhatsApp
```http
POST /api/v1/whatsapp/reconnect
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "message": "WhatsApp reconnection initiated"
}
```

### Disconnect WhatsApp
```http
POST /api/v1/whatsapp/disconnect
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "message": "WhatsApp disconnected successfully"
}
```

## 📱 Usage in Code

### Send Text Message
```typescript
import WhatsAppService from './services/whatsapp.service';

await WhatsAppService.sendMessage(
  '+919876543210',  // Phone number
  'Hello! Your meeting is confirmed.'
);
```

### Send Image with Caption
```typescript
import fs from 'fs';

const imageBuffer = fs.readFileSync('qr-code.png');
await WhatsAppService.sendMessageWithImage(
  '+919876543210',
  'Here is your QR code for check-in',
  imageBuffer
);
```

### Send Document
```typescript
const pdfBuffer = fs.readFileSync('invitation.pdf');
await WhatsAppService.sendDocument(
  '+919876543210',
  pdfBuffer,
  'meeting-invitation.pdf',
  'Your meeting invitation is attached'
);
```

## 🔄 Auto-Reconnection

The service automatically handles:
- Connection drops
- Network issues
- WhatsApp server restarts

It will **NOT** reconnect if:
- User logs out from phone
- Credentials are deleted

## 🛡️ Production Deployment

### EC2 Setup

1. **Keep Service Running**:
```bash
# PM2 keeps the WhatsApp connection alive
pm2 start dist/server.js --name sak-backend
pm2 save
```

2. **First Connection on Server**:
```bash
# SSH into server
ssh -i your-key.pem ubuntu@13.232.42.132

# View logs to see QR code
pm2 logs sak-backend

# Scan QR code with your phone
```

3. **Backup Auth Folder** (Important):
```bash
# Copy whatsapp_auth folder to safe location
# If server crashes, you won't need to re-scan
tar -czf whatsapp_auth_backup.tar.gz whatsapp_auth/
```

### Environment Variables

No environment variables needed! Baileys stores everything locally.

## 📊 Monitoring

### Check Connection Status
```bash
# Via API
curl http://localhost:5000/api/v1/whatsapp/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Via logs
pm2 logs sak-backend | grep WhatsApp
```

## 🐛 Troubleshooting

### Issue: "WhatsApp not connected"
**Solution**: Check if service is running, regenerate QR code via `/whatsapp/reconnect`

### Issue: QR code expired
**Solution**: Call `/whatsapp/qr-code` endpoint to get fresh QR

### Issue: Connection keeps dropping
**Solution**: 
1. Check internet connection
2. Verify phone has active WhatsApp
3. Ensure phone and server are in same WhatsApp account

### Issue: "Multi-device beta required"
**Solution**: Enable multi-device on your WhatsApp:
- Settings > Linked Devices > Multi-device beta

## 🎯 Current Implementation

Already integrated in:
- ✅ Meeting invitations (with QR code image)
- ✅ Visitor arrival notifications
- ✅ Meeting reminders
- ✅ Cancellation notices

Messages sent via:
- `NotificationService` → `WhatsAppService`

## 📝 Notes

- **Phone number format**: `+919876543210` or `919876543210` (auto-formatted)
- **Rate limits**: None (native WhatsApp, not API)
- **Message types**: Text, Image, Document, PDF
- **Connection**: Persistent (stays connected 24/7)
- **Cost**: $0 (completely free)

## 🔐 Security Best Practices

1. **Never commit** `whatsapp_auth/` folder
2. **Backup** auth credentials regularly
3. **Monitor** connection logs for unusual activity
4. **Use dedicated** WhatsApp number for business
5. **Enable two-factor** authentication on WhatsApp account

## 🆚 Maytapi vs Baileys Comparison

| Feature | Baileys | Maytapi |
|---------|---------|---------|
| Cost | Free | ~$20/month |
| Setup | QR scan once | API keys |
| Rate Limits | None | API limits |
| Message Cost | Free | Per message |
| Reliability | High (direct) | Medium (API) |
| Control | Full | Limited |
| Privacy | Complete | Third-party |

## 🎉 Result

You now have a **free, professional WhatsApp integration** that:
- Sends meeting invitations with QR codes
- Notifies hosts when visitors arrive  
- Sends meeting reminders
- Runs 24/7 on your EC2 server
- Costs $0 per month
- Has no message limits

Much better than Maytapi! 🚀
