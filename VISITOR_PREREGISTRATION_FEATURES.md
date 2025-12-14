# Visitor Pre-Registration & Photo Capture Features

## 📋 Overview
Two new major features have been added to SAK Smart Access Control:
1. **Visitor Pre-Registration Portal** - Public self-service registration
2. **Photo Capture at Check-in** - Webcam integration for visitor photos

---

## 🎯 Feature 1: Visitor Pre-Registration Portal

### Description
Visitors can now pre-register themselves for visits without requiring host intervention. They receive a QR code via email that can be used for check-in.

### Access
**Public URL:** `http://your-domain.com/preregister`
- No login required
- Mobile-friendly interface

### User Flow
1. **Step 1: Personal Information**
   - Full Name
   - Email Address
   - Phone Number
   - Company/Organization
   - Visitor Type (Guest, Vendor, Contractor, Consultant, Candidate)

2. **Step 2: Visit Details**
   - Host ITS ID
   - Visit Date & Time
   - Purpose of Visit
   - ID Proof Type (Passport, Driver's License, National ID, Employee ID)
   - ID Number
   - NDA Acceptance

3. **Step 3: Photo Upload (Optional)**
   - Webcam capture or file upload
   - Helps with faster check-in
   - 5MB max file size

4. **Confirmation**
   - QR code displayed on screen
   - QR code sent to email
   - Host notified of pre-registration

### Backend API Endpoints

#### POST `/api/v1/preregister/register` (Public)
Pre-register a visitor for a future visit.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "company": "ABC Corp",
  "visitor_type": "guest",
  "host_its_id": "ITS123456",
  "visit_date": "2025-12-20T10:00:00",
  "purpose": "Business Meeting",
  "id_proof_type": "passport",
  "id_proof_number": "AB1234567",
  "nda_accepted": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Pre-registration successful! QR code sent to your email.",
  "data": {
    "visitor_id": "uuid",
    "meeting_id": "uuid",
    "qr_code": "data:image/png;base64,...",
    "host_name": "Jane Smith",
    "visit_date": "2025-12-20T10:00:00",
    "status": "pending_approval"
  }
}
```

#### GET `/api/v1/preregister/visitors` (Protected)
Get pre-registered visitors for logged-in host.

**Query Parameters:**
- `date` - Filter by visit date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "company": "ABC Corp",
      "meeting_time": "2025-12-20T10:00:00",
      "location": "Reception Area",
      "qr_code": "encrypted_token",
      "check_in_time": null
    }
  ]
}
```

#### POST `/api/v1/preregister/visitors/:visitor_id/photo` (Protected)
Upload photo for pre-registered visitor.

**Content-Type:** `multipart/form-data`
**Body:** `photo` (image file, max 5MB)

**Response:**
```json
{
  "success": true,
  "message": "Photo uploaded successfully",
  "data": {
    "photo_url": "data:image/jpeg;base64,..."
  }
}
```

#### POST `/api/v1/preregister/visitors/:visitor_id/approve` (Protected - Host/Admin)
Approve a pre-registered visitor.

**Response:**
```json
{
  "success": true,
  "message": "Visitor approved successfully"
}
```

### Security Features
- **Blacklist Check:** Automatically blocks blacklisted emails/phones
- **Host Verification:** Validates host ITS ID exists and is active
- **Duplicate Prevention:** Checks for existing registrations
- **Email Validation:** Regex validation for email format
- **Phone Validation:** Regex validation for phone numbers
- **QR Expiry:** QR codes expire 24 hours after visit time

### Notifications
- **Visitor:** Receives QR code via email
- **Host:** Notified of new pre-registration in system

---

## 📸 Feature 2: Photo Capture at Check-in

### Description
Receptionists can now capture visitor photos during check-in using webcam or upload from file.

### Access
**Route:** `/receptionist` (Requires Receptionist/Admin role)

### User Flow
1. Receptionist enters/scans QR code
2. Click camera icon to capture photo
3. Position visitor in frame
4. Click "Capture Photo"
5. Review and "Use Photo" or "Retake"
6. Photo automatically attached to check-in
7. Complete check-in process

### Features
- **Live Webcam Preview:** Real-time video feed
- **Photo Preview:** Review before confirmation
- **Retake Option:** Capture multiple times
- **Optional:** Photo is not mandatory for check-in
- **Auto-compression:** Photos converted to JPEG with 85% quality
- **Base64 Storage:** Photos stored as data URLs (production should use S3/CloudStorage)

### Backend Changes

#### Updated: POST `/api/v1/visitors/check-in`
Now accepts multipart/form-data for photo upload.

**Content-Type:** `multipart/form-data`

**Body:**
- `qr_code` (required) - QR token
- `photo` (optional) - Image file

**Response:** Same as before, but includes `photo_url` if uploaded

### Frontend Components

#### `WebcamCapture.tsx`
Reusable webcam capture component with preview.

**Props:**
- `onCapture: (photoDataUrl: string) => void`
- `onCancel?: () => void`

**Features:**
- Browser permission handling
- Video stream management
- Canvas-based photo capture
- Cleanup on unmount

#### `PhotoUpload.tsx`
File upload component with preview.

**Props:**
- `onUpload: (file: File) => void`
- `currentPhoto?: string`

**Features:**
- File size validation (5MB max)
- Image type validation
- Preview display
- Change photo option

### Browser Compatibility
- **Chrome/Edge:** Full support
- **Firefox:** Full support
- **Safari:** Full support (requires HTTPS in production)
- **Mobile:** Camera access requires HTTPS

---

