# Workout Lockout Documentation

This `docs/` folder contains project documentation moved from the repository root.

See individual files for specific guides and design notes.

## Running tests

The repo includes a couple of lightweight integration scripts for backend auth/profile flows. Ensure your backend is running on http://localhost:3000 and then run from the repository root:

```bash
npm run test:profile
npm run test:password
```

These scripts are located under `tests/` and are executable shell scripts. They perform end-to-end checks against the local backend and are meant for quick manual verification.
