create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null default 'Anonymous',
  bio text not null default 'Ask me anything.',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 3 and 500),
  sender_id uuid references auth.users(id) on delete set null,
  is_anonymous boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'answered', 'deleted', 'reported')),
  answer text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.questions enable row level security;

create policy "Profiles are publicly readable" on public.profiles for select using (true);
create policy "Users create their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "Anyone can submit a question" on public.questions for insert with check (true);
create policy "Owners read their questions" on public.questions for select using (
  exists (select 1 from public.profiles where profiles.id = questions.profile_id and profiles.id = auth.uid())
);
create policy "Answered questions are publicly readable" on public.questions for select using (
  status = 'answered' and answer is not null
);
create policy "Owners update their questions" on public.questions for update using (
  exists (select 1 from public.profiles where profiles.id = questions.profile_id and profiles.id = auth.uid())
);
create policy "Owners delete their questions" on public.questions for delete using (
  exists (select 1 from public.profiles where profiles.id = questions.profile_id and profiles.id = auth.uid())
);
