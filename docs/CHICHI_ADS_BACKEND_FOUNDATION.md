# Chichi_Ads backend foundation

## Current state
The Chichi_Ads branch is a frontend prototype. The legacy Supabase project is shared with the original TM App and contains unrelated account, chat, wallet, gaming and betting data. Chichi_Ads must not query or repurpose those tables.

## Website-project persistence (draft migration)
The migration in `supabase/migrations/20261115000100_chichi_ads_website_projects.sql` introduces isolated tables:
- `chichi_website_projects`: one owner-scoped website project, template key, category, draft/published state and JSON content.
- `chichi_website_project_versions`: owner-scoped snapshots for restore/version history.

Both tables enable RLS. Authenticated users can access only rows where `owner_id = auth.uid()`. The version table also checks that its parent project belongs to the same authenticated owner. Content snapshots are capped at 256 KiB per row as an initial guardrail.

## Important deployment gate
This migration is committed as source only. It has **not** been applied to the live database. Do not apply it until:
1. Chichi_Ads has its own clearly separated sign-in/onboarding experience.
2. The frontend uses a verified Supabase Auth session (not the old TM custom session token).
3. A staging/test run confirms one account cannot read, update, or delete another account's projects or versions.
4. Publishing is still disabled until hosting, domain routing, upload validation, and rollback are implemented.

## Next implementation sequence
1. Add Chichi_Ads Google sign-in and account profile flow.
2. Add project create/list/update/archive using the authenticated client and these RLS policies.
3. Add version snapshots and restore.
4. Add template-driven publishing to a controlled preview subdomain.
5. Only then build hosting plans, checkout, developer submissions and affiliate accounting.

Never place a Supabase service-role/secret key in browser code. Keep marketplace orders, payments, payouts, and admin privileges server-verified.
