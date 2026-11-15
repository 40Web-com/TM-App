create table if not exists public.chichi_profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null default '', country text not null default '', phone text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.chichi_profiles enable row level security;
grant select,insert,update on public.chichi_profiles to authenticated;
create policy "Users view own Chichi profile" on public.chichi_profiles for select to authenticated using ((select auth.uid())=id);
create policy "Users create own Chichi profile" on public.chichi_profiles for insert to authenticated with check ((select auth.uid())=id);
create policy "Users update own Chichi profile" on public.chichi_profiles for update to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
create or replace function public.chichi_handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.chichi_profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name','')) on conflict(id) do nothing;
 return new;
end; $$;
create trigger chichi_auth_user_profile after insert on auth.users for each row execute function public.chichi_handle_new_user();

create table if not exists public.chichi_developer_profiles (id uuid primary key references auth.users(id) on delete cascade, display_name text not null, bio text not null default '', portfolio_url text not null default '', status text not null default 'pending' check(status in ('pending','approved','suspended')), created_at timestamptz not null default now());
alter table public.chichi_developer_profiles enable row level security;
grant select,insert,update on public.chichi_developer_profiles to authenticated;
create policy "Developers manage own profile" on public.chichi_developer_profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);

create table if not exists public.chichi_listings (id uuid primary key default gen_random_uuid(), seller_id uuid references auth.users(id) on delete set null, title text not null check(char_length(trim(title)) between 3 and 120), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), category text not null check(category in ('online-store','business','restaurant','real-estate','portfolio','booking')), description text not null default '', price_kobo bigint not null default 0 check(price_kobo>=0), currency text not null default 'NGN', demo_url text not null default '', preview_image text not null default '', features jsonb not null default '[]'::jsonb, licence_terms text not null default '', review_status text not null default 'pending' check(review_status in ('pending','approved','rejected','suspended')), is_featured boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.chichi_listings enable row level security;
grant select on public.chichi_listings to anon,authenticated;
grant insert,update,delete on public.chichi_listings to authenticated;
create policy "Public can view approved listings" on public.chichi_listings for select to anon,authenticated using (review_status='approved');
create policy "Seller can submit own listing" on public.chichi_listings for insert to authenticated with check ((select auth.uid())=seller_id and review_status='pending');
create policy "Seller can edit own pending listing" on public.chichi_listings for update to authenticated using ((select auth.uid())=seller_id and review_status='pending') with check ((select auth.uid())=seller_id and review_status='pending');

create table if not exists public.chichi_orders (id uuid primary key default gen_random_uuid(), buyer_id uuid not null references auth.users(id) on delete restrict, listing_id uuid references public.chichi_listings(id) on delete set null, item_name text not null, amount_kobo bigint not null check(amount_kobo>=0), currency text not null default 'NGN', payment_status text not null default 'pending' check(payment_status in ('pending','verified','failed','refunded')), fulfilment_status text not null default 'awaiting_payment' check(fulfilment_status in ('awaiting_payment','queued','in_progress','delivered','cancelled')), provider text not null default 'manual', provider_reference text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.chichi_orders enable row level security;
grant select,insert on public.chichi_orders to authenticated;
create policy "Buyers view own orders" on public.chichi_orders for select to authenticated using ((select auth.uid())=buyer_id);
create policy "Buyers create pending orders" on public.chichi_orders for insert to authenticated with check ((select auth.uid())=buyer_id and payment_status='pending' and fulfilment_status='awaiting_payment');

create table if not exists public.chichi_affiliate_profiles (id uuid primary key references auth.users(id) on delete cascade, referral_code text not null unique, status text not null default 'pending' check(status in ('pending','approved','suspended')), created_at timestamptz not null default now());
alter table public.chichi_affiliate_profiles enable row level security;
grant select,insert on public.chichi_affiliate_profiles to authenticated;
create policy "Affiliates view own profile" on public.chichi_affiliate_profiles for select to authenticated using ((select auth.uid())=id);
create policy "Users apply as affiliate" on public.chichi_affiliate_profiles for insert to authenticated with check ((select auth.uid())=id and status='pending');

create table if not exists public.chichi_referral_events (id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references public.chichi_affiliate_profiles(id) on delete restrict, visitor_hash text not null, landing_path text not null default '/', created_at timestamptz not null default now());
alter table public.chichi_referral_events enable row level security;
grant select on public.chichi_referral_events to authenticated;
create policy "Affiliate views own referrals" on public.chichi_referral_events for select to authenticated using ((select auth.uid())=affiliate_id);

create table if not exists public.chichi_commissions (id uuid primary key default gen_random_uuid(), affiliate_id uuid not null references public.chichi_affiliate_profiles(id) on delete restrict, order_id uuid not null references public.chichi_orders(id) on delete restrict, amount_kobo bigint not null check(amount_kobo>=0), status text not null default 'pending' check(status in ('pending','approved','paid','reversed')), created_at timestamptz not null default now(), unique(affiliate_id,order_id));
alter table public.chichi_commissions enable row level security;
grant select on public.chichi_commissions to authenticated;
create policy "Affiliate views own commissions" on public.chichi_commissions for select to authenticated using ((select auth.uid())=affiliate_id);

create table if not exists public.chichi_hosting_plans (id uuid primary key default gen_random_uuid(), name text not null unique, price_kobo bigint not null check(price_kobo>=0), billing_period text not null check(billing_period in ('monthly','yearly','one_time')), storage_mb integer not null check(storage_mb>0), bandwidth_gb integer not null check(bandwidth_gb>0), backups_included boolean not null default false, is_active boolean not null default false, created_at timestamptz not null default now());
alter table public.chichi_hosting_plans enable row level security;
grant select on public.chichi_hosting_plans to anon,authenticated;
create policy "Public view active hosting plans" on public.chichi_hosting_plans for select to anon,authenticated using (is_active=true);

create table if not exists public.chichi_hosting_subscriptions (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, project_id uuid references public.chichi_website_projects(id) on delete set null, plan_id uuid not null references public.chichi_hosting_plans(id), status text not null default 'pending' check(status in ('pending','active','past_due','suspended','cancelled','expired')), starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now());
alter table public.chichi_hosting_subscriptions enable row level security;
grant select,insert on public.chichi_hosting_subscriptions to authenticated;
create policy "Customers view own hosting" on public.chichi_hosting_subscriptions for select to authenticated using ((select auth.uid())=owner_id);
create policy "Customers request own hosting" on public.chichi_hosting_subscriptions for insert to authenticated with check ((select auth.uid())=owner_id and status='pending');

create table if not exists public.chichi_support_tickets (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade, subject text not null check(char_length(trim(subject)) between 3 and 150), message text not null check(char_length(trim(message)) between 10 and 10000), status text not null default 'open' check(status in ('open','in_progress','resolved','closed')), created_at timestamptz not null default now());
alter table public.chichi_support_tickets enable row level security;
grant select,insert on public.chichi_support_tickets to authenticated;
create policy "Customers view own tickets" on public.chichi_support_tickets for select to authenticated using ((select auth.uid())=owner_id);
create policy "Customers open own tickets" on public.chichi_support_tickets for insert to authenticated with check ((select auth.uid())=owner_id);

create table if not exists public.chichi_admin_audit (id bigint generated always as identity primary key, actor_id uuid, action text not null, target_type text not null, target_id text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
alter table public.chichi_admin_audit enable row level security;
revoke all on public.chichi_admin_audit from anon,authenticated;
