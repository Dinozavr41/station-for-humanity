import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const S=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(S,K,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com","http://localhost:3000","http://127.0.0.1:3000"]);
const PLATFORM_ROLES=new Set(["admin","operator"]);
const safe=(v:any,n=1000)=>String(v??"").trim().slice(0,n);
const arr=(v:any,n=20)=>Array.isArray(v)?v.map(x=>safe(x,80)).filter(Boolean).slice(0,n):[];
function cors(o:string|null){const x=o&&ORIGINS.has(o)?o:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":x,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function out(s:number,b:any,o:string|null){return new Response(JSON.stringify(b),{status:s,headers:{...cors(o),"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function fileExt(name:string){const m=name.toLowerCase().match(/\.([a-z0-9]{1,12})$/);return m?.[1]||null}
function cleanFileName(v:string){return v.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._ -]+/g,"_").replace(/\s+/g,"_").slice(-140)||"file.bin"}

async function access(userId:string,slug:string){
  const {data:p}=await db.from("profiles").select("role,status").eq("id",userId).maybeSingle();
  const platform=!!p&&p.status==="active"&&PLATFORM_ROLES.has(p.role);
  const {data:w}=await db.from("rpk_workspaces").select("*").eq("slug",slug).maybeSingle();
  if(!w)return null;
  if(platform)return {workspace:w,role:"platform_admin",platform:true};
  const {data:m}=await db.from("rpk_members").select("role,status").eq("workspace_id",w.id).eq("user_id",userId).maybeSingle();
  if(!m||m.status!=="active")return null;
  return {workspace:w,role:m.role,platform:false};
}
function canManage(role:string){return ["platform_admin","owner","manager"].includes(role)}
function canPrinter(role:string){return ["platform_admin","owner","printer"].includes(role)}

