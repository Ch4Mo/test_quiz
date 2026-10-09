-- Schéma de la base Quiz Live.
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run.
-- Le script peut être relancé sans risque : il met aussi à jour une base existante.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Quiz et questions (édités depuis la console admin)
-- ---------------------------------------------------------------------------
create table if not exists quizzes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'Nouveau quiz',
  -- Défilement automatique : temps de réponse, pause entre les questions, écran des règles (secondes)
  answer_time int  not null default 20,
  pause_time  int  not null default 10,
  intro_time  int  not null default 20,
  created_at  timestamptz not null default now()
);

create table if not exists questions (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references quizzes(id) on delete cascade,
  position      int  not null default 0,
  type          text not null check (type in ('text', 'image', 'music')),
  prompt        text not null default '',
  -- Audio de l'extrait (question musicale) ou image d'illustration (autres types)
  media_url     text,
  -- Début de l'extrait audio, en secondes
  media_start   numeric not null default 0,
  -- Liste de réponses : [{ "text": "...", "image_url": "..." | null }]
  choices       jsonb not null default '[]'::jsonb,
  correct_index int  not null default 0,
  points        int  not null default 1,
  -- Temps de réponse en secondes, 0 = temps par défaut du quiz
  time_limit    int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists questions_quiz_position on questions (quiz_id, position);

-- ---------------------------------------------------------------------------
-- Parties en cours
-- ---------------------------------------------------------------------------
create table if not exists games (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  quiz_id             uuid references quizzes(id) on delete set null,
  quiz_title          text not null default '',
  status              text not null default 'lobby',
  -- Ordre des questions figé au lancement de la partie
  question_ids        uuid[] not null default '{}',
  current_index       int not null default -1,
  question_started_at timestamptz,
  -- Fin de l'étape en cours (règles, question ou pause) : la partie avance seule à cette heure
  phase_ends_at       timestamptz,
  -- Temps restant mémorisé quand l'admin met la partie en pause
  paused_remaining_ms int,
  -- Réglages du quiz copiés au lancement
  answer_time         int not null default 20,
  pause_time          int not null default 10,
  intro_time          int not null default 20,
  -- Modifié à chaque changement (équipe, réponse, étape) pour notifier les écrans en temps réel
  version             bigint not null default 0,
  created_at          timestamptz not null default now()
);

-- Mise à jour d'une base créée avec une version précédente de ce script (sans effet sinon)
alter table quizzes add column if not exists answer_time int not null default 20;
alter table quizzes add column if not exists pause_time  int not null default 10;
alter table quizzes add column if not exists intro_time  int not null default 20;
alter table games add column if not exists phase_ends_at       timestamptz;
alter table games add column if not exists paused_remaining_ms int;
alter table games add column if not exists answer_time int not null default 20;
alter table games add column if not exists pause_time  int not null default 10;
alter table games add column if not exists intro_time  int not null default 20;
alter table games drop constraint if exists games_status_check;
alter table games add constraint games_status_check
  check (status in ('lobby', 'intro', 'question', 'reveal', 'leaderboard', 'finished'));

create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  name        text not null,
  token       text not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists teams_unique_name on teams (game_id, lower(name));

create table if not exists answers (
  id            uuid primary key default gen_random_uuid(),
  game_id       uuid not null references games(id) on delete cascade,
  team_id       uuid not null references teams(id) on delete cascade,
  question_id   uuid not null references questions(id) on delete cascade,
  choice_index  int  not null,
  is_correct    boolean not null,
  points        int  not null default 0,
  created_at    timestamptz not null default now(),
  -- Une seule réponse par équipe et par question : impossible de la modifier
  unique (team_id, question_id)
);
create index if not exists answers_game on answers (game_id);

-- ---------------------------------------------------------------------------
-- Sécurité : tout passe par les routes API (clé service_role).
-- Seule la table "games" (aucune donnée sensible) est lisible publiquement,
-- pour que les écrans reçoivent les notifications temps réel.
-- ---------------------------------------------------------------------------
alter table quizzes   enable row level security;
alter table questions enable row level security;
alter table games     enable row level security;
alter table teams     enable row level security;
alter table answers   enable row level security;

drop policy if exists "games are readable" on games;
create policy "games are readable" on games for select to anon, authenticated using (true);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
     ) then
    alter publication supabase_realtime add table games;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Stockage des médias (images et extraits audio), lecture publique
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('media', 'media', true)
    on conflict (id) do update set public = true;
  end if;
end $$;
