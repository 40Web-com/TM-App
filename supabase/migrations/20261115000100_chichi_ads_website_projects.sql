-- Chichi_Ads website-project foundation.
-- Apply only after the Chichi_Ads authentication flow is connected to Supabase Auth.
-- This migration is intentionally isolated from legacy TM App tables.

create table if not exists public.chichi_website_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  category text not null default 'business'
    check (category in ('online-store','business','restaurant','real-estate','portfolio','booking')),
  template_key text not null default 'business-starter',
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  content jsonb not null default '{}'::jsonb
    check (pg_column_size(content) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (owner_id, slug),
  unique (id, owner_id)
);

create index if not exists chichi_website_projects_owner_updated_idx
  on public.chichi_website_projects(owner_id, updated_at desc);

create table if not exists public.chichi_website_project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null check (pg_column_size(snapshot) <= 262144),
  created_at timestamptz not null default now(),
  foreign key (project_id, owner_id)
    references public.chichi_website_projects(id, owner_id) on delete cascade,
  unique (project_id, version_number)
);

create index if not exists chichi_project_versions_project_created_idx
  on public.chichi_website_project_versions(project_id, created_at desc);

alter table public.chichi_website_projects enable row level security;
alter table public.chichi_website_project_versions enable row level security;

grant select, insert, update, delete on public.chichi_website_projects to authenticated;
grant select, insert, update, delete on public.chichi_website_project_versions to authenticated;

drop policy if exists "Owners can read their Chichi websites" on public.chichi_website_projects;
create policy "Owners can read their Chichi websites"
  on public.chichi_website_projects for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create their Chichi websites" on public.chichi_website_projects;
create policy "Owners can create their Chichi websites"
  on public.chichi_website_projects for insert to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can update their Chichi websites" on public.chichi_website_projects;
create policy "Owners can update their Chichi websites"
  on public.chichi_website_projects for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners can delete their Chichi websites" on public.chichi_website_projects;
create policy "Owners can delete their Chichi websites"
  on public.chichi_website_projects for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can read their Chichi website versions" on public.chichi_website_project_versions;
create policy "Owners can read their Chichi website versions"
  on public.chichi_website_project_versions for select to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners can create their Chichi website versions" on public.chichi_website_project_versions;
create policy "Owners can create their Chichi website versions"
  on public.chichi_website_project_versions for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (
      select 1 from public.chichi_website_projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Owners can delete their Chichi website versions" on public.chichi_website_project_versions;
create policy "Owners can delete their Chichi website versions"
  on public.chichi_website_project_versions for delete to authenticated
  using ((select auth.uid()) = owner_id);
