import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const out=(s:number,d:unknown)=>new Response(JSON.stringify(d),{status:s,headers});
const digest=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))).map(x=>x.toString(16).padStart(2,"0")).join("");
const currencyByCountry:Record<string,string>={"Nigeria":"NGN","United States":"USD","Canada":"CAD","United Kingdom":"GBP","Ghana":"GHS","Kenya":"KES","South Africa":"ZAR","India":"INR","Australia":"AUD","New Zealand":"NZD","Singapore":"SGD","United Arab Emirates":"AED","Saudi Arabia":"SAR","Pakistan":"PKR","Bangladesh":"BDT","Philippines":"PHP","Indonesia":"IDR","Japan":"JPY","China":"CNY","Brazil":"BRL","Mexico":"MXN","Egypt":"EGP","Turkey":"TRY","Switzerland":"CHF","France":"EUR","Germany":"EUR","Italy":"EUR","Spain":"EUR","Netherlands":"EUR","Ireland":"EUR","Portugal":"EUR","Belgium":"EUR","Austria":"EUR","Finland":"EUR","Senegal":"XOF","Côte d’Ivoire":"XOF","Cameroon":"XAF","Benin":"XOF","Togo":"XOF","Niger":"XOF","Burkina Faso":"XOF","Mali":"XOF","Rwanda":"RWF","Uganda":"UGX","Tanzania":"TZS","Ethiopia":"ETB","Morocco":"MAD","Algeria":"DZD","Tunisia":"TND","Zambia":"ZMW","Botswana":"BWP","Namibia":"NAD"};
async function emailNotice(to:string,name:string,bank:string,account:string,amount:number,currency:string,ref:string,sender:string,message:string){
 const key=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("ALIYANKEYEE_EMAIL_FROM");
 if(!key||!from)return "not_configured";
 const amountText=amount.toLocaleString(undefined,{maximumFractionDigits:4});
 const html=`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#17251c"><div style="background:#e7f6ed;border-radius:12px;padding:20px"><p style="font-size:11px;letter-spacing:1px;color:#16814c;font-weight:bold">ALIYANKEYE PAY</p><h2>Aliyankee Pay transfer notification</h2><p style="font-size:12px;background:#fff3e7;border:1px solid #f2c79d;padding:10px;border-radius:8px;color:#8b4a13"><b>TM APP ACCOUNT NOTICE:</b> This notice relates to Aliyankee Pay account credits, not a bank deposit.</p><h1>${amountText} ${currency}</h1><p>Sender: ${sender}</p><p>Message from sender: ${message||"No message included."}</p><p>Reference: ${ref}</p><p>Recipient: ${name||to}</p><p>Virtual bank: ${bank}</p><p>Virtual account: ${account}</p><hr><p style="font-size:12px;color:#66756b">This email is an Aliyankee Pay account notification. It does not confirm a deposit to a bank account. If you do not have an Aliyankee Pay account, contact the sender before relying on this notice.</p></div></div>`;
 try{const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject:"Aliyankee Pay — transfer notification",html,text:`Aliyankee Pay account transfer notice: ${amountText} ${currency}. Sender: ${sender}. Message: ${message||"No message included."}. Reference: ${ref}. This notice does not confirm a bank deposit.`})});if(!r.ok){console.error("Resend email error",await r.text());return "failed"}return "sent"}catch(e){console.error(e);return "failed"}
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});if(req.method!=="POST")return out(405,{error:"POST required"});
 try{const b=await req.json(),token=String(b.session_token||"");if(token.length<30)return out(401,{error:"Sign in to TM App to use Aliyankee Pay."});
 const {data:sess,error:se}=await db.from("sessions").select("user_id,expires_at").eq("token_hash",await digest(token)).is("revoked_at",null).maybeSingle();
 if(se||!sess||new Date(sess.expires_at)<new Date())return out(401,{error:"TM session expired. Sign in again."});
 const {data:u,error:ue}=await db.from("users").select("id,tm_number,display_name,email,country").eq("id",sess.user_id).single();if(ue||!u)return out(401,{error:"TM account not found."});
 if(b.action==="wallet"){
  const defaultCC=currencyByCountry[u.country]||"USD";const requestedCC=String(b.currency||defaultCC).toUpperCase();const cc=/^[A-Z]{3}$/.test(requestedCC)?requestedCC:defaultCC;const starter=cc===defaultCC?10000:0;let {data:w}=await db.from("aliyankeyye_wallets").select("balance").eq("user_id",u.id).eq("currency",cc).maybeSingle();
  if(!w){const q=await db.from("aliyankeyye_wallets").insert({user_id:u.id,currency:cc,balance:starter}).select("balance").single();if(q.error)throw q.error;w=q.data;}
  const {data:txs,error:te}=await db.from("aliyankeyye_transactions").select("*").or(`sender_user_id.eq.${u.id},recipient_user_id.eq.${u.id}`).order("created_at",{ascending:false}).limit(50);if(te)throw te;
  const list=(txs||[]).map(t=>({...t,direction:t.sender_user_id===u.id?"out":"in",title:t.sender_user_id===u.id?(t.recipient_name||t.recipient_email):(u.display_name||"Incoming virtual transfer")}));
  return out(200,{balance:w.balance,currency:cc,transactions:list,profile:{tm_number:u.tm_number,email:u.email,display_name:u.display_name}});
 }
 if(b.action==="transfer"){
  if(b.acknowledged_simulation!==true)return out(400,{error:"Confirm that this is virtual simulation currency."});
  const email=String(b.recipient_email||"").trim().toLowerCase(),name=String(b.recipient_name||"").trim().slice(0,80),bank=String(b.recipient_bank||""),account=String(b.recipient_account||""),currency=String(b.currency||"").toUpperCase(),amount=Number(b.amount),memo=String(b.note||"").slice(0,120);
  if(email.length>254||email.indexOf("@")<1||email.lastIndexOf(".")<email.indexOf("@")+2||email.endsWith("."))return out(400,{error:"Enter a valid recipient email."});
  if(email===String(u.email||"").toLowerCase())return out(400,{error:"You cannot transfer virtual funds to your own email."});
  if(!["Aliyankee Sim Bank","TM Virtual Bank","Aliyankee Sandbox Wallet"].includes(bank)||!/^[0-9]{6,20}$/.test(account))return out(400,{error:"Select a virtual bank and enter a valid simulator account number."});if(!/^[A-Z]{3}$/.test(currency)||!Number.isFinite(amount)||amount<=0||amount>100000000)return out(400,{error:"Enter a valid currency and amount."});
  const result=await db.rpc("aliyankeyye_virtual_transfer",{p_sender:u.id,p_email:email,p_name:name,p_bank:bank,p_account:account,p_currency:currency,p_amount:amount,p_memo:memo});if(result.error)return out(400,{error:result.error.message||"Virtual transfer failed."});
  const tx=result.data.transaction,recipientName=name||email;const status=await emailNotice(email,recipientName,bank,account,amount,currency,tx.reference,u.display_name||u.tm_number,memo);
  await db.from("aliyankeyye_transactions").update({email_status:status}).eq("id",tx.id);
  const {data:w}=await db.from("aliyankeyye_wallets").select("balance").eq("user_id",u.id).eq("currency",currency).single();
  return out(200,{balance:w?.balance??result.data.balance,transaction:{...tx,direction:"out",title:recipientName,email_status:status},email_status:status});
 }
 return out(400,{error:"Unknown Aliyankee Pay action."});
 }catch(e){console.error("Aliyankee Pay",e);return out(500,{error:"Aliyankee Pay service error. Please try again."})}
});