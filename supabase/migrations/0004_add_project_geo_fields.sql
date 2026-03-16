-- Add geographic fields to projects for the explore map and neighborhood filtering
-- lat/lng: WGS84 coordinates for the project's primary location (used for map markers and bounds)
-- neighborhood: human-readable neighborhood name extracted + verified via Mapbox Geocoding
--   (populate via POST /api/admin/geocode-projects after running this migration)

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS lat  FLOAT8,
  ADD COLUMN IF NOT EXISTS lng  FLOAT8,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- Index for filtering by neighborhood on the explore page
CREATE INDEX IF NOT EXISTS projects_neighborhood_idx ON public.projects (neighborhood);
-- Index for bounding-box queries (lat/lng range)
CREATE INDEX IF NOT EXISTS projects_lat_lng_idx ON public.projects (lat, lng);
