-- Talwa Initial Schema Migration
-- Run this against a fresh Supabase project with PostGIS enabled

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
-- pg_cron and pg_net must be enabled in the Supabase dashboard (Database > Extensions)
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";
-- CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name_first  TEXT NOT NULL DEFAULT '',
  name_last   TEXT NOT NULL DEFAULT '',
  avatar      TEXT,
  email       TEXT NOT NULL,
  user_type   TEXT NOT NULL DEFAULT 'community_contributor'
                CHECK (user_type IN ('community_contributor', 'project_creator', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-create users row when auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, user_type)
  VALUES (NEW.id, NEW.email, 'community_contributor')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Projects ─────────────────────────────────────────────────────────────────

CREATE TABLE public.projects (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  short_description   TEXT NOT NULL DEFAULT '',
  long_description    TEXT NOT NULL DEFAULT '',
  featured_image      TEXT,
  contributor_count   INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  location            TEXT NOT NULL DEFAULT '',
  publicly_visible    BOOLEAN NOT NULL DEFAULT FALSE,
  creator_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dialogue_framework  TEXT[] NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX projects_creator_id_idx ON public.projects (creator_id);
CREATE INDEX projects_status_public_idx ON public.projects (status, publicly_visible);

-- ─── Project Followers ────────────────────────────────────────────────────────

CREATE TABLE public.project_followers (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- ─── Project Access ───────────────────────────────────────────────────────────

CREATE TABLE public.project_access (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  role        TEXT NOT NULL DEFAULT 'contributor',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, project_id)
);

CREATE INDEX project_access_project_id_idx ON public.project_access (project_id);
CREATE INDEX project_access_user_id_idx ON public.project_access (user_id);

-- ─── Invitations ─────────────────────────────────────────────────────────────

CREATE TABLE public.invitations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invitee_email         TEXT NOT NULL,
  invitee_first_name    TEXT NOT NULL DEFAULT '',
  invitee_last_name     TEXT NOT NULL DEFAULT '',
  project_id            UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  permissions           TEXT[] NOT NULL DEFAULT '{}',
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'expired', 'declined')),
  expiration            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX invitations_email_idx ON public.invitations (invitee_email);
CREATE INDEX invitations_project_id_idx ON public.invitations (project_id);

-- ─── Features ─────────────────────────────────────────────────────────────────

