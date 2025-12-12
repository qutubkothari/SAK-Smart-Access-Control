# SAK Smart Access Control - Getting Started Guide

## 🚀 Quick Start (Development)

### Step 1: Prerequisites
Ensure you have installed:
- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 14+ ([Download](https://www.postgresql.org/download/))
- Redis 7+ ([Download](https://redis.io/download))
- Git

### Step 2: Clone Repository
```bash
git clone https://github.com/qutubkothari/SAK-Smart-Access-Control.git
cd SAK-Smart-Access-Control
```

### Step 3: Database Setup

#### Create PostgreSQL Database
```bash
# Login to PostgreSQL
psql -U postgres

# In PostgreSQL prompt:
CREATE DATABASE sak_access_control;
CREATE USER sak_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE sak_access_control TO sak_user;
\q
```

#### Start Redis
```bash
# Windows (if installed via WSL/Docker)
redis-server

# Linux/Mac
sudo systemctl start redis
```

### Step 4: Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configurations
# Update DB_PASSWORD, JWT_SECRET, etc.

# Run migrations
npm run migrate

# Start development server
npm run dev
```

Backend will run on: `http://localhost:5000`

### Step 5: Test the API
```bash
# Health check
curl http://localhost:5000/health

# Or open in browser
# http://localhost:5000/health
```

---

## 📋 Configuration

### Environment Variables

Edit `backend/.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sak_access_control
DB_USER=sak_user
DB_PASSWORD=your_secure_password_here

# JWT
JWT_SECRET=generate_random_256_bit_secret_here
JWT_EXPIRES_IN=24h

# Server
PORT=5000
NODE_ENV=development
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🧪 Testing the System

### 1. Register a User (Host)
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "its_id": "ITS123456",
    "email": "john@company.com",
    "password": "SecurePass123",
    "name": "John Doe",
    "phone": "+919876543210"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "its_id": "ITS123456",
    "password": "SecurePass123"
  }'
```

Save the returned `token` for next requests.

### 3. Create a Meeting
```bash
curl -X POST http://localhost:5000/api/v1/meetings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "meeting_time": "2025-12-15T14:00:00Z",
    "duration_minutes": 60,
    "location": "Conference Room A",
    "purpose": "Product Demo",
    "visitors": [
      {
        "name": "Jane Smith",
        "email": "jane@client.com",
        "phone": "+919876543211",
        "company": "Client Corp"
      }
    ]
  }'
```

This will:
- Generate QR codes
- Send email/WhatsApp to visitor
- Return QR code images

### 4. Check-in Visitor (Receptionist)
```bash
curl -X POST http://localhost:5000/api/v1/visitors/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer RECEPTIONIST_TOKEN" \
  -d '{
    "qr_code": "encrypted_qr_from_previous_step"
  }'
```

---

## 📱 User Roles

The system has 4 roles:

1. **Admin**: Full system access
2. **Host**: Can create meetings, view own meetings
3. **Receptionist**: Can check-in/out visitors
4. **Security**: Can view all visitors, manage blacklist

### Creating Different Role Users

Edit database directly or use admin API:
```sql
-- Make a user admin
UPDATE users SET role = 'admin' WHERE its_id = 'ITS123456';

-- Make a user receptionist
UPDATE users SET role = 'receptionist' WHERE its_id = 'ITS789012';
```

---

## 🔄 Complete Workflow Example

### Scenario: Meeting with External Visitor

**Step 1: Host Creates Meeting**
- Host logs into system with ITS ID
- Clicks "Create Meeting"
- Fills form:
  - Date/Time: Tomorrow 2 PM
  - Location: Conference Room B
  - Visitor: Jane Smith, jane@client.com
- Submits form

**Step 2: System Actions**
- Generates encrypted QR code
- Sends email to jane@client.com with QR code
- Sends WhatsApp message with meeting details
- Creates calendar event (optional)

**Step 3: Visitor Arrives**
- Visitor shows up at reception
- Shows QR code (email/phone)
- Receptionist scans QR code

**Step 4: Check-in**
- System validates QR code
- Checks blacklist
- Records check-in time
- **Sends real-time notification to host:**
  - Push notification
  - Email
  - SMS (if enabled)
- Optionally captures visitor photo
- Prints visitor badge

**Step 5: Host Notification**
- Host receives: "Jane Smith has arrived for your 2 PM meeting at Conference Room B"
- Host goes to meet visitor

**Step 6: Reminder (if needed)**
- If 30 minutes after meeting time and host hasn't checked in at meeting location
- System sends reminder: "You have not checked in for your meeting with Jane Smith"

**Step 7: Meeting Completion**
- Visitor checks out at reception
- System logs check-out time
- Updates meeting status to "completed"

---

## 🛠️ Development Tools

### Database Management
```bash
# View all migrations
npm run migrate:status

# Create new migration
npm run migrate:create add_new_feature

# Rollback last migration
npm run migrate:rollback
```

### Viewing Logs
```bash
# Development logs (console)
npm run dev

# Production logs
tail -f logs/combined.log
tail -f logs/error.log
```

### Testing
```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

---

## 🔍 Troubleshooting

### Issue: Database Connection Failed
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check credentials in .env
# Verify DB_HOST, DB_PORT, DB_USER, DB_PASSWORD
```

### Issue: Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping
# Should return "PONG"

# Start Redis
sudo systemctl start redis
```

### Issue: Port 5000 Already in Use
```bash
# Find process using port 5000
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess

# Linux/Mac
lsof -i :5000

# Change PORT in .env to different port
PORT=5001
```

### Issue: JWT Token Invalid
- Make sure JWT_SECRET in .env is set
- Token expires after 24h by default
- Login again to get new token

---

## 📊 Project Structure

```
backend/
├── src/
│   ├── server.ts              # Entry point
│   ├── config/                # Configuration files
│   │   ├── database.ts        # Database connection
│   │   └── redis.ts           # Redis connection
│   ├── controllers/           # Route controllers
│   │   ├── auth.controller.ts
│   │   ├── meeting.controller.ts
│   │   └── visitor.controller.ts
│   ├── middleware/            # Express middleware
│   │   ├── auth.ts            # JWT authentication
│   │   └── errorHandler.ts   # Error handling
│   ├── routes/                # API routes
│   ├── services/              # Business logic
│   │   ├── qrcode.service.ts
│   │   └── notification.service.ts
│   └── utils/                 # Utilities
│       └── logger.ts          # Winston logger
├── package.json
├── tsconfig.json
└── .env
```

---

## 🎯 Next Steps

1. **Set up Email:**
   - Configure AWS SES credentials in .env
   - Or use SMTP (Gmail, SendGrid, etc.)

2. **Set up SMS/WhatsApp:**
   - Create Twilio account
   - Add credentials to .env

3. **Frontend Development:**
   - Create React frontend
   - Connect to backend API

4. **Deploy to EC2:**
   - Follow [DEPLOYMENT.md](./DEPLOYMENT.md)

5. **Add Features:**
   - Recurring meetings
   - Analytics dashboard
   - Mobile app for receptionists

---

## 📞 Need Help?

- **Documentation:** See `/docs` folder
- **API Reference:** [API.md](./API.md)
- **Database Schema:** [DATABASE.md](./DATABASE.md)
- **Issues:** [GitHub Issues](https://github.com/qutubkothari/SAK-Smart-Access-Control/issues)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

**Happy Coding! 🚀**
