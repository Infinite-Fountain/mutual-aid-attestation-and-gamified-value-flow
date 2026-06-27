# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
- Root is a Next.js 14 (App Router) web app, "Interoperable Canvas — Impact Cards" (`package.json` name `interoperable-canvas`). This is the primary product.
- `functions/` is a separate, optional Firebase Functions (Node 20) package for an AI feature (`genericAiAgent`). Not needed for the core app.
- `files-for-agents/` is non-application content (prompts/markdown) and can be ignored for dev.

### Running the app (dev)
- Standard commands live in `package.json` scripts: `npm run dev`, `npm run build`, `npm run lint`. Use `npm run dev` for development → http://localhost:3000 (the update script already runs `npm install`).
- The canvas editor only renders/edits when a project slug is supplied via query param, e.g. `http://localhost:3000/interoperable-canvas/?projectId=demo`. With no `projectId`, the page shows the project-creation home screen instead of the editor.
- Adding a box on the canvas requires a click-AND-DRAG on the canvas (a single click makes a tiny 40x40 box). New empty boxes are transparent with only a thin yellow selection border, so they are easy to miss — drag a large rectangle to see it clearly.

### Firebase / env vars (non-obvious)
- Firestore/Storage persistence uses `NEXT_PUBLIC_FIREBASE_*` env vars (see `README.md`). There is no `.env.example`; create `.env.local` manually if you need persistence. `DUNE_API_KEY` (optional) enables the Dune graph proxy at `/api/dune/latest`.
- Without Firebase env vars the editor still runs and edits in-memory: background changes, adding boxes, and the Layers panel all work locally. However, anything saved through the box content modal (text/image/animation/etc.) will NOT render, because the modal writes to Firestore and re-renders via the Firestore snapshot listener (no listener → no local update). Treat content-modal persistence as requiring real Firebase config.

### Lint / build caveats
- `npm run lint` (`next lint`) is NOT configured — no ESLint config is committed, so it triggers an interactive "How would you like to configure ESLint?" prompt and cannot complete non-interactively. There is no working lint command in this repo as-is.
- `npm run build` (static export, `output: 'export'`) currently fails for two reasons: (1) missing deps imported by `app/newsroom/attestation-portal` (`@ethereum-attestation-service/eas-sdk`, `react-confetti`) that are not in `package.json`, and (2) static export is incompatible with the `app/api/dune/latest` route handler. The supported workflow is `next dev`, not the production export build.
- There are no automated tests anywhere in the repo (no test runner/scripts).

### functions/ (optional)
- See `functions/package.json` scripts. Emulating/deploying requires the Firebase CLI and a `firebase.json`/`.firebaserc` (not present in repo) plus `OPENAI_API_KEY`. Not required for core canvas development.
