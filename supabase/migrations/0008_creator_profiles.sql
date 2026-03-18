-- ─── Migration: Organization-Based Project Ownership ─────────────────────────
--
-- Introduces creator profiles as the ownership entity for projects. A creator
-- profile can be either an individual (1:1 with a user) or an organization
-- (many users via organization_members).
--
-- Projects shift from creator_id → users(id) to creator_profile_id → creator_profiles(id).
-- Existing projects are migrated to individual profiles auto-created for their creators.
--
-- Tables where creator_id remains unchanged (user attribution, not ownership):
--   features, conversations, messages, data_points, perspectives, sketches,
--   project_updates, analytical_frameworks

-- ─── New Tables ─────────────────────────────────────────────────────────────

CREATE TABLE public.creator_profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL CHECK (type IN ('individual', 'organization')),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  avatar      TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX creator_profiles_slug_idx ON public.creator_profiles (slug);
CREATE INDEX creator_profiles_type_idx ON public.creator_profiles (type);

-- 1:1 link between individual profiles and their user
CREATE TABLE public.creator_profile_users (
  creator_profile_id  UUID PRIMARY KEY REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX creator_profile_users_user_id_idx ON public.creator_profile_users (user_id);

-- Organization membership
CREATE TABLE public.organization_members (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_profile_id  UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role                TEXT NOT NULL DEFAULT 'member'
                        CHECK (role IN ('owner', 'admin', 'member')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (creator_profile_id, user_id)
);

CREATE INDEX organization_members_user_id_idx ON public.organization_members (user_id);
CREATE INDEX organization_members_profile_id_idx ON public.organization_members (creator_profile_id);

-- Organization invitations
CREATE TABLE public.organization_invitations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_profile_id  UUID NOT NULL REFERENCES public.creator_profiles(id) ON DELETE CASCADE,
  invitee_email       TEXT NOT NULL,
  role                TEXT NOT NULL DEFAULT 'member'
                        CHECK (role IN ('admin', 'member')),
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'expired', 'declined')),
  expiration          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX org_invitations_email_idx ON public.organization_invitations (invitee_email);
CREATE INDEX org_invitations_profile_id_idx ON public.organization_invitations (creator_profile_id);

-- ─── Migrate projects.creator_id → creator_profile_id ───────────────────────

-- Add the new column (nullable initially for migration)
ALTER TABLE public.projects
  ADD COLUMN creator_profile_id UUID REFERENCES public.creator_profiles(id);

-- Create individual profiles for every distinct project creator
-- and link them via creator_profile_users
DO $$
DECLARE
  r RECORD;
  new_profile_id UUID;
  user_slug TEXT;
  slug_suffix INT;
