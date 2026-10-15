-- ============================================================
-- RHYTHM MASTER AR — skema Supabase awal
-- Jalankan dalam Supabase Dashboard → SQL Editor, atau `supabase db push`.
-- Semua jadual dilindungi Row Level Security (RLS).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Murid' check (char_length(display_name) between 1 and 60),
  avatar text not null default 'drum' check (char_length(avatar) <= 30),
  role text not null default 'student' check (role in ('student', 'teacher')),
  created_at timestamptz not null default now()
);

-- Profil dicipta automatik semasa pendaftaran. Peranan SENTIASA 'student';
-- peranan guru hanya boleh diberi oleh pentadbir melalui SQL Editor (lihat README).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(left(new.raw_user_meta_data ->> 'display_name', 60), ''), 'Murid'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- ---------- KELAS ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  join_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create or replace function public.teaches_student(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.class_members m join public.classes c on c.id = m.class_id
    where m.student_id = p_student and c.teacher_id = auth.uid()
  );
$$;

-- Fungsi pembantu SECURITY DEFINER (mengelakkan rekursi polisi RLS antara classes ↔ class_members)
create or replace function public.owns_class(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.classes where id = p_class and teacher_id = auth.uid());
$$;
create or replace function public.member_of(p_class uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_members where class_id = p_class and student_id = auth.uid());
$$;

-- ---------- LATIHAN ----------
create table if not exists public.rhythm_exercises (
  id text primary key check (id ~ '^[a-z0-9-]{3,60}$'),
  title text not null check (char_length(title) between 1 and 80),
  level int not null check (level between 1 and 4),
  meter text not null check (meter in ('2/4', '3/4', '4/4')),
  tempo_bpm int not null check (tempo_bpm between 40 and 180),
  rhythm_data jsonb not null,
  scoring_settings jsonb,
  pass_mark int not null default 60 check (pass_mark between 0 and 100),
  description text not null default '',
  focus text not null default '',
  allow_no_metronome boolean not null default false,
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Validasi teori muzik di pelayan: jumlah durasi setiap bar mesti sama dengan meter.
create or replace function public.validate_rhythm(p_bars jsonb, p_meter text)
returns boolean language plpgsql immutable as $$
declare
  cap numeric := split_part(p_meter, '/', 1)::numeric;
  bar jsonb; tok jsonb; total numeric; d numeric; claps int := 0;
begin
  if jsonb_typeof(p_bars) <> 'array' or jsonb_array_length(p_bars) = 0 or jsonb_array_length(p_bars) > 16 then
    return false;
  end if;
  for bar in select * from jsonb_array_elements(p_bars) loop
    if jsonb_typeof(bar) <> 'array' or jsonb_array_length(bar) = 0 then return false; end if;
    total := 0;
    for tok in select * from jsonb_array_elements(bar) loop
      d := case tok ->> 'value' when 'w' then 4 when 'h' then 2 when 'q' then 1 when '8' then 0.5 when '16' then 0.25 else null end;
      if d is null then return false; end if;
      if coalesce((tok ->> 'dotted')::boolean, false) then
        if tok ->> 'value' = '16' then return false; end if;
        d := d * 1.5;
      end if;
      if coalesce((tok ->> 'rest')::boolean, false) and coalesce((tok ->> 'tie')::boolean, false) then return false; end if;
      if not coalesce((tok ->> 'rest')::boolean, false) then claps := claps + 1; end if;
      total := total + d;
    end loop;
    if total <> cap then return false; end if;
  end loop;
  return claps > 0;
end $$;

alter table public.rhythm_exercises drop constraint if exists rhythm_valid;
alter table public.rhythm_exercises add constraint rhythm_valid check (public.validate_rhythm(rhythm_data, meter));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists rhythm_exercises_touch on public.rhythm_exercises;
create trigger rhythm_exercises_touch before update on public.rhythm_exercises
for each row execute function public.touch_updated_at();

-- ---------- PERCUBAAN LATIHAN ----------
create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null,
  exercise_title text not null default '',
  level int not null check (level between 1 and 4),
  mode text not null check (mode in ('practice', 'ar', 'challenge', 'daily', 'master')),
  tempo_bpm int not null check (tempo_bpm between 40 and 180),
  pattern_score numeric(5, 1) not null check (pattern_score between 0 and 100),
  timing_score numeric(5, 1) not null check (timing_score between 0 and 100),
  stability_score numeric(5, 1) not null check (stability_score between 0 and 100),
  total_score int not null check (total_score between 0 and 100),
  stars int not null default 0 check (stars between 0 and 3),
  detected_claps jsonb not null default '[]'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists practice_attempts_user_idx on public.practice_attempts (user_id, created_at desc);

-- Murid TIDAK boleh insert/update/delete terus. Rekod hanya melalui RPC yang mengesahkan data.
create or replace function public.submit_attempt(
  p_exercise_id text, p_exercise_title text, p_level int, p_mode text, p_tempo int,
  p_pattern numeric, p_timing numeric, p_stability numeric, p_total int, p_stars int,
  p_claps jsonb, p_counts jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_last timestamptz;
begin
  if auth.uid() is null then raise exception 'Perlu log masuk'; end if;
  if p_total < 0 or p_total > 100 or p_pattern < 0 or p_timing < 0 or p_stability < 0 then
    raise exception 'Markah di luar julat';
  end if;
  if p_mode not in ('practice', 'ar', 'challenge', 'daily', 'master') then
    raise exception 'Mod tidak sah';
  end if;
  if jsonb_typeof(p_claps) <> 'array' or jsonb_array_length(p_claps) > 600 then
    raise exception 'Data tepukan tidak sah';
  end if;
  select max(created_at) into v_last from public.practice_attempts where user_id = auth.uid();
  if v_last is not null and now() - v_last < interval '3 seconds' then
    raise exception 'Terlalu banyak percubaan dalam masa singkat';
  end if;
  insert into public.practice_attempts (user_id, exercise_id, exercise_title, level, mode, tempo_bpm,
    pattern_score, timing_score, stability_score, total_score, stars, detected_claps, counts)
  values (auth.uid(), p_exercise_id, left(p_exercise_title, 80), p_level, p_mode, p_tempo,
    p_pattern, p_timing, p_stability, p_total, p_stars, p_claps, p_counts)
  returning id into v_id;
  return v_id;
end $$;

-- ---------- PENCAPAIAN ----------
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_code text not null check (achievement_code ~ '^[A-Z0-9_]{2,40}$'),
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_code)
);

