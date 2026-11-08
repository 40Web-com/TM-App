create table if not exists public.aliyankeyye_payment_pins (user_id uuid primary key references public.users(id) on delete cascade,pin_salt text not null,pin_hash text not null,failed_attempts integer not null default 0,locked_until timestamptz,updated_at timestamptz not null default now());
alter table public.aliyankeyye_payment_pins enable row level security;
revoke all on public.aliyankeyye_payment_pins from anon, authenticated;
create index if not exists aliyankeyye_transactions_recipient_email_idx on public.aliyankeyye_transactions (lower(recipient_email));
