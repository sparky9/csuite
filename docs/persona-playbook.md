# Persona Playbook

Comprehensive guide for defining, maintaining, and extending the executive personas that power the board meeting experience.

## Current Personas

| ID  | Title                    | Voice & Focus                                                                   | Required Context Keys                                                     |
| --- | ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ceo | Chief Executive Officer  | Decisive, strategic, forward-looking. Synthesises signals into clear calls.     | businessProfile, topRisks, growthHighlights, openActionItems              |
| cfo | Chief Financial Officer  | Analytic, risk-aware, data-backed. Optimises financial health and runway.       | analyticsSnapshots, revenueMetrics, moduleInsights, costDrivers           |
| cmo | Chief Marketing Officer  | Customer-centric, growth-minded. Turns funnel signals into campaigns.           | moduleInsights, analyticsSnapshots, recentWins, personaQuestions          |
| cto | Chief Technology Officer | Calm, systems-oriented, delivery-focused. Highlights platform health and risks. | moduleInsights, analyticsSnapshots, openActionItems, technicalInitiatives |

Personas are declared in `packages/module-sdk/src/personas.json`. They feed the prompt builder at `apps/api/src/services/persona-prompts.ts`, so every persona definition must include:

- `id`: string identifier matching the prompt builder input (e.g. `cto`).
- `name`: human-readable title rendered in the UI and transcripts.
- `tone`: high-level guidance on speaking style.
- `expertise`: array of domain specialties used when composing instructions.
- `maxTokens`: LLM response budget for the persona.
- `streamChunkSize`: desired streaming window for front-end cadence.
- `focus`: single-line reminder of the persona’s mission.
- `requiredContext`: keys that the orchestrator must supply when building prompts.

## Adding a New Persona

1. **Update the configuration**
   - Add a new object to `packages/module-sdk/src/personas.json` with the fields above.
   - Choose a concise `id` and keep tone/focus specific so the LLM stays on-track.

2. **Extend prompt context**
   - Ensure the orchestrator collects any additional context mentioned in `requiredContext`.
   - Update `apps/api/src/services/persona-prompts.ts` to format new context values if necessary.

3. **Document expectations**
   - Append the persona to this playbook (table above).
   - Capture guidance for support/ops teams: when to involve the persona, expected outputs, and escalation paths.

4. **Update seeds & demos**
   - Add representative transcript data inside `packages/db/scripts/seed-slice3.ts` so the demo tenant showcases the persona.

5. **Verify coverage**
   - Run `pnpm --filter @ocsuite/module-sdk typecheck` to confirm schema alignment.
   - Execute `pnpm --filter @ocsuite/db test` to ensure RLS coverage still passes.
   - Spot-check the orchestrated meeting flow in the UI after re-seeding: `pnpm --filter @ocsuite/db seed:slice3`.

## Support Tips

- **Persona Training Drift**: If outcomes feel off-tone, review the `tone` and `focus` strings. Small wording tweaks can materially change model behaviour.
- **Missing Context Errors**: When a persona’s required context is unavailable, the prompt builder logs a warning. Support teams should check upstream data collectors (analytics, insights, action items) to restore coverage.
- **Token Budgeting**: Keep `maxTokens` balanced across personas so meetings finish within expected duration. The board meeting metadata (`BoardMeeting.tokenUsage`) surfaces real token spend per persona.

Keep this playbook updated whenever personas evolve or new executive profiles are introduced. Strong documentation keeps support teams ready to answer customer questions quickly.
