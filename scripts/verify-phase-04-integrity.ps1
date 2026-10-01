$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Fail([string] $Message) {
  Write-Error $Message
  exit 1
}

function Invoke-Git([string[]] $Arguments) {
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & git @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($exitCode -ne 0) {
    Fail "git $($Arguments -join ' ') failed:`n$($output -join "`n")"
  }
  return @($output | ForEach-Object { $_.ToString() } | Where-Object { $_ -notmatch '^warning:' })
}

$repositoryRoot = (Invoke-Git @('rev-parse', '--show-toplevel') | Select-Object -First 1).Trim()
if (-not $repositoryRoot) { Fail 'Could not resolve the repository root.' }
Push-Location $repositoryRoot

try {
  $branch = (Invoke-Git @('branch', '--show-current') | Select-Object -First 1).Trim()

  $nodeOutput = & node --version 2>&1
  $nodeExitCode = $LASTEXITCODE
  $nodeVersion = ($nodeOutput | Select-Object -First 1).Trim()
  if ($nodeExitCode -ne 0 -or $nodeVersion -ne 'v24.19.0') {
    Fail "Node v24.19.0 is required; found '$nodeVersion'."
  }

  $phaseCommitPattern = '^(test|feat|fix|refactor|chore)\(04-[0-9]{2}\):'
  $phaseCommits = foreach ($row in Invoke-Git @('log', '--reverse', '--format=%H|%s', 'HEAD')) {
    $parts = $row -split '\|', 2
    if ($parts.Count -eq 2 -and $parts[1] -match $phaseCommitPattern) {
      [pscustomobject]@{ Hash = $parts[0]; Subject = $parts[1] }
    }
  }
  $oldestPhaseCommit = $phaseCommits | Select-Object -First 1
  if (-not $oldestPhaseCommit) { Fail 'No Phase 4 executor commit was found in HEAD history.' }

  $approvedPhaseBase = 'ccfe77e6650e95b539645700f190aaab2c924bfe'
  Invoke-Git @('cat-file', '-e', "$approvedPhaseBase^{commit}") | Out-Null
  $phaseBase = (Invoke-Git @('rev-parse', "$($oldestPhaseCommit.Hash)^") | Select-Object -First 1).Trim()
  if (-not $phaseBase) { Fail "Could not resolve the parent of $($oldestPhaseCommit.Hash)." }
  if ($phaseBase -ne $approvedPhaseBase) { Fail "Oldest Phase 4 executor commit must descend directly from approved base $approvedPhaseBase; found $phaseBase." }
  & git merge-base --is-ancestor $approvedPhaseBase HEAD
  if ($LASTEXITCODE -ne 0) { Fail "Approved Phase 4 base $approvedPhaseBase is not an ancestor of HEAD." }

  $changedFiles = @(Invoke-Git @('diff', '--name-only', "$approvedPhaseBase..HEAD") | Where-Object { $_.Trim() })
  if ($changedFiles.Count -eq 0) { Fail "Phase 4 diff $approvedPhaseBase..HEAD is empty." }

  $frozenSchemaPattern = '^apps/backend/src/api/(csrm-assessment|csrm-risk|csrm-risk-type|csrm-control|csrm-control-implementation)/content-types/[^/]+/schema\.json$'
  $manifestPattern = '(^|/)package\.json$|(^|/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json)$'
  $protectedChanges = @($changedFiles | Where-Object { $_ -match $frozenSchemaPattern -or $_ -match $manifestPattern })
  if ($protectedChanges.Count -gt 0) {
    Fail "Phase 4 changed frozen schemas, manifests, or lockfiles:`n$($protectedChanges -join "`n")"
  }

  # The fixed Phase 4 base predates the assessment-detail route. Retain the
  # existing contract exception baseline so the closed structural comparison can
  # distinguish the approved detail projection from unrelated contract changes.
  $first0417Commit = foreach ($row in Invoke-Git @('log', '--reverse', '--format=%H|%s', 'HEAD')) {
    $parts = $row -split '\|', 2
    if ($parts.Count -eq 2 -and $parts[1] -match '^(test|feat|fix|refactor|chore)\(04-17\):') { $parts[0]; break }
  }
  if (-not $first0417Commit) { Fail 'Could not resolve the first 04-17 task commit.' }
  $specificationBase = (Invoke-Git @('rev-parse', "$first0417Commit^" ) | Select-Object -First 1).Trim()
  $baseSpecificationText = (& git show "$specificationBase`:docs/references/specification.json") -join "`n"
  if ($LASTEXITCODE -ne 0 -or -not $baseSpecificationText) { Fail "Could not load assessment-detail exception base $specificationBase." }
  $baseSpecification = $baseSpecificationText | ConvertFrom-Json
  $currentSpecification = Get-Content 'docs/references/specification.json' -Raw | ConvertFrom-Json
  $detailPath = '/v1/risk_assessments/{assessmentId}'
  $baseDetailPathProperty = @($baseSpecification.paths.PSObject.Properties | Where-Object Name -eq $detailPath)[0]
  $currentDetailPathProperty = @($currentSpecification.paths.PSObject.Properties | Where-Object Name -eq $detailPath)[0]
  $baseDetailPath = if ($null -ne $baseDetailPathProperty) { $baseDetailPathProperty.Value } else { $null }
  $currentDetailPath = if ($null -ne $currentDetailPathProperty) { $currentDetailPathProperty.Value } else { $null }
  $baseGet = if ($null -ne $baseDetailPath) { $baseDetailPath.get } else { $null }
  $currentGet = if ($null -ne $currentDetailPath) { $currentDetailPath.get } else { $null }
  if (-not $baseGet -or -not $currentGet) { Fail 'Assessment detail GET path is missing.' }
  $currentDetailSchema = $currentGet.responses.'200'.content.'application/json'.schema
  if ($currentDetailSchema.'$ref' -ne '#/components/schemas/AssessmentDetailGetResponse' -or @($currentDetailSchema.PSObject.Properties).Count -ne 1) {
    Fail 'Only the assessment-detail GET 200 response schema may evolve, and it must reference AssessmentDetailGetResponse.'
  }
  $allowedDetailSchemas = @('AssessmentDetailGetResponse', 'ReleaseReadiness', 'AnalystRiskDetail', 'AnalystAssessmentDetail', 'RequestorReleasedAssessmentDetail')
  foreach ($schemaName in $allowedDetailSchemas) {
    $currentSchemaProperty = $currentSpecification.components.schemas.PSObject.Properties | Where-Object Name -eq $schemaName | Select-Object -First 1
    $baseSchemaProperty = $baseSpecification.components.schemas.PSObject.Properties | Where-Object Name -eq $schemaName | Select-Object -First 1
    if ($null -eq $currentSchemaProperty) { Fail "Approved assessment detail schema '$schemaName' is missing." }
    if ($null -ne $baseSchemaProperty) { Fail "Approved assessment detail schema '$schemaName' unexpectedly existed in the base contract." }
    $currentSpecification.components.schemas.PSObject.Properties.Remove($schemaName)
  }
  $currentGet.responses.'200'.content.'application/json'.PSObject.Properties.Remove('schema')
  $baseGet.responses.'200'.content.'application/json'.PSObject.Properties.Remove('schema')
  $baseComparable = $baseSpecification | ConvertTo-Json -Depth 100 -Compress
  $currentComparable = $currentSpecification | ConvertTo-Json -Depth 100 -Compress
  if ($baseComparable -ne $currentComparable) {
    Fail 'Specification changes exceed the approved assessment-detail GET 200 response-schema and closed variant definitions.'
  }

  $uncommittedFiles = @(
    Invoke-Git @('diff', '--name-only')
    Invoke-Git @('diff', '--cached', '--name-only')
  ) | Where-Object { $_.Trim() } | Sort-Object -Unique
  $uncommittedProtected = @($uncommittedFiles | Where-Object { $_ -match $frozenSchemaPattern -or $_ -match $manifestPattern })
  if ($uncommittedProtected.Count -gt 0) {
    Fail "Uncommitted protected-path changes exist:`n$($uncommittedProtected -join "`n")"
  }

  $phase4TestFiles = @(
    'apps/backend/tests/assessment-workflow.integration.test.ts'
    'apps/backend/tests/contract-catalogue.integration.test.ts'
    'apps/csrm/e2e/assessment-release-workflow.spec.ts'
    Get-ChildItem 'apps/csrm/src/features/assessments' -Recurse -Include '*.test.ts', '*.test.tsx' | ForEach-Object FullName
    Get-ChildItem 'apps/csrm/src/features/dashboard' -Recurse -Include '*.test.ts', '*.test.tsx' | ForEach-Object FullName
  )
  $testEscapePattern = 'PHASE4_RED|execArgv|expectsFocused|\.skip\s*\(|\.only\s*\(|\.fixme\s*\(|existsSync|Test-Path|if\s*\([^\)]*(file|path|exist)[^\)]*\)\s*(?:\{\s*)?(return|throw|continue)'
  $testEscapeHits = @(Select-String -Path $phase4TestFiles -Pattern $testEscapePattern -CaseSensitive:$false)
  if ($testEscapeHits.Count -gt 0) {
    $formatted = $testEscapeHits | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" }
    Fail "Phase 4 test escape mechanisms remain:`n$($formatted -join "`n")"
  }

  foreach ($packagePath in @('package.json', 'apps/backend/package.json', 'apps/csrm/package.json')) {
    $scripts = (Get-Content $packagePath -Raw | ConvertFrom-Json).scripts
    foreach ($scriptName in @('test', 'test:e2e')) {
      $property = $scripts.PSObject.Properties[$scriptName]
      $script = if ($null -ne $property) { $property.Value } else { $null }
      if ($null -ne $script -and $script -match 'PHASE4_RED|execArgv|expectsFocused|Test-Path|existsSync|process\.env|\$env:') {
        Fail "$packagePath script '$scriptName' conditionally controls test success: $script"
      }
    }
  }

  $scanPaths = @('apps/backend/src', 'apps/backend/tests', 'apps/csrm/app', 'apps/csrm/src', 'apps/csrm/e2e')
  $addedDiff = @(Invoke-Git (@('diff', '--unified=0', '--no-color', "$approvedPhaseBase..HEAD", '--') + $scanPaths))
  if ($addedDiff.Count -eq 0) { Fail 'Production/test diff scan returned no content.' }

  $rules = @(
    [pscustomobject]@{ Name = 'Phase 4 RED sentinel'; Pattern = 'PHASE4_RED'; TestsOnly = $false }
    [pscustomobject]@{ Name = 'focused or skipped test'; Pattern = '\.(skip|only|fixme)\s*\('; TestsOnly = $true }
    [pscustomobject]@{ Name = 'test focus argv'; Pattern = 'execArgv|expectsFocused'; TestsOnly = $true }
    [pscustomobject]@{ Name = 'missing-file test guard'; Pattern = 'existsSync|Test-Path|if\s*\([^\)]*(file|path|exist)[^\)]*\)\s*(?:\{\s*)?(return|throw|continue)'; TestsOnly = $true }
    [pscustomobject]@{ Name = 'sentinel mechanism'; Pattern = '(?i)(^|[^A-Za-z])sentinel\s*[:=]|[A-Z0-9_]+_SENTINEL'; TestsOnly = $false }
    [pscustomobject]@{ Name = 'bypass mechanism'; Pattern = '(?i)(allow|enable|disable|skip|test)[A-Za-z0-9_-]*bypass|bypass\s*[:=]|bypass(?:ed)?\s+(auth|test|check|validation|assertion|guard)'; TestsOnly = $false }
    [pscustomobject]@{ Name = 'escape hatch'; Pattern = '(?i)escape[-_ ]?hatch'; TestsOnly = $false }
    [pscustomobject]@{ Name = 'permissive fallback'; Pattern = '(?i)allow[-_ ]?on[-_ ]?error|permissive[-_ ]?(fallback|mode|success)|fallback[-_ ]?success'; TestsOnly = $false }
    [pscustomobject]@{ Name = 'swallowed error'; Pattern = '(?i)catch\s*(\([^)]*\))?\s*\{\s*\}|\.catch\s*\(\s*\(.*\)\s*=>\s*(undefined|null|true|false|\[\]|\{\})'; TestsOnly = $false }
    [pscustomobject]@{ Name = 'environment-controlled test result'; Pattern = '(?i)\bif\s*\([^)]*(process\.env|\$env:)|(process\.env\.|\$env:)[A-Z0-9_]*(TEST_SUCCESS|SKIP_TEST|FOCUS_TEST|EXPECT_PASS)'; TestsOnly = $true }
    [pscustomobject]@{ Name = 'tool attribution'; Pattern = '(?i)ChatGPT|Claude|Copilot|OpenAI|Anthropic|language model|generated by (an )?AI|authored by (an )?AI'; TestsOnly = $false }
  )

  $offences = [System.Collections.Generic.List[string]]::new()
  $currentPath = ''
  $newLineNumber = 0
  foreach ($line in $addedDiff) {
    if ($line -match '^\+\+\+ b/(.+)$') {
      $currentPath = $Matches[1]
      continue
    }
    if ($line -match '^@@ -[^ ]+ \+(\d+)(?:,\d+)? @@') {
      $newLineNumber = [int] $Matches[1]
      continue
    }
    if ($line -match '^\+(?!\+\+)') {
      $content = $line.Substring(1)
      $isTest = $currentPath -match '(?i)(^|/)(tests?|e2e)/|\.(test|spec)\.[cm]?[jt]sx?$'
      foreach ($rule in $rules) {
        if ((-not $rule.TestsOnly -or $isTest) -and $content -match $rule.Pattern) {
          $offences.Add("$($rule.Name): $currentPath`:$newLineNumber`:$content")
        }
      }
      $newLineNumber++
    }
  }
  if ($offences.Count -gt 0) {
    Fail "Added Phase 4 lines contain forbidden mechanisms:`n$($offences -join "`n")"
  }

  $catalogueA = 'docs/references/idambox-csrm-role-function-api-catalogue.json'
  $catalogueB = 'apps/backend/src/bootstrap/idambox-csrm-role-function-api-catalogue.json'
  $catalogueHash = 'A67CC51BFA34D2A882D04C0DB706FB05A49D9E320EC8A6B3FC71A8ED54351F89'
  foreach ($cataloguePath in @($catalogueA, $catalogueB)) {
    if ((Get-FileHash $cataloguePath -Algorithm SHA256).Hash -ne $catalogueHash) { Fail "$cataloguePath SHA-256 does not match the approved catalogue hash." }
  }
  if (-not [System.Linq.Enumerable]::SequenceEqual(
    [System.IO.File]::ReadAllBytes((Join-Path $repositoryRoot $catalogueA)),
    [System.IO.File]::ReadAllBytes((Join-Path $repositoryRoot $catalogueB))
  )) {
    Fail 'The authoritative and bootstrap role/function/API catalogues are not byte-identical.'
  }

  & pnpm --filter '@csrm/web' api:check
  if ($LASTEXITCODE -ne 0) { Fail 'The generated web API contract is out of date.' }

  Write-Output "Phase 4 integrity verified."
  Write-Output "  Branch: $branch"
  Write-Output "  Node: $nodeVersion"
  Write-Output "  Oldest executor commit: $($oldestPhaseCommit.Hash) $($oldestPhaseCommit.Subject)"
  Write-Output "  Approved base: $approvedPhaseBase"
  Write-Output "  Changed files: $($changedFiles.Count)"
  Write-Output "  Phase 4 test files swept: $($phase4TestFiles.Count)"
}
finally {
  Pop-Location
}