CREATE TABLE public.features (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'other'
                CHECK (type IN ('path', 'park', 'plaza', 'landmark', 'other')),
  description TEXT NOT NULL DEFAULT '',
  geojson     JSONB NOT NULL,
  -- Generated geometry column for spatial queries
  geometry    GEOMETRY(Geometry, 4326) GENERATED ALWAYS AS (
                ST_SetSRID(
                  ST_GeomFromGeoJSON(geojson::TEXT),
                  4326
                )
              ) STORED,
  creator_id  UUID NOT NULL REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX features_project_id_idx ON public.features (project_id);
CREATE INDEX features_geom_idx ON public.features USING GIST (geometry);

-- ─── Perspectives ─────────────────────────────────────────────────────────────

CREATE TABLE public.perspectives (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_id  UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  image       TEXT NOT NULL,
  caption     TEXT NOT NULL DEFAULT '',
  creator_id  UUID NOT NULL REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX perspectives_feature_id_idx ON public.perspectives (feature_id);

-- ─── Sketches ─────────────────────────────────────────────────────────────────

CREATE TABLE public.sketches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  feature_id      UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  perspective_id  UUID REFERENCES public.perspectives(id) ON DELETE SET NULL,
  image           TEXT NOT NULL,
  caption         TEXT NOT NULL DEFAULT '',
  creator_id      UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sketches_project_id_idx ON public.sketches (project_id);
CREATE INDEX sketches_feature_id_idx ON public.sketches (feature_id);

-- ─── Conversations ────────────────────────────────────────────────────────────

CREATE TABLE public.conversations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  creator_id          UUID NOT NULL REFERENCES public.users(id),
  last_message_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extraction_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (extraction_status IN ('pending', 'processing', 'complete', 'failed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, creator_id)
);

CREATE INDEX conversations_project_id_idx ON public.conversations (project_id);
CREATE INDEX conversations_creator_id_idx ON public.conversations (creator_id);
-- Partial index for extraction cron query
CREATE INDEX conversations_extraction_idx ON public.conversations (extraction_status, last_message_at)
  WHERE extraction_status = 'pending';

-- ─── Messages ─────────────────────────────────────────────────────────────────

CREATE TABLE public.messages (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id         UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender                  TEXT NOT NULL CHECK (sender IN ('human', 'ai_facilitator')),
  content                 TEXT NOT NULL,
  referenced_feature_ids  TEXT[] NOT NULL DEFAULT '{}',
  location                JSONB,  -- { lat: number, lng: number } | null
  creator_id              UUID NOT NULL REFERENCES public.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX messages_conversation_id_idx ON public.messages (conversation_id);
CREATE INDEX messages_created_at_idx ON public.messages (conversation_id, created_at);

-- Trigger: update last_message_at when a message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NOW(),
      extraction_status = CASE
        WHEN extraction_status = 'complete' THEN 'pending'
        ELSE extraction_status
      END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

-- ─── Analytical Frameworks ────────────────────────────────────────────────────

CREATE TABLE public.analytical_frameworks (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  research_questions  TEXT[] NOT NULL DEFAULT '{}',
  creator_id          UUID NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id)  -- One framework per project for now
);

-- ─── Data Points ──────────────────────────────────────────────────────────────

CREATE TABLE public.data_points (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id     UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content             TEXT NOT NULL,
  research_question   TEXT NOT NULL,
  feature_id          UUID REFERENCES public.features(id) ON DELETE SET NULL,
  location            JSONB,  -- { lat: number, lng: number } | null
  theme_ids           TEXT[] NOT NULL DEFAULT '{}',
  creator_id          UUID NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX data_points_project_id_idx ON public.data_points (project_id);
CREATE INDEX data_points_feature_id_idx ON public.data_points (feature_id);
CREATE INDEX data_points_conversation_id_idx ON public.data_points (conversation_id);

-- ─── Themes ───────────────────────────────────────────────────────────────────

CREATE TABLE public.themes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  summary             TEXT NOT NULL,
  research_question   TEXT NOT NULL,
  creator_id          UUID NOT NULL REFERENCES public.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX themes_project_id_idx ON public.themes (project_id);

-- ─── Project Files ────────────────────────────────────────────────────────────

CREATE TABLE public.project_files (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX project_files_project_id_idx ON public.project_files (project_id);

-- ─── Project Updates ──────────────────────────────────────────────────────────

CREATE TABLE public.project_updates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  creator_id  UUID NOT NULL REFERENCES public.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX project_updates_project_id_idx ON public.project_updates (project_id);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'unread'
                CHECK (status IN ('unread', 'read')),
  type        TEXT NOT NULL
                CHECK (type IN ('new_update', 'new_insight', 'access_granted', 'invitation')),
  link        TEXT NOT NULL DEFAULT '',
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_id_status_idx ON public.notifications (user_id, status);
CREATE INDEX notifications_project_id_idx ON public.notifications (project_id);

-- ─── Dialogue Templates ───────────────────────────────────────────────────────

CREATE TABLE public.dialogue_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  questions   TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perspectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sketches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytical_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dialogue_templates ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies: Users ──────────────────────────────────────────────────────

CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles of project collaborators"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_access pa1
      JOIN public.project_access pa2 ON pa1.project_id = pa2.project_id
      WHERE pa1.user_id = auth.uid()
        AND pa2.user_id = public.users.id
    )
  );

-- ─── RLS Policies: Projects ───────────────────────────────────────────────────

CREATE POLICY "Public projects viewable by all"
  ON public.projects FOR SELECT
  USING (publicly_visible = TRUE AND status = 'active');

CREATE POLICY "Creators can do anything with their projects"
  ON public.projects FOR ALL
  USING (auth.uid() = creator_id);

CREATE POLICY "Project access holders can view projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.projects.id
        AND user_id = auth.uid()
    )
  );

-- ─── RLS Policies: Project Access ─────────────────────────────────────────────

CREATE POLICY "Users can view their own project access"
  ON public.project_access FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Project creators can manage access"
  ON public.project_access FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND creator_id = auth.uid()
    )
  );

