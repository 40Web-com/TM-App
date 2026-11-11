create table if not exists public.tmvb_daily_grants (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
 grant_date date not null default current_date, points integer not null default 250 check(points=250),
 created_at timestamptz not null default now(), unique(user_id,grant_date)
);
alter table public.tmvb_daily_grants enable row level security;
revoke all on public.tmvb_daily_grants from anon,authenticated;
grant all on public.tmvb_daily_grants to service_role;
alter table public.tmvb_wallet_transactions drop constraint if exists tmvb_wallet_transactions_kind_check;
alter table public.tmvb_wallet_transactions add constraint tmvb_wallet_transactions_kind_check check(kind in ('welcome','stake','payout','refund','daily_grant'));
create or replace function public.tmvb_claim_daily_points(p_user_id uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare grant_id uuid; new_balance bigint;
begin
 perform public.tmvb_ensure_wallet(p_user_id);
 insert into public.tmvb_daily_grants(user_id,grant_date,points) values(p_user_id,current_date,250)
 on conflict(user_id,grant_date) do nothing returning id into grant_id;
 if grant_id is null then raise exception 'Your daily free points have already been claimed'; end if;
 update public.tmvb_wallets set balance=balance+250,updated_at=now() where user_id=p_user_id returning balance into new_balance;
 insert into public.tmvb_wallet_transactions(user_id,amount,balance_after,kind,reference_key)
 values(p_user_id,250,new_balance,'daily_grant','daily:'||current_date::text);
 return jsonb_build_object('balance',new_balance,'points',250,'grant_date',current_date);
end; $$;
revoke all on function public.tmvb_claim_daily_points(uuid) from public,anon,authenticated;
grant execute on function public.tmvb_claim_daily_points(uuid) to service_role;