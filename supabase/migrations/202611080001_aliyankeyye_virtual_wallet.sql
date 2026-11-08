-- Aliyankee Pay simulator virtual wallet
create table if not exists public.aliyankeyye_wallets (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade, currency text not null check(currency ~ '^[A-Z]{3}$'), balance numeric(20,4) not null default 0 check(balance>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,currency));
create index if not exists aliyankeyye_wallets_user_idx on public.aliyankeyye_wallets(user_id);
create table if not exists public.aliyankeyye_transactions (id uuid primary key default gen_random_uuid(), reference text not null unique, sender_user_id uuid not null references public.users(id) on delete cascade, recipient_user_id uuid references public.users(id) on delete set null, recipient_email text not null, recipient_name text not null default '', currency text not null check(currency ~ '^[A-Z]{3}$'), amount numeric(20,4) not null check(amount>0), memo text not null default '', status text not null default 'simulated' check(status in ('simulated','cancelled')), email_status text not null default 'pending' check(email_status in ('pending','sent','not_configured','failed')), created_at timestamptz not null default now());
create index if not exists aliyankeyye_tx_sender_idx on public.aliyankeyye_transactions(sender_user_id,created_at desc);
create index if not exists aliyankeyye_tx_recipient_idx on public.aliyankeyye_transactions(recipient_user_id,created_at desc);
alter table public.aliyankeyye_wallets enable row level security; alter table public.aliyankeyye_transactions enable row level security;
revoke all on public.aliyankeyye_wallets from anon,authenticated; revoke all on public.aliyankeyye_transactions from anon,authenticated; grant all on public.aliyankeyye_wallets to service_role; grant all on public.aliyankeyye_transactions to service_role;
create or replace function public.aliyankeyye_virtual_transfer(p_sender uuid,p_email text,p_name text,p_currency text,p_amount numeric,p_memo text) returns jsonb language plpgsql security definer set search_path=public as $$
declare sw public.aliyankeyye_wallets; rw public.aliyankeyye_wallets; recipient uuid; tx public.aliyankeyye_transactions; ref text;
begin
 if p_amount<=0 or p_amount>100000000 then raise exception 'Invalid virtual transfer amount'; end if;
 if p_currency !~ '^[A-Z]{3}$' then raise exception 'Invalid currency'; end if;
 select id into recipient from public.users where lower(coalesce(email,''))=lower(p_email) limit 1;
 insert into public.aliyankeyye_wallets(user_id,currency,balance) values(p_sender,p_currency,0) on conflict(user_id,currency) do nothing;
 select * into sw from public.aliyankeyye_wallets where user_id=p_sender and currency=p_currency for update;
 if sw.balance<p_amount then raise exception 'Insufficient virtual balance'; end if;
 update public.aliyankeyye_wallets set balance=balance-p_amount,updated_at=now() where id=sw.id returning * into sw;
 if recipient is not null and recipient<>p_sender then
  insert into public.aliyankeyye_wallets(user_id,currency,balance) values(recipient,p_currency,0) on conflict(user_id,currency) do nothing;
  select * into rw from public.aliyankeyye_wallets where user_id=recipient and currency=p_currency for update;
  update public.aliyankeyye_wallets set balance=balance+p_amount,updated_at=now() where id=rw.id;
 end if;
 ref:='AP-SIM-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into public.aliyankeyye_transactions(reference,sender_user_id,recipient_user_id,recipient_email,recipient_name,currency,amount,memo) values(ref,p_sender,case when recipient=p_sender then null else recipient end,lower(p_email),left(coalesce(p_name,''),80),p_currency,p_amount,left(coalesce(p_memo,''),120)) returning * into tx;
 return jsonb_build_object('transaction',to_jsonb(tx),'balance',sw.balance,'recipient_user_id',recipient);
end;$$;
revoke all on function public.aliyankeyye_virtual_transfer(uuid,text,text,text,numeric,text) from public,anon,authenticated; grant execute on function public.aliyankeyye_virtual_transfer(uuid,text,text,text,numeric,text) to service_role;