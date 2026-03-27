create table if not exists public.community_notification_preferences (
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_notification_preferences enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'community_notification_preferences'
      and policyname = 'Users can read own notification preferences'
  ) then
    create policy "Users can read own notification preferences"
      on public.community_notification_preferences
      for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'community_notification_preferences'
      and policyname = 'Users can upsert own notification preferences'
  ) then
    create policy "Users can upsert own notification preferences"
      on public.community_notification_preferences
      for insert
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'community_notification_preferences'
      and policyname = 'Users can update own notification preferences'
  ) then
    create policy "Users can update own notification preferences"
      on public.community_notification_preferences
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

create or replace function public.set_community_notification_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_set_community_notification_preferences_updated_at'
      and tgrelid = 'public.community_notification_preferences'::regclass
  ) then
    create trigger trg_set_community_notification_preferences_updated_at
    before update on public.community_notification_preferences
    for each row
    execute function public.set_community_notification_preferences_updated_at();
  end if;
end;
$$;
