import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
const S=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(S,K,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com"]),ROLES=new Set(["operator","admin"]);
const safe=(v:any,n=1000)=>String(v??"").trim().slice(0,n);
function cors(o:string|null){const x=o&&ORIGINS.has(o)?o:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":x,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function out(s:number,b:any,o:string|null){return new Response(JSON.stringify(b),{status:s,headers:{...cors(o),"content-type":"application/json; charset=utf-8"}})}
Deno.serve(async req=>{
 const origin=req.headers.get("origin"); if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)}); if(req.method!=="POST")return out(405,{ok:false,error:"method_not_allowed"},origin); if(origin&&!ORIGINS.has(origin))return out(403,{ok:false,error:"origin_not_allowed"},origin);
 const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,""); const {data:u,error:ue}=await db.auth.getUser(jwt); if(ue||!u?.user)return out(401,{ok:false,error:"invalid_session"},origin);
 const {data:p}=await db.from("profiles").select("role,status").eq("id",u.user.id).maybeSingle(); if(!p||p.status!=="active"||!ROLES.has(p.role))return out(403,{ok:false,error:"operator_access_required"},origin);
 let b:any={};try{b=await req.json()}catch{return out(400,{ok:false,error:"invalid_json"},origin)} const action=safe(b.action,50);
 if(action==="list"){
   const {data:jobs,error}=await db.from("design_jobs").select("id,job_no,source,product_type,width_mm,height_mm,customer_name,contact,business_name,status,priority,due_at,print_profile_id,metadata,created_at,updated_at").order("created_at",{ascending:false}).limit(100); if(error)return out(500,{ok:false,error:"design_jobs_read_failed",detail:error.message},origin);
   const ids=(jobs||[]).map((x:any)=>x.id); let briefs:any[]=[],versions:any[]=[],profiles:any[]=[];
   if(ids.length){({data:briefs}=await db.from("design_briefs").select("job_id,revision,campaign_goal,headline,offer_text,phone,website_or_address,style,materials_status,deadline_text,approved,created_at").in("job_id",ids).order("revision",{ascending:false}));({data:versions}=await db.from("design_versions").select("id,job_id,version_no,kind,generated_by,recipe_code,status,created_at").in("job_id",ids).order("version_no",{ascending:false}));}
   const pids=[...new Set((jobs||[]).map((x:any)=>x.print_profile_id).filter(Boolean))]; if(pids.length)({data:profiles}=await db.from("design_print_profiles").select("id,code,name,verified_at,target_dpi,color_mode,color_profile,bleed_mm,safe_zone_mm,allowed_formats").in("id",pids));
   const items=(jobs||[]).map((j:any)=>({ ...j, brief:(briefs||[]).find((x:any)=>x.job_id===j.id)||null, version:(versions||[]).find((x:any)=>x.job_id===j.id)||null, print_profile:(profiles||[]).find((x:any)=>x.id===j.print_profile_id)||null }));
   return out(200,{ok:true,items},origin);
 }
 if(action==="snapshot"){
   const id=safe(b.job_id,100); if(!id)return out(400,{ok:false,error:"job_id_required"},origin);
   const {data:j}=await db.from("design_jobs").select("*").eq("id",id).maybeSingle(); if(!j)return out(404,{ok:false,error:"design_job_not_found"},origin);
   const [{data:briefs},{data:versions},{data:feedback},{data:preflight},{data:events}]=await Promise.all([
     db.from("design_briefs").select("*").eq("job_id",id).order("revision",{ascending:false}),db.from("design_versions").select("*").eq("job_id",id).order("version_no",{ascending:false}),db.from("design_feedback").select("*").eq("job_id",id).order("created_at",{ascending:false}),db.from("design_preflight_runs").select("*").eq("job_id",id).order("created_at",{ascending:false}),db.from("design_events").select("*").eq("job_id",id).order("created_at",{ascending:false}).limit(50)
   ]); let profile=null;if(j.print_profile_id){const {data}=await db.from("design_print_profiles").select("*").eq("id",j.print_profile_id).maybeSingle();profile=data}
   return out(200,{ok:true,job:j,briefs:briefs||[],versions:versions||[],feedback:feedback||[],preflight:preflight||[],events:events||[],print_profile:profile},origin);
 }
 if(action==="recompile"){
   const id=safe(b.job_id,100);const {data:v,error}=await db.rpc("design_compile_billboard_blueprint",{p_job_id:id});if(error)return out(409,{ok:false,error:"blueprint_compile_failed",detail:error.message},origin);return out(200,{ok:true,version_id:v},origin);
 }
 if(action==="feedback"){
   const id=safe(b.job_id,100),message=safe(b.message,3000);if(!id||message.length<2)return out(400,{ok:false,error:"job_and_message_required"},origin);const {error}=await db.from("design_feedback").insert({job_id:id,version_id:b.version_id||null,source:"manager",message,structured_changes:b.structured_changes||{}});if(error)return out(500,{ok:false,error:"feedback_write_failed",detail:error.message},origin);return out(200,{ok:true},origin);
 }
 if(action==="save_print_profile"){
   if(p.role!=="admin")return out(403,{ok:false,error:"admin_required_for_print_profile"},origin);
   const id=safe(b.profile_id,100);if(!id)return out(400,{ok:false,error:"profile_id_required"},origin);
   const payload:any={artwork_scale:b.artwork_scale==null?null:Number(b.artwork_scale),target_dpi:b.target_dpi==null?null:Number(b.target_dpi),color_mode:safe(b.color_mode,50)||null,color_profile:safe(b.color_profile,120)||null,bleed_mm:b.bleed_mm==null?null:Number(b.bleed_mm),safe_zone_mm:b.safe_zone_mm==null?null:Number(b.safe_zone_mm),allowed_formats:Array.isArray(b.allowed_formats)?b.allowed_formats.map((x:any)=>safe(x,20)).filter(Boolean):[],max_file_mb:b.max_file_mb==null?null:Number(b.max_file_mb),notes:safe(b.notes,3000)||null,updated_at:new Date().toISOString()};
   if(b.confirm_verified===true){payload.verified_at=new Date().toISOString();payload.verified_by=u.user.email||u.user.id;}
   const {error}=await db.from("design_print_profiles").update(payload).eq("id",id);if(error)return out(500,{ok:false,error:"profile_update_failed",detail:error.message},origin);await db.from("audit_log").insert({actor_user_id:u.user.id,action:"design.print_profile_updated",entity_type:"design_print_profile",entity_id:id,reason:b.confirm_verified===true?"Production print profile explicitly verified by admin.":"Production print profile edited but not necessarily verified.",metadata:{confirm_verified:b.confirm_verified===true}});return out(200,{ok:true},origin);
 }
 if(action==="preflight"){
   const job=safe(b.job_id,100),version=safe(b.version_id,100),profile=safe(b.profile_id,100);const {data:r,error}=await db.rpc("design_preflight_gate",{p_job_id:job,p_version_id:version,p_print_profile_id:profile});if(error)return out(409,{ok:false,error:"preflight_failed",detail:error.message},origin);return out(200,{ok:true,result:r},origin);
 }
 return out(400,{ok:false,error:"unknown_action"},origin);
});
