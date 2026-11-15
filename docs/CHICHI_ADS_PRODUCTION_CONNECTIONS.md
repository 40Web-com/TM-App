# Chichi_Ads production connection checklist

## Dedicated project

- Supabase project: Chichi-Ads
- Project ref: tluqyuvdumylwvtfpxgp
- API URL: https://tluqyuvdumylwvtfpxgp.supabase.co
- Frontend URL: https://40web-com.github.io/TM-App/
- Google/Supabase provider callback: https://tluqyuvdumylwvtfpxgp.supabase.co/auth/v1/callback

The Chichi_Ads project is separate from the older TM App project. Do not copy legacy TM App tables, secrets or service-role keys into this application.

## Google OAuth — reuse the existing Google web client

The Chichi_Ads frontend now uses the Supabase PKCE authorization-code flow. Google OAuth will not work until the Google provider is enabled in the new Supabase project.

1. Open the [Chichi_Ads Google provider settings](https://supabase.com/dashboard/project/tluqyuvdumylwvtfpxgp/auth/providers?provider=google).
2. In Google Cloud Console, open the existing Google OAuth web client used by the previous website (if it is still available and you control it).
3. Add this authorized JavaScript origin: `https://40web-com.github.io`.
4. Add this authorized redirect URI: `https://tluqyuvdumylwvtfpxgp.supabase.co/auth/v1/callback`.
5. In the Chichi_Ads Supabase Google provider settings, enable Google and enter the existing Google OAuth **Client ID** and **Client Secret**.
6. In Supabase Authentication URL Configuration, set the Site URL to `https://40web-com.github.io/TM-App/` and add `https://40web-com.github.io/TM-App/**` to the redirect URL allow list.
7. Save and test Google sign-in in a private browser session.

If the old Google OAuth client is no longer accessible, create a new Google OAuth client of type Web application. Never put the Google Client Secret in GitHub or browser JavaScript. The secret belongs only in the Supabase provider settings.

Supabase does not provide a safe way to retrieve an existing Google Client Secret from the old project through the project database. This repository does not contain the old client secret. The callback URI must be added to the Google Cloud OAuth client before the new project can use it.

## Email authentication

- Confirm the Site URL and redirect allow list above.
- Set up a production SMTP provider before public onboarding so account confirmation and password-reset email delivery is dependable.
- Test sign-up, confirmation, sign-in, password reset, session refresh and sign-out on Android and desktop.
- Do not disable email confirmation solely to hide a configuration issue.

## Administrator account

The administrator Edge Function checks the trusted `app_metadata.role` claim. It does not trust user-editable profile metadata.

After the owner has created and confirmed their Chichi_Ads account, an authorised project owner can grant the role in the Supabase SQL Editor by replacing the email with the exact verified account email:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = lower('YOUR_VERIFIED_ACCOUNT_EMAIL');
```

Then sign out and sign in again so a fresh access token contains the updated app metadata. Never let users self-assign this role from the website.

## Payment provider — still required before taking money

The database currently supports pending purchase requests and secure administrator verification after a real payment has been confirmed. No online payment provider is configured for Chichi_Ads yet.

Before accepting customer payments, choose the provider and complete its business/KYC approval. Implement a server-side payment initialization and webhook verifier using provider secrets stored only in Supabase Edge Function secrets. Never mark an order paid from a browser success message or screenshot. Refunds must reverse commissions and update order state.

## Hosting and publishing — still required before promising live hosting

The current builder stores private drafts and version snapshots. The private image bucket stores customer assets. It does not yet publish a website to a public URL.

Choose a static hosting and deployment provider, set up an account/project and API credentials, then implement a server-side publishing pipeline with:
- unique project slug/subdomain validation;
- build and deployment status records;
- rollback to a previous version;
- SSL and domain verification;
- storage/bandwidth quotas;
- abuse and malware checks;
- expiry, renewal, backups and export controls.

Do not activate hosting plans until real infrastructure and limits have been verified.

## Implemented backend foundation

- Customer profiles and private website projects/version snapshots.
- Developer applications and pending marketplace listing submissions.
- Pending order records with server-controlled payment verification.
- Affiliate applications, referral and commission ledger foundations.
- Hosting plan and subscription foundations.
- Customer support ticket storage.
- Private per-user website asset bucket.
- Admin Edge Function for listing moderation, affiliate approval and order verification.
- Row-level security enabled on all Chichi_Ads public tables; latest Supabase security advisor check returned no lints.

## Not yet production-enabled

- Google provider credentials and URL allow list.
- SMTP delivery and end-to-end email tests.
- Payment provider and verified webhook.
- Static site publishing and domain/hosting automation.
- Automatic affiliate attribution and commission settlement.
- Admin user assignment and operational review on a real account.
- End-to-end cross-user RLS and device/browser playtesting.