-- ---------- SERTAI KELAS ----------
create or replace function public.join_class(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_class uuid;
begin
  if auth.uid() is null then raise exception 'Perlu log masuk'; end if;
  select id into v_class from public.classes where join_code = upper(trim(p_code));
  if v_class is null then raise exception 'Kod kelas tidak dijumpai'; end if;
  insert into public.class_members (class_id, student_id) values (v_class, auth.uid()) on conflict do nothing;
  return v_class;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.rhythm_exercises enable row level security;
alter table public.practice_attempts enable row level security;
alter table public.achievements enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.teaches_student(id));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Hanya nama & avatar boleh dikemas kini oleh pengguna (BUKAN peranan).
revoke update on public.profiles from authenticated, anon;
grant update (display_name, avatar) on public.profiles to authenticated;

-- classes
drop policy if exists classes_teacher_all on public.classes;
create policy classes_teacher_all on public.classes for all to authenticated
  using (teacher_id = auth.uid() and public.is_teacher())
  with check (teacher_id = auth.uid() and public.is_teacher());
drop policy if exists classes_member_select on public.classes;
create policy classes_member_select on public.classes for select to authenticated
  using (public.member_of(id));

-- class_members
drop policy if exists members_select on public.class_members;
create policy members_select on public.class_members for select to authenticated
  using (student_id = auth.uid() or public.owns_class(class_id));
drop policy if exists members_teacher_delete on public.class_members;
create policy members_teacher_delete on public.class_members for delete to authenticated
  using (public.owns_class(class_id));

-- rhythm_exercises: semua boleh membaca latihan aktif; hanya guru mengurus latihan sendiri.
drop policy if exists ex_select on public.rhythm_exercises;
create policy ex_select on public.rhythm_exercises for select to anon, authenticated
  using (is_active or created_by = auth.uid());
drop policy if exists ex_insert on public.rhythm_exercises;
create policy ex_insert on public.rhythm_exercises for insert to authenticated
  with check (public.is_teacher() and created_by = auth.uid());
drop policy if exists ex_update on public.rhythm_exercises;
create policy ex_update on public.rhythm_exercises for update to authenticated
  using (public.is_teacher() and created_by = auth.uid())
  with check (public.is_teacher() and created_by = auth.uid());
drop policy if exists ex_delete on public.rhythm_exercises;
create policy ex_delete on public.rhythm_exercises for delete to authenticated
  using (public.is_teacher() and created_by = auth.uid());

-- practice_attempts: baca sendiri / guru baca murid dalam kelasnya. Tiada insert/update/delete terus.
drop policy if exists att_select on public.practice_attempts;
create policy att_select on public.practice_attempts for select to authenticated
  using (user_id = auth.uid() or public.teaches_student(user_id));
revoke insert, update, delete on public.practice_attempts from authenticated, anon;

-- achievements
drop policy if exists ach_select on public.achievements;
create policy ach_select on public.achievements for select to authenticated
  using (user_id = auth.uid() or public.teaches_student(user_id));
drop policy if exists ach_insert on public.achievements;
create policy ach_insert on public.achievements for insert to authenticated
  with check (user_id = auth.uid());
revoke update, delete on public.achievements from authenticated, anon;

grant execute on function public.submit_attempt(text, text, int, text, int, numeric, numeric, numeric, int, int, jsonb, jsonb) to authenticated;
grant execute on function public.join_class(text) to authenticated;
revoke execute on function public.submit_attempt(text, text, int, text, int, numeric, numeric, numeric, int, int, jsonb, jsonb) from anon;
