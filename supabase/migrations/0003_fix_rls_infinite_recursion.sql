-- ─── Fix infinite recursion in RLS policies ───────────────────────────────────
--
-- The cycle:
--   SELECT on projects
--     → "Project access holders can view projects" queries project_access
--       → "Project creators can manage access" on project_access queries projects
--         → triggers projects RLS again → infinite recursion (error 42P17)
--
-- Fix: replace the project_access policy that queries projects with a
-- SECURITY DEFINER function. SECURITY DEFINER runs as the function owner
-- (postgres), bypassing RLS on the projects table, breaking the cycle.

CREATE OR REPLACE FUNCTION public.requesting_user_is_project_creator(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id
      AND creator_id = auth.uid()
  );
$$;

-- Replace the recursive policy on project_access
DROP POLICY IF EXISTS "Project creators can manage access" ON public.project_access;

CREATE POLICY "Project creators can manage access"
  ON public.project_access FOR ALL
  USING (public.requesting_user_is_project_creator(project_id));
