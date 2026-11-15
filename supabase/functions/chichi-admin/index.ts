import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!anon||!service)return json({error:"Server configuration is incomplete"},500);
 const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!token)return json({error:"Sign in required"},401);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user)return json({error:"Invalid session"},401);
 if(user.app_metadata?.role!=="admin")return json({error:"Administrator access required"},403);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 let body:Record<string,unknown>;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const action=String(body.action||""),id=String(body.id||"");
 if(action==="dashboard"){
  const [listings,orders,affiliates]=await Promise.all([
   db.from("chichi_listings").select("id,title,category,price_kobo,created_at,seller_id").eq("review_status","pending").order("created_at"),
   db.from("chichi_orders").select("id,item_name,amount_kobo,payment_status,fulfilment_status,created_at,buyer_id").eq("payment_status","pending").order("created_at"),
   db.from("chichi_affiliate_profiles").select("id,referral_code,created_at").eq("status","pending").order("created_at")
  ]);
  if(listings.error||orders.error||affiliates.error)return json({error:"Could not load administrator queues"},500);
  return json({ok:true,result:{listings:listings.data,orders:orders.data,affiliates:affiliates.data}});
 }
 if(!id)return json({error:"A record id is required"},400);
 let result:unknown,targetType="";
 if(action==="approve_listing"||action==="reject_listing"){
  targetType="listing";const status=action==="approve_listing"?"approved":"rejected";
  const {data,error}=await db.from("chichi_listings").update({review_status:status,updated_at:new Date().toISOString()}).eq("id",id).select("id,title,review_status").single();
  if(error)return json({error:error.message},400);result=data;
 }else if(action==="verify_order"){
  targetType="order";const reference=String(body.provider_reference||"").trim();
  if(!reference)return json({error:"Enter the verified bank/provider reference before approving payment"},400);
  const {data:existing,error:lookupError}=await db.from("chichi_orders").select("id,payment_status").eq("id",id).single();
  if(lookupError||!existing)return json({error:"Order not found"},404);
  if(existing.payment_status!=="pending")return json({error:"Only pending orders can be verified"},409);
  const {data,error}=await db.from("chichi_orders").update({payment_status:"verified",fulfilment_status:"queued",provider_reference:reference,updated_at:new Date().toISOString()}).eq("id",id).select("id,payment_status,fulfilment_status").single();
  if(error)return json({error:error.message},400);result=data;
 }else if(action==="set_affiliate_status"){
  targetType="affiliate";const status=String(body.status||"");
  if(!["approved","suspended","pending"].includes(status))return json({error:"Invalid affiliate status"},400);
  const {data,error}=await db.from("chichi_affiliate_profiles").update({status}).eq("id",id).select("id,status").single();
  if(error)return json({error:error.message},400);result=data;
 }else return json({error:"Unsupported administrator action"},400);
 await db.from("chichi_admin_audit").insert({actor_id:user.id,action,target_type:targetType,target_id:id,details:{result}});
 return json({ok:true,result});
});
