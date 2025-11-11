# Incident Response Playbook

## Purpose
Provide a repeatable process for identifying, containing, and remediating security incidents affecting OC-Suite production environments.

## Roles
- **Incident Commander (IC)** – Owns end-to-end coordination, assigns tasks, communicates status.
- **Deputy IC** – Backs up IC, tracks timeline, ensures documentation is captured.
- **Operations Lead** – Executes infrastructure changes (scaling, isolation, secrets rotation).
- **Security Lead** – Drives forensic analysis, determines regulatory obligations.
- **Communications Lead** – Handles stakeholder updates (internal, customers, legal, PR).

## Severity Levels
| Level | Definition | Target Response |
| --- | --- | --- |
| Sev 0 | Confirmed data breach or sustained outage (>1h) | IC paged immediately, exec notification within 30 min |
| Sev 1 | Elevated error rates, partial functionality loss, suspected compromise | On-call response < 15 min, cross-functional war room |
| Sev 2 | Non-critical bug with security implications, localized abuse | Response during business hours, monitor escalation |

## Process
1. **Detect**
   - Alerts via PagerDuty/Slack (`alerting-rules.md`).
   - External report (support, bug bounty) or internal observation.
2. **Triage**
   - IC validates incident, assigns severity, opens incident channel (`#incident-<timestamp>`).
   - Start timeline document in shared drive, link Jira ticket if required.
3. **Contain**
   - Operations Lead isolates impacted services (e.g., disable connector provider, scale down workers).
   - Rotate affected credentials (`pnpm --filter api encryption:rotate` for tenant secrets, rotate infrastructure secrets via Terraform stored values).
   - Query `access_logs` for the affected timeframe to validate scope and actor details.
4. **Eradicate & Recover**
   - Patch vulnerability or revert deployment.
   - Run telemetry smoke test (`pnpm --filter api telemetry:smoke`) and critical regression suite.
   - Validate dashboards/alerts return to baseline.
5. **Communicate**
   - Communications Lead provides hourly updates to incident channel.
   - Security Lead coordinates regulatory/customer notifications if data exposure confirmed.
6. **Post-Incident**
   - Complete incident report within 48 hours (summary, root cause, actions).
   - Schedule blameless retrospective, track follow-up tasks (Jira) with owners/due dates.
   - Update runbooks, threat model, and alert thresholds based on lessons learned.

## Checklist
- [ ] Incident ticket opened and severity assigned.
- [ ] Incident room created with IC, leads, stakeholders.
- [ ] Impacted tenants/customers identified.
- [ ] Mitigation plan agreed and executed.
- [ ] Secrets rotated and validated.
- [ ] Monitoring/alerts restored to green.
- [ ] Customer/internal comms delivered.
- [ ] Post-incident report completed and archived.

## Communication Templates
**Initial Internal Update (Slack #incident channel)**
```
Incident declared: <summary>
Severity: <Sev 0/1/2>
Affected scope: <services/tenants>
IC: <name>, Ops: <name>, Security: <name>
Next update in <X> minutes.
```

**Customer Notification (draft)**
```
Subject: OC-Suite Service Incident Update

We experienced an incident on <date/time> affecting <impact>. The issue has been contained and we are actively working on remediation. No customer action is required at this time. We will provide another update by <time>. If you have questions, contact <support channel>.
```

## Tooling & References
- Dashboards: `docs/observability/dashboards/`
- Runbooks: `docs/observability/runbooks/`
- Threat model: `docs/security/threat-model.md`
- Encryption rotation: `docs/security/encryption-key-rotation.md`
- Access logs: `docs/security/access-logs.md`
- On-call schedule & contact list: company wiki (link to update during handover)
