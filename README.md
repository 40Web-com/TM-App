# Chichi_Ads

**Build. Buy. Host. Earn.**

Chichi_Ads is being developed from the existing TM-App codebase into a website marketplace, template-based website builder, hosting platform, developer marketplace and affiliate programme.

## Rebrand migration

The `chichi-ads-rebrand` branch is the isolated rebranding workstream. The original `main` branch remains the baseline while the existing application is audited and converted in stages.

## Product areas
- Website marketplace and live demos
- Template-based no-code website builder
- Customer websites, publishing and hosting
- Developer submissions and seller earnings
- Affiliate referrals and commissions
- Admin operations, payment verification and support

## Development principles
- Preserve reusable, working infrastructure where it is suitable.
- Remove the old social/dating/chat product experience from the customer-facing product as the Chichi_Ads replacement is implemented.
- Keep customer website projects isolated.
- Verify payments server-side before releasing purchased websites.
- Never expose secrets in frontend code or commit them to Git.
- Treat free hosting tiers as limited capacity, not unlimited hosting.

## Current migration status
Initial brand metadata and visual theme groundwork are being applied on the rebrand branch. The full screen-by-screen migration, backend audit, database changes, builder and marketplace implementation remain staged work and must be verified before launch.

## Local development
Install dependencies with `npm install`, run `npm run dev`, and create a production build with `npm run build`.

## Project handover
All source code, deployment configuration, domain ownership and service accounts should remain under the business owner's control.