Deno.serve(async req=>{
  const origin=req.headers.get("origin");
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(req.method!=="POST")return out(405,{ok:false,error:"method_not_allowed"},origin);
  if(origin&&!ORIGINS.has(origin))return out(403,{ok:false,error:"origin_not_allowed"},origin);
  const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  const {data:u,error:ue}=await db.auth.getUser(jwt);
  if(ue||!u?.user)return out(401,{ok:false,error:"invalid_session"},origin);
  let b:any={};try{b=await req.json()}catch{return out(400,{ok:false,error:"invalid_json"},origin)}
  const slug=safe(b.workspace_slug||"focus-biysk",100),ctx=await access(u.user.id,slug);
  if(!ctx)return out(403,{ok:false,error:"workspace_access_denied"},origin);
  const w=ctx.workspace,role=ctx.role,action=safe(b.action,60);

  if(action==="snapshot"){
    const [{data:services},{data:clients},{data:batches},{data:questionnaires},{data:profiles},{data:jobs}]=await Promise.all([
      db.from("rpk_services").select("id,code,name,product_type,enabled,customer_price,internal_cost,turnaround_hours,settings").eq("workspace_id",w.id).order("name"),
      db.from("rpk_clients").select("id,client_no,name,legal_name,phone,email,website,address,archive_stats,status,last_order_at,created_at").eq("workspace_id",w.id).order("name").limit(300),
      db.from("rpk_archive_batches").select("id,batch_no,label,source_kind,status,file_count,indexed_count,failed_count,created_at").eq("workspace_id",w.id).order("created_at",{ascending:false}).limit(30),
      db.from("rpk_printer_questionnaires").select("*").eq("workspace_id",w.id).order("created_at",{ascending:false}).limit(20),
      db.from("design_print_profiles").select("id,code,name,product_type,printer_model,rip_software,material_name,artwork_scale,target_dpi,color_mode,color_profile,bleed_mm,safe_zone_mm,allowed_formats,max_file_mb,verified_at,active,agreement_version,printer_confirmed_at,manager_confirmed_at").eq("workspace_id",w.id).order("created_at",{ascending:false}),
      db.from("design_jobs").select("id,job_no,workflow_mode,status,business_name,source_artwork_id,rpk_client_id,created_at,updated_at").eq("workspace_id",w.id).order("created_at",{ascending:false}).limit(50)
    ]);
    const {count:artworkCount}=await db.from("rpk_legacy_artworks").select("id",{count:"exact",head:true}).eq("workspace_id",w.id);
    return out(200,{ok:true,workspace:{id:w.id,slug:w.slug,name:w.name,legal_name:w.legal_name,city:w.city,status:w.status,settings:w.settings},access_role:role,services:services||[],clients:clients||[],archive:{total:Number(artworkCount||0),batches:batches||[]},printer_questionnaires:questionnaires||[],print_profiles:profiles||[],jobs:jobs||[]},origin);
  }

  if(action==="create_client"){
    if(!canManage(role))return out(403,{ok:false,error:"manager_role_required"},origin);
    const name=safe(b.name,180);if(name.length<2)return out(400,{ok:false,error:"client_name_required"},origin);
    const {data,error}=await db.from("rpk_clients").insert({workspace_id:w.id,name,legal_name:safe(b.legal_name,220)||null,phone:safe(b.phone,80)||null,email:safe(b.email,180)||null,website:safe(b.website,300)||null,address:safe(b.address,300)||null,notes:safe(b.notes,1500)||null}).select("*").single();
    if(error)return out(500,{ok:false,error:"client_create_failed",detail:error.message},origin);
    return out(200,{ok:true,client:data},origin);
  }

  if(action==="ensure_printer_questionnaire"){
    if(!["platform_admin","owner","manager","printer"].includes(role))return out(403,{ok:false,error:"printer_access_required"},origin);
    const {data:existing}=await db.from("rpk_printer_questionnaires").select("*").eq("workspace_id",w.id).eq("service_code","billboard_3x6").in("status",["draft","submitted","awaiting_approval"]).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(existing)return out(200,{ok:true,questionnaire:existing,created:false},origin);
    const {data,error}=await db.from("rpk_printer_questionnaires").insert({workspace_id:w.id,service_code:"billboard_3x6",title:"Профессиональный профиль печати · баннер 3×6"}).select("*").single();
    if(error)return out(500,{ok:false,error:"questionnaire_create_failed",detail:error.message},origin);
    return out(200,{ok:true,questionnaire:data,created:true},origin);
  }

  if(action==="save_printer_questionnaire"){
    if(!["platform_admin","owner","manager","printer"].includes(role))return out(403,{ok:false,error:"printer_access_required"},origin);
    const id=safe(b.questionnaire_id,80);if(!id)return out(400,{ok:false,error:"questionnaire_id_required"},origin);
    const patch:any={
      printer_model:safe(b.printer_model,180)||null,printer_notes:safe(b.printer_notes,1000)||null,rip_software:safe(b.rip_software,180)||null,rip_version:safe(b.rip_version,80)||null,
      material_name:safe(b.material_name,180)||null,material_notes:safe(b.material_notes,1000)||null,artwork_scale:b.artwork_scale==null?null:Number(b.artwork_scale),target_dpi:b.target_dpi==null?null:Number(b.target_dpi),
      color_mode:safe(b.color_mode,80)||null,color_profile:safe(b.color_profile,180)||null,bleed_mm:b.bleed_mm==null?null:Number(b.bleed_mm),safe_zone_mm:b.safe_zone_mm==null?null:Number(b.safe_zone_mm),
      allowed_formats:arr(b.allowed_formats,20),max_file_mb:b.max_file_mb==null?null:Number(b.max_file_mb),file_naming_rule:safe(b.file_naming_rule,400)||null,
      rasterize_transparency:b.rasterize_transparency===true,convert_fonts_to_curves:b.convert_fonts_to_curves===true,black_generation_rule:safe(b.black_generation_rule,400)||null,other_requirements:safe(b.other_requirements,2000)||null,
      status:b.submit===true?"awaiting_approval":"draft",updated_at:new Date().toISOString()
    };
    const {data,error}=await db.from("rpk_printer_questionnaires").update(patch).eq("id",id).eq("workspace_id",w.id).select("*").maybeSingle();
    if(error||!data)return out(500,{ok:false,error:"questionnaire_save_failed",detail:error?.message},origin);
    const {data:validation}=await db.rpc("rpk_validate_printer_questionnaire",{p_questionnaire_id:id});
    return out(200,{ok:true,questionnaire:data,validation},origin);
  }

  if(action==="confirm_printer_profile"){
    const id=safe(b.questionnaire_id,80);if(!id)return out(400,{ok:false,error:"questionnaire_id_required"},origin);
    const party=safe(b.party,30);
    if(party==="printer"){
      if(!canPrinter(role))return out(403,{ok:false,error:"printer_role_required"},origin);
      await db.from("rpk_printer_questionnaires").update({printer_confirmed_at:new Date().toISOString(),printer_confirmed_by:u.user.id,status:"awaiting_approval",updated_at:new Date().toISOString()}).eq("id",id).eq("workspace_id",w.id);
    }else if(party==="manager"){
      if(!canManage(role))return out(403,{ok:false,error:"manager_role_required"},origin);
      await db.from("rpk_printer_questionnaires").update({manager_confirmed_at:new Date().toISOString(),manager_confirmed_by:u.user.id,status:"awaiting_approval",updated_at:new Date().toISOString()}).eq("id",id).eq("workspace_id",w.id);
    }else return out(400,{ok:false,error:"party_must_be_printer_or_manager"},origin);
    const {data:q}=await db.from("rpk_printer_questionnaires").select("*").eq("id",id).eq("workspace_id",w.id).maybeSingle();
    let profileId=null,validation=null;
    const vr=await db.rpc("rpk_validate_printer_questionnaire",{p_questionnaire_id:id});validation=vr.data;
    if(q?.printer_confirmed_at&&q?.manager_confirmed_at&&validation?.valid){const pr=await db.rpc("rpk_publish_verified_print_profile",{p_questionnaire_id:id});if(pr.error)return out(500,{ok:false,error:"print_profile_publish_failed",detail:pr.error.message},origin);profileId=pr.data;}
    return out(200,{ok:true,questionnaire:q,validation,generated_print_profile_id:profileId},origin);
  }

  if(action==="create_archive_upload"){
    if(!["platform_admin","owner","manager","designer"].includes(role))return out(403,{ok:false,error:"archive_write_role_required"},origin);
    const original=safe(b.original_name,220),size=Number(b.byte_size||0),mime=safe(b.mime_type,160)||"application/octet-stream";
    if(!original)return out(400,{ok:false,error:"original_name_required"},origin);if(size>104857600)return out(400,{ok:false,error:"file_too_large_100mb_max"},origin);
    let batchId=safe(b.batch_id,80);
    if(!batchId){const {data:batch,error:be}=await db.from("rpk_archive_batches").insert({workspace_id:w.id,uploaded_by:u.user.id,label:safe(b.batch_label,180)||`Импорт ${new Date().toLocaleDateString("ru-RU")}`,source_kind:safe(b.source_kind,30)||"files"}).select("id,batch_no").single();if(be)return out(500,{ok:false,error:"batch_create_failed",detail:be.message},origin);batchId=batch.id;}
    const path=`${w.slug}/${batchId}/${crypto.randomUUID()}-${cleanFileName(original)}`;
    const {data:signed,error:se}=await db.storage.from("rpk-archive").createSignedUploadUrl(path);
    if(se||!signed)return out(500,{ok:false,error:"signed_upload_failed",detail:se?.message},origin);
    return out(200,{ok:true,batch_id:batchId,path,token:signed.token,signed_url:signed.signedUrl,original_name:original,mime_type:mime},origin);
  }

  if(action==="register_archive_file"){
    if(!["platform_admin","owner","manager","designer"].includes(role))return out(403,{ok:false,error:"archive_write_role_required"},origin);
    const path=safe(b.storage_path,600),original=safe(b.original_name,220),batchId=safe(b.batch_id,80);if(!path.startsWith(`${w.slug}/`)||!original)return out(400,{ok:false,error:"invalid_archive_registration"},origin);
    const clientId=safe(b.client_id,80)||null;if(clientId){const {data:c}=await db.from("rpk_clients").select("id").eq("id",clientId).eq("workspace_id",w.id).maybeSingle();if(!c)return out(400,{ok:false,error:"client_not_in_workspace"},origin);}
    const {data:a,error}=await db.from("rpk_legacy_artworks").insert({workspace_id:w.id,batch_id:batchId||null,client_id:clientId,storage_path:path,original_name:original,file_ext:fileExt(original),mime_type:safe(b.mime_type,160)||null,byte_size:Number(b.byte_size||0)||null,sha256:safe(b.sha256,128)||null,product_type:safe(b.product_type,80)||null,width_mm:b.width_mm==null?null:Number(b.width_mm),height_mm:b.height_mm==null?null:Number(b.height_mm),client_match_state:clientId?"confirmed":"unmatched",status:"received",metadata:{source:"cabinet_upload"}}).select("*").single();
    if(error)return out(500,{ok:false,error:"archive_register_failed",detail:error.message},origin);
    if(batchId){const {count}=await db.from("rpk_legacy_artworks").select("id",{count:"exact",head:true}).eq("batch_id",batchId);await db.from("rpk_archive_batches").update({status:"uploaded",file_count:Number(count||0),updated_at:new Date().toISOString()}).eq("id",batchId).eq("workspace_id",w.id);}
    return out(200,{ok:true,artwork:a},origin);
  }

  if(action==="list_artworks"){
    const clientId=safe(b.client_id,80);let q=db.from("rpk_legacy_artworks").select("id,batch_id,client_id,original_name,file_ext,mime_type,byte_size,product_type,width_mm,height_mm,preview_path,extracted_content,extraction_confidence,client_match_state,status,created_at").eq("workspace_id",w.id).order("created_at",{ascending:false}).limit(Math.min(300,Number(b.limit||100)));if(clientId)q=q.eq("client_id",clientId);const {data,error}=await q;if(error)return out(500,{ok:false,error:"artworks_read_failed",detail:error.message},origin);return out(200,{ok:true,artworks:data||[]},origin);
  }

  if(action==="assign_artwork_client"){
    if(!["platform_admin","owner","manager","designer"].includes(role))return out(403,{ok:false,error:"archive_write_role_required"},origin);
    const artworkId=safe(b.artwork_id,80),clientId=safe(b.client_id,80);const {data:c}=await db.from("rpk_clients").select("id").eq("id",clientId).eq("workspace_id",w.id).maybeSingle();if(!c)return out(400,{ok:false,error:"client_not_in_workspace"},origin);const {data,error}=await db.from("rpk_legacy_artworks").update({client_id:clientId,client_match_state:"confirmed",updated_at:new Date().toISOString()}).eq("id",artworkId).eq("workspace_id",w.id).select("*").maybeSingle();if(error||!data)return out(404,{ok:false,error:"artwork_not_found"},origin);return out(200,{ok:true,artwork:data},origin);
  }

  if(action==="create_remake"){
    if(!["platform_admin","owner","manager","designer"].includes(role))return out(403,{ok:false,error:"design_role_required"},origin);
    const clientId=safe(b.client_id,80),artworkId=safe(b.artwork_id,80);if(!clientId||!artworkId)return out(400,{ok:false,error:"client_and_artwork_required"},origin);
    const {data,error}=await db.rpc("rpk_create_remake_job",{p_workspace_id:w.id,p_client_id:clientId,p_artwork_id:artworkId,p_change_request:b.changes&&typeof b.changes==="object"?b.changes:{}});if(error)return out(500,{ok:false,error:"remake_create_failed",detail:error.message},origin);return out(200,{ok:true,job_id:data},origin);
  }

  return out(400,{ok:false,error:"unknown_action"},origin);
});