-- ─── RLS Policies: Features ───────────────────────────────────────────────────

CREATE POLICY "Features of public projects are viewable"
  ON public.features FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND publicly_visible = TRUE
        AND status = 'active'
    )
  );

CREATE POLICY "Project creators can manage features"
  ON public.features FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Access holders can view features"
  ON public.features FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.features.project_id
        AND user_id = auth.uid()
    )
  );

-- ─── RLS Policies: Conversations ──────────────────────────────────────────────

CREATE POLICY "Contributors see their own conversations"
  ON public.conversations FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "Contributors can insert conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Contributors can update their own conversations"
  ON public.conversations FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "Project creators can view all conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND creator_id = auth.uid()
    )
  );

-- ─── RLS Policies: Messages ───────────────────────────────────────────────────

CREATE POLICY "Users see messages in their own conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their own conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    creator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Project creators can view all messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = conversation_id AND p.creator_id = auth.uid()
    )
  );

-- ─── RLS Policies: Data Points & Themes ──────────────────────────────────────

CREATE POLICY "Data points visible to project access holders"
  ON public.data_points FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.data_points.project_id
        AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = public.data_points.project_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Themes visible to project access holders"
  ON public.themes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.themes.project_id
        AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = public.themes.project_id AND creator_id = auth.uid()
    )
  );

-- ─── RLS Policies: Notifications ─────────────────────────────────────────────

CREATE POLICY "Users see their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ─── RLS Policies: Project Files & Updates ───────────────────────────────────

CREATE POLICY "Project files viewable by project access holders"
  ON public.project_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND (
          creator_id = auth.uid()
          OR publicly_visible = TRUE
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.project_files.project_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project creators can manage files"
  ON public.project_files FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Project updates viewable by all for public projects"
  ON public.project_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND (
          publicly_visible = TRUE
          OR creator_id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.project_updates.project_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project creators can manage updates"
  ON public.project_updates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND creator_id = auth.uid()
    )
  );

-- ─── RLS Policies: Analytical Frameworks ─────────────────────────────────────

CREATE POLICY "Analytical frameworks viewable by project access holders"
  ON public.analytical_frameworks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND (
          creator_id = auth.uid()
          OR publicly_visible = TRUE
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.analytical_frameworks.project_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project creators can manage frameworks"
  ON public.analytical_frameworks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND creator_id = auth.uid()
    )
  );

-- ─── RLS Policies: Perspectives & Sketches ───────────────────────────────────

CREATE POLICY "Perspectives viewable for accessible projects"
  ON public.perspectives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND (publicly_visible = TRUE OR creator_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.perspectives.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Sketches viewable for accessible projects"
  ON public.sketches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND (publicly_visible = TRUE OR creator_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.sketches.project_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Contributors can insert sketches"
  ON public.sketches FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- ─── RLS Policies: Dialogue Templates ────────────────────────────────────────

CREATE POLICY "Dialogue templates readable by all authenticated users"
  ON public.dialogue_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ─── RLS Policies: Project Followers & Invitations ───────────────────────────

CREATE POLICY "Users can follow/unfollow projects"
  ON public.project_followers FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view invitations sent to them"
  ON public.invitations FOR SELECT
  USING (invitee_email = (SELECT email FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Project creators can manage invitations"
  ON public.invitations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND creator_id = auth.uid()
    )
  );

-- ─── Storage Buckets (run in Supabase dashboard or via API) ──────────────────
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-images', 'project-images', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('sketches', 'sketches', true);

-- ─── pg_cron Job (enable pg_cron extension first in Supabase dashboard) ───────
-- Run after enabling pg_cron and pg_net extensions:
--
-- SELECT cron.schedule(
--   'trigger-extraction',
--   '*/2 * * * *',
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.supabase_functions_url') || '/trigger-extraction',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.extraction_secret')
--     ),
--     body := '{}'::jsonb
--   )
--   $$
-- );
--
-- Set the config values:
-- ALTER DATABASE postgres SET app.supabase_functions_url = 'https://<project-ref>.supabase.co/functions/v1';
-- ALTER DATABASE postgres SET app.extraction_secret = '<your-extraction-secret>';