BEGIN
  FOR r IN
    SELECT DISTINCT u.id, u.name_first, u.name_last, u.avatar, u.email
    FROM public.users u
    WHERE u.user_type IN ('project_creator', 'admin')
       OR u.id IN (SELECT creator_id FROM public.projects)
  LOOP
    -- Generate a URL-safe slug from the user's name
    user_slug := lower(regexp_replace(
      trim(r.name_first || '-' || r.name_last),
      '[^a-zA-Z0-9-]', '-', 'g'
    ));
    user_slug := regexp_replace(user_slug, '-+', '-', 'g');
    user_slug := trim(BOTH '-' FROM user_slug);

    -- Handle empty slug
    IF user_slug = '' OR user_slug IS NULL THEN
      user_slug := 'user-' || substring(r.id::text, 1, 8);
    END IF;

    -- Ensure slug uniqueness
    slug_suffix := 0;
    LOOP
      IF slug_suffix = 0 THEN
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.creator_profiles WHERE slug = user_slug
        );
      ELSE
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.creator_profiles WHERE slug = user_slug || '-' || slug_suffix
        );
      END IF;
      slug_suffix := slug_suffix + 1;
    END LOOP;

    IF slug_suffix > 0 THEN
      user_slug := user_slug || '-' || slug_suffix;
    END IF;

    -- Create the individual profile
    INSERT INTO public.creator_profiles (id, type, name, slug, avatar, description)
    VALUES (
      uuid_generate_v4(),
      'individual',
      trim(r.name_first || ' ' || r.name_last),
      user_slug,
      r.avatar,
      ''
    )
    RETURNING id INTO new_profile_id;

    -- Link profile to user
    INSERT INTO public.creator_profile_users (creator_profile_id, user_id)
    VALUES (new_profile_id, r.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update all projects owned by this user
    UPDATE public.projects
    SET creator_profile_id = new_profile_id
    WHERE creator_id = r.id;
  END LOOP;
END;
$$;

-- Make creator_profile_id NOT NULL now that all rows are populated
ALTER TABLE public.projects ALTER COLUMN creator_profile_id SET NOT NULL;

-- Create index for the new FK
CREATE INDEX projects_creator_profile_id_idx ON public.projects (creator_profile_id);

-- Keep creator_id column for now but make it nullable (backward compat during rollout)
-- It will be dropped in a future migration after all code references are verified.
ALTER TABLE public.projects ALTER COLUMN creator_id DROP NOT NULL;

-- ─── SECURITY DEFINER helper: can the current user manage a project? ────────

CREATE OR REPLACE FUNCTION public.user_can_manage_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.creator_profiles cp ON cp.id = p.creator_profile_id
    LEFT JOIN public.creator_profile_users cpu ON cpu.creator_profile_id = cp.id
    LEFT JOIN public.organization_members om ON om.creator_profile_id = cp.id
    WHERE p.id = p_project_id
      AND (
        -- Individual profile: the user owns the profile
        (cp.type = 'individual' AND cpu.user_id = auth.uid())
        OR
        -- Organization: the user is an owner or admin
        (cp.type = 'organization' AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
      )
  );
$$;

-- Helper: can the current user manage a creator profile?
CREATE OR REPLACE FUNCTION public.user_can_manage_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.creator_profiles cp
    LEFT JOIN public.creator_profile_users cpu ON cpu.creator_profile_id = cp.id
    LEFT JOIN public.organization_members om ON om.creator_profile_id = cp.id
    WHERE cp.id = p_profile_id
      AND (
        (cp.type = 'individual' AND cpu.user_id = auth.uid())
        OR
        (cp.type = 'organization' AND om.user_id = auth.uid() AND om.role IN ('owner', 'admin'))
      )
  );
$$;

-- Helper: is the current user a member of this profile (any role)?
CREATE OR REPLACE FUNCTION public.user_is_profile_member(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.creator_profile_users
    WHERE creator_profile_id = p_profile_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE creator_profile_id = p_profile_id AND user_id = auth.uid()
  );
$$;

-- ─── Replace RLS Policies: Projects ─────────────────────────────────────────

-- Drop old ownership policy
DROP POLICY IF EXISTS "Creators can do anything with their projects" ON public.projects;

-- New: profile managers can do anything with their projects
CREATE POLICY "Profile managers can manage their projects"
  ON public.projects FOR ALL
  USING (public.user_can_manage_project(id));

-- "Public projects viewable by all" and "Project access holders can view projects"
-- remain unchanged.

-- ─── Replace RLS Policies: Project Access ───────────────────────────────────

DROP POLICY IF EXISTS "Project creators can manage access" ON public.project_access;

CREATE POLICY "Project managers can manage access"
  ON public.project_access FOR ALL
  USING (public.user_can_manage_project(project_id));

-- ─── Replace RLS Policies: Features ────────────────────────────────────────

DROP POLICY IF EXISTS "Project creators can manage features" ON public.features;

CREATE POLICY "Project managers can manage features"
  ON public.features FOR ALL
  USING (public.user_can_manage_project(project_id));

-- ─── Replace RLS Policies: Conversations ────────────────────────────────────

DROP POLICY IF EXISTS "Project creators can view all conversations" ON public.conversations;

CREATE POLICY "Project managers can view all conversations"
  ON public.conversations FOR SELECT
  USING (public.user_can_manage_project(project_id));

-- ─── Replace RLS Policies: Messages ─────────────────────────────────────────

