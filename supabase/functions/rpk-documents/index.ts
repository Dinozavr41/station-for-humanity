import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const S=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(S,K,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com","https://glowing-point-3yxf6s3.shipstatic.com","http://localhost:3000","http://127.0.0.1:3000"]);
const PLATFORM_ROLES=new Set(["admin","operator"]);
const MANAGE_ROLES=new Set(["platform_admin","owner","manager"]);
const DOC_TYPES=new Set(["quote","invoice","contract","act","work_order","other"]);
const THREAD_TYPES=new Set(["invoice","act","contract","reconciliation","payment","other"]);
const THREAD_STATUSES=new Set(["draft","requested","sent_to_accountant","received","sent_to_client","paid","closed","canceled"]);
const CHANNELS=new Set(["email","max","phone","manual","other"]);
const FILE_EXTS=new Set(["doc","docx","pdf","xls","xlsx","odt","ods","csv","txt","jpg","jpeg","png"]);
const safe=(v:any,n=1000)=>String(v??"").trim().slice(0,n);
const num=(v:any)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
function cors(o:string|null){const x=o&&ORIGINS.has(o)?o:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":x,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function out(s:number,b:any,o:string|null){return new Response(JSON.stringify(b),{status:s,headers:{...cors(o),"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
function ext(name:string){return name.toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[1]||""}
function clean(name:string){return name.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._ -]+/g,"_").replace(/\s+/g,"_").slice(-150)||"document.bin"}
async function access(userId:string,slug:string){const {data:p}=await db.from("profiles").select("role,status").eq("id",userId).maybeSingle();const platform=!!p&&p.status==="active"&&PLATFORM_ROLES.has(p.role);const {data:w}=await db.from("rpk_workspaces").select("*").eq("slug",slug).maybeSingle();if(!w)return null;if(platform)return{workspace:w,role:"platform_admin"};const {data:m}=await db.from("rpk_members").select("role,status").eq("workspace_id",w.id).eq("user_id",userId).maybeSingle();if(!m||m.status!=="active")return null;return{workspace:w,role:m.role}}
async function audit(uid:string,action:string,type:string,id:string,metadata:any={}){try{await db.from("audit_log").insert({actor_user_id:uid,action,entity_type:type,entity_id:id,reason:"RPK document/accounting action",metadata})}catch{}}
async function clientOk(wid:string,id:string|null){if(!id)return true;const {data}=await db.from("rpk_clients").select("id").eq("workspace_id",wid).eq("id",id).maybeSingle();return!!data}
async function dealOk(wid:string,id:string|null){if(!id)return true;const {data}=await db.from("rpk_deals").select("id").eq("workspace_id",wid).eq("id",id).maybeSingle();return!!data}

