# Agent Instructions

## Commit Attribution
AI commits MUST include:
```text
Co-Authored-By: (the agent's name and attribution byline)
```

## Working Notes
- Keep handoff docs concise; link to source docs rather than duplicating them.
- Markdown context cleanup is tracked in `docs/prds/2026-06-15-markdown-context-pruning-spec.md`; handle it before trusting old docs/artifacts.
- Preserve unrelated user changes. Stage narrowly and check `git status` before committing.
