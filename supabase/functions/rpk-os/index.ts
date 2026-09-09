import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const S=Deno.env.get("SUPABASE_URL")!,K=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(S,K,{auth:{persistSession:false}});
const ORIGINS=new Set(["https://stationforhumanity.com","https://www.stationforhumanity.com","http://localhost:3000","http://127.0.0.1:3000"]);
const PLATFORM_ROLES=new Set(["admin","operator"]);
const MANAGE_ROLES=new Set(["platform_admin","owner","manager"]);
const STAGES=new Set(["lead","qualified","quote","approved","production","ready","won","lost"]);
const DOC_TYPES=new Set(["quote","invoice","contract","act","work_order","other"]);
const safe=(v:any,n=1000)=>String(v??"").trim().slice(0,n);
const num=(v:any)=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
function cors(o:string|null){const x=o&&ORIGINS.has(o)?o:"https://stationforhumanity.com";return{"Access-Control-Allow-Origin":x,"Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function out(s:number,b:any,o:string|null){return new Response(JSON.stringify(b),{status:s,headers:{...cors(o),"content-type":"application/json; charset=utf-8","cache-control":"no-store"}})}
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
async function audit(userId:string,action:string,entityType:string,entityId:string,metadata:any={}){try{await db.from("audit_log").insert({actor_user_id:userId,action,entity_type:entityType,entity_id:entityId,reason:"RPK OS user action",metadata})}catch{}}
async function clientInWorkspace(workspaceId:string,clientId:string){if(!clientId)return null;const {data}=await db.from("rpk_clients").select("id,name").eq("id",clientId).eq("workspace_id",workspaceId).maybeSingle();return data||null}
async function dealInWorkspace(workspaceId:string,dealId:string){if(!dealId)return null;const {data}=await db.from("rpk_deals").select("*").eq("id",dealId).eq("workspace_id",workspaceId).maybeSingle();return data||null}

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
    const {data,error}=await db.rpc("rpk_dashboard_snapshot",{p_workspace_id:w.id});
    if(error)return out(500,{ok:false,error:"dashboard_snapshot_failed",detail:error.message},origin);
    return out(200,{ok:true,workspace:{id:w.id,slug:w.slug,name:w.name,city:w.city,status:w.status},access_role:role,dashboard:data},origin);
  }

  if(action==="create_deal"){
    if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
    const title=safe(b.title,220);if(title.length<2)return out(400,{ok:false,error:"deal_title_required"},origin);
    const clientId=safe(b.client_id,80)||null;if(clientId&&!(await clientInWorkspace(w.id,clientId)))return out(400,{ok:false,error:"client_not_in_workspace"},origin);
    const amount=num(b.amount),cost=num(b.cost_estimate);if((amount!=null&&amount<0)||(cost!=null&&cost<0))return out(400,{ok:false,error:"negative_money_not_allowed"},origin);
    const stage=STAGES.has(safe(b.stage,30))?safe(b.stage,30):"lead";
    const row:any={workspace_id:w.id,client_id:clientId,source:"manual",title,stage,owner_user_id:u.user.id,amount,cost_estimate:cost,margin_estimate:amount!=null&&cost!=null?amount-cost:null,next_action:safe(b.next_action,500)||null,notes:safe(b.notes,2000)||null};
    if(b.next_action_at)row.next_action_at=new Date(b.next_action_at).toISOString();
    const {data,error}=await db.from("rpk_deals").insert(row).select("*").single();
    if(error)return out(500,{ok:false,error:"deal_create_failed",detail:error.message},origin);
    await audit(u.user.id,"rpk.deal_created","rpk_deal",data.id,{workspace_id:w.id,deal_no:data.deal_no});
    return out(200,{ok:true,deal:data},origin);
  }

  if(action==="update_deal"){
    if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
    const id=safe(b.deal_id,80),old=await dealInWorkspace(w.id,id);if(!old)return out(404,{ok:false,error:"deal_not_found"},origin);
    const patch:any={updated_at:new Date().toISOString()};
    if(b.stage!=null){const s=safe(b.stage,30);if(!STAGES.has(s))return out(400,{ok:false,error:"invalid_deal_stage"},origin);patch.stage=s;}
    if(b.title!=null){const t=safe(b.title,220);if(t.length<2)return out(400,{ok:false,error:"deal_title_required"},origin);patch.title=t;}
    const amount=b.amount===undefined?(old.amount==null?null:Number(old.amount)):num(b.amount),cost=b.cost_estimate===undefined?(old.cost_estimate==null?null:Number(old.cost_estimate)):num(b.cost_estimate);
    if((amount!=null&&amount<0)||(cost!=null&&cost<0))return out(400,{ok:false,error:"negative_money_not_allowed"},origin);
    if(b.amount!==undefined)patch.amount=amount;if(b.cost_estimate!==undefined)patch.cost_estimate=cost;if(b.amount!==undefined||b.cost_estimate!==undefined)patch.margin_estimate=amount!=null&&cost!=null?amount-cost:null;
    if(b.next_action!==undefined)patch.next_action=safe(b.next_action,500)||null;
    if(b.next_action_at!==undefined)patch.next_action_at=b.next_action_at?new Date(b.next_action_at).toISOString():null;
    if(b.notes!==undefined)patch.notes=safe(b.notes,2000)||null;
    const {data,error}=await db.from("rpk_deals").update(patch).eq("id",id).eq("workspace_id",w.id).select("*").single();
    if(error)return out(500,{ok:false,error:"deal_update_failed",detail:error.message},origin);
    await audit(u.user.id,"rpk.deal_updated","rpk_deal",id,{workspace_id:w.id,from_stage:old.stage,to_stage:data.stage});
    return out(200,{ok:true,deal:data},origin);
  }

  if(action==="add_cash_entry"){
    if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
    const direction=safe(b.direction,10);if(!["in","out"].includes(direction))return out(400,{ok:false,error:"direction_must_be_in_or_out"},origin);
    const amount=num(b.amount);if(amount==null||amount<=0)return out(400,{ok:false,error:"positive_amount_required"},origin);
    const dealId=safe(b.deal_id,80)||null;if(dealId&&!(await dealInWorkspace(w.id,dealId)))return out(400,{ok:false,error:"deal_not_in_workspace"},origin);
    const occurred=safe(b.occurred_on,20)||new Date().toISOString().slice(0,10);
    const {data,error}=await db.from("rpk_cash_entries").insert({workspace_id:w.id,deal_id:dealId,direction,category:safe(b.category,120)||null,amount,currency:"RUB",occurred_on:occurred,counterparty:safe(b.counterparty,220)||null,note:safe(b.note,1000)||null,source:"manual"}).select("*").single();
    if(error)return out(500,{ok:false,error:"cash_entry_create_failed",detail:error.message},origin);
    await audit(u.user.id,"rpk.cash_entry_created","rpk_cash_entry",data.id,{workspace_id:w.id,direction,amount});
    return out(200,{ok:true,cash_entry:data},origin);
  }

  if(action==="create_document_draft"){
    if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
    const dealId=safe(b.deal_id,80),deal=await dealInWorkspace(w.id,dealId);if(!deal)return out(404,{ok:false,error:"deal_not_found"},origin);
    const type=safe(b.document_type,30);if(!DOC_TYPES.has(type))return out(400,{ok:false,error:"invalid_document_type"},origin);
    const total=b.total===undefined?(deal.amount==null?null:Number(deal.amount)):num(b.total);if(total!=null&&total<0)return out(400,{ok:false,error:"negative_total_not_allowed"},origin);
    const {data,error}=await db.from("rpk_documents").insert({workspace_id:w.id,deal_id:deal.id,client_id:deal.client_id,document_type:type,status:"draft",total,currency:"RUB",payload:{source:"rpk_os",deal_title:deal.title,created_by:u.user.id}}).select("*").single();
    if(error)return out(500,{ok:false,error:"document_draft_create_failed",detail:error.message},origin);
    await audit(u.user.id,"rpk.document_draft_created","rpk_document",data.id,{workspace_id:w.id,deal_id:deal.id,document_type:type});
    return out(200,{ok:true,document:data,note:"Draft record created. PDF/DOCX rendering is a separate controlled step."},origin);
  }

  if(action==="create_supplier"){
    if(!MANAGE_ROLES.has(role))return out(403,{ok:false,error:"manager_role_required"},origin);
    const name=safe(b.name,220);if(name.length<2)return out(400,{ok:false,error:"supplier_name_required"},origin);
    const {data,error}=await db.from("rpk_suppliers").insert({workspace_id:w.id,name,legal_name:safe(b.legal_name,240)||null,contact_name:safe(b.contact_name,180)||null,phone:safe(b.phone,80)||null,email:safe(b.email,180)||null,website:safe(b.website,300)||null,notes:safe(b.notes,1000)||null}).select("*").single();
    if(error)return out(500,{ok:false,error:"supplier_create_failed",detail:error.message},origin);
    await audit(u.user.id,"rpk.supplier_created","rpk_supplier",data.id,{workspace_id:w.id});
    return out(200,{ok:true,supplier:data},origin);
  }

  if(action==="toggle_module"){
    if(!["platform_admin","owner"].includes(role))return out(403,{ok:false,error:"owner_role_required"},origin);
    const code=safe(b.module_code,80),enabled=b.enabled===true;
    const [{data:mods},{data:states}]=await Promise.all([db.from("rpk_modules").select("code,dependencies").order("sort_order"),db.from("rpk_workspace_modules").select("module_code,enabled").eq("workspace_id",w.id)]);
    const mod=(mods||[]).find((x:any)=>x.code===code);if(!mod)return out(404,{ok:false,error:"module_not_found"},origin);
    const state=new Map((states||[]).map((x:any)=>[x.module_code,x.enabled]));
    if(enabled){const missing=(mod.dependencies||[]).filter((d:string)=>state.get(d)!==true);if(missing.length)return out(409,{ok:false,error:"module_dependencies_disabled",dependencies:missing},origin);}
    else{const dependents=(mods||[]).filter((m:any)=>(m.dependencies||[]).includes(code)&&state.get(m.code)===true).map((m:any)=>m.code);if(dependents.length)return out(409,{ok:false,error:"enabled_modules_depend_on_this",dependents},origin);}
    const {error}=await db.from("rpk_workspace_modules").upsert({workspace_id:w.id,module_code:code,enabled,enabled_at:new Date().toISOString(),disabled_at:enabled?null:new Date().toISOString()},{onConflict:"workspace_id,module_code"});
    if(error)return out(500,{ok:false,error:"module_toggle_failed",detail:error.message},origin);
    await audit(u.user.id,"rpk.module_toggled","rpk_workspace",w.id,{module_code:code,enabled});
    return out(200,{ok:true,module_code:code,enabled},origin);
  }

  return out(400,{ok:false,error:"unknown_action"},origin);
});
