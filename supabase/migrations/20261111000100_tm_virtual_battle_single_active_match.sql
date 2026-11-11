drop index if exists public.tmvb_one_active_match;
create unique index tmvb_one_active_match on public.tmvb_matches ((true)) where status in ('scheduled','running');