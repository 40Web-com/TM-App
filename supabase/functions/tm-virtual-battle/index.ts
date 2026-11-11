import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const out = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
const digest = async (value: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes).map((x) => x.toString(16).padStart(2, "0")).join("");
};
const randomSeed = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map((x) => x.toString(16).padStart(2, "0")).join("");

async function authenticate(sessionToken: string) {
  if (!sessionToken || sessionToken.length < 20) throw new Error("Sign in to TM App to enter Virtual Battle.");
  const tokenHash = await digest(sessionToken);
  const { data, error } = await db.from("sessions")
    .select("user_id,expires_at,revoked_at")
    .eq("token_hash", tokenHash).maybeSingle();
  if (error || !data || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now()) {
    throw new Error("Your TM session has expired. Please sign in again.");
  }
  return data.user_id as string;
}

const weaponData: Record<string, { label: string; damage: number; interval: number; head: number }> = {
  ak47: { label: "AK-47", damage: 17, interval: 780, head: 1.8 },
  mp40: { label: "MP40", damage: 11, interval: 390, head: 1.65 },
  m1014: { label: "M1014", damage: 25, interval: 1050, head: 1.55 },
  m4a1: { label: "M4A1", damage: 14, interval: 610, head: 1.7 },
  awm: { label: "AWM", damage: 34, interval: 1450, head: 2.0 },
};

function makeRandom(seed: string) {
  let state = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 0x01000193);
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function applyForm(fighter: any) {
  const winRate = fighter.matches_played > 0 ? fighter.wins / fighter.matches_played : 0.5;
  const form = Math.max(-0.05, Math.min(0.05, (winRate - 0.5) * 0.1));
  return {
    ...fighter,
    accuracy: Math.max(0.5, Math.min(0.82, Number(fighter.accuracy) + form)),
    headshot_rate: Math.max(0.1, Math.min(0.35, Number(fighter.headshot_rate) + form * 0.5)),
    reaction_ms: Math.max(170, Math.round(Number(fighter.reaction_ms) - form * 350)),
    win_rate: Number((winRate * 100).toFixed(1)),
  };
}

