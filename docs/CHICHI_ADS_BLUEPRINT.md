# Chichi_Ads — Business and Product Blueprint

**Brand promise:** Build. Buy. Host. Earn.  
**Business concept:** A website commerce and creation platform that brings customers, independent developers, website services, hosting and affiliate promotion into one managed marketplace.

## 1. Business overview

Chichi_Ads helps individuals and small businesses establish an online presence without needing to hire a full development team. Customers can buy a ready-made website, create one from a template, or commission a custom website. Developers can list eligible website products and services. Affiliates can promote verified products and earn approved commissions. Hosting and domain services can be added when infrastructure and support capacity are in place.

The initial operating model should be lean: start with template-driven static websites, manually review third-party listings, manually reconcile payments and payouts, and expand only when real usage and revenue justify the cost.

## 2. Target customers

- Small businesses and local service providers.
- Online sellers and early-stage e-commerce businesses.
- Restaurants, property professionals and booking-based businesses.
- Freelancers, creators and portfolio owners.
- Independent web developers who want a managed sales channel.
- Content creators and promoters who want referral income.

## 3. Core product areas

### A. Website marketplace

Initial categories:
1. Online stores and product catalogues.
2. Business and company websites.
3. Restaurant websites and menu pages.
4. Real-estate and property showcases.
5. Portfolio and creator websites.
6. Booking and appointment enquiry websites.

Every real listing should include a working demo, screenshots, responsive behaviour, included features, price, source-code and asset-rights declaration, licence/ownership terms, support window, update policy and compatibility notes. Demo listings must be labelled as examples until real seller submissions are approved.

### B. Website builder

MVP is a template-first editor, not an unrestricted visual page builder.

Required customer journey:
1. Create an account and sign in.
2. Choose a starter template and category.
3. Enter website/business name and introductory content.
4. Edit allowed headings, paragraphs, buttons, links, images, colours and sections.
5. Preview mobile and desktop layouts.
6. Save a private draft to the customer's account.
7. Review changes and version history.
8. Publish to a managed preview subdomain after publishing infrastructure is implemented.

Future capabilities: section drag-and-drop, product catalogue, enquiry forms, bookings, SEO settings, analytics, custom domains, AI-assisted copy and page generation. AI generation should only be enabled with strict usage limits and a cost budget.

### C. Hosting and domains

Begin with static/lightweight websites. Hosting plans must state storage, bandwidth, file limits, backup frequency, support level, renewal date, grace period, suspension rules, export/migration options and custom-domain availability. Do not advertise unlimited hosting.

Dynamic features such as customer login, e-commerce checkout and booking require backend services, abuse protection, monitoring and operational support. These must not be represented as included until implemented and tested.

### D. Developer marketplace

Developers submit a website with:
- Title, category, description and price.
- Live demo and screenshots.
- Source code or deployment package.
- Ownership and third-party asset declarations.
- Licence terms, update policy and support window.
- Compatibility and technical requirements.

Admin review must check quality, security, responsiveness, rights declarations and truthful feature claims before a listing becomes purchasable.

### E. Affiliate programme

Each approved affiliate receives a unique referral URL. The server records attribution and calculates commission only on eligible, verified orders. Proposed initial commission examples from the planning blueprint are 10% for Starter, 12% for Professional, 15% for Premium, 10% for custom services and 10% on a first hosting payment. These are proposals, not active rates.

Recommended controls: 30-day attribution window, minimum withdrawal of ₦5,000, no self-referrals, commission reversal for refunds/fraud, a clear pending/approved/paid ledger, and manual payout approval at launch. Rates must be recalculated against payment fees, developer shares, hosting costs, refunds and support.

### F. Custom website studio

Offer a request form for customers who need a tailored website, with scope, timeline, deliverables, revisions, support period and payment milestones confirmed before work starts.

## 4. Account types and dashboards

- **Customer:** profile, purchased websites, website projects, editor, previews, hosting, domains, invoices, renewals, backups and support.
- **Developer:** submissions, demo links, review status, sales, licence versions, earnings and payout history.
- **Affiliate:** referral link, campaign assets, clicks, registrations, verified sales, commission status and withdrawals.
- **Administrator:** user and role management, listing approvals, order/payment reconciliation, refunds, hosting operations, commissions, payout approvals, support and audit logs.

