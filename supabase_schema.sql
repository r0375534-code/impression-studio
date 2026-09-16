-- ==============================================================================
-- AI IMPRESSION ANALYZER PRO - COMPLETE SUPABASE DATABASE SCHEMA
-- Project: https://pcmzhxaokahnxgjwsobm.supabase.co
--
-- HOW TO RUN:
-- 1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/pcmzhxaokahnxgjwsobm
-- 2. Click "SQL Editor" in the left sidebar (icon with '>_')
-- 3. Click "New query"
-- 4. Copy and paste all the code below
-- 5. Click "Run" (or press Ctrl+Enter / Cmd+Enter)
--
-- This script safely creates all tables, indexes, triggers, RLS policies,
-- and enables Realtime for presence, battles, notifications & follows.
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================================================
-- 1. PROFILES TABLE
-- Stores user details, coins, skills, bio, and online presence status
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  college TEXT,
  skills TEXT[] DEFAULT '{}'::TEXT[],
  bio TEXT,
  coins INTEGER DEFAULT 25,
  online_status TEXT DEFAULT 'offline',
  last_seen TIMESTAMPTZ DEFAULT now(),
  avatar TEXT,
  face_descriptor FLOAT8[], -- 128-d face recognition descriptor embeddings
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist if table was already partially created
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS college TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}'::TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 25;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS online_status TEXT DEFAULT 'offline';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS face_descriptor FLOAT8[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ==============================================================================
-- 2. ANALYSIS SESSIONS TABLE
-- Stores results of body posture, face warmth, eye contact, and voice analyses
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  score NUMERIC DEFAULT 0,
  metrics JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_sessions_user ON public.analysis_sessions(user_id, created_at DESC);

-- ==============================================================================
-- 3. USER STATS TABLE
-- Tracks gamification XP, levels, and consecutive day streaks
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 150,
  level INTEGER DEFAULT 1,
  current_streak INTEGER DEFAULT 1,
  longest_streak INTEGER DEFAULT 1,
  last_session_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_user ON public.user_stats(user_id);

-- ==============================================================================
-- 4. USER ACHIEVEMENTS TABLE
-- Stores unlocked badges (first_session, streak_3, streak_7, high_scorer, etc.)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_code TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_achievements_user_code_key UNIQUE (user_id, achievement_code)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON public.user_achievements(user_id);

-- ==============================================================================
-- 5. FOLLOWS TABLE (SOCIAL CONNECTIONS)
-- Stores follower relationships and request status ('pending', 'accepted')
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  status TEXT DEFAULT 'accepted',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT follows_pair_key UNIQUE (follower_id, following_id)
);

ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted';
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- ==============================================================================
-- 6. NOTIFICATIONS TABLE
-- Realtime alerts for follow requests, 1v1 battle invites, results, and system msgs
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  meta TEXT DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS meta TEXT DEFAULT '{}';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- ==============================================================================
-- 7. BATTLES TABLE (1v1 DUEL ENGINE)
-- Records multi-user challenge duels, scores, and winners
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  duration INTEGER DEFAULT 120,
  status TEXT DEFAULT 'pending',
  challenger_score NUMERIC,
  opponent_score NUMERIC,
  winner_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battles_players ON public.battles(challenger_id, opponent_id);

-- ==============================================================================
-- 8. AUTO USER CREATION TRIGGER
-- Automatically populates profiles & user_stats upon signup in auth.users
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  clean_name TEXT;
  clean_handle TEXT;
BEGIN
  clean_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  clean_handle := LOWER(REGEXP_REPLACE(clean_name, '[^a-zA-Z0-9_]', '', 'g'));

  -- 1. Initialize profile
  INSERT INTO public.profiles (id, full_name, username, coins, online_status)
  VALUES (
    new.id,
    clean_name,
    clean_handle,
    25,
    'online'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    online_status = 'online',
    last_seen = now();

  -- 2. Initialize user stats
  INSERT INTO public.user_stats (user_id, xp, level, current_streak, longest_streak)
  VALUES (new.id, 150, 1, 1, 1)
  ON CONFLICT (user_id) DO NOTHING;

  -- 3. Award starter achievement
  INSERT INTO public.user_achievements (user_id, achievement_code)
  VALUES (new.id, 'first_session')
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- Enables secure reads, writes, and real-time operations
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

-- A) PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- B) ANALYSIS SESSIONS POLICIES
DROP POLICY IF EXISTS "sessions_select_all" ON public.analysis_sessions;
CREATE POLICY "sessions_select_all" ON public.analysis_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "sessions_insert_own" ON public.analysis_sessions;
CREATE POLICY "sessions_insert_own" ON public.analysis_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_update_own" ON public.analysis_sessions;
CREATE POLICY "sessions_update_own" ON public.analysis_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_delete_own" ON public.analysis_sessions;
CREATE POLICY "sessions_delete_own" ON public.analysis_sessions FOR DELETE USING (auth.uid() = user_id);

-- C) USER STATS POLICIES
DROP POLICY IF EXISTS "stats_select_all" ON public.user_stats;
CREATE POLICY "stats_select_all" ON public.user_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "stats_insert_own" ON public.user_stats;
CREATE POLICY "stats_insert_own" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "stats_update_own" ON public.user_stats;
CREATE POLICY "stats_update_own" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);

-- D) USER ACHIEVEMENTS POLICIES
DROP POLICY IF EXISTS "achievements_select_all" ON public.user_achievements;
CREATE POLICY "achievements_select_all" ON public.user_achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "achievements_insert_own" ON public.user_achievements;
CREATE POLICY "achievements_insert_own" ON public.user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- E) FOLLOWS POLICIES
DROP POLICY IF EXISTS "follows_select_all" ON public.follows;
CREATE POLICY "follows_select_all" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "follows_insert_auth" ON public.follows;
CREATE POLICY "follows_insert_auth" ON public.follows FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "follows_update_auth" ON public.follows;
CREATE POLICY "follows_update_auth" ON public.follows FOR UPDATE USING (true);

DROP POLICY IF EXISTS "follows_delete_auth" ON public.follows;
CREATE POLICY "follows_delete_auth" ON public.follows FOR DELETE USING (true);

-- F) NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert_any_auth" ON public.notifications;
CREATE POLICY "notif_insert_any_auth" ON public.notifications FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- G) BATTLES POLICIES
DROP POLICY IF EXISTS "battles_select_all" ON public.battles;
CREATE POLICY "battles_select_all" ON public.battles FOR SELECT USING (true);

DROP POLICY IF EXISTS "battles_insert_auth" ON public.battles;
CREATE POLICY "battles_insert_auth" ON public.battles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "battles_update_auth" ON public.battles;
CREATE POLICY "battles_update_auth" ON public.battles FOR UPDATE USING (true);

-- ==============================================================================
-- 10. REALTIME CONFIGURATION
-- Publish tables to supabase_realtime so updates push instantly via WebSockets
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.follows;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- Schema setup complete!
