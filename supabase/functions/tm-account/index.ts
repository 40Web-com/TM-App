import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import bcrypt from "npm:bcryptjs@2.4.3";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const out=(s:number,d:unknown)=>new Response(JSON.stringify(d),{status:s,headers});
const token=()=>crypto.randomUUID()+crypto.randomUUID().replaceAll("-","");
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const makePin=()=>String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,"0");
const countryCallingCodes={"Nigeria":"234","United States":"1","Canada":"1","United Kingdom":"44","Ghana":"233","Kenya":"254","South Africa":"27","India":"91","Australia":"61","New Zealand":"64","Ireland":"353","France":"33","Germany":"49","Spain":"34","Italy":"39","Netherlands":"31","Belgium":"32","Switzerland":"41","Austria":"43","Portugal":"351","Denmark":"45","Sweden":"46","Norway":"47","Finland":"358","Poland":"48","Ukraine":"380","Turkey":"90","Egypt":"20","Morocco":"212","Algeria":"213","Ethiopia":"251","Tanzania":"255","Uganda":"256","Rwanda":"250","Senegal":"221","Côte d’Ivoire":"225","Benin":"229","Zambia":"260","Zimbabwe":"263","Brazil":"55","Mexico":"52","Argentina":"54","Chile":"56","Colombia":"57","China":"86","Japan":"81","South Korea":"82","Indonesia":"62","Malaysia":"60","Singapore":"65","Philippines":"63","Thailand":"66","Vietnam":"84","Pakistan":"92","Bangladesh":"880","Nepal":"977","Sri Lanka":"94","Saudi Arabia":"966","United Arab Emirates":"971","Qatar":"974","Israel":"972","Afghanistan":"93"};
 const makeTm=(country)=>{const cc=countryCallingCodes[String(country||"Nigeria")]||"234";const digits=11-cc.length;const max=10**digits;const suffix=String(crypto.getRandomValues(new Uint32Array(1))[0]%max).padStart(digits,"0");return cc+suffix;};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return out(405,{error:"POST required"});
 try{
 const b=await req.json();
 if(b.action==="guest")return out(200,{guest:true});
 if(b.action==="google_auth"||b.action==="google_register"){
  const bearer=String(b.google_access_token||"");if(bearer.length<30)return out(401,{error:"Google session missing. Please sign in again."});
  const authClient=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!);const {data:authData,error:authErr}=await authClient.auth.getUser(bearer);const au=authData?.user;if(authErr||!au)return out(401,{error:"Google sign-in could not be verified."});
  const authId=au.id,email=String(au.email||"").toLowerCase(),meta=au.user_metadata||{},googleName=String(meta.full_name||meta.name||email.split("@")[0]||"TM member").slice(0,70),avatar=String(meta.avatar_url||meta.picture||"").slice(0,500);
  if(b.action==="google_auth"){const {data:user}=await db.from("users").select("id,tm_number,display_name,plan,tier,profile_complete").eq("auth_user_id",authId).maybeSingle();if(!user)return out(200,{needs_profile:true,google_user:{id:authId,email,display_name:googleName,photo_url:avatar}});const session_token=token();await db.from("sessions").insert({user_id:user.id,device:String(b.device||"web").slice(0,120),token_hash:await digest(session_token),expires_at:new Date(Date.now()+30*86400000).toISOString()});return out(200,{user,session_token});}
  const {display_name,birth_date,gender,city,country,looking_for=[],languages=[],bio=""}=b;const bd=new Date(String(birth_date||""));const now=new Date();let age=now.getFullYear()-bd.getFullYear();if(now.getMonth()<bd.getMonth()||(now.getMonth()===bd.getMonth()&&now.getDate()<bd.getDate()))age--;if(!display_name||!birth_date||!gender||!city||!country)return out(400,{error:"Complete all required profile fields."});if(!Number.isFinite(age)||age<18||age>120)return out(403,{error:"TM is for adults aged 18 or older."});const {data:exists}=await db.from("users").select("id").eq("auth_user_id",authId).maybeSingle();if(exists)return out(409,{error:"This Google account already has a TM account. Please sign in."});
  let user:any=null;for(let i=0;i<10;i++){const tm_number=makeTm(country);const q=await db.from("users").insert({tm_number,auth_user_id:authId,email,device_id:null,display_name:String(display_name).trim().slice(0,70),birth_date,gender,city:String(city).trim().slice(0,80),country:String(country).trim().slice(0,80),looking_for,languages,bio:String(bio||"").slice(0,300),photo_url:avatar,profile_complete:false}).select("id,tm_number,display_name,plan,tier,profile_complete").single();if(!q.error){user=q.data;break;}if(q.error.code!=="23505")return out(400,{error:"Unable to create TM profile."});}if(!user)return out(500,{error:"Unable to allocate TM ID. Please retry."});const session_token=token();await db.from("sessions").insert({user_id:user.id,device:String(b.device||"web").slice(0,120),token_hash:await digest(session_token),expires_at:new Date(Date.now()+30*86400000).toISOString()});return out(200,{user,session_token});
 }

 if(b.action==="register"){
  const {display_name,birth_date,gender,city,country,looking_for=[],interests=[],languages=[],bio="",terms_accepted}=b; const device_id=String(b.device_id||""); if(device_id.length<16)return out(400,{error:"Device ID missing. Refresh and try again."});
  if(!display_name||!birth_date||!gender||!city||!country||!terms_accepted)return out(400,{error:"Fill all required fields and accept Terms and Privacy."});
  const bd=new Date(birth_date);const now=new Date();let age=now.getFullYear()-bd.getFullYear();if(now.getMonth()<bd.getMonth()||(now.getMonth()===bd.getMonth()&&now.getDate()<bd.getDate()))age--;
  if(!Number.isFinite(age)||age<18||age>120)return out(403,{error:"TM is for adults aged 18 or older. Enter a valid date."});
  let user:any=null;
  for(let attempt=0;attempt<10;attempt++){const tm_number=makeTm(country);const q=await db.from("users").insert({tm_number,device_id,display_name,birth_date,gender,city,country,looking_for,languages,bio,profile_complete:false}).select("id,tm_number,display_name,plan,tier,profile_complete").single();if(!q.error){user=q.data;break;}if(q.error.code!=="23505")return out(400,{error:q.error.message});}
  if(!user)return out(500,{error:"Unable to allocate TM number; please retry."});
  const pin=makePin();const code_hash=await bcrypt.hash(pin,12);const q=await db.from("auth_codes").insert({user_id:user.id,code_hash});
  if(q.error){await db.from("users").delete().eq("id",user.id);return out(500,{error:"Could not finish account setup."});}
  if(Array.isArray(interests)&&interests.length){const names=[...new Set(interests.map((x:string)=>String(x).trim()).filter(Boolean))];await db.from("interests").upsert(names.map(name=>({name})),{onConflict:"name"});const found=await db.from("interests").select("id,name").in("name",names);if(found.data?.length)await db.from("user_interests").insert(found.data.map(x=>({user_id:user.id,interest_id:x.id})));}
  const session_token=token();await db.from("sessions").insert({user_id:user.id,device:String(b.device||"web").slice(0,120),token_hash:await digest(session_token),expires_at:new Date(Date.now()+30*86400000).toISOString()});
  return out(200,{user,pin,session_token,save_once:true});
 }
 if(b.action==="session_check"||b.action==="logout"){
  const session_token=String(b.session_token||"");if(session_token.length<20)return out(401,{error:"Session missing."});
  const token_hash=await digest(session_token);const {data:s}=await db.from("sessions").select("id,user_id,expires_at,revoked_at").eq("token_hash",token_hash).maybeSingle();
  if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())return out(401,{error:"Session expired. Please log in again."});
  if(b.action==="logout"){await db.from("sessions").update({revoked_at:new Date().toISOString()}).eq("id",s.id);return out(200,{ok:true});}
  await db.from("sessions").update({last_seen:new Date().toISOString()}).eq("id",s.id);const {data:user}=await db.from("users").select("id,tm_number,display_name,plan,tier,profile_complete,city,country,gender,bio,birth_date,looking_for,languages,profile_photo_url,gallery_photo_urls,photo_url").eq("id",s.user_id).maybeSingle();
  if(!user)return out(401,{error:"Account not found."});const {data:privateContact}=await db.from("user_private_contacts").select("phone_number").eq("user_id",s.user_id).maybeSingle();return out(200,{user:{...user,phone_number:privateContact?.phone_number||""}});
 }
 if(b.action==="profile_update"){
  const session_token=String(b.session_token||"");if(session_token.length<20)return out(401,{error:"Session missing."});
  const token_hash=await digest(session_token);const {data:s}=await db.from("sessions").select("id,user_id,expires_at,revoked_at").eq("token_hash",token_hash).maybeSingle();
  if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())return out(401,{error:"Session expired. Log in again."});
  const allowed=["display_name","city","country","gender","bio","looking_for","languages","interests","preferred_partner","flirt_style","profile_photo_url","gallery_photo_urls"];
  const update:any={};for(const k of allowed)if(b[k]!==undefined)update[k]=b[k];
  if(typeof update.display_name==="string")update.display_name=update.display_name.trim().slice(0,70);
  if(typeof update.city==="string")update.city=update.city.trim().slice(0,80);
  if(typeof update.country==="string")update.country=update.country.trim().slice(0,80);
  if(typeof update.bio==="string")update.bio=update.bio.trim().slice(0,300);
  if(update.gender!==undefined&&!["Woman","Man","Non-binary","Other","Prefer not to say"].includes(update.gender))return out(400,{error:"Invalid gender selection."});
  if(update.looking_for!==undefined&&!Array.isArray(update.looking_for))return out(400,{error:"Looking-for values must be a list."});
  if(update.languages!==undefined&&!Array.isArray(update.languages))return out(400,{error:"Languages must be a list."});
  if(update.interests!==undefined&&!Array.isArray(update.interests))return out(400,{error:"Interests must be a list."});
  if(update.gallery_photo_urls!==undefined&&!Array.isArray(update.gallery_photo_urls))return out(400,{error:"Gallery photos must be a list."});
  for(const k of ["preferred_partner","flirt_style","profile_photo_url"])if(update[k]!==undefined&&typeof update[k]!=="string")return out(400,{error:"Invalid profile preference."});
  const {data:user,error}=await db.from("users").update({...update,profile_complete:true}).eq("id",s.user_id).select("id,tm_number,display_name,plan,tier,profile_complete,city,country,gender,bio,birth_date,looking_for,languages,interests,preferred_partner,flirt_style,profile_photo_url,gallery_photo_urls").single();
  if(error)return out(400,{error:"Unable to save profile."});if(b.phone_number!==undefined){const contact=await db.from("user_private_contacts").upsert({user_id:s.user_id,phone_number:String(b.phone_number||"").trim().slice(0,24),updated_at:new Date().toISOString()},{onConflict:"user_id"});if(contact.error)return out(400,{error:"Profile saved, but private phone number could not be saved."});}const {data:privateContact}=await db.from("user_private_contacts").select("phone_number").eq("user_id",s.user_id).maybeSingle();return out(200,{user:{...user,phone_number:privateContact?.phone_number||""}});
 }
 if(["chat_list","chat_create","chat_messages","chat_send","chat_upload_ticket","chat_block","chat_delete"].includes(b.action)){
  const st=String(b.session_token||"");if(st.length<20)return out(401,{error:"Session missing."});
  const {data:s}=await db.from("sessions").select("id,user_id,expires_at,revoked_at").eq("token_hash",await digest(st)).maybeSingle();
  if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())return out(401,{error:"Session expired. Log in again."});const uid=s.user_id;
  if(b.action==="chat_list"){
   const {data:members}=await db.from("chat_members").select("chat_id,last_read_at,pinned").eq("user_id",uid);const ids=(members||[]).map(x=>x.chat_id);if(!ids.length)return out(200,{chats:[]});
   const {data:chats}=await db.from("chats").select("id,created_at,updated_at").in("id",ids).order("updated_at",{ascending:false});
   const result=[];for(const chat of chats||[]){const {data:mem}=await db.from("chat_members").select("user_id").eq("chat_id",chat.id);const other=(mem||[]).find(x=>x.user_id!==uid)?.user_id;let profile=null;if(other){const q=await db.from("users").select("id,tm_number,display_name,photo_url").eq("id",other).maybeSingle();profile=q.data;}
    const {data:msg}=await db.from("messages").select("body,type,created_at,sender_id").eq("chat_id",chat.id).is("deleted_for_everyone_at",null).order("created_at",{ascending:false}).limit(1);result.push({...chat,other_user:profile,last_message:msg?.[0]||null});}
   return out(200,{chats:result});
  }
  if(b.action==="chat_create"){
   const tm=String(b.tm_number||"").trim();if(!/^(?:\d{6}|\d{11})$/.test(tm))return out(400,{error:"Enter a valid 6- or 11-digit TM ID."});const {data:other}=await db.from("users").select("id,tm_number,display_name,photo_url").eq("tm_number",tm).maybeSingle();if(!other)return out(404,{error:"TM user not found."});if(other.id===uid)return out(400,{error:"You cannot chat with yourself."});
   const {data:blocked}=await db.from("blocks").select("blocker_id").or("and(blocker_id.eq."+uid+",blocked_id.eq."+other.id+"),and(blocker_id.eq."+other.id+",blocked_id.eq."+uid+")");if(blocked?.length)return out(403,{error:"Chat unavailable due to privacy settings."});
   const {data:my}=await db.from("chat_members").select("chat_id").eq("user_id",uid);for(const m of my||[]){const {data:pair}=await db.from("chat_members").select("user_id").eq("chat_id",m.chat_id);if(pair?.length===2&&pair.some(x=>x.user_id===other.id))return out(200,{chat_id:m.chat_id,other_user:other});}
   const {data:chat,error}=await db.from("chats").insert({}).select("id").single();if(error||!chat)return out(500,{error:"Could not create chat."});const ins=await db.from("chat_members").insert([{chat_id:chat.id,user_id:uid},{chat_id:chat.id,user_id:other.id}]);if(ins.error){await db.from("chats").delete().eq("id",chat.id);return out(500,{error:"Could not add chat members."});}return out(200,{chat_id:chat.id,other_user:other});
  }
  const chatId=String(b.chat_id||"");const {data:member}=await db.from("chat_members").select("chat_id").eq("chat_id",chatId).eq("user_id",uid).maybeSingle();if(!member)return out(403,{error:"You are not a member of this chat."});
  const {data:chatPeople}=await db.from("chat_members").select("user_id").eq("chat_id",chatId);const otherId=(chatPeople||[]).find(x=>x.user_id!==uid)?.user_id;if(!otherId)return out(404,{error:"Chat participant not found."});
  if(b.action==="chat_upload_ticket"){
   const name=String(b.file_name||"file").replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,100);
   const mime=String(b.mime_type||"application/octet-stream");
   const size=Number(b.file_size||0);
   const allowed=["image/jpeg","image/png","image/webp","image/gif","audio/webm","audio/ogg","audio/mp4","audio/mpeg","audio/aac","audio/3gpp","video/mp4","video/webm","video/quicktime","video/3gpp","application/pdf","text/plain","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","application/zip"];
   if(!allowed.includes(mime))return out(415,{error:"This file type is not supported."});
   if(!Number.isFinite(size)||size<1||size>26214400)return out(413,{error:"Files must be 25 MB or smaller."});
   const path=chatId+"/"+uid+"/"+crypto.randomUUID()+"-"+name;
   const {data:ticket,error}=await db.storage.from("tm-chat-media").createSignedUploadUrl(path);
   if(error||!ticket)return out(400,{error:"Could not prepare this upload."});
   return out(200,{path,signed_url:ticket.signedUrl,token:ticket.token});
  }
  if(b.action==="chat_block"){const ins=await db.from("blocks").upsert({blocker_id:uid,blocked_id:otherId},{onConflict:"blocker_id,blocked_id"});if(ins.error)return out(400,{error:"Could not block this person."});const removed=await db.from("chat_members").delete().eq("chat_id",chatId).eq("user_id",uid);if(removed.error)return out(400,{error:"Person blocked, but chat could not be hidden. Refresh your chats."});return out(200,{blocked:true});}
  if(b.action==="chat_delete"){const removed=await db.from("chat_members").delete().eq("chat_id",chatId).eq("user_id",uid);if(removed.error)return out(400,{error:"Could not remove this conversation."});return out(200,{deleted_for_me:true});}
  const {data:blockCheck}=await db.from("blocks").select("blocker_id").or("and(blocker_id.eq."+uid+",blocked_id.eq."+otherId+"),and(blocker_id.eq."+otherId+",blocked_id.eq."+uid+")");if(blockCheck?.length)return out(403,{error:"Messaging is unavailable due to a block."});
  if(b.action==="chat_messages"){const {data:messages,error}=await db.from("messages").select("id,sender_id,type,body,media_url,status,created_at").eq("chat_id",chatId).is("deleted_for_everyone_at",null).order("created_at",{ascending:true}).limit(100);if(error)return out(400,{error:"Could not load messages."});const ids=[...new Set((messages||[]).map(x=>x.sender_id))];const {data:users}=await db.from("users").select("id,display_name,tm_number").in("id",ids);const map=new Map((users||[]).map(x=>[x.id,x]));const paths=(messages||[]).filter(x=>x.media_url).map(x=>x.media_url);const signedMap=new Map();if(paths.length){const {data:signed}=await db.storage.from("tm-chat-media").createSignedUrls(paths,3600);for(const item of signed||[])if(item.path&&item.signedUrl)signedMap.set(item.path,item.signedUrl);}const enriched=(messages||[]).map(x=>({...x,media_url:x.media_url?(signedMap.get(x.media_url)||null):null,sender:map.get(x.sender_id)||null}));return out(200,{messages:enriched});}
  if(b.action==="chat_send"){const type=String(b.type||"text");const body=String(b.body||"").trim();const media_url=String(b.media_url||"");if(!["text","voice","photo","video","file"].includes(type))return out(400,{error:"Unsupported message type."});if(type==="text"&&(!body||body.length>2000))return out(400,{error:"Message must be 1–2000 characters."});if(type!=="text"&&(!media_url||!media_url.startsWith(chatId+"/"+uid+"/")||media_url.length>500))return out(400,{error:"Invalid media attachment."});if(type!=="text"&&body.length>180)return out(400,{error:"Attachment caption is too long."});const {data:message,error}=await db.from("messages").insert({chat_id:chatId,sender_id:uid,type,body:body||null,media_url:media_url||null,status:"sent"}).select("id,chat_id,sender_id,type,body,media_url,status,created_at").single();if(error)return out(400,{error:"Could not send message."});await db.from("chats").update({updated_at:new Date().toISOString()}).eq("id",chatId);let signedUrl=null;if(media_url){const {data:signed}=await db.storage.from("tm-chat-media").createSignedUrl(media_url,3600);signedUrl=signed?.signedUrl||null;}return out(200,{message:{...message,media_url:signedUrl}});}
 }
 if(["discover_list","discover_like","discover_pass","match_list","match_phone_share","match_phone_get"].includes(b.action)){
  const st=String(b.session_token||"");if(st.length<20)return out(401,{error:"Session missing."});const {data:s}=await db.from("sessions").select("user_id,expires_at,revoked_at").eq("token_hash",await digest(st)).maybeSingle();if(!s||s.revoked_at||new Date(s.expires_at)<=new Date())return out(401,{error:"Session expired. Log in again."});const uid=s.user_id;
  if(b.action==="discover_list"){
   const {data:my}=await db.from("users").select("looking_for,gender,city,country").eq("id",uid).single();
   const [blocked,passed,liked]=await Promise.all([db.from("blocks").select("blocked_id").eq("blocker_id",uid),db.from("passes").select("passed_user_id").eq("user_id",uid),db.from("likes").select("to_user_id").eq("from_user_id",uid)]);
   const excluded=new Set([uid,...(blocked.data||[]).map(x=>x.blocked_id),...(passed.data||[]).map(x=>x.passed_user_id),...(liked.data||[]).map(x=>x.to_user_id)]);
   // Fetch candidates separately and filter in JS. This avoids fragile PostgREST "NOT IN"
   // syntax and avoids issuing an empty .in() query when no other users exist yet.
   const {data:rows,error}=await db.from("users").select("id,tm_number,display_name,birth_date,gender,city,country,bio,photo_url,profile_photo_url,gallery_photo_urls,looking_for,languages,interests,preferred_partner,flirt_style,plan,tier").eq("profile_complete",true).neq("id",uid).limit(100);
   if(error){console.error("discover_list users query failed",error);return out(400,{error:"Could not load discover profiles."});}
   const {data:reverseBlocks}=await db.from("blocks").select("blocker_id").eq("blocked_id",uid);const blockSet=new Set((reverseBlocks||[]).map(x=>x.blocker_id));
   const candidates=(rows||[]).filter(u=>!excluded.has(u.id)&&!blockSet.has(u.id));
   let onlineIds=new Set();
   if(candidates.length){const activeSessions=await db.from("sessions").select("user_id").in("user_id",candidates.map(u=>u.id)).is("revoked_at",null).gt("last_seen",new Date(Date.now()-120000).toISOString());onlineIds=new Set((activeSessions.data||[]).map(x=>x.user_id));}
   const profiles=candidates.slice(0,40).map(u=>{const bd=new Date(u.birth_date);const now=new Date();let age=now.getFullYear()-bd.getFullYear();if(now.getMonth()<bd.getMonth()||(now.getMonth()===bd.getMonth()&&now.getDate()<bd.getDate()))age--;return {...u,age,is_online:onlineIds.has(u.id),photo_url:u.profile_photo_url||u.photo_url||null};});
   return out(200,{profiles,preferences:my});
  }
  if(b.action==="match_list"){
   const {data:matches,error}=await db.from("matches").select("id,user_a,user_b,chat_id,created_at").or("user_a.eq."+uid+",user_b.eq."+uid).order("created_at",{ascending:false});
   if(error)return out(400,{error:"Could not load your matches."});
   const results=[];for(const match of matches||[]){const otherId=match.user_a===uid?match.user_b:match.user_a;const {data:user}=await db.from("users").select("id,tm_number,display_name,birth_date,gender,city,country,bio,profile_photo_url,gallery_photo_urls,interests,languages,looking_for,flirt_style").eq("id",otherId).maybeSingle();if(!user)continue;const bd=new Date(user.birth_date);const now=new Date();let age=now.getFullYear()-bd.getFullYear();if(now.getMonth()<bd.getMonth()||(now.getMonth()===bd.getMonth()&&now.getDate()<bd.getDate()))age--;const {data:share}=await db.from("match_phone_shares").select("user_id").eq("match_id",match.id).eq("user_id",otherId).maybeSingle();results.push({id:match.id,chat_id:match.chat_id,created_at:match.created_at,other_user:{...user,age,photo_url:user.profile_photo_url||null,phone_shared:!!share}});}
   const {data:notifications}=await db.from("notifications").select("id,title,body,read_at,created_at").eq("user_id",uid).order("created_at",{ascending:false}).limit(20);
   return out(200,{matches:results,notifications:notifications||[]});
  }
  if(b.action==="match_phone_share"||b.action==="match_phone_get"){
   const matchId=String(b.match_id||"");const {data:match}=await db.from("matches").select("id,user_a,user_b").eq("id",matchId).maybeSingle();if(!match||![match.user_a,match.user_b].includes(uid))return out(403,{error:"This match is unavailable."});
   const otherId=match.user_a===uid?match.user_b:match.user_a;
   if(b.action==="match_phone_share"){const {data:me}=await db.from("user_private_contacts").select("phone_number").eq("user_id",uid).maybeSingle();if(!me?.phone_number)return out(400,{error:"Add your phone number in your profile before sharing it."});const {error}=await db.from("match_phone_shares").upsert({match_id:matchId,user_id:uid},{onConflict:"match_id,user_id"});if(error)return out(400,{error:"Could not share your number."});await db.from("notifications").insert({user_id:otherId,title:"Phone number shared",body:"Your match chose to share their phone number with you."});return out(200,{shared:true});}
   const {data:share}=await db.from("match_phone_shares").select("user_id").eq("match_id",matchId).eq("user_id",otherId).maybeSingle();if(!share)return out(200,{shared:false});const {data:other}=await db.from("user_private_contacts").select("phone_number").eq("user_id",otherId).maybeSingle();return out(200,{shared:true,phone_number:other?.phone_number||null});
  }
  const target=String(b.target_user_id||"");if(!target||target===uid)return out(400,{error:"Invalid profile."});
  const {data:targetUser}=await db.from("users").select("id,display_name").eq("id",target).maybeSingle();if(!targetUser)return out(404,{error:"Profile not found."});
  const {data:blocked}=await db.from("blocks").select("blocker_id").or("and(blocker_id.eq."+uid+",blocked_id.eq."+target+"),and(blocker_id.eq."+target+",blocked_id.eq."+uid+")");if(blocked?.length)return out(403,{error:"This profile is unavailable."});
  if(b.action==="discover_pass"){const q=await db.from("passes").upsert({user_id:uid,passed_user_id:target},{onConflict:"user_id,passed_user_id"});if(q.error)return out(400,{error:"Could not pass profile."});return out(200,{passed:true});}
  const q=await db.from("likes").upsert({from_user_id:uid,to_user_id:target},{onConflict:"from_user_id,to_user_id"});if(q.error)return out(400,{error:"Could not like profile."});
  const {data:mutual}=await db.from("likes").select("id").eq("from_user_id",target).eq("to_user_id",uid).maybeSingle();if(!mutual)return out(200,{liked:true,matched:false});
  const [a,b]=[uid,target].sort();let {data:match}=await db.from("matches").select("id,chat_id").eq("user_a",a).eq("user_b",b).maybeSingle();let isNew=!match;
  if(!match){const ins=await db.from("matches").insert({user_a:a,user_b:b}).select("id,chat_id").single();if(ins.error)return out(200,{liked:true,matched:true,match_saved:false});match=ins.data;}
  let chatId=match.chat_id;
  if(!chatId){const {data:chat,error}=await db.from("chats").insert({}).select("id").single();if(error||!chat)return out(200,{liked:true,matched:true,match_id:match.id,chat_unavailable:true});const ins=await db.from("chat_members").insert([{chat_id:chat.id,user_id:uid},{chat_id:chat.id,user_id:target}]);if(ins.error){await db.from("chats").delete().eq("id",chat.id);return out(200,{liked:true,matched:true,match_id:match.id,chat_unavailable:true});}chatId=chat.id;await db.from("matches").update({chat_id:chatId}).eq("id",match.id);}
  if(isNew){const {data:me}=await db.from("users").select("display_name").eq("id",uid).single();await db.from("notifications").insert([{user_id:uid,title:"It’s a match!",body:"You and "+targetUser.display_name+" liked each other. Say hello!"},{user_id:target,title:"It’s a match!",body:"You and "+(me?.display_name||"your match")+" liked each other. Say hello!"}]);}
  return out(200,{liked:true,matched:true,match_id:match.id,chat_id:chatId,other_user:targetUser});
 }
 if(b.action==="recover_account"){
  const device_id=String(b.device_id||"");const birth_date=String(b.birth_date||"");const mode=String(b.mode||"");
  if(device_id.length<16||!birth_date||!["tm_id","reset_pin"].includes(mode))return out(400,{error:"Enter your registered device and date of birth."});
  let query=db.from("users").select("id,tm_number,birth_date,device_id").eq("device_id",device_id).eq("birth_date",birth_date);
  if(mode==="reset_pin"){const tm=String(b.tm_number||"").trim();if(!/^(?:\\d{6}|\\d{11})$/.test(tm))return out(400,{error:"Enter your 6-digit legacy TM ID or 11-digit TM ID."});query=query.eq("tm_number",tm);}
  const {data:user}=await query.maybeSingle();if(!user)return out(403,{error:"Recovery failed. Use the original device and exact date of birth. If you lost the device, contact support."});
  const {data:auth}=await db.from("auth_codes").select("id,failed_attempts,locked_until").eq("user_id",user.id).maybeSingle();if(!auth)return out(400,{error:"Recovery is unavailable for this account."});
  if(auth.locked_until&&new Date(auth.locked_until)>new Date())return out(429,{error:"Recovery temporarily locked. Try again later."});
  if(mode==="tm_id"){await db.from("auth_codes").update({failed_attempts:0,locked_until:null}).eq("user_id",user.id);return out(200,{tm_number:user.tm_number});}
  const pin=String(b.new_pin||"");if(!/^\\d{4}$/.test(pin))return out(400,{error:"Choose a new 4-digit PIN."});
  const code_hash=await bcrypt.hash(pin,12);const upd=await db.from("auth_codes").update({code_hash,failed_attempts:0,locked_until:null,updated_at:new Date().toISOString()}).eq("user_id",user.id);if(upd.error)return out(500,{error:"Could not reset PIN."});
  const session_token=token();await db.from("sessions").insert({user_id:user.id,device:String(b.device||"web").slice(0,120),token_hash:await digest(session_token),expires_at:new Date(Date.now()+30*86400000).toISOString()});
  return out(200,{ok:true,tm_number:user.tm_number,session_token,user:{id:user.id,tm_number:user.tm_number}});
 }
 if(b.action==="login"){
  const tm_number=String(b.tm_number||"").trim();const pin=String(b.pin||"");const device_id=String(b.device_id||"");
  if(!tm_number||!/^\\d{4}$/.test(pin))return out(400,{error:"Enter TM number and 4-digit code."});
  const {data:user}=await db.from("users").select("id,tm_number,display_name,plan,tier,profile_complete,device_id").eq("tm_number",tm_number).maybeSingle();
  if(!user)return out(401,{error:"TM ID or PIN is incorrect."}); if(user.device_id!==device_id)return out(403,{error:"This account is registered to a different device."});
  const {data:auth}=await db.from("auth_codes").select("*").eq("user_id",user.id).single();
  if(!auth)return out(401,{error:"TM number or code is incorrect."});
  if(auth.locked_until&&new Date(auth.locked_until)>new Date())return out(429,{error:"Account temporarily locked. Please try later."});
  if(!await bcrypt.compare(pin,auth.code_hash)){
   const count=(auth.failed_attempts||0)+1;const lock=count>=5;const mins=auth.last_lockout_at?30:15;
   await db.from("auth_codes").update({failed_attempts:lock?0:count,locked_until:lock?new Date(Date.now()+mins*60000).toISOString():null,last_lockout_at:lock?new Date().toISOString():auth.last_lockout_at,updated_at:new Date().toISOString()}).eq("user_id",user.id);
   return out(401,{error:lock?"Too many wrong codes. Locked for "+mins+" minutes.":"TM number or code is incorrect."});
  }
  await db.from("auth_codes").update({failed_attempts:0,locked_until:null,updated_at:new Date().toISOString()}).eq("user_id",user.id);
  const session_token=token();await db.from("sessions").insert({user_id:user.id,device:String(b.device||"web").slice(0,120),token_hash:await digest(session_token),expires_at:new Date(Date.now()+30*86400000).toISOString()});
  return out(200,{user,session_token});
 }
 return out(400,{error:"Unsupported action."});
 }catch(e){console.error(e);return out(500,{error:"Internal error."});}
});