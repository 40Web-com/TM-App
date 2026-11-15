# Chichi_Ads authentication setup

The rebrand branch now includes a browser authentication adapter for Supabase Auth email/password sessions and Google OAuth. It intentionally does not reuse the legacy TM App Supabase project or its user pool.

## Required setup before sign-in can work

1. Create or select a **separate Supabase project dedicated to Chichi_Ads**. This avoids coupling Chichi_Ads customers to TM App accounts and legacy data.
2. In Supabase Project Settings → API, copy the Project URL and **publishable key**.
3. Put those two public values in `chichi-config.js`.
4. In Authentication → URL Configuration, add the deployed Chichi_Ads origin to the allowed redirect URLs.
5. Enable Email provider. Configure email confirmation and password policies.
6. If Google sign-in is required, configure Google OAuth credentials in Authentication → Providers and add the Supabase callback URL to the Google OAuth client.
7. Test sign-up, email confirmation, password sign-in, expired-session refresh, sign-out and Google OAuth on the staging domain.

## Security boundaries

- Only the Supabase publishable key belongs in `chichi-config.js`. Never place a secret key or service_role key in browser code or Git.
- The auth adapter stores the normal user session in browser local storage and refreshes it when close to expiry. Protect the site against XSS and use HTTPS.
- Auth alone does not authorize access to website projects. Apply the separate Chichi_Ads project schema and owner-scoped RLS policies before connecting builder data.
- Do not apply the project migration to the legacy TM App database.
- The adapter remains safely unconfigured while the URL and publishable key are blank. The sign-in form reports this rather than pretending to authenticate.

## Current state

Frontend auth adapter and UI wiring are present in this branch. Live sign-in is **not enabled** until the dedicated project is configured and staging tests pass.