function simulate(seed: string, a: any, b: any) {
  const rand = makeRandom(seed);
  const base = [
    { id:a.fighter_id,name:a.display_name,hp:Number(a.base_health)||100,weapon:a.weapon_pool[Math.floor(rand()*a.weapon_pool.length)],headshots:0,nextShot:Math.max(0,a.reaction_ms/1000),accuracy:Number(a.accuracy),headRate:Number(a.headshot_rate) },
    { id:b.fighter_id,name:b.display_name,hp:Number(b.base_health)||100,weapon:b.weapon_pool[Math.floor(rand()*b.weapon_pool.length)],headshots:0,nextShot:Math.max(0,b.reaction_ms/1000),accuracy:Number(b.accuracy),headRate:Number(b.headshot_rate) },
  ];
  const fighters = base.map(f=>({...f}));
  const events:any[]=[];
  let firstHeadshot:string|null=null,firstHeadshotTime:number|null=null;
  let firstEliminated:string|null=null,finalWeapon:string|null=null;
  let totalHits=0,totalMisses=0,totalEliminations=0,roundA=0,roundB=0,roundEliminationWins=0;
  const roundScores:any[]=[];
  const push=(t:number,round:number,type:string,actor:any,target:any,damage=0,headshot=false)=>{
    events.push({time_sec:Math.max(0,Math.min(60,Number(t.toFixed(2)))),round,type,actor_id:actor.id,actor_name:actor.name,target_id:target.id,target_name:target.name,weapon:actor.weapon,weapon_label:weaponData[actor.weapon].label,damage,headshot,target_hp:Math.max(0,Math.round(target.hp)),text:type==="miss"?actor.name+" missed a shot":type==="headshot"?"HEADSHOT! "+actor.name+" hit "+target.name:type==="hit"?actor.name+" hit "+target.name:type==="elimination"?actor.name+" eliminated "+target.name:""});
  };
  for(let round=1;round<=3;round++){
    for(let i=0;i<2;i++){fighters[i].hp=Number(base[i].hp)||100;fighters[i].nextShot=(round-1)*20000+Math.max(0,Number(i===0?a.reaction_ms:b.reaction_ms));}
    events.push({time_sec:(round-1)*20,round,type:"round_start",text:"ROUND "+round+" START"});
    const roundStartHits=totalHits,roundStartElims=totalEliminations;
    let roundWinner:string|null=null,endedByElimination=false;
    for(let ms=(round-1)*20000;ms<round*20000;ms+=100){
      const ready=fighters.filter(f=>f.hp>0&&ms>=f.nextShot);
      if(!ready.length)continue;
      for(let i=ready.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[ready[i],ready[j]]=[ready[j],ready[i]];}
      const intents:any[]=[];
      for(const actor of ready){
        const target=fighters.find(f=>f.id!==actor.id)!;
        if(target.hp<=0)continue;
        const weapon=weaponData[actor.weapon];actor.nextShot=ms+weapon.interval;
        if(rand()>actor.accuracy){intents.push({actor,target,type:"miss",damage:0,headshot:false});totalMisses++;continue;}
        const headshot=rand()<actor.headRate,damage=Math.round(weapon.damage*(headshot?weapon.head:1));
        intents.push({actor,target,type:headshot?"headshot":"hit",damage,headshot});totalHits++;
        if(headshot){actor.headshots++;if(!firstHeadshot){firstHeadshot=actor.id;firstHeadshotTime=ms/1000;}}
      }
      for(const intent of intents)if(intent.damage)intent.target.hp-=intent.damage;
      for(const intent of intents)push(ms/1000,round,intent.type,intent.actor,intent.target,intent.damage,intent.headshot);
      const eliminated=fighters.filter(f=>f.hp<=0);
      if(eliminated.length){
        for(const target of eliminated)target.hp=0;totalEliminations+=eliminated.length;endedByElimination=true;
        if(eliminated.length===2){roundWinner=null;if(!firstEliminated)firstEliminated="simultaneous";finalWeapon="simultaneous";for(const target of eliminated){const killer=intents.find(i=>i.target.id===target.id&&i.damage>0)?.actor;if(killer)push(ms/1000,round,"elimination",killer,target);}}
        else {const target=eliminated[0],killer=intents.find(i=>i.target.id===target.id&&i.damage>0)?.actor;if(killer){roundWinner=killer.id;if(!firstEliminated)firstEliminated=target.id;finalWeapon=killer.weapon;push(ms/1000,round,"elimination",killer,target);}}
        break;
      }
    }
    if(!endedByElimination){if(fighters[0].hp>fighters[1].hp)roundWinner=fighters[0].id;else if(fighters[1].hp>fighters[0].hp)roundWinner=fighters[1].id;}
    if(roundWinner===fighters[0].id)roundA++;else if(roundWinner===fighters[1].id)roundB++;
    if(endedByElimination&&roundWinner)roundEliminationWins++;
    roundScores.push({round,winner_id:roundWinner,fighter_a_hp:Math.max(0,Math.round(fighters[0].hp)),fighter_b_hp:Math.max(0,Math.round(fighters[1].hp)),hits:totalHits-roundStartHits,eliminations:totalEliminations-roundStartElims});
    events.push({time_sec:round*20,round,type:"round_end",text:"ROUND "+round+" COMPLETE"+(roundWinner?" · "+(roundWinner===fighters[0].id?fighters[0].name:fighters[1].name)+" TAKES THE ROUND":" · ROUND DRAW")});
  }
  let winner:string|null=null;
  if(roundA>roundB)winner=fighters[0].id;else if(roundB>roundA)winner=fighters[1].id;
  else if(fighters[0].hp>fighters[1].hp)winner=fighters[0].id;else if(fighters[1].hp>fighters[0].hp)winner=fighters[1].id;else winner=rand()<0.5?fighters[0].id:fighters[1].id;
  const totalHeadshots=fighters[0].headshots+fighters[1].headshots,winnerFighter=fighters.find(f=>f.id===winner);
  return {events,result:{
    winner_id:winner,is_draw:winner===null,first_headshot_by:firstHeadshot,first_headshot_time_sec:firstHeadshotTime,
    first_headshot_time_outcome:firstHeadshotTime===null?"none":firstHeadshotTime<30?"under_30":"over_30",
    first_elimination_id:firstEliminated,final_weapon:finalWeapon,duration_sec:60,total_headshots:totalHeadshots,
    fighter_a_headshots:fighters[0].headshots,fighter_b_headshots:fighters[1].headshots,
    fighter_a_hp:Math.max(0,Math.round(fighters[0].hp)),fighter_b_hp:Math.max(0,Math.round(fighters[1].hp)),
    fighter_a_weapon:fighters[0].weapon,fighter_b_weapon:fighters[1].weapon,
    both_headshot:fighters[0].headshots>0&&fighters[1].headshots>0,total_eliminations:totalEliminations,total_hits:totalHits,total_misses:totalMisses,
    winner_by:winner===null?"draw":roundEliminationWins>0?"elimination":"time",
    winner_remaining_health:winnerFighter?Math.max(0,Math.round(winnerFighter.hp)):null,
    more_headshots:fighters[0].headshots>fighters[1].headshots?fighters[0].id:fighters[1].headshots>fighters[0].headshots?fighters[1].id:"tie",
    round_scores:roundScores,rounds_won:{[fighters[0].id]:roundA,[fighters[1].id]:roundB}
  }};
}
function makeMarkets(matchId:string,a:any,b:any,startAt:string){
 const skillA=Number(a.accuracy)*.55+Number(a.headshot_rate)*.3+(1/Number(a.reaction_ms))*40;
 const skillB=Number(b.accuracy)*.55+Number(b.headshot_rate)*.3+(1/Number(b.reaction_ms))*40;
 const pA=Math.max(.38,Math.min(.62,skillA/(skillA+skillB))),pB=1-pA;
 const odds=(p:number)=>Number(Math.max(1.15,Math.min(4.8,.92/p)).toFixed(2));
 const entries=[
 {market_key:"winner",label:"Match winner",selections:{[a.fighter_id]:a.display_name,[b.fighter_id]:b.display_name,draw:"Draw"},odds:{[a.fighter_id]:odds(pA*.88),[b.fighter_id]:odds(pB*.88),draw:4.5}},
 {market_key:"first_headshot",label:"First headshot",selections:{[a.fighter_id]:a.display_name,[b.fighter_id]:b.display_name,none:"No headshot"},odds:{[a.fighter_id]:2.05,[b.fighter_id]:2.05,none:3.6}},
 {market_key:"headshots_total",label:"Total headshots",selections:{over_3_5:"Over 3.5",under_3_5:"Under 3.5"},odds:{over_3_5:1.95,under_3_5:1.85}},
 {market_key:"first_elimination",label:"First fighter eliminated",selections:{[a.fighter_id]:a.display_name,[b.fighter_id]:b.display_name,none:"No elimination",simultaneous:"Both together"},odds:{[a.fighter_id]:2.05,[b.fighter_id]:2.05,none:3.8,simultaneous:8}},
 {market_key:"final_weapon",label:"Final elimination weapon",selections:{ak47:"AK-47",mp40:"MP40",m1014:"M1014",m4a1:"M4A1",awm:"AWM",none:"No elimination",simultaneous:"Simultaneous"},odds:{ak47:2.7,mp40:2.7,m1014:3.1,m4a1:3,awm:3.8,none:4.2,simultaneous:9}},
 {market_key:"duration",label:"Battle duration",selections:{under_45:"Under 45 sec",over_45:"45–60 sec"},odds:{under_45:2.1,over_45:1.72}},
 {market_key:"both_headshot",label:"Will both fighters land a headshot?",selections:{yes:"Yes",no:"No"},odds:{yes:2.15,no:1.65}},
 {market_key:"eliminations_total",label:"Total eliminations",selections:{zero:"0",one:"1",two_plus:"2"},odds:{zero:4.2,one:1.35,two_plus:12}},
 {market_key:"first_headshot_time",label:"Time of first headshot",selections:{under_30:"Before 30 sec",over_30:"30 sec or later",none:"No headshot"},odds:{under_30:1.8,over_30:2.5,none:4.2}},
 {market_key:"winner_method",label:"How is the winner decided?",selections:{elimination:"By elimination",time:"By time",draw:"Draw"},odds:{elimination:1.6,time:2.4,draw:6}},
 {market_key:"winning_health",label:"Winner's remaining health",selections:{over_50:"Over 50 HP",under_50:"50 HP or less",draw:"Draw"},odds:{over_50:2.7,under_50:1.7,draw:6}},
 {market_key:"more_headshots",label:"Who lands more headshots?",selections:{[a.fighter_id]:a.display_name,[b.fighter_id]:b.display_name,tie:"Tie"},odds:{[a.fighter_id]:2.15,[b.fighter_id]:2.15,tie:3.2}},
 {market_key:"total_hits",label:"Total successful hits",selections:{over_12_5:"Over 12.5",under_12_5:"Under 12.5"},odds:{over_12_5:1.9,under_12_5:1.9}},
 {market_key:"total_misses",label:"Total missed shots",selections:{over_20_5:"Over 20.5",under_20_5:"Under 20.5"},odds:{over_20_5:1.9,under_20_5:1.9}}
 ];
 return entries.map(m=>({...m,match_id:matchId,closes_at:startAt,status:"open"}));
}

