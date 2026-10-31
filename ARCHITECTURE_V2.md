# CUFA PHOTO CONTROL — V2 Architecture
## Status
- GitHub Pages: static frontend entry point (root index.html), no student data embedded.
- Google Sheets: private system of record; retain existing workbook.
- Google Apps Script: existing spreadsheet-bound backend; not yet a browser-accessible authenticated cross-origin API.
- Production migration: NOT COMPLETE. Do not use the V2 frontend for live student check-in yet.

## Critical security constraint
GitHub Pages is a public static hosting surface. Never commit student names, IDs, phone numbers, height, weight, consent records, API keys or access tokens.
A cross-origin fetch to a Google Apps Script web app is not a reliable authenticated JSON API: redirects, CORS preflight and Google session cookies can block requests. Setting Apps Script access to Anyone does NOT make a student-data API secure.
Use an authenticated same-origin backend/proxy (or another vetted backend such as Cloud Run/Firebase with identity verification) that authorizes every request and talks to private Google services server-side. Public queue display must only expose minimum non-sensitive information.
Never put a long-lived secret in browser JS or GitHub repository.

## Deployment
1. GitHub repository is currently PRIVATE. Check whether Pages is available on this plan; otherwise host frontend with a private-access solution or a public code-only repository without personal data.
2. Configure Pages -> Deploy from branch -> main -> root, if supported.
3. Set up secure authenticated backend and API before connecting live data.
4. Validate student privacy, roles, audit logs, concurrent check-ins, and consent.
5. Only then enable real operations and retire the old Apps Script HTML entry point.

## Existing source
apps-script/Code.gs and apps-script/Index.html remain available as legacy staff-only web app until migration is tested.
