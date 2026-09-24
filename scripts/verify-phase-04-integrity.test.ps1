$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$guard = Get-Content (Join-Path $PSScriptRoot 'verify-phase-04-integrity.ps1') -Raw
$guardPath = Join-Path $PSScriptRoot 'verify-phase-04-integrity.ps1'

foreach ($required in @(
  "AssessmentDetailGetResponse",
  "Specification changes exceed the approved assessment-detail GET 200 response-schema and closed variant definitions.",
  "ccfe77e6650e95b539645700f190aaab2c924bfe",
  "allowedDetailSchemas",
  'Assessment detail GET path is missing.',
  '$phaseBase -ne $approvedPhaseBase',
  'merge-base --is-ancestor $approvedPhaseBase HEAD',
  '$approvedPhaseBase..HEAD',
  'Get-FileHash $cataloguePath -Algorithm SHA256',
  'A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89',
  'SequenceEqual',
  'Could not load assessment-detail exception base'
)) {
  if ($guard.IndexOf($required, [System.StringComparison]::Ordinal) -lt 0) {
    throw "Integrity guard regression: required structural check is absent: $required"
  }
}

if ($guard -match 'dylan-test|Phase 4 verification must run on') {
  throw 'Integrity guard regression: named-branch verification gate remains.'
}

if ($guard -match 'approvedPhaseBase`:\$cataloguePath|differs from its approved-base blob') {
  throw 'Integrity guard regression: catalogue protection must use the authoritative SHA-256 and cross-copy byte parity, not the incompatible pre-Phase-4 catalogue blob.'
}

$repositoryRoot = (& git rev-parse --show-toplevel).Trim()
$specificationPath = Join-Path $repositoryRoot 'docs/references/specification.json'
$originalSpecification = [System.IO.File]::ReadAllBytes($specificationPath)
$detailPath = '/v1/risk_assessments/{assessmentId}'
$fixtures = [ordered]@{
  'changed path' = {
    param($specification)
    $detail = $specification.paths.PSObject.Properties[$detailPath].Value
    $specification.paths.PSObject.Properties.Remove($detailPath)
    $specification.paths | Add-Member -NotePropertyName '/v1/risk_assessments/{changedAssessmentId}' -NotePropertyValue $detail
  }
  'changed operationId' = { param($specification) $specification.paths.$detailPath.get.operationId = 'hostileOperationId' }
  'changed parameter' = { param($specification) $specification.paths.$detailPath.get.parameters[0] | Add-Member -Force -NotePropertyName required -NotePropertyValue $false }
  'changed request body' = { param($specification) $specification.paths.$detailPath.get | Add-Member -Force -NotePropertyName requestBody -NotePropertyValue @{ required = $true } }
  'changed non-200 response' = { param($specification) $specification.paths.$detailPath.get.responses | Add-Member -Force -NotePropertyName '418' -NotePropertyValue @{ description = 'hostile' } }
  'unrelated schema' = { param($specification) $specification.components.schemas | Add-Member -Force -NotePropertyName HostileSchema -NotePropertyValue @{ type = 'string' } }
}

try {
  foreach ($fixture in $fixtures.GetEnumerator()) {
    [System.IO.File]::WriteAllBytes($specificationPath, $originalSpecification)
    $mutated = Get-Content $specificationPath -Raw | ConvertFrom-Json
    & $fixture.Value $mutated
    $mutated | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $specificationPath -Encoding utf8NoBOM
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $guardPath 2>&1
    if ($LASTEXITCODE -eq 0 -or ($output -join "`n") -notmatch 'Specification changes exceed|Assessment detail GET path is missing|Only the assessment-detail|Index was outside the bounds') {
      throw "Integrity guard regression: hostile fixture '$($fixture.Key)' was not rejected by the production guard.`n$($output -join "`n")"
    }
    Write-Output "Hostile specification fixture rejected: $($fixture.Key)"
  }
}
finally {
  [System.IO.File]::WriteAllBytes($specificationPath, $originalSpecification)
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $guardPath
if ($LASTEXITCODE -ne 0) { throw 'Integrity guard must run successfully from the current branch.' }

Write-Output 'Phase 4 integrity guard regression checks passed.'
