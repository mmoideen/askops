## What changed

Describe the change and why it is needed.

## Production readiness mini checklist

- [ ] Tests added or updated for the change
- [ ] No secrets, keys, or connection strings in the diff
- [ ] RBAC and retrieval scoping unaffected, or covered by a test if changed
- [ ] Telemetry still emits spans and audit entries for new code paths
- [ ] Eval suite passes locally (`npm run eval`)
- [ ] Docs updated if behavior, config, or operations changed
- [ ] No em dashes introduced (CI enforces this)

## Rollback plan

How would this change be reverted if it misbehaves in production?
