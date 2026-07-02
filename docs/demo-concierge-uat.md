# Concierge UAT — Comparing the Two Cards

Date: 2026-07-02. Both campaigns are live and rehearsed; this is the
side-by-side script for deciding which card to play at the demo (D046).

## The two surfaces

- **Production (confident tier, campaign-002):**
  https://loanslam-site-nuxt-production.up.railway.app
  Site-wide launcher (closed by default), page-aware concierge, conversation
  survives page loads, plus everything from campaign-001.
- **Staging (tricksy tier, campaign-003):**
  https://loanslam-site-nuxt-staging-production.up.railway.app
  Everything above PLUS confirm-to-act navigation suggestions and
  propose-and-confirm form filling. Not merged to dev; production has none
  of this until you accept it.

## UAT script (run on both, note the differences)

1. Open any page — /faq/, a news article, /instalment-loan/ — click the
   launcher and ask "what page am I on?" and a question about its content.
   (Both should be page-aware.)
2. Ask "Where do I find your privacy policy? Take me there."
   - Production: helpful answer, no navigation.
   - Staging: answer plus a "Take me there (/privacy-policy/)" chip; click
     it.
3. Reload the page mid-conversation, reopen the chat, ask "what did I tell
   you earlier?" (Both should remember — same tab.)
4. From /contact/: ask "How do I apply for a loan?", take the offered
   navigation, and on the form tell it your details in one message ("I'm
   ..., employed full time, income 2500, born 14/02/1990, mobile
   07700900123, email ...") then ask it to help.
   - Production: form-aware guidance only.
   - Staging: also offers "Fill these in for me (N)" — click and watch the
     fields land and the validation errors clear. Values it wasn't told
     stay empty.
5. Say "this is getting difficult, can I talk to a person?" — both routes
   into the proven engine handoff with a ticket.
6. Adversarial poke (staging): insist it navigates somewhere weird or fills
   fields you never mentioned. Proposals it can't validate are dropped
   server-side; fills only contain what you actually said; nothing happens
   without your click.

## Rehearsal commands (green = go)

- Production: `node scripts/concierge-rehearsal.mjs`
- Staging: run the same plus
  `node scripts/dc3-001-suggest-nav-proof.mjs <staging-url> <outdir>` and
  `node scripts/dc3-002-form-fill-proof.mjs <staging-url> <outdir>`

## The decision this UAT feeds

- Accept campaign-003 -> merge `feature/demo-concierge-03` to dev and
  promote to the production service (one deploy), demo the full act.
- Reject or defer -> the demo runs on production as-is; staging stays a
  sandbox (kill it with `CONCIERGE_KILL_SWITCH=1` on the staging service or
  delete the service when done).
