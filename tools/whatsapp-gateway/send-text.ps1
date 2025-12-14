param(
  [Parameter(Mandatory=$true)][string]$To,
  [Parameter(Mandatory=$true)][string]$Message,
  [string]$BaseUrl = $env:SAK_BASE_URL,
  [string]$SessionId = $env:SAK_SESSION_ID,
  [string]$ApiKey = $env:SAK_API_KEY
)

if (-not $BaseUrl) { throw "Missing SAK_BASE_URL env var (e.g. http://13.126.37.210)" }
if (-not $SessionId) { throw "Missing SAK_SESSION_ID env var (e.g. default)" }
if (-not $ApiKey) { throw "Missing SAK_API_KEY env var" }

$uri = "$BaseUrl/api/v1/gateway/$SessionId/send"
$body = @{ to = $To; message = $Message } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri $uri -Headers @{ "x-api-key" = $ApiKey } -ContentType "application/json" -Body $body
