param([string]$BaseUrl = "http://localhost:5188")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromSeconds(15)
$script:Count = 0

function Request-Api([string]$Method, [string]$Path, [string]$Token = "", $Body = $null) {
    $request = [System.Net.Http.HttpRequestMessage]::new()
    $request.Method = [System.Net.Http.HttpMethod]::new($Method)
    $request.RequestUri = [Uri]($BaseUrl.TrimEnd('/') + $Path)
    if ($Token) { $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token) }
    if ($null -ne $Body) {
        $json = ConvertTo-Json -InputObject $Body -Compress
        $request.Content = [System.Net.Http.StringContent]::new($json, [Text.Encoding]::UTF8, "application/json")
    }
    $response = $null
    try {
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        return @{ Status = [int]$response.StatusCode; Data = ($text | ConvertFrom-Json) }
    } finally {
        if ($null -ne $response) { $response.Dispose() }
        $request.Dispose()
    }
}
function Expect-Status($Response, [int]$Expected, [string]$Name) {
    if ($Response.Status -ne $Expected) { throw "$Name : expected $Expected, received $($Response.Status)" }
    $script:Count++
    Write-Host "PASS $Expected - $Name" -ForegroundColor Green
}
function Base64Url([byte[]]$Bytes) {
    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}
function Get-LocalSetting([string]$Name, [string]$Fallback = "") {
    $value = [Environment]::GetEnvironmentVariable($Name)
    if ($null -ne $value) { return $value }
    $path = Join-Path $PSScriptRoot "src/JwtDemo/.env"
    if (Test-Path $path) {
        foreach ($line in Get-Content $path) {
            if ($line.Trim() -match "^$Name\s*=(.*)$") { return $Matches[1].Trim().Trim('"').Trim("'") }
        }
    }
    return $Fallback
}

try {
    Expect-Status (Request-Api GET /api/demo/public) 200 "Public API without login"
    Expect-Status (Request-Api GET /api/me) 401 "Missing token /api/me"
    Expect-Status (Request-Api GET /api/admin) 401 "Missing token /api/admin"
    Expect-Status (Request-Api POST /api/auth/login "" @{username="user"; password="wrong"}) 401 "Wrong password"
    Expect-Status (Request-Api POST /api/auth/login "" @{username="unknown"; password="wrong"}) 401 "Unknown account"
    $user = Request-Api POST /api/auth/login "" @{username="user"; password="123456"; role="admin"}
    Expect-Status $user 200 "User login (injected role must be ignored)"
    if ($user.Data.user.role -ne "user" -or -not $user.Data.accessToken) { throw "Invalid login response or client role trusted" }
    $userToken = $user.Data.accessToken
    Expect-Status (Request-Api GET /api/me $userToken) 200 "User profile"
    Expect-Status (Request-Api GET /api/admin $userToken) 403 "User denied admin access"
    Expect-Status (Request-Api GET /api/me "fake-token") 401 "Malformed JWT"

    $key = Get-LocalSetting JWT_KEY
    if (-not $key) { throw "JWT_KEY not found. Start this project's local app with F5 before testing expiry." }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $claims = @{
        sub="$($user.Data.user.id)"; name="user"; role="user";
        iss=(Get-LocalSetting JWT_ISSUER "JwtDemo"); aud=(Get-LocalSetting JWT_AUDIENCE "JwtDemo.Web");
        nbf=($now - 120); exp=($now - 60)
    }
    $header = Base64Url ([Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
    $payload = Base64Url ([Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $claims -Compress)))
    $signer = [System.Security.Cryptography.HMACSHA256]::new()
    try {
        $signer.Key = [Text.Encoding]::UTF8.GetBytes($key)
        $signature = Base64Url ($signer.ComputeHash([Text.Encoding]::UTF8.GetBytes("$header.$payload")))
    } finally { $signer.Dispose() }
    Expect-Status (Request-Api GET /api/me "$header.$payload.$signature") 401 "Correctly signed but expired JWT"

    $admin = Request-Api POST /api/auth/login "" @{username="admin"; password="123456"}
    Expect-Status $admin 200 "Admin login"
    Expect-Status (Request-Api GET /api/admin $admin.Data.accessToken) 200 "Admin access"
    Expect-Status (Request-Api GET /api/me $admin.Data.accessToken) 200 "Admin profile"
    Write-Host "Completed $script:Count checks. Test browser logout separately or run node --test tests/frontend.test.cjs."
} finally { $client.Dispose() }