Deno.serve(async req=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=="POST")return out(405,{ok:false,error:"method_not_allowed"},origin);
 if(origin&&!ORIGINS.has(origin))return out(403,{ok:false,error:"origin_not_allowed"},origin);
 const jwt=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const {data:u,error:ue}=await db.auth.getUser(jwt);if(ue||!u?.user)return out(401,{ok:false,error:"invalid_session"},origin);
 let b:any={};try{b=await req.json()}catch{return out(400,{ok:false,error:"invalid_json"},origin)}
 const slug=safe(b.workspace_slug||"focus-biysk",100),ctx=await access(u.user.id,slug);if(!ctx)return out(403,{ok:false,error:"workspace_access_denied"},origin);
 const w=ctx.workspace,role=ctx.role,action=safe(b.action,60);if(!MANAGE_ROLES.has(role)&&!["viewer","designer","printer"].includes(role))return out(403,{ok:false,error:"workspace_role_invalid"},origin);

 if(action==="snapshot"){
  const [{data:docs},{data:threads},{data:events},{data:mailboxes}]=await Promise.all([
   db.from("rpk_documents").select("id,deal_id,client_id,document_type,document_no,title,status,total,currency,storage_path,source_kind,source_document_id,original_name,file_ext,mime_type,byte_size,indexing_status,template_family,document_date,issued_at,sent_at,received_at,created_at,updated_at").eq("workspace_id",w.id).order("created_at",{ascending:false}).limit(150),
   db.from("rpk_accounting_threads").select("id,thread_no,deal_id,client_id,result_document_id,request_type,subject,status,preferred_channel,accountant_address,requested_at,received_at,completed_at,due_at,notes,created_at,updated_at").eq("workspace_id",w.id).order("updated_at",{ascending:false}).limit(100),
   db.from("rpk_communication_events").select("id,accounting_thread_id,deal_id,client_id,document_id,direction,channel,actor_side,subject,message_excerpt,occurred_at").eq("workspace_id",w.id).order("occurred_at",{ascending:false}).limit(100),
   db.from("rpk_mailbox_connections").select("id,purpose,provider,email_address,status,sync_from,last_sync_at,created_at,updated_at").eq("workspace_id",w.id).order("created_at")
  ]);
  return out(200,{ok:true,access_role:role,documents:docs||[],accounting_threads:threads||[],communication_events:events||[],mailboxes:mailboxes||[]},origin);
 }

 if(action==="create_upload"){
  if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
  const name=safe(b.original_name,240),size=Number(b.byte_size||0),e=ext(name),mime=safe(b.mime_type,180)||"application/octet-stream";
  if(!name||!FILE_EXTS.has(e))return out(400,{ok:false,error:"unsupported_document_format",allowed:[...FILE_EXTS]},origin);
  if(!Number.isFinite(size)||size<0||size>104857600)return out(400,{ok:false,error:"file_too_large_100mb_max"},origin);
  const path=`${w.slug}/${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}-${clean(name)}`;
  const {data,error}=await db.storage.from("rpk-documents").createSignedUploadUrl(path);if(error||!data)return out(500,{ok:false,error:"signed_upload_failed",detail:error?.message},origin);
  return out(200,{ok:true,path,token:data.token,signed_url:data.signedUrl,original_name:name,mime_type:mime},origin);
 }

 if(action==="register_upload"){
  if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
  const path=safe(b.storage_path,700),name=safe(b.original_name,240),e=ext(name);if(!path.startsWith(`${w.slug}/`)||!FILE_EXTS.has(e))return out(400,{ok:false,error:"invalid_document_registration"},origin);
  const clientId=safe(b.client_id,80)||null,dealId=safe(b.deal_id,80)||null;if(!(await clientOk(w.id,clientId)))return out(400,{ok:false,error:"client_not_in_workspace"},origin);if(!(await dealOk(w.id,dealId)))return out(400,{ok:false,error:"deal_not_in_workspace"},origin);
  const type=DOC_TYPES.has(safe(b.document_type,30))?safe(b.document_type,30):"other";
  const total=num(b.total);if(total!=null&&total<0)return out(400,{ok:false,error:"negative_total_not_allowed"},origin);
  const {data,error}=await db.from("rpk_documents").insert({workspace_id:w.id,deal_id:dealId,client_id:clientId,document_type:type,title:safe(b.title,240)||name,status:"archived",total,currency:"RUB",storage_path:path,source_kind:"uploaded",original_name:name,file_ext:e,mime_type:safe(b.mime_type,180)||"application/octet-stream",byte_size:Number(b.byte_size||0)||null,indexing_status:"queued",document_date:safe(b.document_date,20)||null,created_by:u.user.id,received_at:new Date().toISOString(),payload:{source:"document_vault_upload"}}).select("*").single();
  if(error)return out(500,{ok:false,error:"document_register_failed",detail:error.message},origin);await audit(u.user.id,"rpk.document_uploaded","rpk_document",data.id,{workspace_id:w.id,file_ext:e,document_type:type});return out(200,{ok:true,document:data},origin);
 }

 if(action==="download"){
  const id=safe(b.document_id,80);const {data:d}=await db.from("rpk_documents").select("id,storage_path,original_name").eq("workspace_id",w.id).eq("id",id).maybeSingle();if(!d?.storage_path)return out(404,{ok:false,error:"document_file_not_found"},origin);const {data,error}=await db.storage.from("rpk-documents").createSignedUrl(d.storage_path,900,{download:d.original_name||true});if(error||!data)return out(500,{ok:false,error:"signed_download_failed",detail:error?.message},origin);return out(200,{ok:true,url:data.signedUrl,expires_in:900},origin);
 }

 if(action==="clone_document"){
  if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
  const sourceId=safe(b.source_document_id,80);const {data:s}=await db.from("rpk_documents").select("*").eq("workspace_id",w.id).eq("id",sourceId).maybeSingle();if(!s)return out(404,{ok:false,error:"source_document_not_found"},origin);
  const clientId=safe(b.client_id,80)||s.client_id||null,dealId=safe(b.deal_id,80)||null;if(!(await clientOk(w.id,clientId)))return out(400,{ok:false,error:"client_not_in_workspace"},origin);if(!(await dealOk(w.id,dealId)))return out(400,{ok:false,error:"deal_not_in_workspace"},origin);
  const type=DOC_TYPES.has(safe(b.document_type,30))?safe(b.document_type,30):s.document_type;
  const total=b.total===undefined?s.total:num(b.total);const instruction=safe(b.instruction,4000);
  const {data,error}=await db.from("rpk_documents").insert({workspace_id:w.id,deal_id:dealId,client_id:clientId,document_type:type,title:safe(b.title,240)||`Новое на основе: ${s.title||s.original_name||'документ'}`,status:"draft",total,currency:s.currency||"RUB",source_kind:"clone",source_document_id:s.id,template_family:s.template_family,indexing_status:"not_required",created_by:u.user.id,payload:{source:"document_clone",instruction,source_original_name:s.original_name,source_storage_path:s.storage_path}}).select("*").single();if(error)return out(500,{ok:false,error:"document_clone_failed",detail:error.message},origin);await audit(u.user.id,"rpk.document_cloned","rpk_document",data.id,{workspace_id:w.id,source_document_id:s.id});return out(200,{ok:true,document:data,note:"Draft linked to source. Content rendering/editing is performed by the document engine layer."},origin);
 }

 if(action==="create_accounting_request"){
  if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
  const subject=safe(b.subject,300);if(subject.length<2)return out(400,{ok:false,error:"subject_required"},origin);const type=THREAD_TYPES.has(safe(b.request_type,30))?safe(b.request_type,30):"invoice";const channel=CHANNELS.has(safe(b.preferred_channel,30))?safe(b.preferred_channel,30):"email";const clientId=safe(b.client_id,80)||null,dealId=safe(b.deal_id,80)||null;if(!(await clientOk(w.id,clientId)))return out(400,{ok:false,error:"client_not_in_workspace"},origin);if(!(await dealOk(w.id,dealId)))return out(400,{ok:false,error:"deal_not_in_workspace"},origin);
  const now=new Date().toISOString();const {data,error}=await db.from("rpk_accounting_threads").insert({workspace_id:w.id,deal_id:dealId,client_id:clientId,request_type:type,subject,status:"requested",preferred_channel:channel,accountant_address:safe(b.accountant_address,240)||null,requested_at:now,due_at:b.due_at?new Date(b.due_at).toISOString():null,notes:safe(b.notes,2000)||null,created_by:u.user.id}).select("*").single();if(error)return out(500,{ok:false,error:"accounting_request_failed",detail:error.message},origin);
  await db.from("rpk_communication_events").insert({workspace_id:w.id,accounting_thread_id:data.id,deal_id:dealId,client_id:clientId,direction:"out",channel:channel==="other"?"manual":channel,actor_side:"rpk",subject,message_excerpt:safe(b.notes,1000)||"Запрос бухгалтеру создан",occurred_at:now,metadata:{manual:true}});await audit(u.user.id,"rpk.accounting_request_created","rpk_accounting_thread",data.id,{workspace_id:w.id,request_type:type,channel});return out(200,{ok:true,thread:data},origin);
 }

 if(action==="update_accounting_request"){
  if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);const id=safe(b.thread_id,80),status=safe(b.status,40);if(!THREAD_STATUSES.has(status))return out(400,{ok:false,error:"invalid_accounting_status"},origin);const patch:any={status,updated_at:new Date().toISOString()};if(status==="received")patch.received_at=new Date().toISOString();if(["paid","closed"].includes(status))patch.completed_at=new Date().toISOString();if(b.result_document_id!==undefined)patch.result_document_id=safe(b.result_document_id,80)||null;const {data,error}=await db.from("rpk_accounting_threads").update(patch).eq("workspace_id",w.id).eq("id",id).select("*").maybeSingle();if(error||!data)return out(404,{ok:false,error:"accounting_thread_not_found",detail:error?.message},origin);await audit(u.user.id,"rpk.accounting_request_updated","rpk_accounting_thread",id,{workspace_id:w.id,status});return out(200,{ok:true,thread:data},origin);
 }

 if(action==="log_communication"){
  if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);const threadId=safe(b.thread_id,80)||null;if(threadId){const {data:t}=await db.from("rpk_accounting_threads").select("id").eq("workspace_id",w.id).eq("id",threadId).maybeSingle();if(!t)return out(404,{ok:false,error:"accounting_thread_not_found"},origin)}const channel=CHANNELS.has(safe(b.channel,30))?safe(b.channel,30):"manual";const direction=["in","out","internal"].includes(safe(b.direction,20))?safe(b.direction,20):"internal";const actor=["rpk","accountant","client","supplier","system"].includes(safe(b.actor_side,30))?safe(b.actor_side,30):"rpk";const {data,error}=await db.from("rpk_communication_events").insert({workspace_id:w.id,accounting_thread_id:threadId,direction,channel:channel==="other"?"manual":channel,actor_side:actor,subject:safe(b.subject,300)||null,message_excerpt:safe(b.message_excerpt,1500)||null,occurred_at:b.occurred_at?new Date(b.occurred_at).toISOString():new Date().toISOString(),metadata:{manual:true}}).select("*").single();if(error)return out(500,{ok:false,error:"communication_log_failed",detail:error.message},origin);return out(200,{ok:true,event:data},origin);
 }

 if(action==="register_mailbox"){
  if(!["platform_admin","owner"].includes(role))return out(403,{ok:false,error:"owner_role_required"},origin);const purpose=["company","accountant","other"].includes(safe(b.purpose,30))?safe(b.purpose,30):"other";const provider=["gmail","imap","other"].includes(safe(b.provider,30))?safe(b.provider,30):"other";const email=safe(b.email_address,240).toLowerCase();if(!email.includes("@"))return out(400,{ok:false,error:"valid_email_required"},origin);const {data,error}=await db.from("rpk_mailbox_connections").upsert({workspace_id:w.id,purpose,provider,email_address:email,status:"pending",updated_at:new Date().toISOString()},{onConflict:"workspace_id,purpose,email_address"}).select("id,purpose,provider,email_address,status,created_at,updated_at").single();if(error)return out(500,{ok:false,error:"mailbox_register_failed",detail:error.message},origin);return out(200,{ok:true,mailbox:data,note:"Mailbox registered as pending. OAuth/IMAP authorization is a separate credential step; no password is stored here."},origin);
 }

 return out(400,{ok:false,error:"unknown_action"},origin);
});
