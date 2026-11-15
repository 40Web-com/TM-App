# Chichi_Ads

**Build. Buy. Host. Earn.**

A website marketplace and template-first website creation platform, using a dedicated Supabase project separate from the legacy TM App database.

## Connected foundation

- Responsive Chichi_Ads website, logo and PWA shell.
- Email/password registration, sign-in, session refresh, password reset request and Google OAuth PKCE frontend flow.
- Customer-owned website drafts, version snapshots and private image storage.
- Developer applications and pending website listing submissions.
- Approved-listing marketplace reads and pending customer purchase requests.
- Affiliate applications and referral-code generation.
- Hosting-plan and subscription request foundation.
- Customer support tickets and purchase-request history.
- Restricted administrator Edge Function for listing review, affiliate approval, payment verification and audit events.
- Database migrations tracked in `supabase/migrations`.

## Dedicated backend

- Supabase project ref: `tluqyuvdumylwvtfpxgp`
- API URL: `https://tluqyuvdumylwvtfpxgp.supabase.co`
- All Chichi_Ads public tables have RLS enabled.
- The latest Supabase security advisor scan returned no lints.
- Only the publishable key is in browser configuration. Secret/service-role keys are not in Git.

## Still required before full commercial launch

- Enable Google provider with the existing Google OAuth web client credentials and add the new callback URI.
- Configure production SMTP and test email confirmation/password reset.
- Select and configure a payment provider and server-side webhook verification.
- Connect static website publishing, subdomains, SSL, backups and custom domains.
- Activate hosting plans only after infrastructure capacity and costs are verified.
- Complete affiliate click attribution and commission settlement after verified orders.
- Assign the trusted admin role to the owner's confirmed account.
- Run end-to-end Android/desktop, cross-user RLS and live deployment tests.

See [the full business blueprint](docs/CHICHI_ADS_BLUEPRINT.md), [production connection checklist](docs/CHICHI_ADS_PRODUCTION_CONNECTIONS.md), [backend foundation](docs/CHICHI_ADS_BACKEND_FOUNDATION.md) and [authentication setup](docs/CHICHI_ADS_AUTH_SETUP.md).

## Important

The platform can accept applications and save website drafts, but it is not yet safe to accept real payments or promise public website hosting. Purchase requests remain pending until a payment provider is connected. Website drafts are not publicly published yet.
