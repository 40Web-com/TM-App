create or replace function public.tmvb_settle_match(p_match_id uuid)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_match public.tmvb_matches%rowtype;
  v_prediction record;
  v_outcome text;
  v_payout bigint;
  v_balance bigint;
  v_result jsonb;
begin
  select * into v_match from public.tmvb_matches where id = p_match_id for update;
  if not found then raise exception 'Match not found'; end if;
  if v_match.status = 'completed' then return jsonb_build_object('status','completed'); end if;
  if now() < v_match.ends_at then return jsonb_build_object('status',v_match.status,'settled',false); end if;
  v_result := v_match.result;
  for v_prediction in
    select p.*, m.market_key from public.tmvb_predictions p
    join public.tmvb_markets m on m.id = p.market_id
    where p.match_id = p_match_id and p.status = 'pending'
    for update of p
  loop
    v_outcome := case v_prediction.market_key
      when 'winner' then coalesce(v_result->>'winner_id','draw')
      when 'first_headshot' then coalesce(v_result->>'first_headshot_by','none')
      when 'headshots_total' then case when coalesce((v_result->>'total_headshots')::integer,0) >= 4 then 'over_3_5' else 'under_3_5' end
      when 'first_elimination' then coalesce(v_result->>'first_elimination_id','none')
      when 'final_weapon' then coalesce(v_result->>'final_weapon','none')
      when 'duration' then case when coalesce((v_result->>'duration_sec')::integer,60) < 45 then 'under_45' else 'over_45' end
      when 'both_headshot' then case when coalesce((v_result->>'both_headshot')::boolean,false) then 'yes' else 'no' end
      when 'eliminations_total' then case when coalesce((v_result->>'total_eliminations')::integer,0)=0 then 'zero' when coalesce((v_result->>'total_eliminations')::integer,0)=1 then 'one' else 'two_plus' end
      when 'first_headshot_time' then coalesce(v_result->>'first_headshot_time_outcome','none')
      when 'winner_method' then coalesce(v_result->>'winner_by','draw')
      when 'winning_health' then case when v_result->>'winner_id' is null then 'draw' when coalesce((v_result->>'winner_remaining_health')::integer,0)>50 then 'over_50' else 'under_50' end
      when 'more_headshots' then coalesce(v_result->>'more_headshots','tie')
      when 'total_hits' then case when coalesce((v_result->>'total_hits')::integer,0)>=13 then 'over_12_5' else 'under_12_5' end
      when 'total_misses' then case when coalesce((v_result->>'total_misses')::integer,0)>=21 then 'over_20_5' else 'under_20_5' end
      else 'void'
    end;
    if v_prediction.selection = v_outcome then
      v_payout := v_prediction.potential_return;
      update public.tmvb_wallets set balance=balance+v_payout,updated_at=now()
        where user_id=v_prediction.user_id returning balance into v_balance;
      update public.tmvb_predictions set status='won',settled_at=now() where id=v_prediction.id;
      insert into public.tmvb_wallet_transactions(user_id,amount,balance_after,kind,reference_key)
        values(v_prediction.user_id,v_payout,v_balance,'payout',v_prediction.id::text) on conflict do nothing;
    else
      update public.tmvb_predictions set status='lost',settled_at=now() where id=v_prediction.id;
    end if;
  end loop;
  update public.tmvb_fighters
    set matches_played=matches_played+1,
        wins=wins+case when fighter_id=v_result->>'winner_id' then 1 else 0 end,
        losses=losses+case when v_result->>'winner_id' is not null and fighter_id<>v_result->>'winner_id' then 1 else 0 end,
        total_headshots=total_headshots+case when fighter_id=v_match.fighter_a_id then coalesce((v_result->>'fighter_a_headshots')::integer,0) else coalesce((v_result->>'fighter_b_headshots')::integer,0) end,
        updated_at=now()
    where fighter_id in (v_match.fighter_a_id,v_match.fighter_b_id);
  update public.tmvb_markets set status='settled' where match_id=p_match_id;
  update public.tmvb_matches set status='completed',seed_reveal=seed_secret where id=p_match_id;
  return jsonb_build_object('status','completed','settled',true);
end;
$function$;