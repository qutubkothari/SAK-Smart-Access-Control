# SAK Smart Access Control System

## 🎯 Overview
Enterprise-grade visitor management and access control system with QR-based authentication, real-time notifications, and comprehensive tracking.

## ✨ Key Features
- **Single-Click Meeting Creation**: Host creates meetings instantly using ITS ID
- **QR Code Generation**: Secure, time-bound QR codes for visitors
- **Multi-Channel Notifications**: Email + WhatsApp delivery
- **Real-Time Check-in**: Receptionist scans QR, host gets instant notification
- **Smart Reminders**: 30-min reminder if host hasn't reached meeting spot
- **Audit Trails**: Complete visitor logs and compliance tracking
- **Analytics Dashboard**: Visitor trends, meeting stats, and reports

## 🏗️ Architecture

```
SAK-Smart-Access-Control/
├── backend/              # Node.js + Express API
├── frontend/             # React.js Web Portal
├── receptionist-app/     # React Native Mobile App
├── docs/                 # Documentation
└── deployment/           # Docker, Nginx, CI/CD configs
```

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express
- PostgreSQL + Redis
- Socket.io (Real-time)
- Bull (Job Queue)

**Frontend:**
- React.js + TypeScript
- Tailwind CSS + shadcn/ui
- React Query
- Zustand (State Management)

**Infrastructure:**
- AWS EC2 (13.232.42.132)
- AWS RDS PostgreSQL
- AWS S3, SES, SNS
- Nginx Reverse Proxy

## 🚀 Quick Start

### 🔥 Fast Deploy to EC2 (15 minutes)
**New to the project? Start here:** [QUICKSTART.md](./QUICKSTART.md)

Complete step-by-step guide to deploy to EC2 in 15 minutes with:
- PostgreSQL setup
- Backend deployment
- Nginx configuration
- Security checklist

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- npm/yarn

### Installation

```bash
# Clone repository
git clone https://github.com/qutubkothari/SAK-Smart-Access-Control.git
cd SAK-Smart-Access-Control

# Backend setup
cd backend
npm install
cp .env.example .env
npm run migrate
npm run dev

# Frontend setup
cd ../frontend
npm install
cp .env.example .env
npm run dev
```

## 📚 Documentation

- [API Documentation](./docs/API.md)
- [Database Schema](./docs/DATABASE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [User Guide](./docs/USER_GUIDE.md)

## 🔐 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Encrypted QR codes with expiry
- Audit logging for all actions
- Rate limiting on APIs
- Data encryption at rest

## 📊 Database Schema

```
Users → Meetings → Visitors
  ↓         ↓
Departments  Notifications
              ↓
         AuditLogs
```

## 🔄 Workflow

1. **Meeting Creation**: Host logs in → Create meeting → QR generated
2. **Visitor Notification**: QR sent via Email + WhatsApp
3. **Check-in**: Receptionist scans → Validates → Notifies host
4. **Reminder**: If host not at meeting spot in 30 mins → Send reminder

## 🌐 Deployment

Deployed on AWS EC2: `13.232.42.132`

```bash
# SSH into EC2
ssh -i sak-smart-access.pem ubuntu@13.232.42.132

# Deploy
./deployment/deploy.sh
```

## 📈 Roadmap

- [ ] Phase 1: Core functionality (MVP)
- [ ] Phase 2: Mobile apps
- [ ] Phase 3: Advanced analytics
- [ ] Phase 4: IoT integration (door locks, sensors)
- [ ] Phase 5: AI-based security alerts

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## 📄 License

MIT License - see [LICENSE](./LICENSE)

## 👥 Team

- Project Manager: Senior Developer Mode
- Lead Developer: Senior Developer Mode
- Client: [Your Client Name]

## 📞 Support

For issues and questions: [Open an issue](https://github.com/qutubkothari/SAK-Smart-Access-Control/issues)
