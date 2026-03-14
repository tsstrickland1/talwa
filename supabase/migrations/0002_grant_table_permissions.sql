-- ─── Grant table-level permissions to Supabase roles ─────────────────────────
--
-- RLS policies control row-level visibility, but without these grants the
-- `anon` and `authenticated` roles have no permission to touch the tables at
-- all. Missing grants cause Supabase to silently return null data instead of
-- throwing a visible error, which makes the symptom look like "no rows" rather
-- than a permission problem.
--
-- Pattern: grant broadly, restrict with RLS.
--   anon        → SELECT only (public read for things like public project list)
--   authenticated → full DML (RLS enforces what each user can actually do)

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.users                 TO anon, authenticated;
GRANT SELECT ON public.projects              TO anon, authenticated;
GRANT SELECT ON public.features              TO anon, authenticated;
GRANT SELECT ON public.conversations         TO anon, authenticated;
GRANT SELECT ON public.messages              TO anon, authenticated;
GRANT SELECT ON public.analytical_frameworks TO anon, authenticated;
GRANT SELECT ON public.data_points           TO anon, authenticated;
GRANT SELECT ON public.themes                TO anon, authenticated;
GRANT SELECT ON public.project_files         TO anon, authenticated;
GRANT SELECT ON public.project_updates       TO anon, authenticated;
GRANT SELECT ON public.project_followers     TO anon, authenticated;
GRANT SELECT ON public.project_access        TO anon, authenticated;
GRANT SELECT ON public.invitations           TO anon, authenticated;
GRANT SELECT ON public.perspectives          TO anon, authenticated;
GRANT SELECT ON public.sketches              TO anon, authenticated;
GRANT SELECT ON public.notifications         TO anon, authenticated;
GRANT SELECT ON public.dialogue_templates    TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON public.users                 TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projects              TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.features              TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.conversations         TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.messages              TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.analytical_frameworks TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.data_points           TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.themes                TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_files         TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_updates       TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_followers     TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.project_access        TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.invitations           TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.perspectives          TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sketches              TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.notifications         TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
