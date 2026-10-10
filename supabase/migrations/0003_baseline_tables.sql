-- Baseline delle tabelle create in origine dalla dashboard Supabase, cosi' lo schema e'
-- ricostruibile dal repository. Descrive lo stato verificato sul progetto il 2026-10-10.
-- Idempotente: sul progetto esistente non cambia nulla.

create table if not exists public.athletes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id integer primary key,
  claude_api_key text,
  claude_model text,
  plan_generation_prompt_template text,
  weekly_feedback_prompt_template text,
  weekly_feedback_day text not null default 'domenica',
  weekly_feedback_time text not null default '08:00',
  weekly_feedback_timezone text not null default 'Europe/Rome',
  weekly_feedback_email_enabled boolean not null default false
);
