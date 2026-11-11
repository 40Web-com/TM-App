create table if not exists public.tmvb_fighters (
 fighter_id text primary key, display_name text not null, call_sign text not null,
 accent text not null default '#48a8ff',
 base_health integer not null default 100 check (base_health between 1 and 200),
 accuracy numeric(5,4) not null default 0.62 check (accuracy between 0 and 1),
 headshot_rate numeric(5,4) not null default 0.18 check (headshot_rate between 0 and 1),
 reaction_ms integer not null default 260 check (reaction_ms between 80 and 2000),
 weapon_pool text[] not null default array['ak47','mp40','m1014'],
 matches_played integer not null default 0, wins integer not null default 0,
 losses integer not null default 0, total_headshots integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.tmvb_fighters(fighter_id,display_name,call_sign,accent,base_health,accuracy,headshot_rate,reaction_ms,weapon_pool) values
 ('nova','NOVA','THE STRIKER','#48a8ff',100,0.66,0.21,235,array['ak47','mp40','m4a1']),
 ('vex','VEX','THE PHANTOM','#c084fc',100,0.63,0.24,220,array['mp40','m1014','awm'])
on conflict(fighter_id) do nothing;
create table if not exists public.tmvb_matches (
 id uuid primary key default gen_random_uuid(), status text not null default 'scheduled' check(status in ('scheduled','running','completed','cancelled')),
 fighter_a_id text not null references public.tmvb_fighters(fighter_id), fighter_b_id text not null references public.tmvb_fighters(fighter_id),
 fighter_a_snapshot jsonb not null, fighter_b_snapshot jsonb not null,
 scheduled_start_at timestamptz not null, ends_at timestamptz not null, seed_hash text not null, seed_secret text not null,
 simulation_version text not null default 'tmvb-1.0.0', events jsonb not null default '[]'::jsonb, result jsonb,
 seed_reveal text, created_by uuid references public.users(id) on delete set null, created_at timestamptz not null default now(),
 check(fighter_a_id<>fighter_b_id), check(ends_at>scheduled_start_at)
);
create unique index if not exists tmvb_one_active_match on public.tmvb_matches ((status)) where status in ('scheduled','running');
create table if not exists public.tmvb_markets (
 id uuid primary key default gen_random_uuid(), match_id uuid not null references public.tmvb_matches(id) on delete cascade,
 market_key text not null, label text not null, selections jsonb not null, odds jsonb not null,
 status text not null default 'open' check(status in ('open','locked','settled','void')),
 closes_at timestamptz not null, created_at timestamptz not null default now(), unique(match_id,market_key)
);
create table if not exists public.tmvb_wallets (
 user_id uuid primary key references public.users(id) on delete cascade,
 balance bigint not null default 1000 check(balance>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.tmvb_predictions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
 match_id uuid not null references public.tmvb_matches(id) on delete cascade, market_id uuid not null references public.tmvb_markets(id) on delete cascade,
 selection text not null, stake integer not null check(stake between 10 and 5000), odds numeric(8,3) not null check(odds>=1),
 potential_return bigint not null check(potential_return>=0), status text not null default 'pending' check(status in ('pending','won','lost','void')),
 created_at timestamptz not null default now(), settled_at timestamptz, unique(user_id,market_id)
);
create table if not exists public.tmvb_wallet_transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
 amount bigint not null, balance_after bigint not null check(balance_after>=0),
 kind text not null check(kind in ('welcome','stake','payout','refund')), reference_key text not null,
 created_at timestamptz not null default now(), unique(user_id,kind,reference_key)
);
create index if not exists tmvb_matches_created_idx on public.tmvb_matches(created_at desc);
create index if not exists tmvb_predictions_user_idx on public.tmvb_predictions(user_id,created_at desc);
create index if not exists tmvb_markets_match_idx on public.tmvb_markets(match_id);
alter table public.tmvb_fighters enable row level security;
alter table public.tmvb_matches enable row level security;
alter table public.tmvb_markets enable row level security;
alter table public.tmvb_wallets enable row level security;
alter table public.tmvb_predictions enable row level security;
alter table public.tmvb_wallet_transactions enable row level security;
revoke all on public.tmvb_fighters,public.tmvb_matches,public.tmvb_markets,public.tmvb_wallets,public.tmvb_predictions,public.tmvb_wallet_transactions from anon,authenticated;
grant all on public.tmvb_fighters,public.tmvb_matches,public.tmvb_markets,public.tmvb_wallets,public.tmvb_predictions,public.tmvb_wallet_transactions to service_role;
create or replace function public.tmvb_ensure_wallet(p_user_id uuid) returns bigint language plpgsql security invoker set search_path=public as $$
declare inserted_count integer; current_balance bigint;
begin
 insert into public.tmvb_wallets(user_id,balance) values(p_user_id,1000) on conflict(user_id) do nothing;
 get diagnostics inserted_count=row_count;
 if inserted_count=1 then insert into public.tmvb_wallet_transactions(user_id,amount,balance_after,kind,reference_key) values(p_user_id,1000,1000,'welcome','welcome:'||p_user_id::text) on conflict do nothing; end if;
 select balance into current_balance from public.tmvb_wallets where user_id=p_user_id;
 return current_balance;
end; $$;
create or replace function public.tmvb_place_prediction(p_user_id uuid,p_market_id uuid,p_selection text,p_stake integer) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_market public.tmvb_markets%rowtype; v_match public.tmvb_matches%rowtype; v_odds numeric(8,3); v_balance bigint; v_prediction public.tmvb_predictions%rowtype;
begin
 if p_stake<10 or p_stake>5000 then raise exception 'Stake must be between 10 and 5000 virtual points'; end if;
 select * into v_market from public.tmvb_markets where id=p_market_id for update;
 if not found then raise exception 'Market not found'; end if;
 select * into v_match from public.tmvb_matches where id=v_market.match_id for update;
 if not found or v_match.status<>'scheduled' or now()>=v_match.scheduled_start_at or now()>=v_market.closes_at then raise exception 'Predictions are closed for this match'; end if;
 if not(v_market.selections?p_selection) then raise exception 'Invalid market selection'; end if;
 v_odds:=(v_market.odds->>p_selection)::numeric;
 if v_odds is null or v_odds<1 then raise exception 'Invalid odds'; end if;
 perform public.tmvb_ensure_wallet(p_user_id);
 update public.tmvb_wallets set balance=balance-p_stake,updated_at=now() where user_id=p_user_id and balance>=p_stake returning balance into v_balance;
 if not found then raise exception 'Not enough virtual points'; end if;
 insert into public.tmvb_predictions(user_id,match_id,market_id,selection,stake,odds,potential_return) values(p_user_id,v_match.id,v_market.id,p_selection,p_stake,v_odds,floor(p_stake*v_odds)::bigint) returning * into v_prediction;
 insert into public.tmvb_wallet_transactions(user_id,amount,balance_after,kind,reference_key) values(p_user_id,-p_stake,v_balance,'stake',v_prediction.id::text);
 return jsonb_build_object('prediction_id',v_prediction.id,'balance',v_balance,'potential_return',v_prediction.potential_return,'odds',v_odds);
end; $$;
create or replace function public.tmvb_settle_match(p_match_id uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_match public.tmvb_matches%rowtype; v_prediction record; v_outcome text; v_payout bigint; v_balance bigint;
begin
 select * into v_match from public.tmvb_matches where id=p_match_id for update;
 if not found then raise exception 'Match not found'; end if;
 if v_match.status='completed' then return jsonb_build_object('status','completed'); end if;
 if now()<v_match.ends_at then return jsonb_build_object('status',v_match.status,'settled',false); end if;
 for v_prediction in select p.*,m.market_key from public.tmvb_predictions p join public.tmvb_markets m on m.id=p.market_id where p.match_id=p_match_id and p.status='pending' for update of p loop
  v_outcome:=case v_prediction.market_key
   when 'winner' then coalesce(v_match.result->>'winner_id','draw')
   when 'first_headshot' then coalesce(v_match.result->>'first_headshot_by','none')
   when 'headshots_total' then case when coalesce((v_match.result->>'total_headshots')::integer,0)>=4 then 'over_3_5' else 'under_3_5' end
   when 'first_elimination' then coalesce(v_match.result->>'first_elimination_id','none')
   when 'final_weapon' then coalesce(v_match.result->>'final_weapon','none')
   when 'duration' then case when coalesce((v_match.result->>'duration_sec')::integer,60)<45 then 'under_45' else 'over_45' end
   else 'void' end;
  if v_prediction.selection=v_outcome then
   v_payout:=v_prediction.potential_return;
   update public.tmvb_wallets set balance=balance+v_payout,updated_at=now() where user_id=v_prediction.user_id returning balance into v_balance;
   update public.tmvb_predictions set status='won',settled_at=now() where id=v_prediction.id;
   insert into public.tmvb_wallet_transactions(user_id,amount,balance_after,kind,reference_key) values(v_prediction.user_id,v_payout,v_balance,'payout',v_prediction.id::text) on conflict do nothing;
  else update public.tmvb_predictions set status='lost',settled_at=now() where id=v_prediction.id; end if;
 end loop;
 update public.tmvb_fighters set matches_played=matches_played+1,
  wins=wins+case when fighter_id=v_match.result->>'winner_id' then 1 else 0 end,
  losses=losses+case when v_match.result->>'winner_id' is not null and fighter_id<>v_match.result->>'winner_id' then 1 else 0 end,
  total_headshots=total_headshots+case when fighter_id=v_match.fighter_a_id then coalesce((v_match.result->>'fighter_a_headshots')::integer,0) else coalesce((v_match.result->>'fighter_b_headshots')::integer,0) end,
  updated_at=now() where fighter_id in(v_match.fighter_a_id,v_match.fighter_b_id);
 update public.tmvb_markets set status='settled' where match_id=p_match_id;
 update public.tmvb_matches set status='completed',seed_reveal=seed_secret where id=p_match_id;
 return jsonb_build_object('status','completed','settled',true);
end; $$;
revoke all on function public.tmvb_ensure_wallet(uuid) from public,anon,authenticated;
revoke all on function public.tmvb_place_prediction(uuid,uuid,text,integer) from public,anon,authenticated;
revoke all on function public.tmvb_settle_match(uuid) from public,anon,authenticated;
grant execute on function public.tmvb_ensure_wallet(uuid) to service_role;
grant execute on function public.tmvb_place_prediction(uuid,uuid,text,integer) to service_role;
grant execute on function public.tmvb_settle_match(uuid) to service_role;
