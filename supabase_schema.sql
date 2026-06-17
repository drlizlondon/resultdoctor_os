-- ════════════════════════════════════════════════════════════════════════
--  Result Doctor — Supabase schema for tester-mode audit (central cloud store)
--  Run in the Supabase SQL editor. Then put the project URL + anon key in
--  config.js (see config.sample.js).
--
--  This makes the tester runs from EVERY tester/device land in one place that
--  Admin reads. Tables are exposed via Supabase's auto REST API (PostgREST),
--  which auditLogger.js's Supabase adapter calls.
--
--  SECURITY: the anon key is public. The policies below are a STARTING POINT
--  for a closed tester pilot (insert + read). Tighten before any real use —
--  ideally verify tester passwords and gate reads behind an Edge Function /
--  authenticated role rather than the anon key. Never store real patient data.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists testers (
  "testerId"    text primary key,
  "displayName" text,
  "passwordHash" text,
  active        boolean default true,
  "createdAt"   timestamptz default now(),
  "createdBy"   text,
  notes         text
);

create table if not exists runs (
  "runId"        text primary key,
  "timestamp"    timestamptz default now(),
  "testerId"     text,
  mode           text,
  "pathwayName"  text,
  "pathwayVersion" text,
  "appVersion"   text,
  "inputValues"  jsonb,
  "contextValues" jsonb,
  "outputShown"  jsonb,
  "displayedResultText" text,
  "displayedRecommendation" text,
  "ruleBranchTriggered" text,
  "warningsShown" jsonb,
  "missingInfoPrompts" jsonb,
  queried        boolean default false,
  "queryId"      text,
  "sessionId"    text,
  "userAgent"    text
);
create index if not exists runs_pathway_idx on runs ("pathwayName");
create index if not exists runs_tester_idx  on runs ("testerId");
create index if not exists runs_queried_idx on runs (queried);

create table if not exists queries (
  "queryId"     text primary key,
  "runId"       text references runs("runId"),
  "testerId"    text,
  "timestamp"   timestamptz default now(),
  "feedbackText" text,
  status        text default 'new',
  "adminNotes"  text,
  "reviewedAt"  timestamptz,
  "reviewedBy"  text
);

alter table testers enable row level security;
alter table runs    enable row level security;
alter table queries enable row level security;

-- Starting-point policies for a closed pilot. Review/tighten before real use.
create policy "anon read testers"   on testers for select using (true);
create policy "anon upsert testers" on testers for insert with check (true);
create policy "anon update testers" on testers for update using (true);

create policy "anon read runs"   on runs for select using (true);
create policy "anon insert runs" on runs for insert with check (true);
create policy "anon update runs" on runs for update using (true);

create policy "anon read queries"   on queries for select using (true);
create policy "anon insert queries" on queries for insert with check (true);
create policy "anon update queries" on queries for update using (true);
