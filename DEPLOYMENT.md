# CUFA PHOTO CONTROL — Deployment

## Current status
The Google Sheet is initialized with 114 people and 124 tasks. The GitHub repository contains the Apps Script backend and staff interface. **No live web app has been deployed yet.**

## Google Sheet
https://docs.google.com/spreadsheets/d/1nq1d8fEzDIfY4othTMXa79tsXy6OsICzjAlN5-K9UEQ/edit

## Required deployment
1. Open the Google Sheet using the school account.
2. Extensions → Apps Script.
3. Replace Code.gs with `apps-script/Code.gs` and add HTML file `Index` with `apps-script/Index.html`.
4. Deploy → New deployment → Web app.
5. Choose a configuration that authenticates and reliably identifies staff users; **never deploy publicly or anonymously**. The provided code checks `Session.getActiveUser().getEmail()` against the Users tab and denies access when identity is blank.
6. Verify the deployment identity model with a second school account before entering real contact or health-related measurements.

## Important limitations
- No student self-service form, role-managed external access, or public queue screen yet.
- Only authenticated authorized staff can load the interface; the slate displays private fields and must not be made public.
- The dashboard polls every five seconds. It is not push-based realtime.
- This is an early functional build, not a security-audited production release.
- Do not share spreadsheet edit access with students.
- The app must be tested on at least two devices before the shoot.
- Names, student IDs, height, weight and phone numbers must never be committed to this repository.