Admin-only functions must be enforced server-side. Hiding a button in the browser is not access control.

## 5. Revenue model

Potential revenue sources:
- Ready-made website sales.
- Custom website projects.
- Hosting subscriptions and renewals.
- Domain setup/management services.
- Developer listing or premium placement fees, if introduced transparently.
- Future paid builder tiers and optional add-ons.

All pricing must include the cost of infrastructure, payment processing, refunds, developer shares, affiliate commissions, customer support and taxes where applicable. Gross sales are not net profit.

## 6. Technical architecture

- Static, responsive web application for the customer-facing experience.
- Dedicated Chichi_Ads Supabase project for authentication and application data.
- Postgres tables with row-level security and strict owner scoping.
- Supabase Storage or another controlled object store for validated uploads.
- Server-side functions for payment verification, order state changes, commissions, payouts and privileged admin actions.
- Static hosting for initial published websites; a controlled publishing pipeline and domain-routing layer before custom domains.
- Monitoring, audit logs, backups and tested restore procedures.

Never expose Supabase secret/service-role keys in browser code. Only publishable keys may be placed in public frontend configuration. All sensitive business logic must be server-verified.

## 7. Core data entities

Users and profiles; roles and permissions; marketplace listings and versions; developer profiles; website projects and project versions; project assets; orders; payment records; licence/ownership transfers; hosting plans and subscriptions; domains; usage records; backups; affiliate profiles; referral events; commission ledger; payout requests; support tickets; audit events.

## 8. Security and operational requirements

- Enforce RLS on every exposed table and write policies for each role/action.
- Test that one customer cannot read, change or delete another customer's projects or assets.
- Use server-side authorization for admin, payment, payout and publishing operations.
- Validate uploads by file type, size and content; prevent executable uploads where not needed.
- Verify payment status with the payment provider or trusted bank/provider evidence before fulfilling an order.
- Record immutable payment and commission events; reverse ledger entries rather than silently editing history.
- Use rate limits, spam protection, email verification and secure password reset.
- Keep secrets out of Git, logs and frontend bundles.
- Test backup restoration, account recovery, refunds and incident response.

## 9. Development roadmap

### Phase 1 — Brand and early-access foundation
- Chichi_Ads branding, responsive navigation and product sections.
- Dedicated Supabase project.
- Email/password authentication foundation.
- Customer-owned website draft and version records.
- Initial security policies and deployment checks.

### Phase 2 — Builder MVP
- Template selection and structured editing.
- Image upload and validation.
- Mobile/desktop preview.
- Draft persistence, version history and restore.
- Private preview links and publish/unpublish workflow.

### Phase 3 — Marketplace and transactions
- Real developer submissions and admin review.
- Listing detail pages, licences and checkout.
- Verified order fulfilment, refunds and invoices.
- Customer and developer dashboards.

### Phase 4 — Hosting and domains
- Static site publishing pipeline.
- Subdomain routing, SSL and rollback.
- Hosting plans, usage limits, renewals, backups and domain connection.
- Monitoring and support processes.

### Phase 5 — Affiliate and scale
- Referral attribution and fraud controls.
- Commission ledger and payout approvals.
- Analytics, support automation and performance improvements.
- Optional AI-assisted builder with hard usage and cost caps.

## 10. Current implementation status (15 November 2026)

**Implemented and committed to main:**
- Chichi_Ads rebrand, logo, responsive early-access interface and navigation.
- Dedicated Supabase project Chichi-Ads.
- Website project and version tables, owner-scoped RLS policies.
- Browser auth adapter for email/password, registration and password-reset requests.
- Customer project save/list foundation and version snapshots.
- PWA shell and project documentation.

**Not yet production-ready or activated:**
- Google OAuth credentials and redirect allow-list.
- End-to-end email confirmation and password-reset redirect configuration.
- Full browser/device testing of registration and customer project saves.
- Visual drag-and-drop editor, file uploads and version restore interface.
- Public publishing pipeline, hosting provisioning and custom domains.
- Real marketplace inventory, checkout, payment verification and refunds.
- Developer onboarding, affiliate attribution, commission settlement and payouts.
- Admin role management and operational audit interface.

This status is deliberately explicit: the early-access interface and database foundation are not the same as a fully operating website marketplace.
