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

function simulate(seed: string, a: any, b: any) {
  const rand = makeRandom(seed);
  const fighters = [
    { id: a.fighter_id, name: a.display_name, hp: a.base_health, weapon: a.weapon_pool[Math.floor(rand() * a.weapon_pool.length)], headshots: 0, nextShot: Math.max(0, a.reaction_ms / 1000), accuracy: Number(a.accuracy), headRate: Number(a.headshot_rate) },
    { id: b.fighter_id, name: b.display_name, hp: b.base_health, weapon: b.weapon_pool[Math.floor(rand() * b.weapon_pool.length)], headshots: 0, nextShot: Math.max(0, b.reaction_ms / 1000), accuracy: Number(b.accuracy), headRate: Number(b.headshot_rate) },
  ];
  const events: any[] = [];
  let firstHeadshot: string | null = null;
  let firstEliminated: string | null = null;
  let finalWeapon: string | null = null;
  let duration = 60;
  const push = (t: number, type: string, actor: any, target: any, damage = 0, headshot = false) => {
    events.push({
      time_sec: Math.max(0, Math.min(60, Number(t.toFixed(2)))),
      type, actor_id: actor.id, actor_name: actor.name, target_id: target.id,
      target_name: target.name, weapon: actor.weapon, weapon_label: weaponData[actor.weapon].label,
      damage, headshot, target_hp: Math.max(0, Math.round(target.hp)),
      text: type === "miss" ? actor.name + " missed a shot" :
        type === "headshot" ? "HEADSHOT! " + actor.name + " hit " + target.name :
        type === "hit" ? actor.name + " hit " + target.name :
        type === "elimination" ? actor.name + " eliminated " + target.name : "",
    });
  };
  for (let ms = 0; ms <= 60000; ms += 100) {
    for (let index = 0; index < 2; index++) {
      const actor = fighters[index], target = fighters[1 - index];
      if (actor.hp <= 0 || target.hp <= 0 || ms < actor.nextShot) continue;
      const weapon = weaponData[actor.weapon];
      actor.nextShot = ms + weapon.interval;
      if (rand() > actor.accuracy) {
        push(ms / 1000, "miss", actor, target);
        continue;
      }
      const headshot = rand() < actor.headRate;
      const damage = Math.round(weapon.damage * (headshot ? weapon.head : 1));
      target.hp -= damage;
      push(ms / 1000, headshot ? "headshot" : "hit", actor, target, damage, headshot);
      if (headshot) {
        actor.headshots++;
        if (!firstHeadshot) firstHeadshot = actor.id;
      }
      if (target.hp <= 0) {
        target.hp = 0;
        firstEliminated = target.id;
        finalWeapon = actor.weapon;
        duration = Math.max(1, Math.ceil(ms / 1000));
        push(ms / 1000, "elimination", actor, target, damage, headshot);
        break;
      }
    }
    if (fighters.some((f) => f.hp <= 0)) break;
  }
  let winner: string | null = null;
  if (fighters[0].hp > fighters[1].hp) winner = fighters[0].id;
  else if (fighters[1].hp > fighters[0].hp) winner = fighters[1].id;
  const totalHeadshots = fighters[0].headshots + fighters[1].headshots;
  return {
    events,
    result: {
      winner_id: winner,
      is_draw: winner === null,
      first_headshot_by: firstHeadshot,
      first_elimination_id: firstEliminated,
      final_weapon: finalWeapon,
      duration_sec: duration,
      total_headshots: totalHeadshots,
      fighter_a_headshots: fighters[0].headshots,
      fighter_b_headshots: fighters[1].headshots,
      fighter_a_hp: Math.max(0, Math.round(fighters[0].hp)),
      fighter_b_hp: Math.max(0, Math.round(fighters[1].hp)),
      fighter_a_weapon: fighters[0].weapon,
      fighter_b_weapon: fighters[1].weapon,
    },
  };
}

