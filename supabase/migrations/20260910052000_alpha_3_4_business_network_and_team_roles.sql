alter table public.rpk_members drop constraint if exists rpk_members_role_check;
alter table public.rpk_members add constraint rpk_members_role_check check (role = any (array['owner'::text,'manager'::text,'printer'::text,'designer'::text,'production'::text,'accountant'::text,'installer'::text,'viewer'::text]));

create table if not exists public.business_workspace_settings (
  workspace_id uuid primary key references public.business_workspace_registry(id) on delete cascade,
  declared_team_size integer check (declared_team_size is null or declared_team_size between 1 and 5000),
  community_enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_network_profiles (
  workspace_id uuid primary key references public.business_workspace_registry(id) on delete cascade,
  discoverable boolean not null default true,
  display_name text,
  headline text,
  about text,
  offers text[] not null default '{}',
  needs text[] not null default '{}',
  contact_person text,
  public_phone text,
  public_email text,
  telegram text,
  max_contact text,
  website text,
  contacts_visibility text not null default 'members' check (contacts_visibility in ('members','none')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_community_channels (
  code text primary key,
  name_ru text not null,
  description_ru text,
  scope text not null check (scope in ('all_business','owners','managers','vertical')),
  vertical_code text references public.business_verticals(code) on delete cascade,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.business_community_messages (
  id uuid primary key default gen_random_uuid(),
  channel_code text not null references public.business_community_channels(code) on delete cascade,
  workspace_id uuid not null references public.business_workspace_registry(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  reply_to uuid references public.business_community_messages(id) on delete set null,
  status text not null default 'active' check (status in ('active','deleted','moderated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_network_profiles_discoverable_idx on public.business_network_profiles(discoverable,updated_at desc);
create index if not exists business_community_messages_channel_created_idx on public.business_community_messages(channel_code,created_at desc) where status='active';
create index if not exists business_community_messages_workspace_idx on public.business_community_messages(workspace_id,created_at desc);

alter table public.business_workspace_settings enable row level security;
alter table public.business_network_profiles enable row level security;
alter table public.business_community_channels enable row level security;
alter table public.business_community_messages enable row level security;
revoke all on public.business_workspace_settings from anon,authenticated;
revoke all on public.business_network_profiles from anon,authenticated;
revoke all on public.business_community_channels from anon,authenticated;
revoke all on public.business_community_messages from anon,authenticated;
grant all on public.business_workspace_settings to service_role;
grant all on public.business_network_profiles to service_role;
grant all on public.business_community_channels to service_role;
grant all on public.business_community_messages to service_role;

insert into public.business_community_channels(code,name_ru,description_ru,scope,vertical_code,sort_order) values
 ('business-general','Бизнес-сообщество','Общий чат владельцев и менеджеров компаний Station. Заказы, материалы, подрядчики, помощь и сотрудничество.','all_business',null,10),
 ('business-owners','Клуб владельцев','Общение владельцев компаний: партнёрства, загрузка, закупки и развитие.','owners',null,20),
 ('business-managers','Менеджеры','Рабочий чат менеджеров компаний: лиды, подрядчики, сроки, обмен опытом.','managers',null,30),
 ('rpk-network','РПК','Отраслевой чат рекламно-производственных компаний.','vertical','rpk',40)
on conflict (code) do update set name_ru=excluded.name_ru,description_ru=excluded.description_ru,scope=excluded.scope,vertical_code=excluded.vertical_code,sort_order=excluded.sort_order,active=true;

insert into public.business_workspace_settings(workspace_id)
select id from public.business_workspace_registry
on conflict (workspace_id) do nothing;
insert into public.business_network_profiles(workspace_id,display_name)
select id,name from public.business_workspace_registry
on conflict (workspace_id) do nothing;

create or replace function public.ensure_business_network_workspace()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.business_workspace_settings(workspace_id) values (new.id) on conflict do nothing;
  insert into public.business_network_profiles(workspace_id,display_name) values (new.id,new.name) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.ensure_business_network_workspace() from public,anon,authenticated;
grant execute on function public.ensure_business_network_workspace() to service_role;
drop trigger if exists trg_business_network_workspace on public.business_workspace_registry;
create trigger trg_business_network_workspace after insert on public.business_workspace_registry for each row execute function public.ensure_business_network_workspace();