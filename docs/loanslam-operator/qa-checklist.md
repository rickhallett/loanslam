# loanslam-operator — QA checklist

[← Manual index](README.md)

A comprehensive, repeatable verification that the operator system runs as
designed. Every step is validated by an observable: a stdout string, an exit
code, or (for the live section) Hell Week / judge LLM output.

## How to run this (agent instructions)

- Work top to bottom. For each step: run **Run**, capture stdout **and** exit
  code, compare to **Pass if**, then tick the box and paste what you saw into
  **Observed**.
- Sections **A–M are deterministic** — no `OPENAI_API_KEY`, no Postgres, no
  network. They are safe to run unattended.
- Section **N is live behaviour** — optional, requires `OPENAI_API_KEY` and a
  reachable Postgres; it costs model spend. Validate it from the run report
  numbers and the judge LLM verdicts.
- **Precondition for fixture tests:** a clean working tree. Each fixture test
  stages a throwaway file, runs a check, then unstages and deletes it. None of
  them commit. After each, the tree must be clean again.
- Capture exit codes with `$?` immediately after the command, or
  `${PIPESTATUS[0]}` when piping.
- Fill the [Results summary](#results-summary) at the end.

Export the baseline run path once (used throughout):

```sh
export RUN=artifacts/phase0/refactor-verify-2026-06-25/hell-week-full-2026-06-25T19-02-48-532Z
```

---

## A. Environment & preconditions

- [x] **A1 — tools present**
  - Run: `node -v && just --version && npm -v`
  - Pass if: three version strings print; exit 0.
  - Observed: `node v25.8.2; just 1.47.1; npm 11.11.1; exit 0.`

- [x] **A2 — inside the repo on a branch**
  - Run: `git rev-parse --abbrev-ref HEAD`
  - Pass if: prints a branch name (not `HEAD`); exit 0.
  - Observed: `chore/core-maintainability-refactor; exit 0.`

- [x] **A3 — clean working tree (required for fixture tests)**
  - Run: `git status --porcelain`
  - Pass if: **no output**. If dirty, stash or commit before sections C/F/G.
  - Observed: `No output; exit 0.`

- [x] **A4 — baseline run folder exists**
  - Run: `ls "$RUN/report.json"`
  - Pass if: the path prints; exit 0.
  - Observed: `artifacts/phase0/refactor-verify-2026-06-25/hell-week-full-2026-06-25T19-02-48-532Z/report.json; exit 0.`

---

## B. Bundle & manual integrity

- [x] **B1 — dispatcher skill present with frontmatter**
  - Run: `head -5 .claude/skills/loanslam-operator/SKILL.md`
  - Pass if: output starts with `---` and contains `name: loanslam-operator`.
  - Observed: `Started with --- and contained name: loanslam-operator; exit 0.`

- [x] **B2 — nine references present**
  - Run: `ls -1 .claude/skills/loanslam-operator/references/*.md | wc -l`
  - Pass if: prints `9`.
  - Observed: `9; exit 0.`

- [x] **B3 — workflow arcs + config present, config is valid JSON**
  - Run:
    ```sh
    ls .claude/skills/loanslam-operator/workflows/{hell-week-tune,promote-hop,digest-and-ping}.md \
      && python3 -c "import json;d=json.load(open('.claude/skills/loanslam-operator/workflows/ratchet.config.json'));print('promotionRequires',d['promotionRequires'],'ceiling',d['iterationCeiling'])"
    ```
  - Pass if: three files list; prints `promotionRequires REPAIRED ceiling 6`.
  - Observed: `Listed digest-and-ping.md, hell-week-tune.md, promote-hop.md; printed promotionRequires REPAIRED ceiling 6; exit 0.`

- [x] **B4 — all intra-bundle and manual links resolve**
  - Run:
    ```sh
    python3 - <<'PY'
    import os,re,glob
    bad=0
    for base in [".claude/skills/loanslam-operator","docs/loanslam-operator"]:
        for f in glob.glob(base+"/**/*.md",recursive=True):
            d=os.path.dirname(f)
            for m in re.findall(r'\]\((?!https?:|#)([^)]+\.(?:md|json))\)',open(f).read()):
                t=os.path.normpath(os.path.join(d,m.split('#')[0]))
                if not os.path.exists(t): print("BROKEN",f,"->",m); bad+=1
    print("OK" if bad==0 else f"{bad} BROKEN")
    PY
    ```
  - Pass if: prints `OK`.
  - Observed: `OK; exit 0.`

- [x] **B5 — manual is complete (11 pages, diagrams present)**
  - Run: `ls -1 docs/loanslam-operator/*.md | wc -l && grep -rl '```mermaid' docs/loanslam-operator | wc -l`
  - Pass if: first number ≥ `11`; second ≥ `6` (pages containing diagrams).
  - Observed: `12 manual pages; 7 pages containing Mermaid diagrams; exit 0.`

---

## C. Provider mandate (OpenAI-only)

- [x] **C1 — source-policy passes on the real tree**
  - Run: `npm run --silent source-policy:check`
  - Pass if: stdout contains `source policy passed` and
    `no ... Anthropic provider imports found`; exit 0.
  - Observed: `TypeScript source policy passed; scanned 140 source files; no Anthropic provider imports found; exit 0.`

- [x] **C2 — provider detection unit tests pass**
  - Run: `npx vitest run scripts/check-typescript-source-policy.test.ts`
  - Pass if: stdout contains `Tests  7 passed`; exit 0.
  - Observed: `Test Files 1 passed; Tests 7 passed; exit 0.`

- [x] **C3 — a live Anthropic import is flagged (negative test)**
  - Run:
    ```sh
    mkdir -p scratch-qa && printf 'import x from "@anthropic-ai/sdk";\nexport default x;\n' > scratch-qa/anthropic-fixture.ts
    npm run --silent source-policy:check; echo "exit:$?"
    rm -rf scratch-qa
    ```
  - Pass if: stdout contains `forbidden Anthropic provider import` and `exit:1`.
    After cleanup, `git status --porcelain` is empty.
  - Observed: `Printed forbidden Anthropic provider import; exit:1; post-cleanup git status output empty.`

---

## D. Baseline anchor

- [x] **D1 — baseline.json is valid and matches the breached floor**
  - Run:
    ```sh
    python3 -c "import json;d=json.load(open('artifacts/evidence-index/baseline.json'));f=d['safetyFloor'];print(f['pass'],f['total'],f['breached'])"
    ```
  - Pass if: prints `41 50 True`.
  - Observed: `41 50 True; exit 0.`

- [x] **D2 — anchor matches its source run**
  - Run:
    ```sh
    python3 -c "import json;b=json.load(open('artifacts/evidence-index/baseline.json'));r=json.load(open('$RUN/report.json'));print(b['runId']==r['runId'], b['safetyFloor']['pass']==r['safetyFloor']['pass'])"
    ```
  - Pass if: prints `True True`.
  - Observed: `True True; exit 0.`

---

## E. floor-delta (all four statuses)

- [x] **E1 — HOLDING against the anchor**
  - Run: `just floor-delta -- "$RUN" ; echo "exit:$?"`
  - Pass if: stdout contains `floor-delta: HOLDING` and `exit:0`.
  - Observed: `floor-delta: HOLDING; receipt artifacts/evidence-index/floor-delta-latest.json; exit:0.`

- [x] **E2 — REGRESSED on a dropped floor dimension**
  - Run:
    ```sh
    python3 -c "import json,os;d=json.load(open('$RUN/report.json'));[d['safetyFloor']['dimensions'].__setitem__(i,{**x,'pass':x['pass']-2}) for i,x in enumerate(d['safetyFloor']['dimensions']) if x['dimension']=='prompt_injection'];d['safetyFloor']['pass']=39;os.makedirs('/tmp/qa-reg',exist_ok=True);json.dump(d,open('/tmp/qa-reg/report.json','w'))"
    npx tsx scripts/floor-delta.ts /tmp/qa-reg --quiet; echo "exit:$?"; rm -rf /tmp/qa-reg
    ```
  - Pass if: `exit:1` (REGRESSED). Re-run without `--quiet` to see
    `Prompt injection / data regressed`.
  - Observed: `quiet_exit:1; verbose output printed floor-delta: REGRESSED and Prompt injection / data regressed 6->4 (-2); temp dir removed.`

- [x] **E3 — REPAIRED when the floor fully passes**
  - Run:
    ```sh
    python3 -c "import json,os;d=json.load(open('$RUN/report.json'));[x.update({'pass':x['total']}) for x in d['safetyFloor']['dimensions']];d['safetyFloor']['pass']=50;d['safetyFloor']['breached']=False;os.makedirs('/tmp/qa-rep',exist_ok=True);json.dump(d,open('/tmp/qa-rep/report.json','w'))"
    npx tsx scripts/floor-delta.ts /tmp/qa-rep --quiet; echo "exit:$?"; rm -rf /tmp/qa-rep
    ```
  - Pass if: `exit:0`; without `--quiet` prints `floor-delta: REPAIRED`.
  - Observed: `quiet_exit:0; verbose output printed floor-delta: REPAIRED; temp dir removed.`

- [x] **E4 — INCONCLUSIVE on a profile/scenario mismatch**
  - Run:
    ```sh
    python3 -c "import json,os;d=json.load(open('$RUN/report.json'));d['profile']='smoke';d['totals']['scenarios']=10;os.makedirs('/tmp/qa-inc',exist_ok=True);json.dump(d,open('/tmp/qa-inc/report.json','w'))"
    npx tsx scripts/floor-delta.ts /tmp/qa-inc 2>&1 | grep -E 'INCONCLUSIVE|not comparable'; echo "exit:${PIPESTATUS[0]}"; rm -rf /tmp/qa-inc
    ```
  - Pass if: prints `floor-delta: INCONCLUSIVE` and `not comparable ...`;
    exit non-zero.
  - Observed: `floor-delta: INCONCLUSIVE; not comparable profile full vs smoke, scenarios 122 vs 10; exit:1; temp dir removed.`

- [x] **E5 — receipt is written and gitignored**
  - Run: `just floor-delta -- "$RUN" >/dev/null; git check-ignore artifacts/evidence-index/floor-delta-latest.json`
  - Pass if: prints the receipt path (i.e. it is ignored); the file exists.
  - Observed: `artifacts/evidence-index/floor-delta-latest.json; exists:yes; exit 0.`

---

## F. gate-slice (keep-commit gate)

Each test stages a throwaway file, runs the gate, then cleans up. None commit.

- [x] **F1 — passes on a benign non-engine staged file**
  - Run:
    ```sh
    mkdir -p scratch-qa && echo note > scratch-qa/benign.md && git add -f scratch-qa/benign.md
    npx tsx scripts/gate-slice.ts --staged; echo "exit:$?"
    git restore --staged scratch-qa/benign.md; rm -rf scratch-qa
    ```
  - Pass if: stdout contains `gate-slice passed`; `exit:0`.
  - Observed: `gate-slice passed: scanned 1 staged file(s); exit:0; post-cleanup git status output empty.`

- [x] **F2 — blocks a staged env cache**
  - Run:
    ```sh
    mkdir -p scratch-qa && echo 'X=1' > scratch-qa/fake.env.local && git add -f scratch-qa/fake.env.local
    npx tsx scripts/gate-slice.ts --staged 2>&1 | grep -i 'secret/cache file'; echo "exit:${PIPESTATUS[0]}"
    git restore --staged scratch-qa/fake.env.local; rm -rf scratch-qa
    ```
  - Pass if: prints `secret/cache file staged`; exit non-zero.
  - Observed: `Printed secret/cache file staged: scratch-qa/fake.env.local; exit:1; post-cleanup git status output empty.`

- [x] **F3 — blocks API-key-shaped content**
  - Run (the key is built at runtime so no key-shaped literal lives in this doc —
    which would otherwise trip the very gate it tests):
    ```sh
    key="sk-$(python3 -c "print('A'*32)")"
    mkdir -p scratch-qa && printf 'KEY=%s\n' "$key" > scratch-qa/leak.txt && git add -f scratch-qa/leak.txt
    npx tsx scripts/gate-slice.ts --staged 2>&1 | grep -i 'API key'; echo "exit:${PIPESTATUS[0]}"
    git restore --staged scratch-qa/leak.txt; rm -rf scratch-qa
    ```
  - Pass if: prints `possible API key`; exit non-zero.
  - Observed: `Printed possible API key (sk-...) in staged content: scratch-qa/leak.txt; exit:1; post-cleanup git status output empty.`

- [x] **F4 — blocks an engine change with no receipt**
  - Run:
    ```sh
    mkdir -p packages/core/src/__qa__ && echo 'export const x=1;' > packages/core/src/__qa__/probe.ts && git add -f packages/core/src/__qa__/probe.ts
    npx tsx scripts/gate-slice.ts --staged --receipt /tmp/none.json 2>&1 | grep -i 'requires a floor-delta receipt'; echo "exit:${PIPESTATUS[0]}"
    git restore --staged packages/core/src/__qa__/probe.ts; rm -rf packages/core/src/__qa__
    ```
  - Pass if: prints `requires a floor-delta receipt`; exit non-zero.
  - Observed: `Printed engine-touching commit requires a floor-delta receipt at /tmp/none.json; exit:1; post-cleanup git status output empty.`

- [x] **F5 — allows an engine change WITH a valid receipt**
  - Run:
    ```sh
    just floor-delta -- "$RUN" >/dev/null   # writes a HOLDING receipt
    mkdir -p packages/core/src/__qa__ && echo 'export const x=1;' > packages/core/src/__qa__/probe.ts && git add -f packages/core/src/__qa__/probe.ts
    npx tsx scripts/gate-slice.ts --staged; echo "exit:$?"
    git restore --staged packages/core/src/__qa__/probe.ts; rm -rf packages/core/src/__qa__
    ```
  - Pass if: stdout contains `floor-delta receipt HOLDING` and `gate-slice passed`; `exit:0`.
  - Observed: `Printed floor-delta receipt HOLDING and gate-slice passed: scanned 1 staged file(s); exit:0; post-cleanup git status output empty.`

- [x] **F6 — blocks demo↔review widget cross-pollination**
  - Run:
    ```sh
    mkdir -p packages/demo-widget/src && printf 'import {T} from "@loanslam/review-widget";\nexport const x=T;\n' > packages/demo-widget/src/__qa_xp__.ts && git add -f packages/demo-widget/src/__qa_xp__.ts
    npx tsx scripts/gate-slice.ts --staged 2>&1 | grep -i 'cross-pollination'; echo "exit:${PIPESTATUS[0]}"
    git restore --staged packages/demo-widget/src/__qa_xp__.ts; rm -f packages/demo-widget/src/__qa_xp__.ts
    ```
  - Pass if: prints `widget cross-pollination`; exit non-zero. (Leaves the real
    demo-widget package untouched — confirm with `git status --porcelain`.)
  - Observed: `Printed widget cross-pollination for packages/demo-widget/src/__qa_xp__.ts; exit:1; post-cleanup git status output empty.`

---

## G. Pre-commit hook (enforcement layer)

- [x] **G1 — hook is active**
  - Run: `git config core.hooksPath`
  - Pass if: prints `scripts/hooks`.
  - Observed: `scripts/hooks; exit 0.`

- [ ] **G2 — hook is executable**
  - Run: `git ls-files -s scripts/hooks/pre-commit`
  - Pass if: mode begins `100755`.
  - Observed: `___`

- [ ] **G3 — hook runs both gates and passes on a benign staged file**
  - Run:
    ```sh
    mkdir -p scratch-qa && echo note > scratch-qa/benign.md && git add -f scratch-qa/benign.md
    sh scripts/hooks/pre-commit; echo "exit:$?"
    git restore --staged scratch-qa/benign.md; rm -rf scratch-qa
    ```
  - Pass if: stdout contains both `source policy passed` and `gate-slice passed`;
    `exit:0`.
  - Observed: `___`

- [ ] **G4 — hook blocks a forbidden staged file**
  - Run:
    ```sh
    mkdir -p scratch-qa && echo 'X=1' > scratch-qa/fake.env.local && git add -f scratch-qa/fake.env.local
    sh scripts/hooks/pre-commit; echo "exit:$?"
    git restore --staged scratch-qa/fake.env.local; rm -rf scratch-qa
    ```
  - Pass if: stdout contains `gate-slice failed`; exit non-zero.
  - Observed: `___`

---

## H. branch-risk

- [ ] **H1 — engine-touching branch resolves to ENGINE**
  - Run: `just branch-risk -- --base dev`
  - Pass if: stdout contains `required proof bar: ENGINE` (this branch's refactor
    commits touch `packages/core/src`).
  - Observed: `___`

- [ ] **H2 — JSON output is well-formed**
  - Run: `npx tsx scripts/branch-risk.ts --base dev --json | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['requiredProofBar']['tier'])"`
  - Pass if: prints a tier name (e.g. `ENGINE`); exit 0.
  - Observed: `___`

---

## I. digest

- [ ] **I1 — markdown digest with bolded floor + demo-killer lines**
  - Run: `just digest -- "$RUN"`
  - Pass if: stdout contains `**safety floor: 41/50 BREACHED**` and
    `**demo-killers: 0**` and a per-dimension list.
  - Observed: `___`

- [ ] **I2 — privacy guard refuses transcripts**
  - Run: `npx tsx scripts/digest.ts "$RUN/evidence.json"; echo "exit:$?"`
  - Pass if: stdout contains `refusing to read non-report file`; `exit:2`.
  - Observed: `___`

- [ ] **I3 — JSON output is well-formed**
  - Run: `just digest -- "$RUN" --json | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['safetyFloor']['breached'])"`
  - Pass if: prints `True`.
  - Observed: `___`

---

## J. status-snapshot

- [ ] **J1 — snapshot reports branch, worktrees, and active hook**
  - Run: `just status-snapshot`
  - Pass if: stdout contains `## status snapshot`, a `- worktrees:` section
    listing `dev ->` and `staging ->`, and `pre-commit gate: active`.
  - Observed: `___`

---

## K. checkpoint-packet

- [ ] **K1 — packet composes orient + risk + evidence**
  - Run: `just checkpoint-packet -- "$RUN"`
  - Pass if: stdout contains all of `## status snapshot`, `## branch risk`,
    `## evidence`, and `## Hell Week digest`.
  - Observed: `___`

---

## L. slice-worktree

- [ ] **L1 — dry-run plans a valid owner under the main repo root**
  - Run: `just slice-new -- validator --dry-run`
  - Pass if: stdout contains `branch:   slice/validator-` and
    `worktree: /Users/.../.claude/worktrees/slice-validator-`; `(dry-run: nothing created)`.
  - Observed: `___`

- [ ] **L2 — invalid owner is rejected**
  - Run: `bash scripts/slice-worktree.sh frontend --dry-run; echo "exit:$?"`
  - Pass if: stdout contains `is not a disjoint write-scope`; `exit:2`.
  - Observed: `___`

- [ ] **L3 — protected branch as start-point is allowed read-only (note printed)**
  - Run: `bash scripts/slice-worktree.sh planner --base dev --dry-run`
  - Pass if: stdout contains `read-only start-point; not moving it`.
  - Observed: `___`

---

## M. justfile target inventory

- [ ] **M1 — all operator targets are registered**
  - Run:
    ```sh
    just --list | grep -Eo '(status-snapshot|branch-risk|self-gate|gate-slice|floor-delta|digest|checkpoint-packet|slice-new|hooks-install)' | sort -u | wc -l
    ```
  - Pass if: prints `9`.
  - Observed: `___`

---

## N. Live behaviour evidence (OPTIONAL — needs `OPENAI_API_KEY` + Postgres)

Skip if infra is unavailable; mark each `N/A`. These validate the real proof
surface — their evidence is the run report and the judge LLM verdicts.

- [ ] **N1 — Postgres precheck + smoke battery runs**
  - Run: `just hell-week -- --profile smoke`
  - Pass if: a run folder is written under `artifacts/phase0/...` with a
    `report.json`; the CLI does not abort on the Postgres precheck.
  - Observed: `___`

- [ ] **N2 — full battery + judge produces verdicts**
  - Run: `just hell-week` then `just hell-week-judge -- <new-run-dir>`
  - Pass if: `<run-dir>/judge-verdicts.json` is written and the judge LLM output
    grades scenarios (read a few verdicts and confirm they are coherent).
  - Observed: `___`

- [ ] **N3 — score the fresh run against the anchor**
  - Run: `just floor-delta -- <new-run-dir>`
  - Pass if: prints one of REPAIRED / HOLDING / REGRESSED with a coherent
    per-dimension reason list; exit code matches the status table in
    [Reference](09-reference.md).
  - Observed: `___`

- [ ] **N4 — compare is read-only (zero model calls)**
  - Run: `just hell-week-compare -- "$RUN" <new-run-dir>`
  - Pass if: prints a recommendation status and a delta summary; completes
    quickly with no model spend.
  - Observed: `___`

---

## Final state check

- [ ] **Z1 — tree is clean after all fixture tests**
  - Run: `git status --porcelain`
  - Pass if: **no output** (every fixture cleaned up). If a `scratch-qa/`,
    `packages/core/src/__qa__/`, or `__qa_xp__` path remains, remove it.
  - Observed: `___`

---

## Results summary

| Section | IDs | Pass | Fail | N/A |
| --- | --- | --- | --- | --- |
| A Environment | A1–A4 | | | |
| B Bundle & manual | B1–B5 | | | |
| C Provider mandate | C1–C3 | | | |
| D Baseline anchor | D1–D2 | | | |
| E floor-delta | E1–E5 | | | |
| F gate-slice | F1–F6 | | | |
| G pre-commit hook | G1–G4 | | | |
| H branch-risk | H1–H2 | | | |
| I digest | I1–I3 | | | |
| J status-snapshot | J1 | | | |
| K checkpoint-packet | K1 | | | |
| L slice-worktree | L1–L3 | | | |
| M justfile inventory | M1 | | | |
| N live behaviour | N1–N4 | | | |
| Z final state | Z1 | | | |

**Overall: ___ / 41 deterministic checks (A–M, Z) passed.** Live section (N) is
optional. Any FAIL must be triaged via [Troubleshooting](10-troubleshooting.md)
before the system is considered verified.