## 🚀 Deployment

### Environment Variables
No new environment variables required. Uses existing configuration.

### Database
No schema changes needed. Uses existing `visitors.photo_url` column.

### Production Considerations

1. **Photo Storage:**
   ```typescript
   // Current: Base64 in database (dev only)
   // Production: Upload to S3/CloudStorage
   
   import AWS from 'aws-sdk';
   const s3 = new AWS.S3();
   
   // Upload to S3
   const uploadPhoto = async (photoBuffer, visitorId) => {
     const key = `visitors/${visitorId}/photo-${Date.now()}.jpg`;
     await s3.upload({
       Bucket: process.env.S3_BUCKET,
       Key: key,
       Body: photoBuffer,
       ContentType: 'image/jpeg'
     }).promise();
     return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
   };
   ```

2. **HTTPS Required:**
   - Webcam access requires HTTPS in production
   - Install SSL certificate using Let's Encrypt

3. **File Size Limits:**
   - Current: 5MB per photo
   - Adjust nginx client_max_body_size if needed

### Nginx Configuration
```nginx
# Add to your server block
client_max_body_size 10M;  # Allow up to 10MB uploads
```

---

## 📊 Usage Analytics

### Track Pre-Registrations
```sql
-- Count pre-registrations by date
SELECT 
  DATE(created_at) as date,
  COUNT(*) as registrations
FROM visitors
WHERE check_in_time IS NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Photo Capture Rate
```sql
-- Percentage of check-ins with photos
SELECT 
  COUNT(*) as total_checkins,
  COUNT(photo_url) as with_photo,
  ROUND(COUNT(photo_url) * 100.0 / COUNT(*), 2) as photo_percentage
FROM visitors
WHERE check_in_time IS NOT NULL;
```

---

## 🧪 Testing

### Test Pre-Registration (Manual)
1. Navigate to `http://localhost:5173/preregister`
2. Fill in all required fields
3. Use test host ITS ID: `ITS100001`
4. Set visit date to tomorrow
5. Capture or upload photo
6. Submit and verify QR code received

### Test Photo Capture (Manual)
1. Login as receptionist (`ITS000002` / `Reception123!`)
2. Navigate to `/receptionist`
3. Enter a valid QR code
4. Click camera icon
5. Allow webcam access
6. Capture photo
7. Verify photo appears in check-in confirmation

### API Testing
```bash
# Test pre-registration
curl -X POST http://localhost:3000/api/v1/preregister/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Visitor",
    "email": "test@example.com",
    "phone": "+1234567890",
    "host_its_id": "ITS100001",
    "visit_date": "2025-12-20T10:00:00"
  }'

# Test photo upload (requires visitor_id and JWT token)
curl -X POST http://localhost:3000/api/v1/preregister/visitors/{visitor_id}/photo \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "photo=@/path/to/photo.jpg"
```

---

## 🔐 Security Considerations

1. **Rate Limiting:** Pre-registration endpoint is public but rate-limited
2. **Input Validation:** All inputs sanitized and validated
3. **Blacklist Check:** Automatic blocking of blacklisted visitors
4. **Photo Privacy:** Photos stored securely, not publicly accessible
5. **GDPR Compliance:** Photos are visitor data - include in privacy policy

---

## 📱 Mobile Optimization

Both features are fully responsive:
- Touch-friendly buttons
- Mobile camera access
- Optimized layouts for small screens
- Progressive form (step-by-step)

---

## 🎨 UI/UX Highlights

### Pre-Registration Portal
- ✅ 3-step wizard with progress indicator
- ✅ Real-time validation with error messages
- ✅ Success page with QR code display
- ✅ Clear instructions and help text
- ✅ NDA acceptance checkbox

### Photo Capture
- ✅ Live video preview with overlay
- ✅ Circular capture button (Instagram-style)
- ✅ Photo preview before confirmation
- ✅ Retake and remove options
- ✅ Non-blocking (optional feature)

---

## 🐛 Troubleshooting

### Webcam Not Working
**Issue:** Camera not starting
**Solution:**
- Check browser permissions
- Ensure HTTPS in production
- Try different browser
- Check device camera access

### Photo Upload Fails
**Issue:** 413 Payload Too Large
**Solution:**
- Check file size (must be < 5MB)
- Increase nginx client_max_body_size
- Compress image before upload

### Pre-Registration Email Not Received
**Issue:** No QR code email
**Solution:**
- Check email service configuration
- Verify SMTP settings in .env
- Check spam folder
- Review backend logs

---

## 📈 Future Enhancements

1. **Facial Recognition:** Match captured photo with pre-registered photo
2. **Badge Printing:** Auto-print visitor badge with photo
3. **ID Document Scan:** OCR for ID proof validation
4. **Multi-photo Capture:** Front + ID photo
5. **Photo Gallery:** View all visitor photos in admin panel
6. **Bulk Pre-Registration:** CSV upload for multiple visitors
7. **Calendar Integration:** Sync with Outlook/Google Calendar
8. **SMS Notifications:** Send QR code via SMS too

---

## ✅ Success Metrics

After deploying these features, monitor:
- Pre-registration adoption rate
- Photo capture compliance
- Check-in time reduction
- User satisfaction scores
- Security incident reduction

---

## 📞 Support

For issues or questions:
- **Backend:** Check logs in `backend/logs/`
- **Frontend:** Check browser console
- **API Testing:** Use Postman collection
- **Documentation:** Refer to API.md for full endpoint details

---

**Last Updated:** December 13, 2025
**Version:** 1.1.0
**Status:** ✅ Production Ready
