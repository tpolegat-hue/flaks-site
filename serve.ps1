param(
  [int]$Port = 4173,
  [string]$Root = "."
)

$ErrorActionPreference = "Stop"
$rootPath = (Resolve-Path -LiteralPath $Root).Path
$rootPrefix = $rootPath.TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$listener = $null
try {
  $listener = [System.Net.HttpListener]::new()
} catch [System.PlatformNotSupportedException] {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { throw }

  $nodeServer = @'
const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.argv[2]);
const root = path.resolve(process.argv[3]);
const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

http.createServer((request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const cleanPath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    let fullPath = path.resolve(root, cleanPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      fullPath = path.join(fullPath, "index.html");
    }
    if ((!fullPath.startsWith(rootPrefix) && fullPath !== root) || !fs.existsSync(fullPath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": mime[path.extname(fullPath).toLowerCase()] || "application/octet-stream" });
    fs.createReadStream(fullPath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Server error");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}/`);
});
'@
  $encodedServer = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($nodeServer))
  & $node.Source -e "eval(Buffer.from(process.argv[1], 'base64').toString('utf8'))" $encodedServer $Port $rootPath
  exit $LASTEXITCODE
}
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $rootPath at http://localhost:$Port/"

function Get-Mime([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".css" { "text/css; charset=utf-8"; break }
    ".js" { "application/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".svg" { "image/svg+xml"; break }
    default { "application/octet-stream" }
  }
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $urlPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($urlPath)) { $urlPath = "index.html" }
    $fullPath = [IO.Path]::GetFullPath((Join-Path $rootPath $urlPath))
    if ([IO.Directory]::Exists($fullPath)) {
      $fullPath = [IO.Path]::Combine($fullPath, "index.html")
    }

    if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or -not [IO.File]::Exists($fullPath)) {
      $context.Response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("Not found")
    } else {
      $context.Response.StatusCode = 200
      $context.Response.ContentType = Get-Mime $fullPath
      $bytes = [IO.File]::ReadAllBytes($fullPath)
    }

    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $context.Response.StatusCode = 500
  } finally {
    $context.Response.OutputStream.Close()
  }
}