DROP POLICY IF EXISTS "Project creators can view all messages" ON public.messages;

CREATE POLICY "Project managers can view all messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND public.user_can_manage_project(c.project_id)
    )
  );

-- ─── Replace RLS Policies: Data Points ──────────────────────────────────────

DROP POLICY IF EXISTS "Data points visible to project access holders" ON public.data_points;

CREATE POLICY "Data points visible to project access holders"
  ON public.data_points FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.data_points.project_id
        AND user_id = auth.uid()
    )
    OR public.user_can_manage_project(project_id)
  );

-- ─── Replace RLS Policies: Themes ───────────────────────────────────────────

DROP POLICY IF EXISTS "Themes visible to project access holders" ON public.themes;

CREATE POLICY "Themes visible to project access holders"
  ON public.themes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.themes.project_id
        AND user_id = auth.uid()
    )
    OR public.user_can_manage_project(project_id)
  );

-- ─── Replace RLS Policies: Project Files ────────────────────────────────────

DROP POLICY IF EXISTS "Project files viewable by project access holders" ON public.project_files;
DROP POLICY IF EXISTS "Project creators can manage files" ON public.project_files;

CREATE POLICY "Project files viewable by project access holders"
  ON public.project_files FOR SELECT
  USING (
    public.user_can_manage_project(project_id)
    OR EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND publicly_visible = TRUE
    )
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.project_files.project_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project managers can manage files"
  ON public.project_files FOR ALL
  USING (public.user_can_manage_project(project_id));

-- ─── Replace RLS Policies: Project Updates ──────────────────────────────────

DROP POLICY IF EXISTS "Project updates viewable by all for public projects" ON public.project_updates;
DROP POLICY IF EXISTS "Project creators can manage updates" ON public.project_updates;

CREATE POLICY "Project updates viewable by all for public projects"
  ON public.project_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND publicly_visible = TRUE
    )
    OR public.user_can_manage_project(project_id)
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.project_updates.project_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project managers can manage updates"
  ON public.project_updates FOR ALL
  USING (public.user_can_manage_project(project_id));

-- ─── Replace RLS Policies: Analytical Frameworks ────────────────────────────

DROP POLICY IF EXISTS "Analytical frameworks viewable by project access holders" ON public.analytical_frameworks;
DROP POLICY IF EXISTS "Project creators can manage frameworks" ON public.analytical_frameworks;

CREATE POLICY "Analytical frameworks viewable by project access holders"
  ON public.analytical_frameworks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND publicly_visible = TRUE
    )
    OR public.user_can_manage_project(project_id)
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.analytical_frameworks.project_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Project managers can manage frameworks"
  ON public.analytical_frameworks FOR ALL
  USING (public.user_can_manage_project(project_id));

-- ─── Replace RLS Policies: Perspectives & Sketches ──────────────────────────

DROP POLICY IF EXISTS "Perspectives viewable for accessible projects" ON public.perspectives;

CREATE POLICY "Perspectives viewable for accessible projects"
  ON public.perspectives FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND publicly_visible = TRUE
    )
    OR public.user_can_manage_project(project_id)
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.perspectives.project_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sketches viewable for accessible projects" ON public.sketches;

CREATE POLICY "Sketches viewable for accessible projects"
  ON public.sketches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND publicly_visible = TRUE
    )
    OR public.user_can_manage_project(project_id)
    OR EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.sketches.project_id AND user_id = auth.uid()
    )
  );

-- ─── Replace RLS Policies: Invitations ──────────────────────────────────────

DROP POLICY IF EXISTS "Project creators can manage invitations" ON public.invitations;

CREATE POLICY "Project managers can manage invitations"
  ON public.invitations FOR ALL
  USING (public.user_can_manage_project(project_id));

-- ─── RLS: New Tables ────────────────────────────────────────────────────────

ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profile_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Creator Profiles: public read, managers can modify
CREATE POLICY "Creator profiles are publicly readable"
  ON public.creator_profiles FOR SELECT
  USING (true);

