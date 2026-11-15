# Chichi_Ads

**Build. Buy. Host. Earn.**

Chichi_Ads is a website marketplace and template-first website creation platform. The early-access release is built from the existing TM App repository and uses a separate Supabase project for Chichi_Ads accounts and website drafts.

## Product areas

- Website marketplace: online stores, business sites, restaurants, real estate, portfolios and booking sites.
- Website builder: template-driven editing and customer-owned drafts.
- Hosting and domains: planned lightweight hosting, renewals, backups and custom domains.
- Developer marketplace: reviewed third-party website listings and licensing.
- Affiliate programme: referral attribution and verified commission accounting.
- Custom website studio: tailored website requests and delivery.

## Current early-access capabilities

- Responsive Chichi_Ads interface and logo.
- Email/password account registration and sign-in foundation.
- Customer-owned website draft storage and version snapshots.
- Separate Supabase project with row-level security on website-project tables.

## Important status

This is an early-access foundation, not yet a complete production marketplace. Google OAuth still needs provider credentials and redirect configuration. Email confirmation and password-reset redirects need final configuration and browser testing. Public website publishing, hosting provisioning, payments, developer payouts, affiliate commissions and admin operations are not yet active. Demo marketplace cards are examples, not real purchasable inventory.

See [the full business and product blueprint](docs/CHICHI_ADS_BLUEPRINT.md), [backend foundation](docs/CHICHI_ADS_BACKEND_FOUNDATION.md) and [authentication setup](docs/CHICHI_ADS_AUTH_SETUP.md).

## Security

- The frontend contains only the Supabase publishable key.
- Never add a Supabase secret/service-role key to this repository or browser code.
- The Chichi_Ads Supabase project is separate from the legacy TM App project.
- Do not accept or fulfil payments based only on a client-side success message.
