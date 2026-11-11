insert into public.tmvb_fighters(fighter_id,display_name,call_sign,accent,base_health,accuracy,headshot_rate,reaction_ms,weapon_pool)
values ('nova','NOVA','THE STRIKER','#48a8ff',100,0.66,0.21,235,array['ak47','mp40','m4a1']),
('vex','VEX','THE PHANTOM','#c084fc',100,0.63,0.24,220,array['mp40','m1014','awm'])
on conflict(fighter_id) do nothing;
with roster as (
 select name,ord,
 array['THE RUNNER','NIGHT HUNTER','THE VANGUARD','QUICKDRAW','SHADOW STRIKE','THE SENTINEL','WILDCARD','DARK PULSE','RAPID FIRE','SILENT EDGE']::text[] as calls,
 array['#48a8ff','#b477ff','#ff6b8a','#f2b84b','#48d6b0','#f07f49']::text[] as colors
 from unnest(array['Kairo','Nyx','Riven','Zara','Blaze','Echo','Rogue','Vanta','Jett','Sable','Orion','Kestrel','Drift','Onyx','Phoenix','Razor','Mira','Atlas','Viper','NovaX','Cipher','Storm','Aria','Knox','Ember','Ghost','Lynx','Reign','Astra','Frost','Havoc','Lux','Talon','Wraith','Skye','Dagger','Volt','Raven','Titan','Zero','Stryker','Karma','Bishop','Cinder','Mako','Juno','Shade','Bane']) with ordinality as r(name,ord)
)
insert into public.tmvb_fighters(fighter_id,display_name,call_sign,accent,base_health,accuracy,headshot_rate,reaction_ms,weapon_pool)
select lower(regexp_replace(name,'[^a-zA-Z0-9]+','','g')),name,calls[((ord-1)%array_length(calls,1))+1],colors[((ord-1)%array_length(colors,1))+1],
100, (0.58 + ((ord*7)%19)/100.0), (0.13 + ((ord*11)%15)/100.0), 205+((ord*37)%110),
case when ord%3=0 then array['ak47','mp40','m4a1'] when ord%3=1 then array['mp40','m1014','awm'] else array['ak47','m1014','awm'] end
from roster on conflict(fighter_id) do nothing;