async function settleExpired(matches: any[]) {
  for (const match of matches) {
    if (match.status !== "completed" && new Date(match.ends_at).getTime() <= Date.now()) {
      await db.rpc("tmvb_settle_match", { p_match_id: match.id });
    }
  }
}

function publicMatch(match: any, markets: any[], predictions: any[]) {
  const now = Date.now();
  const start = new Date(match.scheduled_start_at).getTime();
  const end = new Date(match.ends_at).getTime();
  const elapsed = now < start ? 0 : Math.min(60, Math.max(0, Math.floor((now - start) / 1000)));
  const status = now < start ? "scheduled" : now < end ? "running" : "completed";
  const events = status === "scheduled" ? [] : (match.events || []).filter((e: any) => status === "completed" || e.time_sec <= elapsed);
  return {
    id: match.id, status, scheduled_start_at: match.scheduled_start_at, ends_at: match.ends_at,
    seed_hash: match.seed_hash, seed_reveal: status === "completed" ? match.seed_reveal : null,
    simulation_version: match.simulation_version, fighter_a: match.fighter_a_snapshot,
    fighter_b: match.fighter_b_snapshot, elapsed_sec: elapsed, events,
    result: status === "completed" ? match.result : null,
    markets: markets.filter((m) => m.match_id === match.id),
    predictions: predictions.filter((p) => p.match_id === match.id),
    created_at: match.created_at,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return out(405, { error: "POST required" });
  try {
    const body = await req.json();
    const userId = await authenticate(String(body.session_token || ""));
    const action = String(body.action || "");

    if (action === "place_accumulator") {
      const matchId = String(body.match_id || "");
      const legs = body.legs;
      const stake = Number(body.stake);
      if (!matchId || !Array.isArray(legs) || legs.length !== 2 || !Number.isInteger(stake) || stake < 100 || stake > 5000) return out(400, { error: "Choose exactly two different markets and a stake from 100 to 5,000 points." });
      const { data, error } = await db.rpc("tmvb_place_accumulator", {
        p_user_id: userId, p_match_id: matchId, p_legs: legs, p_stake: stake,
      });
      if (error) return out(400, { error: error.message });
      return out(200, { ok: true, ...data });
    }

    if (action === "create_match") {
      const { data: active } = await db.from("tmvb_matches").select("*")
        .in("status", ["scheduled", "running"]).gt("ends_at", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (active) return out(200, { ok: true, match_id: active.id, reused: true });

      const { data: fighters, error: fighterError } = await db.from("tmvb_fighters").select("*").order("fighter_id");
      if (fighterError || !fighters || fighters.length < 2) return out(500, { error: "Fighter roster is not ready." });
      const { count: completedCount } = await db.from("tmvb_matches").select("id", { count: "exact", head: true }).eq("status", "completed");
      const pairIndex = ((completedCount || 0) * 2) % fighters.length;
      const a = applyForm(fighters[pairIndex]);
      const b = applyForm(fighters[(pairIndex + 1) % fighters.length]);
      const seed = randomSeed();
      const seedHash = await digest(seed);
      const { events, result } = simulate(seed, a, b);
      const startAt = new Date(Date.now() + 60000);
      const endAt = new Date(startAt.getTime() + 60000);
      const { data: match, error: matchError } = await db.from("tmvb_matches").insert({
        status: "scheduled", fighter_a_id: a.fighter_id, fighter_b_id: b.fighter_id,
        fighter_a_snapshot: a, fighter_b_snapshot: b, scheduled_start_at: startAt.toISOString(),
        ends_at: endAt.toISOString(), seed_hash: seedHash, seed_secret: seed,
        simulation_version: "tmvb-1.4.0-two-pick-accumulator", events, result, created_by: userId,
      }).select("id").single();
      if (matchError) {
        const { data: existing } = await db.from("tmvb_matches").select("id")
          .in("status", ["scheduled", "running"]).gt("ends_at", new Date().toISOString())
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (existing) return out(200, { ok: true, match_id: existing.id, reused: true });
        throw matchError;
      }
      const markets = makeMarkets(match.id, a, b, startAt.toISOString());
      const { error: marketError } = await db.from("tmvb_markets").insert(markets);
      if (marketError) {
        await db.from("tmvb_matches").delete().eq("id", match.id);
        throw marketError;
      }
      return out(200, { ok: true, match_id: match.id, reused: false });
    }

    if (action === "claim_daily") {
      const { data, error } = await db.rpc("tmvb_claim_daily_points", { p_user_id: userId });
      if (error) return out(400, { error: error.message });
      return out(200, { ok: true, ...data });
    }

    if (action === "state") {
      const balance = await db.rpc("tmvb_ensure_wallet", { p_user_id: userId });
      if (balance.error) throw balance.error;
      let { data: matches, error } = await db.from("tmvb_matches").select("*")
        .order("created_at", { ascending: false }).limit(12);
      if (error) throw error;
      await settleExpired(matches || []);
      const { data: refreshed } = await db.from("tmvb_matches").select("*")
        .order("created_at", { ascending: false }).limit(12);
      matches = refreshed || matches || [];
      const ids = matches.map((m: any) => m.id);
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: markets }, { data: predictions }, { data: wallet }, { data: dailyGrant }, { data: roster }] = await Promise.all([
        ids.length ? db.from("tmvb_markets").select("*").in("match_id", ids) : Promise.resolve({ data: [] }),
        ids.length ? db.from("tmvb_predictions").select("id,match_id,market_id,selection,stake,odds,potential_return,status,created_at,settled_at").eq("user_id", userId).in("match_id", ids) : Promise.resolve({ data: [] }),
        db.from("tmvb_wallets").select("balance").eq("user_id", userId).single(),
        db.from("tmvb_daily_grants").select("id").eq("user_id", userId).eq("grant_date", today).maybeSingle(),
        db.from("tmvb_fighters").select("fighter_id,display_name,call_sign,accent,matches_played,wins,losses,total_headshots").order("display_name"),
      ]);
      return out(200, {
        ok: true, balance: wallet?.balance ?? Number(balance.data ?? 1000),
        daily_claimed: Boolean(dailyGrant),
        matches: (matches || []).map((m: any) => publicMatch(m, markets || [], predictions || [])),
        fighters: (roster || []).map((f: any) => ({ ...f, win_rate: f.matches_played ? Number((f.wins / f.matches_played * 100).toFixed(1)) : 50 })),
        user_id: userId,
      });
    }

    return out(400, { error: "Unknown Virtual Battle action." });
  } catch (error) {
    console.error("TM Virtual Battle error:", error);
    return out(400, { error: error instanceof Error ? error.message : "Virtual Battle request failed." });
  }
});