function makeMarkets(matchId: string, a: any, b: any, startAt: string) {
  const skillA = Number(a.accuracy) * 0.55 + Number(a.headshot_rate) * 0.3 + (1 / Number(a.reaction_ms)) * 40;
  const skillB = Number(b.accuracy) * 0.55 + Number(b.headshot_rate) * 0.3 + (1 / Number(b.reaction_ms)) * 40;
  const pA = Math.max(0.38, Math.min(0.62, skillA / (skillA + skillB)));
  const pB = 1 - pA;
  const odds = (p: number) => Number(Math.max(1.15, Math.min(4.8, 0.92 / p)).toFixed(2));
  const entries = [
    { market_key: "winner", label: "Who wins the battle?", selections: { [a.fighter_id]: a.display_name, [b.fighter_id]: b.display_name, draw: "Draw" }, odds: { [a.fighter_id]: odds(pA * 0.88), [b.fighter_id]: odds(pB * 0.88), draw: 4.5 } },
    { market_key: "first_headshot", label: "Who lands the first headshot?", selections: { [a.fighter_id]: a.display_name, [b.fighter_id]: b.display_name, none: "No headshot" }, odds: { [a.fighter_id]: 2.05, [b.fighter_id]: 2.05, none: 3.6 } },
    { market_key: "headshots_total", label: "Total headshots", selections: { over_3_5: "Over 3.5", under_3_5: "Under 3.5" }, odds: { over_3_5: 1.95, under_3_5: 1.85 } },
    { market_key: "first_elimination", label: "Who gets eliminated first?", selections: { [a.fighter_id]: a.display_name, [b.fighter_id]: b.display_name, none: "No elimination" }, odds: { [a.fighter_id]: 2.05, [b.fighter_id]: 2.05, none: 3.8 } },
    { market_key: "final_weapon", label: "Weapon of the final elimination", selections: { ak47: "AK-47", mp40: "MP40", m1014: "M1014", m4a1: "M4A1", awm: "AWM", none: "No elimination" }, odds: { ak47: 2.7, mp40: 2.7, m1014: 3.1, m4a1: 3.0, awm: 3.8, none: 4.2 } },
    { market_key: "duration", label: "How long does the battle last?", selections: { under_45: "Under 45 seconds", over_45: "45–60 seconds" }, odds: { under_45: 2.1, over_45: 1.72 } },
  ];
  return entries.map((m) => ({ ...m, match_id: matchId, closes_at: startAt, status: "open" }));
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

    if (action === "place_prediction") {
      const marketId = String(body.market_id || "");
      const selection = String(body.selection || "");
      const stake = Number(body.stake);
      if (!marketId || !selection || !Number.isInteger(stake)) return out(400, { error: "Choose a market, selection and whole-number stake." });
      const { data, error } = await db.rpc("tmvb_place_prediction", {
        p_user_id: userId, p_market_id: marketId, p_selection: selection, p_stake: stake,
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
      const a = fighters.find((f: any) => f.fighter_id === "nova") || fighters[0];
      const b = fighters.find((f: any) => f.fighter_id === "vex") || fighters[1];
      const seed = randomSeed();
      const seedHash = await digest(seed);
      const { events, result } = simulate(seed, a, b);
      const startAt = new Date(Date.now() + 20000);
      const endAt = new Date(startAt.getTime() + 60000);
      const { data: match, error: matchError } = await db.from("tmvb_matches").insert({
        status: "scheduled", fighter_a_id: a.fighter_id, fighter_b_id: b.fighter_id,
        fighter_a_snapshot: a, fighter_b_snapshot: b, scheduled_start_at: startAt.toISOString(),
        ends_at: endAt.toISOString(), seed_hash: seedHash, seed_secret: seed,
        simulation_version: "tmvb-1.0.0", events, result, created_by: userId,
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
      const [{ data: markets }, { data: predictions }, { data: wallet }] = await Promise.all([
        ids.length ? db.from("tmvb_markets").select("*").in("match_id", ids) : Promise.resolve({ data: [] }),
        ids.length ? db.from("tmvb_predictions").select("id,match_id,market_id,selection,stake,odds,potential_return,status,created_at,settled_at").eq("user_id", userId).in("match_id", ids) : Promise.resolve({ data: [] }),
        db.from("tmvb_wallets").select("balance").eq("user_id", userId).single(),
      ]);
      return out(200, {
        ok: true, balance: wallet?.balance ?? Number(balance.data ?? 1000),
        matches: (matches || []).map((m: any) => publicMatch(m, markets || [], predictions || [])),
        user_id: userId,
      });
    }

    return out(400, { error: "Unknown Virtual Battle action." });
  } catch (error) {
    console.error("TM Virtual Battle error:", error);
    return out(400, { error: error instanceof Error ? error.message : "Virtual Battle request failed." });
  }
});
