-- Home Inventory cloud sync — initial schema.
--
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.
--
-- Model
--   items, settings     per-field last-write-wins. `data` holds field values,
--                       `meta` holds {field: [updatedAtMs, deviceId]}. Merging
--                       happens inside sync_push() so concurrent devices can't
--                       clobber each other's fields.
--   purchases, receipts append-and-merge by id; `deleted` is a sticky tombstone.
--   photos              photo metadata; bytes live in the private `item-photos`
--                       bucket at {user_id}/{sha256}.jpg.
--   Every row belongs to one user. RLS: a row is visible/writable only when
--   user_id = auth.uid(). Storage: a user can only touch their own folder.

-- ---------------------------------------------------------------- tables ---

create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 200),
  data       jsonb       not null default '{}'::jsonb,
  meta       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  deleted_at bigint,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.settings (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null default 'app' check (char_length(id) between 1 and 200),
  data       jsonb       not null default '{}'::jsonb,
  meta       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.purchases (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 200),
  item_id    text,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.receipts (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 200),
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.photos (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 200),  -- photo key "<itemId>#<rand>"
  item_id    text        not null,
  sha256     text        check (sha256 ~ '^[0-9a-f]{64}$'),
  width      integer,
  height     integer,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists items_user_updated     on public.items     (user_id, updated_at);
create index if not exists settings_user_updated  on public.settings  (user_id, updated_at);
create index if not exists purchases_user_updated on public.purchases (user_id, updated_at);
create index if not exists receipts_user_updated  on public.receipts  (user_id, updated_at);
create index if not exists photos_user_updated    on public.photos    (user_id, updated_at);

-- ------------------------------------------------------------------- RLS ---

alter table public.items     enable row level security;
alter table public.settings  enable row level security;
alter table public.purchases enable row level security;
alter table public.receipts  enable row level security;
alter table public.photos    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['items', 'settings', 'purchases', 'receipts', 'photos'] loop
    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    -- No anon access at all; authenticated users are still limited by the policies above.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ------------------------------------------------------- merge function ---

-- Per-field LWW: for each field the side with the larger [updatedAtMs, deviceId]
-- wins (deviceId compared bytewise, same as JS string comparison).
create or replace function public.lww_merge(
  a_data jsonb, a_meta jsonb, b_data jsonb, b_meta jsonb,
  out data jsonb, out meta jsonb
)
language plpgsql immutable
set search_path = ''
as $$
declare
  f text;
  am jsonb;
  bm jsonb;
  b_wins boolean;
begin
  data := coalesce(a_data, '{}'::jsonb);
  meta := coalesce(a_meta, '{}'::jsonb);
  for f in select jsonb_object_keys(coalesce(b_meta, '{}'::jsonb)) loop
    am := meta -> f;
    bm := b_meta -> f;
    if jsonb_typeof(bm) <> 'array' then continue; end if;
    if am is null or jsonb_typeof(am) <> 'array' then
      b_wins := true;
    elsif (bm ->> 0)::numeric > (am ->> 0)::numeric then
      b_wins := true;
    elsif (bm ->> 0)::numeric = (am ->> 0)::numeric then
      b_wins := (coalesce(bm ->> 1, '') collate "C") > (coalesce(am ->> 1, '') collate "C");
    else
      b_wins := false;
    end if;
    if b_wins then
      meta := jsonb_set(meta, array[f], bm);
      if b_data ? f then
        data := jsonb_set(data, array[f], b_data -> f);
      else
        data := data - f;
      end if;
    end if;
  end loop;
end $$;

-- One round-trip push. SECURITY INVOKER: runs as the signed-in user, so RLS
-- applies to every statement. Each argument is a JSON array of rows.
--   p_items/p_settings: [{id, data, meta, deleted?, deleted_at?}]
--   p_purchases/p_receipts: [{id, item_id?, data, deleted?}]
--   p_photos: [{id, item_id, sha256, width, height, deleted?}]
create or replace function public.sync_push(
  p_items     jsonb default '[]'::jsonb,
  p_settings  jsonb default '[]'::jsonb,
  p_purchases jsonb default '[]'::jsonb,
  p_receipts  jsonb default '[]'::jsonb,
  p_photos    jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r jsonb;
  cur record;
  m record;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]')) + jsonb_array_length(coalesce(p_settings, '[]'))
     + jsonb_array_length(coalesce(p_purchases, '[]')) + jsonb_array_length(coalesce(p_receipts, '[]'))
     + jsonb_array_length(coalesce(p_photos, '[]')) > 2000 then
    raise exception 'batch too large' using errcode = '54000';
  end if;

  -- items: field merge + sticky tombstone
  for r in select * from jsonb_array_elements(coalesce(p_items, '[]')) loop
    select i.data, i.meta, i.deleted, i.deleted_at into cur
      from public.items i where i.user_id = uid and i.id = r ->> 'id' for update;
    if not found then
      insert into public.items (user_id, id, data, meta, deleted, deleted_at)
      values (uid, r ->> 'id', coalesce(r -> 'data', '{}'), coalesce(r -> 'meta', '{}'),
              coalesce((r ->> 'deleted')::boolean, false), (r ->> 'deleted_at')::bigint);
    else
      select * into m from public.lww_merge(cur.data, cur.meta, r -> 'data', r -> 'meta');
      if m.data is distinct from cur.data or m.meta is distinct from cur.meta
         or (coalesce((r ->> 'deleted')::boolean, false) and not cur.deleted) then
        update public.items set
          data = m.data,
          meta = m.meta,
          deleted = cur.deleted or coalesce((r ->> 'deleted')::boolean, false),
          deleted_at = coalesce(cur.deleted_at, (r ->> 'deleted_at')::bigint),
          updated_at = now()
        where user_id = uid and id = r ->> 'id';
      end if;
    end if;
  end loop;

  -- settings: field merge
  for r in select * from jsonb_array_elements(coalesce(p_settings, '[]')) loop
    select s.data, s.meta into cur
      from public.settings s where s.user_id = uid and s.id = coalesce(r ->> 'id', 'app') for update;
    if not found then
      insert into public.settings (user_id, id, data, meta)
      values (uid, coalesce(r ->> 'id', 'app'), coalesce(r -> 'data', '{}'), coalesce(r -> 'meta', '{}'));
    else
      select * into m from public.lww_merge(cur.data, cur.meta, r -> 'data', r -> 'meta');
      if m.data is distinct from cur.data or m.meta is distinct from cur.meta then
        update public.settings set data = m.data, meta = m.meta, updated_at = now()
        where user_id = uid and id = coalesce(r ->> 'id', 'app');
      end if;
    end if;
  end loop;

  -- purchases / receipts / photos: append by id, tombstones are sticky
  insert into public.purchases as t (user_id, id, item_id, data, deleted)
  select uid, x ->> 'id', x ->> 'item_id', coalesce(x -> 'data', '{}'), coalesce((x ->> 'deleted')::boolean, false)
  from jsonb_array_elements(coalesce(p_purchases, '[]')) x
  on conflict (user_id, id) do update
    set deleted = true, updated_at = now()
    where excluded.deleted and not t.deleted;

  insert into public.receipts as t (user_id, id, data, deleted)
  select uid, x ->> 'id', coalesce(x -> 'data', '{}'), coalesce((x ->> 'deleted')::boolean, false)
  from jsonb_array_elements(coalesce(p_receipts, '[]')) x
  on conflict (user_id, id) do update
    set deleted = true, updated_at = now()
    where excluded.deleted and not t.deleted;

  insert into public.photos as t (user_id, id, item_id, sha256, width, height, deleted)
  select uid, x ->> 'id', x ->> 'item_id', x ->> 'sha256', (x ->> 'width')::int, (x ->> 'height')::int,
         coalesce((x ->> 'deleted')::boolean, false)
  from jsonb_array_elements(coalesce(p_photos, '[]')) x
  on conflict (user_id, id) do update
    set deleted = t.deleted or excluded.deleted,
        sha256  = coalesce(t.sha256, excluded.sha256),
        width   = coalesce(t.width, excluded.width),
        height  = coalesce(t.height, excluded.height),
        updated_at = now()
    where (excluded.deleted and not t.deleted) or (t.sha256 is null and excluded.sha256 is not null);
end $$;

revoke all on function public.sync_push(jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.sync_push(jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
revoke all on function public.lww_merge(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.lww_merge(jsonb, jsonb, jsonb, jsonb) to authenticated;

-- Keep-alive target for .github/workflows/supabase-keepalive.yml:
-- GET /rest/v1/rpc/keepalive touches the database without exposing any data.
create or replace function public.keepalive()
returns text
language sql stable
set search_path = ''
as $$ select 'ok'::text $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;

-- ------------------------------------------------------------- realtime ---
-- Devices listen for postgres_changes as a "something changed, pull now" ping.
-- Realtime applies the same RLS, so a user only hears about their own rows.

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['items', 'settings', 'purchases', 'receipts', 'photos'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- -------------------------------------------------------------- storage ---
-- Private bucket for 1200px JPEGs at {user_id}/{sha256}.jpg (max 5 MB, JPEG only).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "item-photos: read own"   on storage.objects;
drop policy if exists "item-photos: upload own" on storage.objects;
drop policy if exists "item-photos: update own" on storage.objects;
drop policy if exists "item-photos: delete own" on storage.objects;

create policy "item-photos: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "item-photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "item-photos: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "item-photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
