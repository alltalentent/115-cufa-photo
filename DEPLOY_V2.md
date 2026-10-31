# CUFA PHOTO CONTROL V2 — Deployment checklist

## Current status
Source implemented, but **NOT LIVE**. GitHub repository is private and no Pages URL or Cloud Run service was confirmed. Student data stays private.

## 1. Google Cloud setup (school-controlled)
- Create a Google Cloud project under an account the school controls.
- Enable Cloud Run, Cloud Build, Google Sheets API, Firestore API, and Artifact Registry.
- Create a Firestore database in Native mode. This stores atomic check-in counters, not student profile data.
- Create a dedicated Cloud Run service account with minimal permissions: Sheets API access through sharing the spreadsheet with that service account as Editor; Firestore Datastore User role. Do not create/download a JSON key.
- Create an OAuth 2.0 Web Client ID. Set authorized JavaScript origins to the eventual GitHub Pages origin. Configure OAuth consent screen for the school audience as appropriate.
- Deploy backend/ to Cloud Run with the service account and environment variables GOOGLE_CLIENT_ID, SHEET_ID, ALLOWED_ORIGIN, GOOGLE_CLOUD_PROJECT. Cloud Run must accept HTTP requests to serve browser requests, but every /api/* route independently validates Google ID tokens and the private Users allowlist. Configure throttling and monitoring before production.
- Restrict ALLOWED_ORIGIN to the exact GitHub Pages origin, never '*'. CORS is not authentication.

## 2. GitHub Pages
- Confirm GitHub plan supports Pages for the current PRIVATE repository, or choose an approved public code-only repository. Never publish student data.
- In repository Settings > Pages choose GitHub Actions as the build/deploy source.
- Update config.js with actual Cloud Run URL and OAuth Client ID (both are public identifiers, NOT secrets).
- Push to main, verify GitHub Actions deployment, open the actual Pages URL and sign in using an email enabled in the Users sheet.

## 3. Acceptance tests before live operations
- Test invalid/unauthorized accounts return 401/403; test two authorized staff accounts.
- Confirm dashboard reads all 114 people and 124 tasks, including renamed Chinese tabs.
- Test using an isolated COPY of the Sheet and an isolated Firestore project. Never test check-in in the production Sheet.
- Test concurrent check-ins, duplicate clicks, incomplete Sheets writes, queue counter recovery, staff actions, slate retention, tasks, logging, mobile.
- Confirm public queue display does not leak phone/student ID; restrict digital slate to staff.
- Back up production Sheets and set restore procedures.

## Current limitations (must resolve before production)
- Cloud Run /api/action check-in is allocated atomically in Firestore but Sheets updates are not a distributed transaction; partial failure requires recovery.
- This backend uses the staff Users allowlist; no student self-service login/form, no new person creation or admin role editor.
- Staff "consent verified" click is not independent legal proof of consent.
- Cloud Run project, OAuth, Firestore, Pages settings and permissions require the account owner to provision/authorize; they cannot be deployed solely by committing code.
- No actual live backend test has been completed.
