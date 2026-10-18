<#
.SYNOPSIS
Re-applies midPoint configuration from docker/midpoint/objects/ to the running midPoint.

.DESCRIPTION
Post-initial objects load only once, when the repository is created. This script
PUTs each numbered object through midPoint's REST API (create or overwrite by OID),
so the change goes through midPoint's model and caches. The call runs inside the
midpoint container: the administrator password never reaches the terminal.
Stops at the first failure with a non-zero exit code. Same behaviour as reload.sh.

.EXAMPLE
docker/midpoint/reload.ps1
docker/midpoint/reload.ps1 110-resource-scim-spike.xml
#>
param([Parameter(ValueFromRemainingArguments = $true)][string[]] $Files)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$objectsDir = Join-Path $PSScriptRoot 'objects'
if (-not $Files -or $Files.Count -eq 0) {
  $Files = Get-ChildItem -Path $objectsDir -File |
    Where-Object { $_.Name -match '^\d{3}-.+\.xml$' } |
    Sort-Object Name |
    ForEach-Object { $_.Name }
}

# REST collection for each object root element used in docker/midpoint/objects.
$collections = @{
  resource = 'resources'; user = 'users'; role = 'roles'; archetype = 'archetypes'
  objectTemplate = 'objectTemplates'; task = 'tasks'
  systemConfiguration = 'systemConfigurations'; securityPolicy = 'securityPolicies'
  valuePolicy = 'valuePolicies'; orgType = 'orgs'; org = 'orgs'; objectCollection = 'objectCollections'
}

# The container script uses only single quotes: Windows PowerShell 5.1 (and the
# Legacy native-argument mode) would split an argument that holds double quotes.
# set -f and an empty IFS stop the unquoted expansions from splitting or globbing.
# Render inside the container so the Identity Source token stays there. A failed
# render reports a sentinel and exits before curl can send anything.
$curl = 'set -f; IFS=; body=$(/opt/midpoint/bin/idambox-render.sh /opt/midpoint/objects-src/$0) || { echo render; exit 0; }; ' +
  'printf ''%s'' $body | curl -sS -o /tmp/reload-response -w ''%{http_code}'' -X PUT ' +
  '-u administrator:$MP_SET_midpoint_administrator_initialPassword ' +
  '-H ''Content-Type: application/xml'' -H ''Accept: application/json'' ' +
  '--data-binary @- ' +
  'http://localhost:8080/midpoint/ws/rest/$1/$2'

foreach ($name in $Files) {
  $src = Join-Path $objectsDir $name
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) {
    Write-Error "reload: no such object file: $name" -ErrorAction Continue
    exit 1
  }
  [xml] $doc = Get-Content -LiteralPath $src -Raw
  $root = $doc.DocumentElement.LocalName
  $oid = $doc.DocumentElement.GetAttribute('oid')
  if (-not $oid) {
    Write-Error "reload: ${name}: the root element needs a fixed oid attribute" -ErrorAction Continue
    exit 1
  }
  $collection = $collections[$root]
  if (-not $collection) {
    Write-Error "reload: ${name}: unsupported object type <$root>; add it to `$collections" -ErrorAction Continue
    exit 1
  }

  $code = docker exec midpoint sh -c $curl $name $collection $oid
  if ($LASTEXITCODE -ne 0) {
    Write-Error "reload: ${name} failed: docker exec exited $LASTEXITCODE" -ErrorAction Continue
    exit 1
  }
  if ($code -eq 'render') {
    Write-Error "reload: ${name} not sent: it could not be rendered (see above)" -ErrorAction Continue
    exit 1
  }
  if ($code -in '200', '201', '202', '204') {
    Write-Output "reloaded $name ($root $oid): HTTP $code"
  } else {
    Write-Error "reload: $name failed: HTTP $code" -ErrorAction Continue
    docker exec midpoint sh -c 'grep -o ''.message. *: *.[^,]*'' /tmp/reload-response | head -3'
    exit 1
  }
}
