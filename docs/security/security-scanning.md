# Security Scanning Playbook

Phase 7 introduces repeatable security scanning across dependencies, source code, and runtime surfaces. Run these steps before each release and monitor results via CI.

## 1. Dependency Hygiene
- Enable GitHub Dependabot by committing `.github/dependabot.yml` (see repo root). Review alerts weekly.
- Run `pnpm audit --audit-level=moderate` in CI; track findings in Jira with target fix dates.
- For high/critical CVEs, patch or pin dependencies before release.

## 2. Secret & Config Scanning
- Use `gitleaks` locally: `gitleaks detect --no-banner --redact`.
- Add a CI step (see reference workflow in `.github/workflows/`) to execute gitleaks on pull requests.
- Configure GitHub Advanced Security secret scanning if available; add custom patterns for tenant keys.

## 3. OWASP ZAP Baseline
1. Start target environment (staging) with test credentials.
2. Execute:
   ```powershell
   docker run --rm -v %CD%/zap-reports:/zap/wrk owasp/zap2docker-stable zap-baseline.py ^
     -t https://staging.api.example.com/health ^
     -a -r zap-report.html -x zap-report.xml
   ```
3. Review the HTML report for medium/high alerts; file tickets with owners.
4. Store reports under `zap-reports/<release>/` for audit.

## 4. Static Application Security Testing (SAST)
- Run `pnpm lint` and `pnpm typecheck` (already part of CI).
- Optional: integrate `semgrep` with `semgrep ci --config auto`.

## 5. Tracking & Reporting
- Log scan executions and results in `docs/security/audit-status.md`.
- Block releases until critical findings are remediated or risk-accepted by Security Lead.

## References
- `docs/security/threat-model.md`
- `docs/security/incident-response.md`
- `docs/launch-checklist.md`
