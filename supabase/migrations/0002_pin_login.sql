-- PIN sign-in (Edge Function `pin-login`) — attempt limiting + lockout.
--
-- Only the service role (inside the Edge Function) can touch any of this:
-- RLS is on with NO policies, and anon/authenticated have no privileges on
-- the tables or the functions. Safe to re-run.
--
-- Rules (enforced atomically in pin_attempt_reserve, BEFORE the PIN is checked,
-- so concurrent bursts can't sneak extra guesses in):
--   * Global: 5 consecutive wrong PINs lock ALL PIN sign-in for 15 min; each
--     further lockout doubles (30 min, 1 h, …) up to 24 h. Success resets.
--   * Per IP: at most 10 attempts per rolling hour (right or wrong); a success
--     clears that IP's history.

create table if not exists public.pin_login_state (
  id                  int         primary key default 1 check (id = 1),
  consecutive_fails   int         not null default 0,
  lockouts            int         not null default 0,
  locked_until        timestamptz,
  updated_at          timestamptz not null default now()
);
insert into public.pin_login_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.pin_login_attempts (
  id  bigint      generated always as identity primary key,
  ip  text        not null,
  at  timestamptz not null default now()
);
create index if not exists pin_login_attempts_ip_at on public.pin_login_attempts (ip, at);

alter table public.pin_login_state    enable row level security;
alter table public.pin_login_attempts enable row level security;
-- (no policies on purpose)
revoke all on public.pin_login_state    from public, anon, authenticated;
revoke all on public.pin_login_attempts from public, anon, authenticated;
grant all on public.pin_login_state    to service_role;
grant all on public.pin_login_attempts to service_role;

-- Reserve one attempt. Counts it as a failure up front; pin_attempt_success()
-- undoes that when the PIN turns out to be right.
-- Returns allowed=false with retry_after seconds while locked / rate limited.
create or replace function public.pin_attempt_reserve(p_ip text, out allowed boolean, out retry_after int, out reason text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  s public.pin_login_state;
  n int;
  oldest timestamptz;
  lock_secs int;
begin
  select * into s from public.pin_login_state where id = 1 for update;
  if not found then
    insert into public.pin_login_state (id) values (1) returning * into s;
  end if;

  if s.locked_until is not null and s.locked_until > now() then
    allowed := false; reason := 'locked';
    retry_after := greatest(1, ceil(extract(epoch from s.locked_until - now()))::int);
    return;
  end if;

  delete from public.pin_login_attempts where at < now() - interval '1 day';
  select count(*), min(at) into n, oldest
    from public.pin_login_attempts
    where ip = coalesce(p_ip, 'unknown') and at > now() - interval '1 hour';
  if n >= 10 then
    allowed := false; reason := 'rate_limited';
    retry_after := greatest(1, ceil(extract(epoch from oldest + interval '1 hour' - now()))::int);
    return;
  end if;

  insert into public.pin_login_attempts (ip) values (coalesce(p_ip, 'unknown'));
  s.consecutive_fails := s.consecutive_fails + 1;
  if s.consecutive_fails >= 5 then
    s.lockouts := s.lockouts + 1;
    lock_secs := least(15 * 60 * (2 ^ (s.lockouts - 1))::bigint, 24 * 60 * 60)::int;
    s.locked_until := now() + make_interval(secs => lock_secs);
    s.consecutive_fails := 0;
  end if;
  update public.pin_login_state
     set consecutive_fails = s.consecutive_fails, lockouts = s.lockouts,
         locked_until = s.locked_until, updated_at = now()
   where id = 1;
  allowed := true; retry_after := 0; reason := null;
end $$;

-- Right PIN: clear the global counters, any lock this attempt triggered, and
-- this IP's attempt history.
drop function if exists public.pin_attempt_success();
create or replace function public.pin_attempt_success(p_ip text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.pin_login_state
     set consecutive_fails = 0, lockouts = 0, locked_until = null, updated_at = now()
   where id = 1;
  delete from public.pin_login_attempts where ip = coalesce(p_ip, 'unknown');
$$;

revoke all on function public.pin_attempt_reserve(text) from public, anon, authenticated;
revoke all on function public.pin_attempt_success(text) from public, anon, authenticated;
grant execute on function public.pin_attempt_reserve(text) to service_role;
grant execute on function public.pin_attempt_success(text) to service_role;
