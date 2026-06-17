-- ════════════════════════════════════════════════════════════════════════
--  Result Doctor — Supabase schema for tester-mode audit (central cloud store)
--  HARDENED for external-tester use. Run in the Supabase SQL editor.
--
--  Security model (see README "Tester mode, audit & admin → security"):
--    • RLS is ENABLED on every table.
--    • anon has NO read on any table — anon cannot list tester accounts, read
--      password hashes, or read any audit data.
--    • anon may ONLY: insert a tester run (write-only telemetry), and call two
--      SECURITY DEFINER functions — rd_verify_tester (login) and rd_submit_query
--      (raise a query). Neither returns account or audit data.
--    • ALL admin reads/updates and tester management go through the service_role
--      key, used only inside the rd-admin Edge Function (never in the browser).
--    • Admin credentials are NOT stored here. Admin access is gated by the
--      RD_ADMIN_SECRET env var checked inside the Edge Function.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists testers (
  "testerId" text primary key,
  "displayName" text,
  "passwordHash" text,
  active boolean default true,
  "createdAt" timestamptz default now(),
  "createdBy" text,
  notes text
);

create table if not exists runs (
  "runId" text primary key,
  "timestamp" timestamptz default now(),
  "testerId" text,
  mode text,
  "pathwayName" text,
  "pathwayVersion" text,
  "appVersion" text,
  "inputValues" jsonb,
  "contextValues" jsonb,
  "outputShown" jsonb,
  "displayedResultText" text,
  "displayedRecommendation" text,
  "ruleBranchTriggered" text,
  "warningsShown" jsonb,
  "missingInfoPrompts" jsonb,
  queried boolean default false,
  "queryId" text,
  "sessionId" text,
  "userAgent" text
);
create index if not exists runs_pathway_idx on runs ("pathwayName");
create index if not exists runs_tester_idx  on runs ("testerId");
create index if not exists runs_queried_idx on runs (queried);

create table if not exists queries (
  "queryId" text primary key,
  "runId" text references runs("runId"),
  "testerId" text,
  "timestamp" timestamptz default now(),
  "feedbackText" text,
  status text default 'new',
  "adminNotes" text,
  "reviewedAt" timestamptz,
  "reviewedBy" text
);

-- ── RLS: on for all, and DENY-by-default (no permissive policies = no access) ──
alter table testers enable row level security;
alter table runs    enable row level security;
alter table queries enable row level security;
-- Belt-and-braces: explicitly revoke the anon/auth grants PostgREST would use.
revoke all on testers from anon, authenticated;
revoke all on queries from anon, authenticated;
revoke select, update, delete on runs from anon, authenticated;

-- The ONLY direct anon capability: insert a tester run (write-only telemetry).
grant insert on runs to anon;
create policy "anon may insert tester runs only"
  on runs for insert to anon with check (mode = 'tester');
-- (No select/update/delete policy for anon on runs ⇒ anon cannot read audit data.)

-- ── Tester login — server-side hash compare, never exposes the hash ──────────
create or replace function rd_verify_tester(p_tester_id text, p_password text)
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from testers
    where "testerId" = p_tester_id
      and active = true
      and "passwordHash" = encode(digest('resultdoctor::' || p_password, 'sha256'), 'hex')
  );
$$;
revoke all on function rd_verify_tester(text, text) from public;
grant execute on function rd_verify_tester(text, text) to anon;

-- ── Raise a query — inserts the query + flags the run, atomically ────────────
create or replace function rd_submit_query(p_run_id text, p_tester_id text, p_feedback text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_qid text;
begin
  v_qid := 'q_' || encode(gen_random_bytes(8), 'hex');
  insert into queries("queryId", "runId", "testerId", "timestamp", "feedbackText", status)
    values (v_qid, p_run_id, p_tester_id, now(), p_feedback, 'new');
  update runs set queried = true, "queryId" = v_qid where "runId" = p_run_id;
  return v_qid;
end; $$;
revoke all on function rd_submit_query(text, text, text) from public;
grant execute on function rd_submit_query(text, text, text) to anon;

-- service_role bypasses RLS automatically and is used ONLY by the rd-admin
-- Edge Function for: listing/reading runs, queries and testers; updating query
-- status; creating/disabling testers (hashing passwords server-side).
