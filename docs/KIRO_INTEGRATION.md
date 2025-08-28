KIRO integration status and options

Current status
- This project was created entirely using Kiro (vibe method). The hackathon's requirement that the Project "uses Kiro" is satisfied by development-time evidence (transcripts, generated code, video clips).

What to include in the submission
- Kiro transcripts: place the Kiro conversation transcripts in a `KIRO_TRANSCRIPTS/` directory at the repo root. Include a short README in that folder describing which files correspond to which parts of the project (extension, backend, iOS) and the date of the session.
- Generated code diffs: include a small ZIP or a folder `KIRO_GENERATED_DIFFS/` showing the before/after or code snippets Kiro produced that you kept.
- Demo video: <= 3 minutes. Show a short clip of the Kiro session and then show the working application (extension + iOS simulator + backend). Judges expect both evidence of Kiro usage and a working demo.

Runtime vs development-time usage
- If the app invoked Kiro at runtime during the demo, include the runtime call details and how to configure the API key. If you did not run Kiro at runtime, do not worry — the judges accept development-time usage IF you provide clear transcripts and generated-code evidence.


MongoDB note
- This repo uses a local MongoDB instance in development. You do not need Docker; ensure MongoDB is running locally before starting the backend. See `JUDGING.md` for platform-specific sample commands to start MongoDB.

Checklist to make the submission robust
- [ ] Add `KIRO_TRANSCRIPTS/` with transcripts and a short README
- [ ] Add `KIRO_GENERATED_DIFFS/` with representative samples (optional: ZIP)
- [ ] Update `JUDGING.md` to reference the transcripts and include exact local-run steps
- [ ] Produce a <=3 minute demo video and upload it publicly (YouTube/Vimeo)
- [ ] Ensure the repo is public and includes an OSI-approved license (e.g., MIT)

## Hackathon story

This project started from a simple, repeating problem: long late-night coding sessions followed by a skipped morning workout and the predictable consequence — sore back, tight hips, and the nagging regret of not doing the thing I promised myself I would do. The goal of Dont Skip is to make that trade-off visible and costly for developers and founders, so the healthy choice becomes the easier one.

Dont Skip combines a VS Code extension that enforces a configurable lockout mechanism with an optional iOS app and a lightweight backend. The extension enforces accountability by restricting editing when the user has not earned coding time with a workout; users can manually add workouts or earn credits automatically via the iOS app. Workouts map to coding credits (for example, a 45‑minute workout can yield a full 8‑hour coding session; the conversion is configurable and some presets are included).

Under the hood the extension records and can undo local edits while the lockout is active; all user data syncs through a small Node.js backend with MongoDB, which also bridges the iOS integrations (Apple Health, Strava, Fitbit). The iOS app pulls verified workouts from those services and grants credits through the backend. During testing premium features are enabled automatically to demonstrate the full flow.

Everything in the extension, the iOS app, and the backend was developed with Kiro (vibe method). Kiro shaped the architecture, generated code snippets, and provided step‑by‑step guidance when working across unfamiliar tools like Xcode. For an early learner, Kiro accelerated development and made cross‑language integration reachable.

The biggest technical challenges were authentication and cross‑language data compatibility: making sure the payloads and types the backend emits map correctly to Swift models, and iterating on the iOS side until the app handled the server responses reliably. Switching between Kiro and Xcode for UI previews added friction, but the guidance Kiro provided reduced the trial‑and‑error and got the previews working faster than expected.

The app currently functions end‑to‑end, including a widget that surfaces credits from the main app. This is a personal milestone — it validates that an AI‑assisted workflow can take a developer from idea to a multi‑platform prototype.

## What we learned

- Data contracts matter: design a single canonical shape for workout and credit payloads and keep converters/adapters small and explicit between Node (JSON/JavaScript objects) and Swift (strongly typed models). This prevents subtle runtime mismatches.
- Authentication across platforms is nontrivial: token formats, expiration, and refresh patterns need consistent handling on the backend and clear guidance in the iOS client.
- Test early across the full stack: a fast smoke test (backend + simulated iOS payloads + extension) catches schema issues before spending time in UI refinements.
- Kiro is effective as a development companion: it helped generate repeatable scaffolding, offered specific code fixes when switching languages, and saved time on routine tasks and learning Xcode.

## What's next for Dont Skip

- Launch to the founder/developer community: prepare a small beta with easy onboarding (clear local MongoDB setup, one‑click backend start scripts, and seeded demo accounts) and invite feedback from developer friends and co‑founders.
- Improve the onboarding flow: add an in‑app walkthrough, clearer mapping of workout -> credits, and a simple restore/revoke flow for accidental manual credit grants.
- Polish reliability and CI: add automated tests for API contracts (contract tests between backend and iOS types), Swift unit tests for model parsing, and a GitHub Actions pipeline to validate builds.
- Expand integrations and analytics: make it easy to add more fitness providers and add simple usage analytics for retention and habit tracking (privacy‑first, opt‑in).
- Prepare submission artifacts: finalize `KIRO_TRANSCRIPTS/`, a ≤3‑minute demo video (showing Kiro usage + the working app), and a concise `JUDGING.md` with exact steps and credentials for reviewers.

If you'd like, I can draft the 3‑minute demo script (with a 30–45s Kiro section) and create the `KIRO_TRANSCRIPTS/` placeholder files in the repo so you can paste the actual transcripts there.
