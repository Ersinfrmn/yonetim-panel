-- ============================================================
-- ProductiFlow — Supabase Database Setup
-- Run this in your Supabase project's SQL Editor
-- ============================================================

-- 1. HABITS
create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
alter table habits enable row level security;
create policy "Users manage own habits" on habits
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. HABIT LOGS
create table habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  completed boolean default true,
  unique(habit_id, date)
);
alter table habit_logs enable row level security;
create policy "Users manage own habit_logs" on habit_logs
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. TASKS
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  due_date date,
  priority text check (priority in ('low', 'medium', 'high')) default 'medium',
  completed boolean default false,
  created_at timestamptz default now()
);
alter table tasks enable row level security;
create policy "Users manage own tasks" on tasks
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. JOURNAL ENTRIES
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  content text default '',
  created_at timestamptz default now(),
  unique(user_id, date)
);
alter table journal_entries enable row level security;
create policy "Users manage own journal_entries" on journal_entries
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. GOALS
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text default '',
  type text check (type in ('weekly', 'monthly')) default 'weekly',
  target_date date,
  status text check (status in ('in-progress', 'completed')) default 'in-progress',
  created_at timestamptz default now()
);
alter table goals enable row level security;
create policy "Users manage own goals" on goals
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. GOAL TASKS (subtasks)
create table goal_tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade not null,
  title text not null,
  completed boolean default false
);
alter table goal_tasks enable row level security;
create policy "Users manage own goal_tasks" on goal_tasks
  using (
    exists (
      select 1 from goals
      where goals.id = goal_tasks.goal_id
        and goals.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from goals
      where goals.id = goal_tasks.goal_id
        and goals.user_id = auth.uid()
    )
  );

-- 7. POMODORO SESSIONS
create table pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  started_at timestamptz default now(),
  duration_minutes integer not null default 25,
  completed boolean default false
);
alter table pomodoro_sessions enable row level security;
create policy "Users manage own pomodoro_sessions" on pomodoro_sessions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. HABIT BREAK REASONS
-- Run this in Supabase SQL Editor if upgrading from a previous version.
create table if not exists habit_break_reasons (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid references habits(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  break_date date not null,
  reason text not null,
  created_at timestamptz default now(),
  unique(habit_id, break_date)
);
alter table habit_break_reasons enable row level security;
create policy "Users manage own habit_break_reasons" on habit_break_reasons
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
