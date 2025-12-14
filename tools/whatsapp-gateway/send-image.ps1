param(
  [Parameter(Mandatory=$true)][string]$To,
  [Parameter(Mandatory=$true)][string]$ImagePath,
  [string]$Caption = "",
  [string]$BaseUrl = $env:SAK_BASE_URL,
  [string]$SessionId = $env:SAK_SESSION_ID,
  [string]$ApiKey = $env:SAK_API_KEY
)

if (-not $BaseUrl) { throw "Missing SAK_BASE_URL env var (e.g. http://13.126.37.210)" }
if (-not $SessionId) { throw "Missing SAK_SESSION_ID env var (e.g. default)" }
if (-not $ApiKey) { throw "Missing SAK_API_KEY env var" }
if (-not (Test-Path $ImagePath)) { throw "ImagePath not found: $ImagePath" }

Add-Type -AssemblyName System.Net.Http

$uri = "$BaseUrl/api/v1/gateway/$SessionId/send-image"

$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Add("x-api-key", $ApiKey)

$form = New-Object System.Net.Http.MultipartFormDataContent
$form.Add((New-Object System.Net.Http.StringContent($To)), "to")
if ($Caption) { $form.Add((New-Object System.Net.Http.StringContent($Caption)), "caption") }

$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $ImagePath))
$fileContent = New-Object System.Net.Http.ByteArrayContent($bytes)

# Best-effort content-type
$ext = [System.IO.Path]::GetExtension($ImagePath).ToLowerInvariant()
$mime = if ($ext -eq ".jpg" -or $ext -eq ".jpeg") { "image/jpeg" } else { "image/png" }
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse($mime)

$form.Add($fileContent, "image", [System.IO.Path]::GetFileName($ImagePath))

$resp = $client.PostAsync($uri, $form).Result
$resp.Content.ReadAsStringAsync().Result
