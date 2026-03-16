-- Backfill lat/lng/neighborhood for the two seeded Portland sample projects.
-- Idempotent: only updates rows where lat IS NULL so re-running is safe.

UPDATE public.projects
  SET lat          = 45.5175,
      lng          = -122.6680,
      neighborhood = 'Eastside Waterfront'
  WHERE name = 'Eastside Waterfront Park Redesign'
    AND lat IS NULL;

UPDATE public.projects
  SET lat          = 45.5043,
      lng          = -122.6370,
      neighborhood = 'SE Division Street'
  WHERE name = 'Division Street Complete Streets'
    AND lat IS NULL;
