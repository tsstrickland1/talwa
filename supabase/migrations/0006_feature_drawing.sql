-- Migration: Feature Drawing Support
-- Adds source tracking for features and contributor draw permissions

-- Add source column to distinguish who drew the feature
ALTER TABLE public.features
  ADD COLUMN source TEXT NOT NULL DEFAULT 'creator'
    CHECK (source IN ('creator', 'contributor'));

-- Allow contributors with 'contribute' permission to insert features for projects they have access to
CREATE POLICY "Contributors can insert features"
  ON public.features FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_access
      WHERE project_id = public.features.project_id
        AND user_id = auth.uid()
        AND 'contribute' = ANY(permissions)
    )
  );

-- Contributors can delete only their own drawn features
CREATE POLICY "Contributors can delete their own features"
  ON public.features FOR DELETE
  USING (
    source = 'contributor'
    AND creator_id = auth.uid()
  );
