-- Alpha 2.0: SFH Design Factory — first production format: billboard/banner 3×6 m.
-- The system deliberately separates creative automation from print-production readiness.
-- No DPI/bleed/color profile is assumed globally: a verified printer profile is mandatory for PRINT_READY.

create table if not exists public.design_print_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_name text not null,
  name text not null,
  product_type text not null default 'billboard_3x6' check (product_type in ('billboard_3x6')),
  width_mm integer not null default 6000 check (width_mm > 0),
  height_mm integer not null default 3000 check (height_mm > 0),
  artwork_scale numeric(8,4),
  target_dpi numeric(8,2),
  color_mode text,
  color_profile text,
  bleed_mm numeric(8,2),
  safe_zone_mm numeric(8,2),
  allowed_formats text[] not null default '{}'::text[],
  max_file_mb integer,
  notes text,
  active boolean not null default true,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.design_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no bigint generated always as identity unique,
  source text not null default 'manual' check (source in ('manual','leadbot','factory','api')),
  lead_id uuid unique references public.leadbot_leads(id) on delete set null,
  factory_request_id uuid references public.factory_requests(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  product_type text not null default 'billboard_3x6' check (product_type in ('billboard_3x6')),
  width_mm integer not null default 6000 check (width_mm = 6000),
  height_mm integer not null default 3000 check (height_mm = 3000),
  customer_name text,
  contact text,
  business_name text,
  status text not null default 'brief_incomplete' check (status in (
    'brief_incomplete','brief_ready','blueprint_ready','drafting','draft_ready','client_review',
    'revision','approved','preflight','print_ready','blocked','canceled'
  )),
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  due_at timestamptz,
  print_profile_id uuid references public.design_print_profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_design_jobs_status_created on public.design_jobs(status,created_at desc);
create index if not exists idx_design_jobs_business_created on public.design_jobs(business_name,created_at desc);

create table if not exists public.design_briefs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.design_jobs(id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  campaign_goal text,
  headline text,
  offer_text text,
  cta_text text,
  phone text,
  website_or_address text,
  legal_text text,
  style text,
  brand_colors text[] not null default '{}'::text[],
  materials_status text not null default 'unknown' check (materials_status in ('unknown','ready','partial','none')),
  source_materials_note text,
  deadline_text text,
  raw_input jsonb not null default '{}'::jsonb,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique(job_id,revision)
);

create table if not exists public.design_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.design_jobs(id) on delete cascade,
  kind text not null check (kind in ('logo','photo','reference','font','source','preview','production')),
  storage_path text,
  original_name text,
  mime_type text,
  byte_size bigint,
  sha256 text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'received' check (status in ('received','validated','rejected','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.design_versions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.design_jobs(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  kind text not null check (kind in ('blueprint','draft','revision','final')),
  generated_by text not null default 'system' check (generated_by in ('system','ai','designer','client')),
  recipe_code text,
  generation_manifest jsonb not null default '{}'::jsonb,
  preview_asset_id uuid references public.design_assets(id) on delete set null,
  production_asset_id uuid references public.design_assets(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','presented','approved','rejected','superseded')),
  created_at timestamptz not null default now(),
  unique(job_id,version_no)
);

create table if not exists public.design_feedback (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.design_jobs(id) on delete cascade,
  version_id uuid references public.design_versions(id) on delete cascade,
  source text not null check (source in ('client','manager','designer','system')),
  message text not null,
  structured_changes jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.design_preflight_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.design_jobs(id) on delete cascade,
  version_id uuid not null references public.design_versions(id) on delete cascade,
  print_profile_id uuid references public.design_print_profiles(id) on delete set null,
  status text not null check (status in ('pass','warn','fail')),
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.design_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.design_jobs(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.design_print_profiles enable row level security;
alter table public.design_jobs enable row level security;
alter table public.design_briefs enable row level security;
alter table public.design_assets enable row level security;
alter table public.design_versions enable row level security;
alter table public.design_feedback enable row level security;
alter table public.design_preflight_runs enable row level security;
alter table public.design_events enable row level security;

revoke all on public.design_print_profiles,public.design_jobs,public.design_briefs,public.design_assets,public.design_versions,public.design_feedback,public.design_preflight_runs,public.design_events from anon,authenticated;
grant select,insert,update,delete on public.design_print_profiles,public.design_jobs,public.design_briefs,public.design_assets,public.design_versions,public.design_feedback,public.design_preflight_runs,public.design_events to service_role;
grant usage,select on all sequences in schema public to service_role;

-- Focus pilot profile intentionally starts UNVERIFIED. Production parameters must come from the real printer/RPK workflow.
insert into public.design_print_profiles(
  code,owner_name,name,product_type,width_mm,height_mm,notes,active,verified_at
)
select
  'FOCUS_BIYSK_3X6_PENDING','ООО «Фокус»','ООО «Фокус» · 3×6 · ТРЕБУЕТ ПРОВЕРКИ',
  'billboard_3x6',6000,3000,
  'DPI, scale, color mode/profile, bleed, safe zone and accepted formats must be confirmed against the actual production printer before PRINT_READY.',
  true,null
where not exists(select 1 from public.design_print_profiles where code='FOCUS_BIYSK_3X6_PENDING');

create or replace function public.design_validate_brief(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  b public.design_briefs%rowtype;
  errors jsonb := '[]'::jsonb;
  valid boolean;
begin
  select * into b from public.design_briefs where job_id=p_job_id order by revision desc limit 1;
  if b.id is null then
    return jsonb_build_object('valid',false,'errors',jsonb_build_array('brief_missing'));
  end if;
  if coalesce(length(trim(b.campaign_goal)),0)=0 then errors:=errors||'"campaign_goal_required"'::jsonb; end if;
  if coalesce(length(trim(b.headline)),0)=0 then errors:=errors||'"headline_required"'::jsonb; end if;
  if coalesce(length(trim(b.phone)),0)=0 and coalesce(length(trim(b.website_or_address)),0)=0 then
    errors:=errors||'"contact_or_address_required"'::jsonb;
  end if;
  valid := jsonb_array_length(errors)=0;
  return jsonb_build_object('valid',valid,'errors',errors,'revision',b.revision);
end;
$$;

revoke all on function public.design_validate_brief(uuid) from public,anon,authenticated;
grant execute on function public.design_validate_brief(uuid) to service_role;

create or replace function public.design_compile_billboard_blueprint(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  j public.design_jobs%rowtype;
  b public.design_briefs%rowtype;
  v_validation jsonb;
  v_id uuid;
  v_no integer;
  v_recipe text;
  manifest jsonb;
begin
  select * into j from public.design_jobs where id=p_job_id for update;
  if j.id is null then raise exception 'design_job_not_found'; end if;
  select * into b from public.design_briefs where job_id=j.id order by revision desc limit 1;
  v_validation := public.design_validate_brief(j.id);
  if not coalesce((v_validation->>'valid')::boolean,false) then
    update public.design_jobs set status='brief_incomplete',updated_at=now(),metadata=metadata||jsonb_build_object('brief_validation',v_validation) where id=j.id;
    raise exception 'design_brief_invalid:%',v_validation::text;
  end if;

  v_recipe := case
    when lower(coalesce(b.style,'')) like '%миним%' then 'billboard_clean_left_v1'
    when lower(coalesce(b.style,'')) like '%прем%' then 'billboard_premium_center_v1'
    when lower(coalesce(b.campaign_goal,'')) like '%акц%' or lower(coalesce(b.offer_text,'')) like '%скид%' then 'billboard_offer_burst_v1'
    else 'billboard_attention_v1'
  end;

  select coalesce(max(version_no),0)+1 into v_no from public.design_versions where job_id=j.id;
  manifest := jsonb_build_object(
    'schema','sfh/design-blueprint/v1',
    'product','billboard_3x6',
    'physical_size_mm',jsonb_build_object('width',6000,'height',3000),
    'recipe_code',v_recipe,
    'content',jsonb_build_object(
      'headline',b.headline,
      'offer',b.offer_text,
      'cta',coalesce(nullif(b.cta_text,''),'Узнать подробнее'),
      'phone',b.phone,
      'website_or_address',b.website_or_address,
      'legal_text',b.legal_text
    ),
    'style',jsonb_build_object('requested',b.style,'brand_colors',to_jsonb(b.brand_colors)),
    'zones',jsonb_build_array(
      jsonb_build_object('code','hero','x',0.04,'y',0.08,'w',0.58,'h',0.54,'role','headline_offer'),
      jsonb_build_object('code','visual','x',0.64,'y',0.05,'w',0.32,'h',0.66,'role','photo_or_brand_visual'),
      jsonb_build_object('code','cta','x',0.04,'y',0.68,'w',0.92,'h',0.20,'role','contact_cta')
    ),
    'constraints',jsonb_build_object(
      'max_primary_message_count',1,
      'max_secondary_message_count',2,
      'print_profile_required_for_final',true,
      'no_unverified_print_parameters',true
    )
  );

  insert into public.design_versions(job_id,version_no,kind,generated_by,recipe_code,generation_manifest,status)
  values(j.id,v_no,'blueprint','system',v_recipe,manifest,'draft')
  returning id into v_id;

  update public.design_jobs
  set status='blueprint_ready',updated_at=now(),metadata=metadata||jsonb_build_object('brief_validation',v_validation,'current_blueprint_id',v_id)
  where id=j.id;

  insert into public.design_events(job_id,event_type,payload)
  values(j.id,'design.blueprint_compiled',jsonb_build_object('version_id',v_id,'recipe_code',v_recipe,'validation',v_validation));
  return v_id;
end;
$$;

revoke all on function public.design_compile_billboard_blueprint(uuid) from public,anon,authenticated;
grant execute on function public.design_compile_billboard_blueprint(uuid) to service_role;

create or replace function public.design_preflight_gate(p_job_id uuid,p_version_id uuid,p_print_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.design_print_profiles%rowtype;
  v public.design_versions%rowtype;
  checks jsonb := '[]'::jsonb;
  result text := 'pass';
begin
  select * into v from public.design_versions where id=p_version_id and job_id=p_job_id;
  if v.id is null then raise exception 'design_version_not_found'; end if;
  select * into p from public.design_print_profiles where id=p_print_profile_id and active=true;
  if p.id is null then raise exception 'print_profile_not_found'; end if;

  if p.verified_at is null then
    checks:=checks||jsonb_build_array(jsonb_build_object('code','profile_verified','status','fail','message','Print profile is not verified.'));
    result:='fail';
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','profile_verified','status','pass'));
  end if;
  if p.width_mm<>6000 or p.height_mm<>3000 then
    checks:=checks||jsonb_build_array(jsonb_build_object('code','physical_size','status','fail','expected','6000x3000','actual',p.width_mm::text||'x'||p.height_mm::text));
    result:='fail';
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','physical_size','status','pass','value','6000x3000 mm'));
  end if;
  if p.target_dpi is null or p.color_mode is null or p.bleed_mm is null or cardinality(p.allowed_formats)=0 then
    checks:=checks||jsonb_build_array(jsonb_build_object('code','production_parameters','status','fail','message','DPI/color/bleed/formats are incomplete.'));
    result:='fail';
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','production_parameters','status','pass'));
  end if;
  if v.status<>'approved' and v.kind<>'final' then
    checks:=checks||jsonb_build_array(jsonb_build_object('code','creative_approval','status','fail','message','Approved final creative is required.'));
    result:='fail';
  else
    checks:=checks||jsonb_build_array(jsonb_build_object('code','creative_approval','status','pass'));
  end if;

  insert into public.design_preflight_runs(job_id,version_id,print_profile_id,status,checks)
  values(p_job_id,p_version_id,p_print_profile_id,result,checks);

  update public.design_jobs
  set print_profile_id=p_print_profile_id,
      status=case when result='pass' then 'print_ready' else 'blocked' end,
      updated_at=now(),
      metadata=metadata||jsonb_build_object('last_preflight',jsonb_build_object('status',result,'checks',checks,'at',now()))
  where id=p_job_id;

  insert into public.design_events(job_id,event_type,payload)
  values(p_job_id,'design.preflight_completed',jsonb_build_object('status',result,'checks',checks,'version_id',p_version_id,'print_profile_id',p_print_profile_id));

  return jsonb_build_object('status',result,'checks',checks);
end;
$$;

revoke all on function public.design_preflight_gate(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.design_preflight_gate(uuid,uuid,uuid) to service_role;

create or replace function public.design_create_billboard_job_from_lead(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  l public.leadbot_leads%rowtype;
  i public.leadbot_instances%rowtype;
  j_id uuid;
  b_id uuid;
  a jsonb;
  profile_id uuid;
  validation jsonb;
begin
  select * into l from public.leadbot_leads where id=p_lead_id;
  if l.id is null then raise exception 'lead_not_found'; end if;
  if l.flow_code<>'banner_3x6' then raise exception 'unsupported_design_flow'; end if;
  select * into i from public.leadbot_instances where id=l.instance_id;
  if i.id is null then raise exception 'leadbot_instance_not_found'; end if;
  select id into profile_id from public.design_print_profiles where code='FOCUS_BIYSK_3X6_PENDING' and i.public_slug='focus-biysk-pilot' limit 1;
  a:=coalesce(l.answers,'{}'::jsonb);

  insert into public.design_jobs(source,lead_id,product_type,width_mm,height_mm,customer_name,contact,business_name,status,print_profile_id,metadata)
  values('leadbot',l.id,'billboard_3x6',6000,3000,coalesce(a->>'customer',a->>'name'),l.contact,i.business_name,'brief_incomplete',profile_id,
    jsonb_build_object('source_channel',l.source_channel,'lead_no',l.lead_no,'leadbot_instance_id',i.id))
  returning id into j_id;

  insert into public.design_briefs(
    job_id,revision,campaign_goal,headline,offer_text,cta_text,phone,website_or_address,style,materials_status,source_materials_note,deadline_text,raw_input
  ) values (
    j_id,1,a->>'campaign_goal',a->>'headline',a->>'offer_text',a->>'cta_text',coalesce(a->>'phone',l.contact),a->>'website_or_address',a->>'style',
    case lower(coalesce(a->>'materials_status','')) when 'есть' then 'ready' when 'частично' then 'partial' when 'нет' then 'none' else 'unknown' end,
    a->>'materials_note',a->>'deadline',a
  ) returning id into b_id;

  validation:=public.design_validate_brief(j_id);
  if coalesce((validation->>'valid')::boolean,false) then
    update public.design_jobs set status='brief_ready',metadata=metadata||jsonb_build_object('brief_validation',validation) where id=j_id;
    perform public.design_compile_billboard_blueprint(j_id);
  else
    update public.design_jobs set status='brief_incomplete',metadata=metadata||jsonb_build_object('brief_validation',validation) where id=j_id;
  end if;

  insert into public.design_events(job_id,event_type,payload)
  values(j_id,'design.job_created_from_lead',jsonb_build_object('lead_id',l.id,'lead_no',l.lead_no,'source_channel',l.source_channel,'brief_id',b_id,'validation',validation));
  return j_id;
end;
$$;

revoke all on function public.design_create_billboard_job_from_lead(uuid) from public,anon,authenticated;
grant execute on function public.design_create_billboard_job_from_lead(uuid) to service_role;

create or replace function public.design_lead_auto_job_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.flow_code='banner_3x6' then
    perform public.design_create_billboard_job_from_lead(new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.design_lead_auto_job_trigger() from public,anon,authenticated;
drop trigger if exists trg_design_lead_auto_job on public.leadbot_leads;
create trigger trg_design_lead_auto_job
after insert on public.leadbot_leads
for each row execute function public.design_lead_auto_job_trigger();

-- Add the 3×6 design intake to the real Focus pilot. One flow works across Telegram/MAX/WhatsApp runtimes.
update public.leadbot_instances
set config = jsonb_set(
  jsonb_set(
    config,
    '{menu}',
    case
      when exists(select 1 from jsonb_array_elements(coalesce(config->'menu','[]'::jsonb)) x where x->>'code'='banner_3x6') then config->'menu'
      else coalesce(config->'menu','[]'::jsonb) || jsonb_build_array(jsonb_build_object('code','banner_3x6','label','Заказать баннер 3×6'))
    end,
    true
  ),
  '{flows,banner_3x6}',
  jsonb_build_object(
    'title','Баннер / билборд 3×6',
    'questions',jsonb_build_array(
      jsonb_build_object('key','customer','text','Как называется компания или как к вам обращаться?','type','text'),
      jsonb_build_object('key','campaign_goal','text','Какая задача у баннера?','type','choice','options',jsonb_build_array('Продажи / акция','Открытие / событие','Имиджевая реклама','Навигация / адрес','Другое')),
      jsonb_build_object('key','headline','text','Главная фраза, которую человек должен увидеть первой.','type','text'),
      jsonb_build_object('key','offer_text','text','Что именно предлагаете? Цена, скидка, преимущество или короткое пояснение.','type','text'),
      jsonb_build_object('key','cta_text','text','Что должен сделать человек: позвонить, приехать, перейти на сайт?','type','text'),
      jsonb_build_object('key','website_or_address','text','Укажите сайт, адрес или другой ориентир, который должен быть на баннере.','type','text'),
      jsonb_build_object('key','style','text','Какой стиль нужен?','type','choice','options',jsonb_build_array('Ярко и заметно','Строго и делово','Премиально','Минималистично','На усмотрение')),
      jsonb_build_object('key','materials_status','text','Есть логотип и фотографии?','type','choice','options',jsonb_build_array('Есть','Частично','Нет')),
      jsonb_build_object('key','materials_note','text','Коротко напишите, какие материалы есть или что нужно подобрать.','type','text'),
      jsonb_build_object('key','deadline','text','К какому сроку нужен макет?','type','text'),
      jsonb_build_object('key','phone','text','Телефон или другой контакт для согласования макета.','type','text')
    )
  ),
  true
),
updated_at=now()
where public_slug='focus-biysk-pilot';

insert into public.audit_log(action,entity_type,entity_id,reason,metadata)
select 'design_factory.billboard_3x6_enabled','leadbot_instance',id::text,
       'Enabled the first Design Factory intake flow for 3×6 billboards in the Focus pilot.',
       jsonb_build_object('public_slug',public_slug,'product_type','billboard_3x6','channels',jsonb_build_array('telegram','max','whatsapp'))
from public.leadbot_instances where public_slug='focus-biysk-pilot';
