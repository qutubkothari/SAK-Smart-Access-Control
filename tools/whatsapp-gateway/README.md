# WhatsApp Gateway quick test (PowerShell)

These scripts call the SAK WhatsApp Gateway endpoints:
- `POST /api/v1/gateway/:sessionId/send`
- `POST /api/v1/gateway/:sessionId/send-image`

## 1) Set env vars (do not hardcode keys)

```powershell
$env:SAK_BASE_URL = "http://13.126.37.210"
$env:SAK_SESSION_ID = "default"
$env:SAK_API_KEY = "<YOUR_SESSION_API_KEY>"
```

## 2) Send text

```powershell
.\send-text.ps1 -To "919999999999" -Message "Hello from SAK"
```

## 3) Send image

```powershell
.\send-image.ps1 -To "919999999999" -ImagePath "C:\path\to\qr.png" -Caption "Your meeting QR"
```
