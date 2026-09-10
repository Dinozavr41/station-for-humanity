alter table public.rpk_documents drop constraint if exists rpk_documents_status_check;
alter table public.rpk_documents add constraint rpk_documents_status_check check (status in ('draft','received','archived','issued','sent','accepted','paid','canceled'));