CREATE POLICY "Profile managers can update their profile"
  ON public.creator_profiles FOR UPDATE
  USING (public.user_can_manage_profile(id));

CREATE POLICY "Authenticated users can create profiles"
  ON public.creator_profiles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Profile managers can delete their profile"
  ON public.creator_profiles FOR DELETE
  USING (public.user_can_manage_profile(id));

-- Creator Profile Users: linked user can read their own; system-managed inserts
CREATE POLICY "Users can view their own profile link"
  ON public.creator_profile_users FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can link profiles"
  ON public.creator_profile_users FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Organization Members: members can view their org; managers can modify
CREATE POLICY "Org members can view membership"
  ON public.organization_members FOR SELECT
  USING (public.user_is_profile_member(creator_profile_id));

CREATE POLICY "Org managers can manage members"
  ON public.organization_members FOR ALL
  USING (public.user_can_manage_profile(creator_profile_id));

-- Organization Invitations: invitees can view; managers can manage
CREATE POLICY "Invitees can view their org invitations"
  ON public.organization_invitations FOR SELECT
  USING (
    invitee_email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

CREATE POLICY "Org managers can manage invitations"
  ON public.organization_invitations FOR ALL
  USING (public.user_can_manage_profile(creator_profile_id));

-- ─── Grants for new tables ──────────────────────────────────────────────────

GRANT SELECT ON public.creator_profiles          TO anon, authenticated;
GRANT SELECT ON public.creator_profile_users     TO anon, authenticated;
GRANT SELECT ON public.organization_members      TO anon, authenticated;
GRANT SELECT ON public.organization_invitations  TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.creator_profiles          TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.creator_profile_users     TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.organization_members      TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.organization_invitations  TO authenticated;

-- ─── Update Storage Policies ────────────────────────────────────────────────
-- Replace storage policies that check projects.creator_id with user_can_manage_project

DROP POLICY IF EXISTS "project_images_authorized_insert" ON storage.objects;
DROP POLICY IF EXISTS "project_images_authorized_update" ON storage.objects;
DROP POLICY IF EXISTS "project_images_authorized_delete" ON storage.objects;

CREATE POLICY "project_images_authorized_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-images'
    AND (
      public.user_can_manage_project((storage.foldername(name))[1]::uuid)
      OR EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id::text = (storage.foldername(name))[1]
          AND user_id = auth.uid()
          AND 'manage_files' = ANY(permissions)
      )
    )
  );

CREATE POLICY "project_images_authorized_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-images'
    AND (
      public.user_can_manage_project((storage.foldername(name))[1]::uuid)
      OR EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id::text = (storage.foldername(name))[1]
          AND user_id = auth.uid()
          AND 'manage_files' = ANY(permissions)
      )
    )
  );

CREATE POLICY "project_images_authorized_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-images'
    AND (
      public.user_can_manage_project((storage.foldername(name))[1]::uuid)
      OR EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id::text = (storage.foldername(name))[1]
          AND user_id = auth.uid()
          AND 'manage_files' = ANY(permissions)
      )
    )
  );

DROP POLICY IF EXISTS "project_files_member_select" ON storage.objects;
DROP POLICY IF EXISTS "project_files_manage_insert" ON storage.objects;
DROP POLICY IF EXISTS "project_files_manage_delete" ON storage.objects;

CREATE POLICY "project_files_member_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      public.user_can_manage_project((storage.foldername(name))[1]::uuid)
      OR EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id::text = (storage.foldername(name))[1]
          AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "project_files_manage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files'
    AND (
      public.user_can_manage_project((storage.foldername(name))[1]::uuid)
      OR EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id::text = (storage.foldername(name))[1]
          AND user_id = auth.uid()
          AND 'manage_files' = ANY(permissions)
      )
    )
  );

CREATE POLICY "project_files_manage_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files'
    AND (
      public.user_can_manage_project((storage.foldername(name))[1]::uuid)
      OR EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id::text = (storage.foldername(name))[1]
          AND user_id = auth.uid()
          AND 'manage_files' = ANY(permissions)
      )
    )
  );
