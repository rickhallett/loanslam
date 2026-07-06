# loanslam-operator QA checklist

[<- Manual index](README.md)

This is a smoke audit for the operator surface. It does not redefine proof
doctrine; the canonical ladder is [Proof and gates](05-proof-and-gates.md).

Run it when changing `docs/loanslam-operator/`, `.claude/skills/loanslam-operator/`,
the `.agents` skill compatibility link, or the root proof scripts.

## Deterministic self-audit

1. Confirm the manual and skill bundle resolve:
   ```sh
   python3 - <<'PY'
   import glob, os, re
   bad = 0
   agent_link = ".agents/skills/loanslam-operator"
   expected_target = "../../.claude/skills/loanslam-operator"
   if not os.path.islink(agent_link) or os.readlink(agent_link) != expected_target:
       print("BROKEN", agent_link, "must point to", expected_target)
       bad += 1
   for base in [".claude/skills/loanslam-operator", "docs/loanslam-operator"]:
       for path in glob.glob(base + "/**/*.md", recursive=True):
           root = os.path.dirname(path)
           text = open(path, encoding="utf8").read()
           for link in re.findall(r'\]\((?!https?:|#)([^)]+\.(?:md|json))\)', text):
               target = os.path.normpath(os.path.join(root, link.split("#")[0]))
               if not os.path.exists(target):
                   print("BROKEN", path, "->", link)
                   bad += 1
   print("OK" if bad == 0 else f"{bad} BROKEN")
   raise SystemExit(1 if bad else 0)
   PY
   ```

2. Confirm the provider/source policy:
   ```sh
   npm run source-policy:check
   ```

3. Confirm report manifests and generated report HTML are current:
   ```sh
   npm run reports:check
   ```

4. Confirm the deterministic proof scripts still execute:
   ```sh
   just branch-risk -- --base HEAD
   just gate-slice -- --staged
   ```

5. Confirm the floor anchor is readable:
   ```sh
   python3 - <<'PY'
   import json
   data = json.load(open("artifacts/evidence-index/baseline.json", encoding="utf8"))
   floor = data["safetyFloor"]
   print(data["runId"], floor["pass"], floor["total"], floor["breached"])
   PY
   ```

## Behaviour receipts

Run the live/model-backed section only when the changed slice owes runtime
proof. Use the current proof ladder:

1. `just branch-risk -- --base <ref>`
2. Capture the required full integration run or live browser/API proof.
3. `just hell-week-judge -- <run-dir>` when Hell Week behavior is in scope.
4. `just floor-delta -- <run-dir>`
5. `just digest -- <run-dir>` or `just checkpoint-packet -- <run-dir>`

Paste the resulting digest/checkpoint into the PR or handoff. Do not keep raw
transcripts or PNG receipts in this checklist.
