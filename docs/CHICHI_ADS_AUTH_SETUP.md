# Chichi_Ads authentication setup

The Chichi_Ads frontend uses a dedicated Supabase project and supports email/password authentication plus a Google OAuth PKCE flow. It does not reuse the legacy TM App database or user pool.

## Project details

- Project ref: `tluqyuvdumylwvtfpxgp`
- API URL: `https://tluqyuvdumylwvtfpxgp.supabase.co`
- Website: `https://40web-com.github.io/TM-App/`
- Google callback URI: `https://tluqyuvdumylwvtfpxgp.supabase.co/auth/v1/callback`

## Google OAuth

Open [Chichi_Ads Google provider settings](https://supabase.com/dashboard/project/tluqyuvdumylwvtfpxgp/auth/providers?provider=google).

If the previous website Google OAuth web client is still under your control, reuse that same Google Cloud OAuth client:
1. Add authorized JavaScript origin `https://40web-com.github.io`.
2. Add authorized redirect URI `https://tluqyuvdumylwvtfpxgp.supabase.co/auth/v1/callback`.
3. Enable Google in the Chichi_Ads Supabase provider settings.
4. Enter the Google OAuth Client ID and Client Secret in the Supabase dashboard only. Do not place the secret in Git or browser JavaScript.

In Supabase Authentication URL Configuration:
- Site URL: `https://40web-com.github.io/TM-App/`
- Redirect allow list: `https://40web-com.github.io/TM-App/**`

If you cannot access the old Google OAuth client, create a new Web application OAuth client in Google Cloud and configure it the same way. Supabase does not expose the old Google Client Secret through the database API, so it cannot be copied automatically from the old project.

## Email provider

Enable Email provider, configure email confirmation, and add a production SMTP provider. Test registration, confirmation, password reset, login, session refresh and logout on Android and desktop. Keep email confirmation enabled for public accounts.

## Administrator role

The Edge Function checks trusted `app_metadata.role = admin`. User-editable metadata is not accepted. After the owner has registered and confirmed the account, a project owner may grant the role in SQL Editor by replacing the email with the exact confirmed account:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where lower(email) = lower('YOUR_VERIFIED_ACCOUNT_EMAIL');
```

Sign out and back in to refresh the JWT claim. Never let a public user self-assign this role.

## Security

- Browser configuration contains only the publishable API key.
- Never commit service-role/secret keys.
- Website project and image access is owner-scoped.
- Admin actions run in a JWT-verified Edge Function and check trusted app metadata.
- Payment state is not writable by customers; the admin function requires a verified provider/bank reference.

