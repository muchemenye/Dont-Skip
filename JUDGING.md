## How to run this project for judging

This file explains how a judge or reviewer can run the full Don't Skip system locally without any paid services (no domain, no Apple Developer account required).

Summary
- The project was created entirely using Kiro (the "vibe" method). See `docs/KIRO_INTEGRATION.md` for transcripts and notes on how Kiro was used to build the project.
- The project runs fully from source using a local MongoDB instance (no Docker required) and the standard local dev workflow described below.
- The iOS app can be run in the Xcode simulator (no paid Apple account required).
- The VSCode extension can be run from source using the Debug / Run Extension workflow (F5).
- The backend runs locally via `npm run dev` (ts-node-dev).

Important: Kiro usage
- Provide development-time evidence that the project was created with Kiro:
  - a short demo video (<= 3 minutes) that includes screenshots or a short clip of the Kiro session(s) used to produce the code/design; and
  - transcripts of the Kiro conversations and the generated code diffs. Place those in `KIRO_TRANSCRIPTS/` in the repo (recommended).

Local run instructions (no Docker)
1) Ensure MongoDB is running locally

On macOS (Homebrew):

```bash
# Install if you don't have it
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB as a background service
brew services start mongodb-community

# Verify
mongo --eval 'db.runCommand({ ping: 1 })'
```

On Linux (systemd):

```bash
# Start the service
sudo systemctl start mongod
# Verify
mongo --eval 'db.runCommand({ ping: 1 })'
```

If you prefer Docker, a docker-compose example is available in the repo, but it is not required.

2) Start backend

```bash
cd backend
npm install
cp .env.example .env       # edit .env if you need to change ports/urls
npm run dev
```

Verify backend is healthy:

```bash
curl http://localhost:3000/health
```

3) Run VSCode extension (no publish required)

```bash
# from project root
npm install
npm run compile
# In VSCode: press F5 to launch the extension host window
```

4) Run iOS app in simulator (no Apple Developer account required)

- Open `ios/Dont Skip/Dont Skip.xcodeproj` in Xcode
- Select a simulator and press Cmd+R
- App runs in simulator and will try to connect to `http://localhost:3000/api` (DEBUG build)

What you should include in your submission (minimum)
- Public Git repository URL (must be public and contain an OSI-approved license)
- Short (<=3 min) demonstration video showing:
  - Backend starting (note that a local MongoDB is required)
  - VSCode extension being launched and the extension commands working
  - iOS app running in the simulator and any key flows (register, view credits, sync)
  - A short clip showing the Kiro session or a walkthrough of the transcripts and generated code (required)
- Provide testing instructions and any credentials (if a private test build is used)

Notes & tips
- You do NOT need to host a public domain or deploy a public backend; judges can run everything locally using the instructions above.
- You do NOT need an Apple Developer Program account to run in the Simulator. You only need one to distribute TestFlight builds.
- If you prefer to avoid requiring judges to run a local backend, consider deploying the backend to a free-tier host (Render / Railway / Fly) and include the URL in the submission; this is optional.

If you'd like, I can:
- Add a short `demo-checklist.txt` you can follow while recording the submission video.
- Add a Kiro replay adapter that replays recorded Kiro responses so you can demonstrate Kiro usage without live Kiro access.

---
Generated to help make local runs reproducible.
