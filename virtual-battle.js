(() => {
const API_URL="https://swfawduoosskffbuniks.supabase.co/functions/v1/tm-virtual-battle";
const API_KEY="sb_publishable_rkR-lAksyaDc9dNU4fgkZg_MNoN5RGb";
const $=id=>document.getElementById(id);
const canvas=$("vb-canvas"),ctx=canvas?.getContext("2d");
let sessionToken="",state=null,currentMatch=null,selected=[],pollTimer=null,raf=0,toastTimer=0,lastEventId="",busy=false,refreshing=false,refreshQueued=false,seenEventKeys=new Set(),visualEvents=[],visualMatchId="",lastFeedKeys=[];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>Number(n||0).toLocaleString();
function toast(message){const el=$("vb-toast");if(!el){console.warn("[TM Virtual Battle]",message);return;}el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
async function api(action,payload={}){const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json","apikey":API_KEY,"Authorization":"Bearer "+API_KEY},body:JSON.stringify({action,session_token:sessionToken,...payload})});const data=await res.json().catch(()=>({error:"The server returned an invalid response."}));if(!res.ok)throw new Error(data.error||"Virtual Battle request failed.");return data;}
function latestMatch(){return state?.matches?.[0]||null;}
function activeMatch(){return state?.matches?.find(m=>m.status==="scheduled"||m.status==="running")||latestMatch();}
function portraitData(fighter,side){
 const source=String(fighter?.fighter_id||fighter?.display_name||side);
 let h=2166136261;for(let i=0;i<source.length;i++)h=Math.imul(h^source.charCodeAt(i),16777619);
 const pick=n=>Math.abs(h>>>0)%n;
 const skin=["#f0c7a5","#c98d68","#8e5b43","#e2aa83","#754b39","#d6a17f"][pick(6)];
 const hair=["#18202d","#30201b","#4a2c22","#b98a43","#242b48","#161616"][pick(6)];
 const cloth=side==="b"?"#c13a8b":"#8d36b5";
 const style=pick(4),hairPath=style===0?"M25 51 Q24 14 60 13 Q98 12 95 56 L85 43 Q70 30 48 38 L34 55Z":style===1?"M25 50 Q20 17 57 12 Q92 8 97 44 L88 32 Q60 20 35 45Z":style===2?"M27 48 Q29 9 63 12 Q90 13 94 48 L82 35 Q55 27 38 48Z":"M25 48 Q24 10 61 11 Q100 10 96 49 L87 37 Q68 29 45 39Z";
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="'+cloth+'"/><stop offset="1" stop-color="#11182d"/></linearGradient><radialGradient id="light"><stop stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="120" height="120" rx="20" fill="url(#bg)"/><circle cx="60" cy="48" r="54" fill="url(#light)"/><path d="M12 120 Q18 83 60 82 Q102 83 108 120" fill="#111b2b"/><path d="M36 84 Q60 68 84 84 L96 120 H24Z" fill="'+cloth+'"/><path d="M42 75 L60 91 L78 75" fill="#e7edf7" opacity=".7"/><ellipse cx="60" cy="52" rx="31" ry="37" fill="'+skin+'"/><path d="'+hairPath+'" fill="'+hair+'"/><path d="M34 52 Q30 82 48 88 Q36 79 37 59Z" fill="'+hair+'"/><path d="M86 51 Q91 79 73 88 Q84 78 83 59Z" fill="'+hair+'"/><path d="M43 53 Q50 48 56 53 M65 53 Q72 48 78 53" stroke="#33251f" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="58" rx="3" ry="2.5" fill="#172334"/><ellipse cx="70" cy="58" rx="3" ry="2.5" fill="#172334"/><path d="M60 61 L57 72 L63 72" stroke="#9c624f" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M50 79 Q60 85 70 79" stroke="#793d39" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M38 44 Q60 34 82 44" stroke="'+hair+'" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="60" cy="108" r="3" fill="#c9e8ff" opacity=".7"/></svg>';
 return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
}
function setFighterPortrait(id,fighter,side){
 const host=$(id);if(!host)return;
 const img=document.createElement("img");img.alt=fighter.display_name+" portrait";img.src=portraitData(fighter,side);
 host.replaceChildren(img);const online=document.createElement("i");host.appendChild(online);
}
function updateMatchClock(m){if(!m)return;const now=Date.now(),start=Date.parse(m.scheduled_start_at||""),end=Date.parse(m.ends_at||"");let seconds=0,label="FINAL";if(m.status==="scheduled"&&Number.isFinite(start)){seconds=Math.max(0,Math.ceil((start-now)/1000));label="NEXT MATCH IN";}else if(m.status==="running"&&Number.isFinite(end)){seconds=Math.max(0,Math.ceil((end-now)/1000));label="TIME LEFT";}setText("vb-clock",String(Math.floor(seconds/60)).padStart(2,"0")+":"+String(seconds%60).padStart(2,"0"));setText("vb-clock-label",label);}
function statusLabel(m){return m?.status==="scheduled"?"PREDICTIONS OPEN":m?.status==="running"?"BATTLE IN PROGRESS":m?.status==="completed"?"MATCH COMPLETED":"WAITING";}
function setText(id,value){const el=$(id);if(el)el.textContent=value;}
function render(){setText("vb-balance",fmt(state?.balance??0));if($("vb-claim-daily"))$("vb-claim-daily").disabled=Boolean(state?.daily_claimed);if($("vb-claim-daily"))$("vb-claim-daily").textContent=state?.daily_claimed?"CLAIMED TODAY":"CLAIM +250";currentMatch=activeMatch();const m=currentMatch;if(!m){setText("vb-status","NO MATCH");$("vb-markets").innerHTML='<div class="vb-loading">No match is available. Generate the first battle.</div>';return;}
if(visualMatchId!==m.id){visualMatchId=m.id;visualEvents=[];seenEventKeys.clear();}const eventNow=performance.now();let eventDelay=0;for(const event of (m.events||[])){const key=m.id+":"+event.time_sec+":"+event.actor_id+":"+event.type+":"+event.target_hp;if(!seenEventKeys.has(key)){seenEventKeys.add(key);visualEvents.push({event,at:eventNow+eventDelay});eventDelay+=120;}}visualEvents=visualEvents.filter(item=>eventNow-item.at<1300);setText("vb-match-id","MATCH #"+m.id.slice(0,8).toUpperCase());setText("vb-status",statusLabel(m));
const roundNow=m.status==="running"?Math.min(3,Math.floor(m.elapsed_sec/20)+1):m.status==="completed"?3:0;
setText("vb-round",m.status==="scheduled"?"NEXT MATCH":m.status==="completed"?"MATCH COMPLETE":"ROUND "+roundNow+" / 3");const live=$("vb-live");if(live)live.classList.toggle("active",m.status==="running");setText("vb-a-name",m.fighter_a.display_name);setText("vb-b-name",m.fighter_b.display_name);setFighterPortrait("vb-avatar-a",m.fighter_a,"a");setFighterPortrait("vb-avatar-b",m.fighter_b,"b");setText("vb-a-call",m.fighter_a.call_sign);setText("vb-b-call",m.fighter_b.call_sign);setText("vb-a-record",`${m.fighter_a.matches_played||0} MATCHES · ${m.fighter_a.win_rate??50}% WIN RATE · ${m.fighter_a.total_headshots||0} HS`);setText("vb-b-record",`${m.fighter_b.matches_played||0} MATCHES · ${m.fighter_b.win_rate??50}% WIN RATE · ${m.fighter_b.total_headshots||0} HS`);const aWeapon=m.result?.fighter_a_weapon||(m.events||[]).find(e=>e.actor_id===m.fighter_a.fighter_id)?.weapon||"—";const bWeapon=m.result?.fighter_b_weapon||(m.events||[]).find(e=>e.actor_id===m.fighter_b.fighter_id)?.weapon||"—";setText("vb-a-weapon","WEAPON · "+aWeapon.toUpperCase());setText("vb-b-weapon","WEAPON · "+bWeapon.toUpperCase());
const aHp=m.result?.fighter_a_hp??(m.events?.filter(e=>e.target_id===m.fighter_a.fighter_id).slice(-1)[0]?.target_hp??100);const bHp=m.result?.fighter_b_hp??(m.events?.filter(e=>e.target_id===m.fighter_b.fighter_id).slice(-1)[0]?.target_hp??100);setText("vb-a-hp",aHp);setText("vb-b-hp",bHp);$("vb-a-health").style.width=Math.max(0,aHp)+"%";$("vb-b-health").style.width=Math.max(0,bHp)+"%";
updateMatchClock(m);
const overlay=$("vb-canvas-overlay");if(overlay){overlay.classList.toggle("hidden",m.status==="running"||m.status==="completed");const title=overlay.querySelector("strong"),hint=overlay.querySelector("small");if(title)title.textContent=m.status==="scheduled"?"BATTLE STARTS SOON":m.status==="completed"?"MATCH COMPLETED":"ARENA STANDBY";if(hint)hint.textContent=m.status==="scheduled"?"Predictions close when the countdown ends":m.status==="completed"?"View the verified match result below":"Waiting for battle sequence";}
setText("vb-event-count",(m.events?.length||0)+" COMBAT EVENTS");const last=(m.events||[]).slice(-1)[0];setText("vb-event-line",last?.text|| (m.status==="scheduled"?"Predictions are open. Battle begins after the countdown.":"No combat event yet."));
renderMarkets(m);renderLiveFeed(m);
const completed=(state?.matches||[]).find(x=>x.status==="completed");
if(completed){renderResult(completed);renderPredictions(completed);}else{renderResult(null);renderPredictions(null);}
draw();
}
function renderMarkets(m){
 const host=$("vb-markets");if(!host)return;
 const accepting=m.status==="scheduled";
 const markets=m.markets||[];if(!markets.length){host.innerHTML='<div class="vb-loading">Loading markets…</div>';return;}
 host.innerHTML=markets.map(market=>{
  const locked=!accepting||market.status!=="open";
  const chosen=selected.find(x=>x.market.id===market.id);
  const options=Object.entries(market.selections||{});
  return '<article class="vb-market"><div class="vb-market-heading"><h3>'+esc(market.label)+'</h3><small>'+(locked?'LOCKED · ':'OPEN · ')+options.length+' OUTCOMES</small></div><div class="vb-market-options">'+options.map(([key,label])=>'<button class="vb-option '+(chosen?.selection===key?'selected':'')+'" data-market="'+market.id+'" data-selection="'+esc(key)+'" '+(locked?'disabled':'')+'><span>'+esc(label)+'</span><b>'+Number(market.odds?.[key]||1).toFixed(2)+'×</b></button>').join('')+'</div>'+(chosen?'<p class="vb-market-locked">SELECTED: '+esc(chosen.label)+' · '+chosen.odds.toFixed(2)+'×</p>':'')+'</article>';
 }).join('');
 host.querySelectorAll("[data-market]").forEach(btn=>btn.addEventListener("click",()=>{
  const market=markets.find(x=>x.id===btn.dataset.market),selection=btn.dataset.selection;
  const existing=selected.findIndex(x=>x.market.id===market.id);
  if(existing>=0){selected.splice(existing,1);}
  if(existing<0){if(selected.length>=2){toast("You can select exactly two markets. Remove one selection first.");return;}selected.push({market,selection,label:market.selections[selection],odds:Number(market.odds[selection])});}
  renderMarkets(m);renderAccumulatorSlip(m);
 }));
 renderAccumulatorSlip(m);
}
function renderAccumulatorSlip(m){
 const slip=$("vb-slip");if(!slip)return;
 if(!selected.length){slip.hidden=true;return;}
 slip.hidden=false;
 const combined=selected.reduce((v,x)=>v*x.odds,1);
 setText("vb-slip-title",selected.length+"/2 selections · "+selected.map(x=>x.label).join(" + "));
 setText("vb-potential",fmt(Math.floor((Number($("vb-stake")?.value)||100)*combined))+" pts");
 setText("vb-combined-odds",combined.toFixed(2)+"×");
 setText("vb-selection-count",selected.length+" OF 2 PICKS");
 if($("vb-submit"))$("vb-submit").disabled=selected.length!==2;
}
function renderRoster(){
 const host=$("vb-roster");if(!host)return;
 const fighters=state?.fighters||[];
 setText("vb-roster-count",fighters.length+" FIGHTERS");
 const active=new Set([currentMatch?.fighter_a?.fighter_id,currentMatch?.fighter_b?.fighter_id]);
 host.innerHTML=fighters.map(f=>'<article class="vb-roster-card '+(active.has(f.fighter_id)?'active':'')+'"><span class="vb-roster-mark" style="--fighter-accent:'+esc(f.accent||"#7b61ff")+'">'+esc((f.display_name||"?").slice(0,1))+'</span><span class="vb-roster-info"><b>'+esc(f.display_name)+'</b><small>'+esc(f.call_sign||"TM FIGHTER")+'</small><small>'+Number(f.matches_played||0)+' MATCHES · '+Number(f.win_rate??50)+'% WIN</small></span><span class="vb-roster-tag">'+(active.has(f.fighter_id)?"IN MATCH":"ROSTER")+'</span></article>').join("");
}
function updatePotential(){const input=$("vb-stake");const stake=Math.max(0,Number(input?.value)||0);const odds=selected.reduce((v,x)=>v*x.odds,1);setText("vb-potential",fmt(Math.floor(stake*odds))+" pts");setText("vb-combined-odds",odds.toFixed(2)+"×");}
function adjustStake(delta){const input=$("vb-stake");if(!input)return;const current=Math.max(100,Number(input.value)||100);input.value=String(Math.max(100,Math.min(5000,current+delta)));updatePotential();}
function renderLiveFeed(m){
 const host=$("vb-event-feed");if(!host)return;
 const events=(m.events||[]).slice(-5).reverse();
 host.innerHTML=events.map(e=>'<div class="vb-feed-item '+(e.headshot?'headshot':e.type==='elimination'?'elimination':'')+'"><span>'+String(Math.floor(e.time_sec)).padStart(2,'0')+'s</span><b>'+esc(e.text||e.type.toUpperCase())+'</b><small>'+(e.headshot?'HEADSHOT':e.type.toUpperCase())+'</small></div>').join('');
 const last=events[0];if(last)setText("vb-event-line",last.text);
}
function renderResult(m){const host=$("vb-result");if(!host)return;if(!m||m.status!=="completed"||!m.result){host.innerHTML='<div class="vb-result-empty">The official result appears when the match ends.</div>';return;}const r=m.result,winner=r.winner_id===m.fighter_a.fighter_id?m.fighter_a.display_name:r.winner_id===m.fighter_b.fighter_id?m.fighter_b.display_name:"DRAW";const roundRows=(r.round_scores||[]).map(x=>'<div class="vb-round-result"><b>ROUND '+x.round+'</b><span>'+(x.winner_id===m.fighter_a.fighter_id?esc(m.fighter_a.display_name):x.winner_id===m.fighter_b.fighter_id?esc(m.fighter_b.display_name):'DRAW')+'</span><small>'+x.fighter_a_hp+' – '+x.fighter_b_hp+' HP</small></div>').join('');
host.innerHTML='<div class="vb-result-winner"><div><strong>'+esc(winner)+'</strong><small>OFFICIAL RESULT · '+(r.is_draw?"DRAW":"WINNER")+'</small></div><span class="vb-pill won">'+(r.is_draw?"DRAW":"MATCH WON")+'</span></div><div class="vb-round-results">'+roundRows+'</div><div class="vb-result-stats">'+[['HEADSHOTS',r.total_headshots],['BATTLE TIME',r.duration_sec+'s'],['FINAL WEAPON',(r.final_weapon||"No elimination").toUpperCase()],['FINAL HEALTH',r.fighter_a_hp+' – '+r.fighter_b_hp],['FIRST HEADSHOT',r.first_headshot_by||"None"],['SEED CHECK',m.seed_reveal&&m.seed_hash?"REVEALED":"PENDING"]].map(([k,v])=>'<div class="vb-stat"><small>'+esc(k)+'</small><b>'+esc(v)+'</b></div>').join("")+'</div><p class="vb-disclaimer">Verification hash: '+esc(m.seed_hash.slice(0,24))+'… · Seed revealed after completion: '+esc(m.seed_reveal||"")+'</p>';}
function renderPredictions(m){const host=$("vb-my-predictions");if(!host)return;if(!m||!m.predictions?.length){host.innerHTML='<div class="vb-predictions-empty">You have not submitted a prediction for this match.</div>';return;}host.innerHTML=m.predictions.map(p=>{const market=m.markets.find(x=>x.id===p.market_id);return '<div class="vb-prediction-row"><span>'+esc(market?.label||"Market")+'<br><small>'+esc(market?.selections?.[p.selection]||p.selection)+' · '+fmt(p.stake)+' pts</small></span><span class="vb-pill '+(p.status==="won"?"won":p.status==="lost"?"lost":"")+'">'+esc(p.status.toUpperCase())+'</span></div>';}).join("");}
function renderHistory(){const host=$("vb-history-list");if(!host)return;const done=(state?.matches||[]).filter(m=>m.status==="completed").slice(0,5);host.innerHTML=done.length?done.map(m=>{const winner=m.result?.winner_id===m.fighter_a.fighter_id?m.fighter_a.display_name:m.result?.winner_id===m.fighter_b.fighter_id?m.fighter_b.display_name:"DRAW";return '<div class="vb-history-item"><span><b>'+esc(m.fighter_a.display_name)+' vs '+esc(m.fighter_b.display_name)+'</b><br><small>'+new Date(m.created_at).toLocaleString()+'</small></span><span>'+esc(winner)+'</span></div>';}).join(""):'No completed battles yet.';}
function resizeCanvas(){if(!canvas)return;const w=canvas.clientWidth||960;canvas.style.height=(w*430/960)+"px";}
function fighterDraw(x,y,side,accent,frame,aim,recoil=0){ctx.save();ctx.translate(x,y);ctx.scale(side,1);ctx.globalAlpha=.25;ctx.fillStyle="#000";ctx.beginPath();ctx.ellipse(0,0,42,10,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
const bob=Math.sin(frame*.006+(side<0?1:0))*4;ctx.translate(0,bob);
ctx.fillStyle="#101b2e";ctx.fillRect(-17,-48,13,42);ctx.fillRect(5,-48,13,42);ctx.fillStyle=accent;ctx.fillRect(-21,-52,18,9);ctx.fillRect(4,-52,18,9);
ctx.fillStyle=side>0?" #5b2678":"#492b76";ctx.beginPath();ctx.moveTo(-25,-105);ctx.lineTo(22,-105);ctx.lineTo(27,-56);ctx.lineTo(-27,-56);ctx.closePath();ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.stroke();
ctx.fillStyle="#202f48";ctx.fillRect(-29,-99,12,35);ctx.fillRect(18,-99,12,35);
ctx.fillStyle="#b7c7dc";ctx.beginPath();ctx.arc(0,-123,19,0,Math.PI*2);ctx.fill();ctx.fillStyle="#1b2940";ctx.fillRect(-20,-132,40,12);ctx.fillStyle=accent;ctx.fillRect(-14,-126,28,5);
ctx.strokeStyle="#d4e4f7";ctx.lineWidth=8;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(17,-91);ctx.lineTo(38,-87);ctx.stroke();
ctx.fillStyle="#263c59";ctx.fillRect(30,-94,43,11);ctx.fillStyle=accent;ctx.fillRect(59,-91,25,4);if(recoil>0){ctx.globalAlpha=Math.min(1,recoil);ctx.fillStyle="#fff1a8";ctx.beginPath();ctx.moveTo(84,-89);ctx.lineTo(103,-101);ctx.lineTo(98,-89);ctx.lineTo(103,-77);ctx.closePath();ctx.fill();ctx.globalAlpha=1;}
ctx.restore();}
function draw(){
const now=performance.now();const w=960,h=430,m=currentMatch;if(!ctx)return;ctx.clearRect(0,0,w,h);
const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,"#251333");bg.addColorStop(.6,"#140b1e");bg.addColorStop(1,"#090610");ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
ctx.strokeStyle="#223958";ctx.lineWidth=1;for(let x=0;x<w;x+=48){ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}ctx.globalAlpha=1;
ctx.fillStyle="#251331";for(let i=0;i<12;i++){const x=i*88+12,ht=65+(i*37)%100;ctx.fillRect(x,h-ht-55,52,ht);ctx.fillStyle="#47215c";for(let j=0;j<3;j++)ctx.fillRect(x+9+j*13,h-ht-42,5,5);ctx.fillStyle="#251331";}
ctx.strokeStyle="#753b91";ctx.globalAlpha=.55;ctx.beginPath();ctx.moveTo(0,h-54);ctx.lineTo(w,h-54);ctx.stroke();ctx.globalAlpha=1;
 // Animated arena lighting, floor lanes and atmospheric particles.
 const glow=ctx.createRadialGradient(480,350,20,480,350,460);glow.addColorStop(0,"#2b78ad22");glow.addColorStop(1,"#09101a00");ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.globalAlpha=.12;ctx.strokeStyle="#f0a5ff";ctx.lineWidth=2;
 for(let i=0;i<7;i++){const x=((i*173+now*.018)%1100)-70;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(480+(x-480)*.18,h-55);ctx.stroke();}
 ctx.restore();
 for(let i=0;i<24;i++){const x=(i*137+now*(.012+(i%4)*.003))%w,y=(i*79+now*(.009+(i%3)*.004))%h;ctx.globalAlpha=.12+(i%4)*.035;ctx.fillStyle=i%2?"#ee8bd2":"#ff9acb";ctx.beginPath();ctx.arc(x,y,1+(i%3)*.5,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
const running=m?.status==="running",startMs=m?Date.parse(m.scheduled_start_at||""):0,endMs=m?Date.parse(m.ends_at||""):0,t=m&&Number.isFinite(startMs)?Math.min(60,Math.max(0,(Date.now()-startMs)/1000)):0,pulse=running?Math.sin(now*.012):0;if(m?.status==="scheduled"&&Number.isFinite(startMs)){const left=Math.max(0,Math.ceil((startMs-Date.now())/1000));setText("vb-clock","00:"+String(Math.min(60,left)).padStart(2,"0"));}else if(running){const fallbackEnd=Number.isFinite(startMs)?startMs+60000:Date.now();const left=Math.max(0,Math.ceil(((Number.isFinite(endMs)?endMs:fallbackEnd)-Date.now())/1000));setText("vb-clock","00:"+String(Math.min(60,left)).padStart(2,"0"));}
const ax=180+Math.sin(now*.0018)*13,bx=780-Math.sin(now*.0018)*13;let recoilA=0,recoilB=0;
for(const item of visualEvents){const age=now-item.at;if(age<260){const amount=1-age/260;if(item.event.actor_id===m?.fighter_a?.fighter_id)recoilA=Math.max(recoilA,amount);if(item.event.actor_id===m?.fighter_b?.fighter_id)recoilB=Math.max(recoilB,amount);}}
fighterDraw(ax,h-55,1,"#d77bff",now,0,recoilA);fighterDraw(bx,h-55,-1,"#ff73b7",now,0,recoilB);
visualEvents.forEach(item=>{const age=now-item.at,e=item.event;if(age<0||age>700||e.type==="elimination")return;const fromA=e.actor_id===m?.fighter_a?.fighter_id,sx=fromA?ax+88:bx-88,tx=fromA?bx-78:ax+78,progress=Math.min(1,age/280),sy=h-142,ty=h-150,px=sx+(tx-sx)*progress,py=sy+(ty-sy)*progress+Math.sin(age*.045)*5;ctx.globalAlpha=Math.max(0,1-age/700);ctx.strokeStyle=e.headshot?"#ffb4e1":fromA?"#e09aff":"#ff9acb";ctx.lineWidth=e.headshot?3:2;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(px,py);ctx.stroke();ctx.fillStyle=e.headshot?"#ffe0f3":fromA?"#e5b0ff":"#ffc1dc";ctx.beginPath();ctx.arc(px,py,e.headshot?4:2.5,0,Math.PI*2);ctx.fill();if(age>280&&(e.type==="hit"||e.type==="headshot")){ctx.strokeStyle=e.headshot?"#ffb4e1":"#f0b6ff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(tx,ty,9+(age-280)*.035,0,Math.PI*2);ctx.stroke();if(e.headshot){ctx.fillStyle="#ffb4e1";ctx.font="bold 13px system-ui";ctx.fillText("HEADSHOT",tx-44,ty-18);}}});ctx.globalAlpha=1;
ctx.fillStyle="#e7f2ff";ctx.font="bold 12px system-ui";ctx.fillText(running?"LIVE SIMULATION":"TM VIRTUAL ARENA",24,30);ctx.fillStyle="#c5a5d5";ctx.font="10px system-ui";ctx.fillText("3 ROUNDS · 20 SECONDS EACH · 60 SECOND MATCH",24,48);
ctx.fillStyle="#f18bd0";ctx.globalAlpha=.75;ctx.fillRect(24,65,Math.max(0,Math.min(912,(t/60)*912)),3);ctx.globalAlpha=1;
if(running){ctx.fillStyle="#ff5b6b";ctx.beginPath();ctx.arc(w-35,30,5+Math.max(0,pulse)*2,0,Math.PI*2);ctx.fill();}
if(m?.status==="completed"){ctx.fillStyle="#06101dcc";ctx.fillRect(0,0,w,h);ctx.textAlign="center";ctx.fillStyle="#fff";ctx.font="900 34px system-ui";ctx.fillText(m.result?.is_draw?"DRAW":(m.result?.winner_id===m.fighter_a.fighter_id?m.fighter_a.display_name:m.fighter_b.display_name)+" WINS",w/2,h/2);ctx.font="12px system-ui";ctx.fillStyle="#9dcfff";ctx.fillText("MATCH ENDED · OFFICIAL RESULTS",w/2,h/2+28);ctx.textAlign="left";}
}
async function refresh(force=false){if(refreshing){if(force)refreshQueued=true;return;}if(busy&&!force){refreshQueued=true;return;}refreshing=true;try{state=await api("state");let hasActive=Boolean(state.matches?.some(m=>m.status==="scheduled"||m.status==="running"));if(!hasActive){await api("create_match");state=await api("state");hasActive=Boolean(state.matches?.some(m=>m.status==="scheduled"||m.status==="running"));}render();}catch(e){toast(e.message);setText("vb-status","CONNECTION ERROR");}finally{refreshing=false;if(refreshQueued&&!busy){refreshQueued=false;setTimeout(()=>refresh(),0);}}}
async function claimDaily(){if(busy||state?.daily_claimed)return;busy=true;$("vb-claim-daily").disabled=true;try{await api("claim_daily");busy=false;await refresh();toast("250 free points added to your balance.");}catch(e){toast(e.message);}finally{busy=false;}}
async function createNext(){if(busy)return;busy=true;try{await api("create_match");selected=[];$("vb-slip").hidden=true;busy=false;await refresh();toast("Next battle is ready.");}catch(e){toast(e.message);}finally{busy=false;}}
async function submitPrediction(){if(selected.length!==2||busy)return;const stake=Number($("vb-stake").value);if(!Number.isInteger(stake)||stake<100||stake>5000){toast("Enter a whole-number stake from 100 to 5,000 points.");return;}if(stake>Number(state?.balance||0)){toast("Not enough virtual points.");return;}busy=true;$("vb-submit").disabled=true;try{const match=activeMatch();await api("place_accumulator",{match_id:match.id,legs:selected.map(x=>({market_id:x.market.id,selection:x.selection})),stake});selected=[];$("vb-slip").hidden=true;busy=false;await refresh();toast("Two-selection accumulator submitted.");}catch(e){toast(e.message);}finally{busy=false;$("vb-submit").disabled=selected.length!==2;}}
function startPolling(){clearInterval(pollTimer);pollTimer=setInterval(()=>{if(document.visibilityState==="visible"){updateMatchClock(activeMatch());refresh();}},1000);document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")refresh();});cancelAnimationFrame(raf);const loop=()=>{draw();raf=requestAnimationFrame(loop);};loop();}
function boot(){if(!canvas)return;sessionToken=localStorage.getItem("tm_session")||"";if(!sessionToken){setText("vb-status","SIGN IN REQUIRED");$("vb-markets").innerHTML='<div class="vb-loading">Please sign in to your TM App account, then reopen Virtual Battle.</div>';return;}if($("vb-claim-daily"))$("vb-claim-daily").addEventListener("click",claimDaily);if($("vb-stake"))$("vb-stake").addEventListener("input",updatePotential);if($("vb-stake-minus"))$("vb-stake-minus").addEventListener("click",()=>adjustStake(-100));if($("vb-stake-plus"))$("vb-stake-plus").addEventListener("click",()=>adjustStake(100));if($("vb-slip-close"))$("vb-slip-close").addEventListener("click",()=>{selected=[];$("vb-slip").hidden=true;renderMarkets(activeMatch());});if($("vb-submit"))$("vb-submit").addEventListener("click",submitPrediction);refresh().then(startPolling);window.addEventListener("resize",resizeCanvas);resizeCanvas();}
boot();
})();