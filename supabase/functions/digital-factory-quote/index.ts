import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const service=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com"]);
const PRODUCT_CODE="TGBOT_LEADS_V1";
const enc=new TextEncoder();

function cors(origin:string|null){const o=origin&&ORIGINS.has(origin)?origin:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":o,"Access-Control-Allow-Headers":"content-type, apikey, authorization, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};}
function json(status:number,body:any,origin:string|null){return new Response(JSON.stringify(body),{status,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
function clean(v:any,max=500){return String(v??"").trim().replace(/[\u0000-\u001f\u007f]/g," ").slice(0,max)}
function bool(v:any){return v===true||v===1||v==="1"||v==="true"}
async function sourceKey(req:Request){const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim();const day=new Date().toISOString().slice(0,10);const key=await crypto.subtle.importKey("raw",enc.encode(SERVICE_ROLE_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,enc.encode(`${day}|${ip}|digital-factory`));return Array.from(new Uint8Array(sig)).map(x=>x.toString(16).padStart(2,"0")).join("");}

async function catalog(){
 const {data:p,error:pe}=await service.from("factory_products").select("code,name_ru,name_en,currency,base_price,delivery_days,price_version,public_description_ru,public_description_en,base_scope").eq("code",PRODUCT_CODE).eq("status","active").maybeSingle();
 if(pe||!p)throw new Error("product_unavailable");
 const {data:r,error:re}=await service.from("factory_pricing_rules").select("option_code,label_ru,label_en,input_kind,unit_price,max_quantity,sort_order").eq("product_code",PRODUCT_CODE).eq("active",true).order("sort_order");
 if(re)throw new Error("pricing_rules_unavailable");
 return {product:p,rules:r||[]};
}
function calculate(product:any,rules:any[],rawOptions:any){
 const options=rawOptions&&typeof rawOptions==="object"&&!Array.isArray(rawOptions)?rawOptions:{};
 const breakdown:any[]=[{code:"base",label_ru:`${product.name_ru} — базовый пакет`,label_en:`${product.name_en} — base package`,qty:1,unit_price:Number(product.base_price),subtotal:Number(product.base_price)}];
 const normalized:any={};let total=Number(product.base_price);
 for(const r of rules){let qty=0;if(r.input_kind==="boolean")qty=bool(options[r.option_code])?1:0;else qty=Math.max(0,Math.min(Number(r.max_quantity)||1,Math.floor(Number(options[r.option_code])||0)));normalized[r.option_code]=r.input_kind==="boolean"?qty===1:qty;if(qty>0){const unit=Number(r.unit_price);const sub=unit*qty;total+=sub;breakdown.push({code:r.option_code,label_ru:r.label_ru,label_en:r.label_en,qty,unit_price:unit,subtotal:sub});}}
 return {amount:Math.round(total*100)/100,currency:product.currency,price_version:product.price_version,delivery_days:bool(normalized.priority_48h)?2:product.delivery_days,options:normalized,breakdown};
}

Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=="POST")return json(405,{ok:false,error:"method_not_allowed"},origin);
 if(origin&&!ORIGINS.has(origin))return json(403,{ok:false,error:"origin_not_allowed"},origin);
 let body:any={};try{body=await req.json()}catch{return json(400,{ok:false,error:"invalid_json"},origin)}
 if(clean(body?.website,200))return json(200,{ok:true,ignored:true},origin);
 const action=clean(body?.action||"catalog",30);
 try{
   const {product,rules}=await catalog();
   if(action==="catalog")return json(200,{ok:true,product,rules,payment_available:false,live_money:false},origin);
   const quote=calculate(product,rules,body?.options||{});
   if(action==="estimate")return json(200,{ok:true,quote,product:{code:product.code,name_ru:product.name_ru,name_en:product.name_en,base_scope:product.base_scope},payment_available:false,live_money:false},origin);
   if(action!=="submit")return json(400,{ok:false,error:"unknown_action"},origin);

   const customerName=clean(body?.customer_name,120),contact=clean(body?.contact,180),businessType=clean(body?.business_type,180),desiredResult=clean(body?.desired_result,2000);
   const consent=body?.consent===true;
   if(customerName.length<2)return json(400,{ok:false,error:"customer_name_required"},origin);
   if(contact.length<3)return json(400,{ok:false,error:"contact_required"},origin);
   if(desiredResult.length<10)return json(400,{ok:false,error:"desired_result_too_short"},origin);
   if(!consent)return json(400,{ok:false,error:"consent_required"},origin);

   const key=await sourceKey(req);
   const {data:allowed,error:rateError}=await service.rpc("consume_factory_rate_limit",{p_key:key,p_max_hits:5,p_window_minutes:60});
   if(rateError)throw new Error("rate_limit_check_failed");
   if(!allowed)return json(429,{ok:false,error:"rate_limit_exceeded",retry_after_minutes:60},origin);

   const {data:created,error:createError}=await service.rpc("create_factory_public_order",{
     p_product_code:PRODUCT_CODE,p_customer_name:customerName,p_contact:contact,p_business_type:businessType,p_desired_result:desiredResult,p_selected_options:quote.options,p_price_breakdown:quote.breakdown,p_amount:quote.amount,p_currency:quote.currency,p_price_version:quote.price_version,p_source_key:key
   });
   if(createError)throw new Error(`order_create_failed:${createError.message}`);
   return json(201,{ok:true,request:{number:`DF-${String(created.request_no).padStart(6,"0")}`,order_number:`ORD-${String(created.order_no).padStart(6,"0")}`,quote_number:`Q-${String(created.quote_no).padStart(6,"0")}`,amount:Number(created.amount),currency:created.currency,valid_until:created.valid_until},quote,payment_available:false,live_money:false,message_ru:"Смета зафиксирована. Оплата пока не принимается: LIVE-контур Station остаётся выключенным до юридической и платёжной готовности."},origin);
 }catch(e){console.error(e);return json(500,{ok:false,error:"factory_service_error",detail:String((e as any)?.message||e)},origin)}
});