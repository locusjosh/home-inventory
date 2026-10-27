-- Home Inventory — count sessions + count log (ADDITIVE ONLY).
--
-- Adds two new tables and one new function. Nothing existing is altered,
-- dropped, renamed or backfilled: items/settings/purchases/receipts/photos,
-- sync_push(), lww_merge() and the storage bucket are untouched, so app
-- builds that predate this migration keep working exactly as before.
-- Safe to re-run.
--
--   counts         one row per count session. `data` holds fields, `meta` holds
--                  per-field [updatedAtMs, deviceId] stamps (same LWW as items),
--                  except `status`, which only moves forward:
--                  active < reviewing < cancelled < completed < reverted.
--   count_entries  the count log. Append-only and immutable: a row is written
--                  once; later pushes can't change it (only the sticky
--                  `deleted` flag can turn on, which the app never does today).

create table if not exists public.counts (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 200),
  data       jsonb       not null default '{}'::jsonb,
  meta       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.count_entries (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null check (char_length(id) between 1 and 200),
  item_id    text,
  session_id text,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists counts_user_updated        on public.counts        (user_id, updated_at);
create index if not exists count_entries_user_updated on public.count_entries (user_id, updated_at);
create index if not exists count_entries_user_item    on public.count_entries (user_id, item_id);

alter table public.counts        enable row level security;
alter table public.count_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['counts', 'count_entries'] loop
    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    if t = 'counts' then
      execute format('create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
      execute format('create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
      -- exactly these four; no TRUNCATE/REFERENCES/TRIGGER (RLS doesn't cover TRUNCATE)
      execute format('revoke all on public.%I from authenticated', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    else
      -- The count log is append-only: signed-in users may only read and insert. No UPDATE or DELETE
      -- policy and no UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privilege (earlier local drafts of this migration
      -- had some; the drops above and this revoke correct a database where one was applied). Account deletion still cascades.
      execute format('revoke all on public.%I from authenticated', t);
      execute format('grant select, insert on public.%I to authenticated', t);
    end if;
  end loop;
end $$;

-- Status only moves forward (same order as src/lib/counts/model.ts STATUS_RANK).
create or replace function public.count_status_rank(s text)
returns int language sql immutable set search_path = '' as $$
  select case s when 'active' then 1 when 'reviewing' then 2 when 'cancelled' then 3
                when 'completed' then 4 when 'reverted' then 5 else 0 end
$$;

-- One round-trip push for count data. SECURITY INVOKER: RLS applies.
--   p_counts:  [{id, data, meta, deleted?}]
--   p_entries: [{id, item_id?, session_id?, data, deleted?}]
create or replace function public.sync_push_counts(
  p_counts  jsonb default '[]'::jsonb,
  p_entries jsonb default '[]'::jsonb
) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r jsonb;
  cur record;
  merged record;
  in_meta jsonb;
  cur_meta jsonb;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;

  for r in select * from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) loop
    select c.data, c.meta, c.deleted into cur from public.counts c where c.user_id = uid and c.id = r ->> 'id' for update;
    if not found then
      insert into public.counts (user_id, id, data, meta, deleted)
      values (uid, r ->> 'id', coalesce(r -> 'data', '{}'), coalesce(r -> 'meta', '{}'), coalesce((r ->> 'deleted')::boolean, false));
    else
      in_meta := coalesce(r -> 'meta', '{}'::jsonb);
      -- A status that would move backwards never wins, whatever its stamp.
      cur_meta := coalesce(cur.meta, '{}'::jsonb);
      if (r -> 'data') ? 'status' then
        if public.count_status_rank(r -> 'data' ->> 'status') < public.count_status_rank(cur.data ->> 'status') then
          in_meta := in_meta - 'status';
        elsif public.count_status_rank(r -> 'data' ->> 'status') > public.count_status_rank(cur.data ->> 'status') then
          -- and a status that moves forward always wins, even with an older stamp
          cur_meta := jsonb_set(cur_meta, '{status}', '[0, ""]'::jsonb);
        end if;
      end if;
      select * into merged from public.lww_merge(cur.data, cur_meta, coalesce(r -> 'data', '{}'), in_meta);
      if merged.data is distinct from cur.data or merged.meta is distinct from cur.meta
         or (coalesce((r ->> 'deleted')::boolean, false) and not cur.deleted) then
        update public.counts
           set data = merged.data, meta = merged.meta,
               deleted = cur.deleted or coalesce((r ->> 'deleted')::boolean, false),
               updated_at = now()
         where user_id = uid and id = r ->> 'id';
      end if;
    end if;
  end loop;

  -- Entries: insert once, never changed afterwards (no tombstones either).
  insert into public.count_entries (user_id, id, item_id, session_id, data, deleted)
  select uid, x ->> 'id', x ->> 'item_id', x ->> 'session_id', coalesce(x -> 'data', '{}'), false
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) x
  on conflict (user_id, id) do nothing;
end $$;

revoke all on function public.sync_push_counts(jsonb, jsonb) from public, anon;
grant execute on function public.sync_push_counts(jsonb, jsonb) to authenticated;

-- Log entries are immutable, for every role: no column of an existing row may change (including
-- `deleted`), and a new row can't arrive pre-hidden. Defense in depth on top of the missing UPDATE grant.
create or replace function public.count_entries_immutable() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.deleted := false;
    return new;
  end if;
  if (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    raise exception 'count log entries are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists count_entries_immutable on public.count_entries;
create trigger count_entries_immutable before insert or update on public.count_entries
  for each row execute function public.count_entries_immutable();

-- Realtime pings for the new tables (the app subscribes on a separate channel).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'counts') then
      execute 'alter publication supabase_realtime add table public.counts';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'count_entries') then
      execute 'alter publication supabase_realtime add table public.count_entries';
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
