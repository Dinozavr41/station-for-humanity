-- Alpha 2.1: RPK Workspace — legacy client archive + professional printer onboarding.
-- Core principle: most work is REMAKE from a known client/archive, not greenfield design.

create table if not exists public.rpk_workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_no bigint generated always as identity unique,
  slug text not null unique,
  name text not null,
  legal_name text,
  city text,
  status text not null default 'pilot' check (status in ('pilot','active','paused','retired')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpk_members (
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','printer','designer','viewer')),
  status text not null default 'active' check (status in ('invited','active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);

create table if not exists public.rpk_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  product_type text not null,
  enabled boolean not null default true,
  customer_price numeric(12,2),
  internal_cost numeric(12,2),
  turnaround_hours integer,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,code)
);

create table if not exists public.rpk_clients (
  id uuid primary key default gen_random_uuid(),
  client_no bigint generated always as identity unique,
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  name text not null,
  legal_name text,
  phone text,
  email text,
  website text,
  address text,
  notes text,
  brand_profile jsonb not null default '{}'::jsonb,
  archive_stats jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rpk_clients_workspace_name on public.rpk_clients(workspace_id,name);

create table if not exists public.rpk_archive_batches (
  id uuid primary key default gen_random_uuid(),
  batch_no bigint generated always as identity unique,
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  label text,
  source_kind text not null default 'files' check (source_kind in ('files','folder','zip','external_import')),
  status text not null default 'uploading' check (status in ('uploading','uploaded','indexing','ready','partial','failed','canceled')),
  file_count integer not null default 0 check (file_count>=0),
  indexed_count integer not null default 0 check (indexed_count>=0),
  failed_count integer not null default 0 check (failed_count>=0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rpk_legacy_artworks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  batch_id uuid references public.rpk_archive_batches(id) on delete set null,
  client_id uuid references public.rpk_clients(id) on delete set null,
  storage_path text not null,
  original_name text not null,
  file_ext text,
  mime_type text,
  byte_size bigint,
  sha256 text,
  product_type text,
  width_mm numeric(12,2),
  height_mm numeric(12,2),
  preview_path text,
  extracted_content jsonb not null default '{}'::jsonb,
  extraction_confidence numeric(5,4),
  client_match_state text not null default 'unmatched' check (client_match_state in ('unmatched','suggested','confirmed','ambiguous')),
  status text not null default 'received' check (status in ('received','indexing','ready','needs_review','rejected','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,storage_path)
);
create index if not exists idx_rpk_artworks_client_created on public.rpk_legacy_artworks(workspace_id,client_id,created_at desc);
create index if not exists idx_rpk_artworks_sha on public.rpk_legacy_artworks(workspace_id,sha256) where sha256 is not null;

create table if not exists public.rpk_printer_questionnaires (
  id uuid primary key default gen_random_uuid(),
  questionnaire_no bigint generated always as identity unique,
  workspace_id uuid not null references public.rpk_workspaces(id) on delete cascade,
  service_code text not null default 'billboard_3x6',
  title text not null default 'Профиль печати 3×6',
  printer_model text,
  printer_notes text,
  rip_software text,
  rip_version text,
  material_name text,
  material_notes text,
  artwork_scale numeric(8,4),
  target_dpi numeric(8,2),
  color_mode text,
  color_profile text,
  bleed_mm numeric(8,2),
  safe_zone_mm numeric(8,2),
  allowed_formats text[] not null default '{}'::text[],
  max_file_mb integer,
  file_naming_rule text,
  rasterize_transparency boolean,
  convert_fonts_to_curves boolean,
  black_generation_rule text,
  other_requirements text,
  status text not null default 'draft' check (status in ('draft','submitted','awaiting_approval','verified','rejected','superseded')),
  printer_confirmed_at timestamptz,
  printer_confirmed_by uuid references auth.users(id) on delete set null,
  manager_confirmed_at timestamptz,
  manager_confirmed_by uuid references auth.users(id) on delete set null,
  resolved_spec jsonb not null default '{}'::jsonb,
  generated_print_profile_id uuid references public.design_print_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_rpk_printer_q_workspace on public.rpk_printer_questionnaires(workspace_id,status,created_at desc);

alter table public.design_print_profiles add column if not exists workspace_id uuid references public.rpk_workspaces(id) on delete set null;
alter table public.design_print_profiles add column if not exists source_questionnaire_id uuid references public.rpk_printer_questionnaires(id) on delete set null;
alter table public.design_print_profiles add column if not exists printer_model text;
alter table public.design_print_profiles add column if not exists rip_software text;
alter table public.design_print_profiles add column if not exists material_name text;
alter table public.design_print_profiles add column if not exists agreement_version integer not null default 1;
alter table public.design_print_profiles add column if not exists printer_confirmed_at timestamptz;
alter table public.design_print_profiles add column if not exists manager_confirmed_at timestamptz;

alter table public.design_jobs add column if not exists workspace_id uuid references public.rpk_workspaces(id) on delete set null;
alter table public.design_jobs add column if not exists rpk_client_id uuid references public.rpk_clients(id) on delete set null;
alter table public.design_jobs add column if not exists source_artwork_id uuid references public.rpk_legacy_artworks(id) on delete set null;
alter table public.design_jobs add column if not exists workflow_mode text not null default 'new' check (workflow_mode in ('new','remake','resize','variation'));
alter table public.design_jobs add column if not exists change_request jsonb not null default '{}'::jsonb;
create index if not exists idx_design_jobs_workspace_client on public.design_jobs(workspace_id,rpk_client_id,created_at desc);

alter table public.rpk_workspaces enable row level security;
alter table public.rpk_members enable row level security;
alter table public.rpk_services enable row level security;
alter table public.rpk_clients enable row level security;
alter table public.rpk_archive_batches enable row level security;
alter table public.rpk_legacy_artworks enable row level security;
alter table public.rpk_printer_questionnaires enable row level security;

revoke all on public.rpk_workspaces,public.rpk_members,public.rpk_services,public.rpk_clients,public.rpk_archive_batches,public.rpk_legacy_artworks,public.rpk_printer_questionnaires from anon,authenticated;
grant select,insert,update,delete on public.rpk_workspaces,public.rpk_members,public.rpk_services,public.rpk_clients,public.rpk_archive_batches,public.rpk_legacy_artworks,public.rpk_printer_questionnaires to service_role;
grant usage,select on all sequences in schema public to service_role;

-- Private archive bucket. Files are accessed only through scoped server-side/signed flows.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'rpk-archive','rpk-archive',false,104857600,
  array['application/pdf','image/jpeg','image/png','image/tiff','image/svg+xml','application/postscript','application/zip','application/octet-stream']::text[]
)
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.rpk_validate_printer_questionnaire(p_questionnaire_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  q public.rpk_printer_questionnaires%rowtype;
  errors jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
begin
  select * into q from public.rpk_printer_questionnaires where id=p_questionnaire_id;
  if q.id is null then return jsonb_build_object('valid',false,'errors',jsonb_build_array('questionnaire_not_found'),'warnings',warnings); end if;
  if coalesce(length(trim(q.printer_model)),0)=0 then errors:=errors||'"printer_model_required"'::jsonb; end if;
  if coalesce(length(trim(q.rip_software)),0)=0 then errors:=errors||'"rip_software_required"'::jsonb; end if;
  if coalesce(length(trim(q.material_name)),0)=0 then errors:=errors||'"material_required"'::jsonb; end if;
  if q.artwork_scale is null or q.artwork_scale<=0 then errors:=errors||'"artwork_scale_required"'::jsonb; end if;
  if q.target_dpi is null or q.target_dpi<=0 then errors:=errors||'"target_dpi_required"'::jsonb; end if;
  if coalesce(length(trim(q.color_mode)),0)=0 then errors:=errors||'"color_mode_required"'::jsonb; end if;
  if q.bleed_mm is null or q.bleed_mm<0 then errors:=errors||'"bleed_required"'::jsonb; end if;
  if q.safe_zone_mm is null or q.safe_zone_mm<0 then errors:=errors||'"safe_zone_required"'::jsonb; end if;
  if cardinality(q.allowed_formats)=0 then errors:=errors||'"allowed_formats_required"'::jsonb; end if;
  if q.max_file_mb is null or q.max_file_mb<=0 then warnings:=warnings||'"max_file_mb_not_set"'::jsonb; end if;
  if coalesce(length(trim(q.color_profile)),0)=0 then warnings:=warnings||'"color_profile_not_set"'::jsonb; end if;
  return jsonb_build_object('valid',jsonb_array_length(errors)=0,'errors',errors,'warnings',warnings);
end;
$$;
revoke all on function public.rpk_validate_printer_questionnaire(uuid) from public,anon,authenticated;
grant execute on function public.rpk_validate_printer_questionnaire(uuid) to service_role;

create or replace function public.rpk_resolve_printer_spec(p_questionnaire_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare q public.rpk_printer_questionnaires%rowtype;
begin
  select * into q from public.rpk_printer_questionnaires where id=p_questionnaire_id;
  if q.id is null then raise exception 'printer_questionnaire_not_found'; end if;
  return jsonb_build_object(
    'schema','sfh/rpk-print-profile/v1',
    'service_code',q.service_code,
    'physical_size_mm',jsonb_build_object('width',6000,'height',3000),
    'printer',jsonb_build_object('model',q.printer_model,'notes',q.printer_notes),
    'rip',jsonb_build_object('software',q.rip_software,'version',q.rip_version),
    'material',jsonb_build_object('name',q.material_name,'notes',q.material_notes),
    'artwork',jsonb_build_object(
      'scale',q.artwork_scale,'target_dpi',q.target_dpi,'color_mode',q.color_mode,'color_profile',q.color_profile,
      'bleed_mm',q.bleed_mm,'safe_zone_mm',q.safe_zone_mm,'allowed_formats',to_jsonb(q.allowed_formats),
      'max_file_mb',q.max_file_mb,'file_naming_rule',q.file_naming_rule,
      'rasterize_transparency',q.rasterize_transparency,'convert_fonts_to_curves',q.convert_fonts_to_curves,
      'black_generation_rule',q.black_generation_rule
    ),
    'other_requirements',q.other_requirements
  );
end;
$$;
revoke all on function public.rpk_resolve_printer_spec(uuid) from public,anon,authenticated;
grant execute on function public.rpk_resolve_printer_spec(uuid) to service_role;

create or replace function public.rpk_publish_verified_print_profile(p_questionnaire_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  q public.rpk_printer_questionnaires%rowtype;
  w public.rpk_workspaces%rowtype;
  validation jsonb;
  spec jsonb;
  profile_id uuid;
  profile_code text;
begin
  select * into q from public.rpk_printer_questionnaires where id=p_questionnaire_id for update;
  if q.id is null then raise exception 'printer_questionnaire_not_found'; end if;
  select * into w from public.rpk_workspaces where id=q.workspace_id;
  validation:=public.rpk_validate_printer_questionnaire(q.id);
  if not coalesce((validation->>'valid')::boolean,false) then raise exception 'printer_questionnaire_invalid:%',validation::text; end if;
  if q.printer_confirmed_at is null then raise exception 'printer_confirmation_required'; end if;
  if q.manager_confirmed_at is null then raise exception 'manager_confirmation_required'; end if;
  spec:=public.rpk_resolve_printer_spec(q.id);
  profile_code:=upper(regexp_replace(w.slug,'[^a-zA-Z0-9]+','_','g'))||'_3X6_Q'||q.questionnaire_no::text;

  update public.design_print_profiles set active=false,updated_at=now()
  where workspace_id=q.workspace_id and product_type='billboard_3x6' and active=true;

  insert into public.design_print_profiles(
    code,owner_name,name,product_type,width_mm,height_mm,artwork_scale,target_dpi,color_mode,color_profile,bleed_mm,safe_zone_mm,
    allowed_formats,max_file_mb,notes,active,verified_at,verified_by,workspace_id,source_questionnaire_id,printer_model,rip_software,material_name,
    agreement_version,printer_confirmed_at,manager_confirmed_at
  ) values(
    profile_code,coalesce(w.legal_name,w.name),w.name||' · 3×6 · VERIFIED','billboard_3x6',6000,3000,
    q.artwork_scale,q.target_dpi,q.color_mode,q.color_profile,q.bleed_mm,q.safe_zone_mm,q.allowed_formats,q.max_file_mb,
    'Verified from RPK professional printer questionnaire. Agreement snapshot: '||spec::text,true,now(),'rpk_dual_confirmation',
    q.workspace_id,q.id,q.printer_model,q.rip_software,q.material_name,1,q.printer_confirmed_at,q.manager_confirmed_at
  ) returning id into profile_id;

  update public.rpk_printer_questionnaires
  set status='verified',resolved_spec=spec,generated_print_profile_id=profile_id,updated_at=now()
  where id=q.id;
  return profile_id;
end;
$$;
revoke all on function public.rpk_publish_verified_print_profile(uuid) from public,anon,authenticated;
grant execute on function public.rpk_publish_verified_print_profile(uuid) to service_role;

create or replace function public.rpk_create_remake_job(
  p_workspace_id uuid,
  p_client_id uuid,
  p_artwork_id uuid,
  p_change_request jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  w public.rpk_workspaces%rowtype;
  c public.rpk_clients%rowtype;
  a public.rpk_legacy_artworks%rowtype;
  j_id uuid;
  x jsonb;
  b_valid jsonb;
begin
  select * into w from public.rpk_workspaces where id=p_workspace_id and status in ('pilot','active');
  if w.id is null then raise exception 'rpk_workspace_not_found'; end if;
  select * into c from public.rpk_clients where id=p_client_id and workspace_id=w.id;
  if c.id is null then raise exception 'rpk_client_not_found'; end if;
  select * into a from public.rpk_legacy_artworks where id=p_artwork_id and workspace_id=w.id;
  if a.id is null then raise exception 'legacy_artwork_not_found'; end if;
  x:=coalesce(a.extracted_content,'{}'::jsonb);

  insert into public.design_jobs(
    source,product_type,width_mm,height_mm,customer_name,contact,business_name,status,metadata,workspace_id,rpk_client_id,source_artwork_id,workflow_mode,change_request
  ) values(
    'api','billboard_3x6',6000,3000,c.name,coalesce(c.phone,c.email),c.name,'brief_incomplete',
    jsonb_build_object('archive_source',true,'legacy_original_name',a.original_name,'legacy_storage_path',a.storage_path),
    w.id,c.id,a.id,'remake',coalesce(p_change_request,'{}'::jsonb)
  ) returning id into j_id;

  insert into public.design_briefs(
    job_id,campaign_goal,headline,offer_text,cta_text,phone,website_or_address,legal_text,style,brand_colors,materials_status,source_materials_note,raw_input
  ) values(
    j_id,x->>'campaign_goal',x->>'headline',x->>'offer_text',x->>'cta_text',coalesce(x->>'phone',c.phone),
    coalesce(x->>'website_or_address',c.website,c.address),x->>'legal_text',x->>'style',
    case when jsonb_typeof(x->'brand_colors')='array' then array(select jsonb_array_elements_text(x->'brand_colors')) else '{}'::text[] end,
    'ready','Remake from legacy archive: '||a.original_name,
    jsonb_build_object('source_artwork_id',a.id,'source_extracted_content',x,'requested_changes',coalesce(p_change_request,'{}'::jsonb))
  );

  b_valid:=public.design_validate_brief(j_id);
  if coalesce((b_valid->>'valid')::boolean,false) then
    perform public.design_compile_billboard_blueprint(j_id);
  else
    update public.design_jobs set metadata=metadata||jsonb_build_object('brief_validation',b_valid) where id=j_id;
  end if;

  insert into public.design_events(job_id,event_type,payload)
  values(j_id,'design.remake_created_from_archive',jsonb_build_object('workspace_id',w.id,'client_id',c.id,'source_artwork_id',a.id,'changes',coalesce(p_change_request,'{}'::jsonb)));
  return j_id;
end;
$$;
revoke all on function public.rpk_create_remake_job(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.rpk_create_remake_job(uuid,uuid,uuid,jsonb) to service_role;

-- Focus becomes the first RPK Workspace pilot.
insert into public.rpk_workspaces(slug,name,legal_name,city,status,settings)
values('focus-biysk','ООО «Фокус»','ООО «Фокус»','Бийск','pilot',jsonb_build_object('pilot',true,'primary_product','billboard_3x6','archive_first',true))
on conflict (slug) do update set settings=public.rpk_workspaces.settings||excluded.settings,updated_at=now();

insert into public.rpk_services(workspace_id,code,name,product_type,enabled,turnaround_hours,settings)
select w.id,'billboard_3x6','Баннер / билборд 3×6','billboard_3x6',true,null,jsonb_build_object('modes',jsonb_build_array('remake','resize','new'),'default_mode','remake')
from public.rpk_workspaces w where w.slug='focus-biysk'
on conflict (workspace_id,code) do update set enabled=true,settings=excluded.settings,updated_at=now();

update public.design_print_profiles p
set workspace_id=w.id,updated_at=now()
from public.rpk_workspaces w
where w.slug='focus-biysk' and p.code='FOCUS_BIYSK_3X6_PENDING' and p.workspace_id is null;
