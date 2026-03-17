-- ─── Storage Buckets ──────────────────────────────────────────────────────────
-- Creates the four buckets used by Talwa for image and file storage.
-- project-images and avatars are public (CDN-served).
-- project-files is private — access is via signed URLs only.
-- sketches is public — AI-generated and contributor-uploaded sketches.

INSERT INTO storage.buckets (id, name, public) VALUES
  ('sketches',       'sketches',       true),
  ('project-images', 'project-images', true),
  ('avatars',        'avatars',        true),
  ('project-files',  'project-files',  false)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS: avatars ─────────────────────────────────────────────────────────────
-- Public read. Owners can upload/update only their own avatar.
-- Path convention: avatars/{user_id}/avatar.{ext}

CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ─── RLS: project-images ──────────────────────────────────────────────────────
-- Public read. Project creators and users with manage_files permission can upload.
-- Path convention: project-images/{project_id}/featured.{ext}
--                  project-images/{project_id}/perspectives/{feature_id}/{timestamp}.{ext}

CREATE POLICY "project_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-images');

CREATE POLICY "project_images_authorized_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-images'
    AND (
      EXISTS (
        SELECT 1 FROM projects
        WHERE id::text = (storage.foldername(name))[1]
          AND creator_id = auth.uid()
      )
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
      EXISTS (
        SELECT 1 FROM projects
        WHERE id::text = (storage.foldername(name))[1]
          AND creator_id = auth.uid()
      )
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
      EXISTS (
        SELECT 1 FROM projects
        WHERE id::text = (storage.foldername(name))[1]
          AND creator_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id::text = (storage.foldername(name))[1]
          AND user_id = auth.uid()
          AND 'manage_files' = ANY(permissions)
      )
    )
  );

-- ─── RLS: sketches ────────────────────────────────────────────────────────────
-- Public read. Contributors with 'contribute' permission can upload to their project.
-- Server-side admin uploads (AI-generated) bypass RLS entirely.
-- Path convention: sketches/{project_id}/{user_id}/{timestamp}.png

CREATE POLICY "sketches_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sketches');

CREATE POLICY "sketches_contributor_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'sketches'
    AND EXISTS (
      SELECT 1 FROM project_access
      WHERE project_id::text = (storage.foldername(name))[1]
        AND user_id = auth.uid()
        AND 'contribute' = ANY(permissions)
    )
  );

CREATE POLICY "sketches_contributor_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'sketches'
    AND auth.uid()::text = (string_to_array(name, '/'))[2]
  );

-- ─── RLS: project-files ───────────────────────────────────────────────────────
-- No public read. Access only via signed URLs generated server-side.
-- Project creators and any project member can read.
-- Only creators and manage_files members can insert/delete.
-- Path convention: project-files/{project_id}/{timestamp}-{filename}

CREATE POLICY "project_files_member_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files'
    AND (
      EXISTS (
        SELECT 1 FROM projects
        WHERE id::text = (storage.foldername(name))[1]
          AND creator_id = auth.uid()
      )
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
      EXISTS (
        SELECT 1 FROM projects
        WHERE id::text = (storage.foldername(name))[1]
          AND creator_id = auth.uid()
      )
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
      EXISTS (
        SELECT 1 FROM projects
        WHERE id::text = (storage.foldername(name))[1]
          AND creator_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_access
        WHERE project_id::text = (storage.foldername(name))[1]
          AND user_id = auth.uid()
          AND 'manage_files' = ANY(permissions)
      )
    )
  );
