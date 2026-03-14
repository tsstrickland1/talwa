-- ============================================================
-- Talwa Sample Data Seed Script
-- User: ts@tsstrickland.com
--
-- Run this in the Supabase SQL Editor (it runs as postgres/superuser,
-- so RLS is bypassed and all inserts will succeed).
--
-- What this script does:
--   1. Promotes ts@tsstrickland.com to project_creator
--   2. Creates two active, public-facing sample projects
--   3. Adds map features (with valid GeoJSON) for each project
--   4. Adds analytical frameworks, conversations, messages,
--      themes, and data points so the insights view is populated
-- ============================================================

DO $$
DECLARE
  v_user_id     UUID;

  -- Projects
  v_proj1_id    UUID;
  v_proj2_id    UUID;

  -- Features – Project 1 (Eastside Waterfront)
  v_f1_path_id      UUID;
  v_f1_plaza_id     UUID;
  v_f1_overlook_id  UUID;

  -- Features – Project 2 (Division Street)
  v_f2_corridor_id  UUID;
  v_f2_park_id      UUID;
  v_f2_node_id      UUID;

  -- Conversations
  v_conv1_id    UUID;
  v_conv2_id    UUID;

  -- Themes – Project 1
  v_t1_path_id      UUID;
  v_t1_fitness_id   UUID;
  v_t1_overlook_id  UUID;

  -- Themes – Project 2
  v_t2_cycling_id   UUID;
  v_t2_hotspot_id   UUID;
  v_t2_crossing_id  UUID;

BEGIN

  -- ─── 0. Resolve user ────────────────────────────────────────
  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'ts@tsstrickland.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'User ts@tsstrickland.com not found. Sign up first, then re-run this script.';
  END IF;

  -- ─── 1. Promote to project_creator ──────────────────────────
  UPDATE public.users
  SET user_type = 'project_creator'
  WHERE id = v_user_id;

  RAISE NOTICE 'Promoted user % to project_creator.', v_user_id;

  -- ─── 2. Project 1: Eastside Waterfront Park Redesign ────────
  INSERT INTO public.projects (
    name, short_description, long_description,
    status, publicly_visible, location,
    creator_id, dialogue_framework, contributor_count
  ) VALUES (
    'Eastside Waterfront Park Redesign',

    'Reimagining 12 acres of underutilized riverfront into a vibrant, '
    'accessible public space for all residents.',

    'The Eastside Waterfront Park Redesign project is a community-driven '
    'effort to transform a stretch of neglected riverbank into a dynamic '
    'public green space. This 12-acre site sits between the Hawthorne and '
    'Morrison bridges and currently offers little beyond a cracked walking '
    'path and a few aging benches. Our goal is to create a multi-use '
    'destination that serves walkers, cyclists, families, and ecological '
    'needs—while honoring the cultural history of the riverbank. Community '
    'input will shape everything from programming to plantings.',

    'active', TRUE,
    'Portland, OR — Eastside Waterfront',
    v_user_id,

    ARRAY[
      'How do you currently use the waterfront area, and what activities would you like to see supported there?',
      'What safety or accessibility concerns do you have about the current waterfront path and facilities?',
      'What natural or ecological features of the riverbank are most important to you?',
      'What community programming or events would make this park a destination for your neighborhood?'
    ],
    23
  ) RETURNING id INTO v_proj1_id;

  -- ─── 3. Project 2: Division Street Complete Streets ─────────
  INSERT INTO public.projects (
    name, short_description, long_description,
    status, publicly_visible, location,
    creator_id, dialogue_framework, contributor_count
  ) VALUES (
    'Division Street Complete Streets',

    'Redesigning a 1.2-mile corridor to prioritize pedestrian safety, '
    'cycling infrastructure, and transit access.',

    'Division Street is one of Portland''s most-traveled east–west '
    'corridors, but decades of car-centric design have left it unsafe '
    'for pedestrians and cyclists. This project studies the stretch '
    'from 20th to 50th Avenue and will develop a complete streets plan '
    'that balances the needs of all road users while supporting the '
    'vibrant mix of small businesses, schools, and residences along '
    'the corridor. Your experiences and priorities will directly inform '
    'the design alternatives presented to City Council.',

    'active', TRUE,
    'Portland, OR — SE Division Street (20th–50th Ave)',
    v_user_id,

    ARRAY[
      'How do you travel along Division Street today, and what makes your journey difficult or unsafe?',
      'What improvements would make you more likely to walk, bike, or take transit on Division Street?',
      'How do you feel proposed street changes might affect local businesses and neighborhood character?',
      'Which intersections or segments feel most dangerous to you, and why?'
    ],
    41
  ) RETURNING id INTO v_proj2_id;

  -- ─── 4. Features – Project 1 ────────────────────────────────

  -- Main walking/cycling path along the river (LineString)
  INSERT INTO public.features (project_id, name, type, description, geojson, creator_id)
  VALUES (
    v_proj1_id,
    'Willamette Promenade Path', 'path',
    'The main waterfront walking and cycling path running along the '
    'river''s edge. Currently cracked and narrow, this 1,800-metre '
    'route connects the two bridge endpoints.',
    '{"type":"LineString","coordinates":[[-122.6680,45.5165],[-122.6685,45.5190],[-122.6682,45.5215],[-122.6676,45.5238],[-122.6668,45.5255]]}'::jsonb,
    v_user_id
  ) RETURNING id INTO v_f1_path_id;

  -- Central gathering plaza (Polygon)
  INSERT INTO public.features (project_id, name, type, description, geojson, creator_id)
  VALUES (
    v_proj1_id,
    'Central Event Plaza', 'plaza',
    'A paved central gathering area near the midpoint of the park. '
    'Currently empty asphalt—proposed as a flexible event space with '
    'shade structures, seating, and a small stage.',
    '{"type":"Polygon","coordinates":[[[-122.6685,45.5200],[-122.6675,45.5200],[-122.6675,45.5210],[-122.6685,45.5210],[-122.6685,45.5200]]]}'::jsonb,
    v_user_id
  ) RETURNING id INTO v_f1_plaza_id;

  -- Elevated overlook point (Point landmark)
  INSERT INTO public.features (project_id, name, type, description, geojson, creator_id)
  VALUES (
    v_proj1_id,
    'River Overlook', 'landmark',
    'A natural elevated point offering panoramic views of the river '
    'and downtown skyline. Community members frequently cite this as '
    'the park''s most beloved spot.',
    '{"type":"Point","coordinates":[-122.6672,45.5230]}'::jsonb,
    v_user_id
  ) RETURNING id INTO v_f1_overlook_id;

  -- ─── 5. Features – Project 2 ────────────────────────────────

  -- Study corridor (LineString)
  INSERT INTO public.features (project_id, name, type, description, geojson, creator_id)
  VALUES (
    v_proj2_id,
    'Division Street Corridor', 'path',
    'The primary 1.2-mile study corridor from SE 20th to SE 50th '
    'Avenue. Five lanes of traffic with narrow sidewalks and no '
    'protected cycling infrastructure.',
    '{"type":"LineString","coordinates":[[-122.6490,45.5040],[-122.6430,45.5042],[-122.6370,45.5044],[-122.6310,45.5046],[-122.6250,45.5048]]}'::jsonb,
    v_user_id
  ) RETURNING id INTO v_f2_corridor_id;

  -- Adjacent neighborhood park (Polygon)
  INSERT INTO public.features (project_id, name, type, description, geojson, creator_id)
  VALUES (
    v_proj2_id,
    'Powell Park', 'park',
    'A neighborhood park adjacent to the corridor at SE 26th. '
    'Heavily used by families but poorly connected to the street—'
    'no safe crossing nearby.',
    '{"type":"Polygon","coordinates":[[[-122.6430,45.5030],[-122.6415,45.5030],[-122.6415,45.5045],[-122.6430,45.5045],[-122.6430,45.5030]]]}'::jsonb,
    v_user_id
  ) RETURNING id INTO v_f2_park_id;

  -- High-risk intersection (Point)
  INSERT INTO public.features (project_id, name, type, description, geojson, creator_id)
  VALUES (
    v_proj2_id,
    'SE 30th & Division Commercial Node', 'other',
    'A high-traffic commercial intersection with several restaurants '
    'and shops. Identified as the highest-priority safety hotspot—'
    'three pedestrian injuries in the past two years.',
    '{"type":"Point","coordinates":[-122.6370,45.5044]}'::jsonb,
    v_user_id
  ) RETURNING id INTO v_f2_node_id;

  -- ─── 6. Analytical Frameworks ───────────────────────────────

  INSERT INTO public.analytical_frameworks (project_id, name, research_questions, creator_id)
  VALUES (
    v_proj1_id,
    'Waterfront Park Community Needs Assessment',
    ARRAY[
      'How do you currently use the waterfront area, and what activities would you like to see supported there?',
      'What safety or accessibility concerns do you have about the current waterfront path and facilities?',
      'What natural or ecological features of the riverbank are most important to you?',
      'What community programming or events would make this park a destination for your neighborhood?'
    ],
    v_user_id
  );

  INSERT INTO public.analytical_frameworks (project_id, name, research_questions, creator_id)
  VALUES (
    v_proj2_id,
    'Division Street Travel Patterns & Safety Needs',
    ARRAY[
      'How do you travel along Division Street today, and what makes your journey difficult or unsafe?',
      'What improvements would make you more likely to walk, bike, or take transit on Division Street?',
      'How do you feel proposed street changes might affect local businesses and neighborhood character?',
      'Which intersections or segments feel most dangerous to you, and why?'
    ],
    v_user_id
  );

  -- ─── 7. Conversations ───────────────────────────────────────
  -- One conversation per project owned by the seed user
  -- (represents a test contributor session)

  INSERT INTO public.conversations (project_id, creator_id, extraction_status)
  VALUES (v_proj1_id, v_user_id, 'pending')
  RETURNING id INTO v_conv1_id;

  INSERT INTO public.conversations (project_id, creator_id, extraction_status)
  VALUES (v_proj2_id, v_user_id, 'pending')
  RETURNING id INTO v_conv2_id;

  -- ─── 8. Messages – Conversation 1 (Waterfront Park) ────────

  INSERT INTO public.messages
    (conversation_id, sender, content, creator_id, location, referenced_feature_ids)
  VALUES
    (v_conv1_id, 'ai_facilitator',
     'Welcome! I''m here to help capture your ideas for the Eastside '
     'Waterfront Park Redesign. This project will transform 12 acres of '
     'riverfront into a community destination. To start—how do you '
     'currently use the waterfront area, and what activities would you '
     'most like to see supported there?',
     v_user_id, NULL, '{}'),

    (v_conv1_id, 'human',
     'I walk my dog there every morning, but the path is really uneven '
     'and tree roots have completely cracked the pavement in several '
     'spots—I''ve nearly tripped a few times. I''d love to see better '
     'lighting too, especially under the bridges. It gets pretty dark '
     'there. I also think the waterfront would be amazing for outdoor '
     'yoga and fitness classes. There''s so much unused space.',
     v_user_id, NULL,
     ARRAY[v_f1_path_id::TEXT]),

    (v_conv1_id, 'ai_facilitator',
     'That''s really helpful—pavement condition and lighting under '
     'the bridges are coming up consistently from other community '
     'members too. You mentioned space for yoga and fitness. Would '
     'you use the Central Event Plaza for that kind of programming, '
     'or somewhere along the path itself? I''d love to understand '
     'which spots feel most promising.',
     v_user_id, NULL,
     ARRAY[v_f1_plaza_id::TEXT]),

    (v_conv1_id, 'human',
     'The plaza could work for organized classes, but I think having '
     'some exercise equipment along the path itself would be great—'
     'so people can use it spontaneously, not just during scheduled '
     'events. Also, I have to say: the River Overlook is genuinely '
     'magical at sunset. That area should be a priority. Maybe some '
     'seating and interpretive signs about the river ecology?',
     v_user_id,
     '{"lat":45.5230,"lng":-122.6672}'::jsonb,
     ARRAY[v_f1_overlook_id::TEXT]),

    (v_conv1_id, 'ai_facilitator',
     'The River Overlook really is a special spot—several people have '
     'named it as the park''s most irreplaceable feature. Pairing '
     'comfortable seating with ecological interpretation there is a '
     'wonderful idea. Before we finish: are there any safety or access '
     'concerns you feel aren''t being addressed in the current '
     'conversation?',
     v_user_id, NULL, '{}'),

    (v_conv1_id, 'human',
     'Yes—the ramps down to the waterfront from street level are really '
     'steep. I''ve seen elderly people and parents with strollers really '
     'struggle. Better ADA-compliant access points at multiple locations '
     'along the path would make a huge difference. And some water '
     'fountains and restrooms—there''s literally nowhere to go for miles.',
     v_user_id, NULL, '{}');

  -- ─── 9. Messages – Conversation 2 (Division Street) ────────

  INSERT INTO public.messages
    (conversation_id, sender, content, creator_id, location, referenced_feature_ids)
  VALUES
    (v_conv2_id, 'ai_facilitator',
     'Thanks for joining the Division Street Complete Streets '
     'conversation. This project is looking at how to redesign the '
     'SE 20th–50th corridor for all users. Let''s start with your '
     'experience: how do you typically travel along Division Street, '
     'and what makes it difficult or unsafe?',
     v_user_id, NULL, '{}'),

    (v_conv2_id, 'human',
     'I bike Division almost every day to get to work. It''s terrifying. '
     'Cars constantly door me, and the right lane basically functions as '
     'informal parking. I tried taking the lane once and got honked at '
     'aggressively. I avoid the stretch between 28th and 34th if I can '
     'help it—there''s no protection at all.',
     v_user_id, NULL,
     ARRAY[v_f2_corridor_id::TEXT]),

    (v_conv2_id, 'ai_facilitator',
     'The stretch between 28th and 34th comes up a lot as a high-stress '
     'zone for cyclists. You mentioned dooring—would a separated bike '
     'lane address your main concerns, or are there other changes that '
     'would make a bigger difference? And could you point me to the '
     'specific spot that worries you most?',
     v_user_id, NULL,
     ARRAY[v_f2_node_id::TEXT]),

    (v_conv2_id, 'human',
     'A protected lane would help enormously. The 30th intersection is '
     'the worst—there''s a restaurant with a loading zone that''s '
     'basically always blocked by double-parked delivery trucks during '
     'morning rush. I''ve seen near-misses there almost every week.',
     v_user_id,
     '{"lat":45.5044,"lng":-122.6370}'::jsonb,
     ARRAY[v_f2_node_id::TEXT]),

    (v_conv2_id, 'ai_facilitator',
     'That''s really specific and useful—the 30th and Division loading '
     'situation is something the design team should address directly. '
     'Several people have also raised concerns about Powell Park''s '
     'connection to Division. Do you ever cross Division near the park '
     'with kids, or know families who do?',
     v_user_id, NULL,
     ARRAY[v_f2_park_id::TEXT]),

    (v_conv2_id, 'human',
     'I don''t have kids but my neighbors do, and they''ve basically '
     'given up walking to Powell Park because crossing Division is so '
     'dangerous. There''s no crosswalk for about 4 blocks in that '
     'stretch. One family I know actually drives to the park—which is '
     'absurd when it''s only 3 blocks away. A raised crosswalk near '
     'the park entrance would change everything for that neighborhood.',
     v_user_id,
     '{"lat":45.5040,"lng":-122.6420}'::jsonb,
     ARRAY[v_f2_park_id::TEXT]);

  -- ─── 10. Themes – Project 1 ─────────────────────────────────

  INSERT INTO public.themes (project_id, name, summary, research_question, creator_id)
  VALUES (
    v_proj1_id,
    'Path Quality & Lighting',
    'Community members consistently report that the main waterfront '
    'path is in poor condition—cracked pavement, tree root damage, '
    'and inadequate lighting especially under the bridges—creating '
    'safety hazards for all users, particularly at night and for '
    'mobility-impaired visitors.',
    'What safety or accessibility concerns do you have about the current waterfront path and facilities?',
    v_user_id
  ) RETURNING id INTO v_t1_path_id;

  INSERT INTO public.themes (project_id, name, summary, research_question, creator_id)
  VALUES (
    v_proj1_id,
    'Active Recreation & Fitness Programming',
    'Strong community interest in using the park for regular fitness '
    'activities—including walking, dog walking, outdoor yoga, and '
    'fitness classes. There is particular appetite for both scheduled '
    'programming in the plaza and permanently installed outdoor '
    'fitness equipment along the path for spontaneous use.',
    'How do you currently use the waterfront area, and what activities would you like to see supported there?',
    v_user_id
  ) RETURNING id INTO v_t1_fitness_id;

  INSERT INTO public.themes (project_id, name, summary, research_question, creator_id)
  VALUES (
    v_proj1_id,
    'River Overlook as Community Anchor',
    'The River Overlook is repeatedly identified as the park''s most '
    'beloved and distinctive feature. Community members want it '
    'enhanced with comfortable seating and ecological interpretation '
    'signage. It is seen as having the strongest potential to become '
    'a true destination point that draws visitors from across the city.',
    'What natural or ecological features of the riverbank are most important to you?',
    v_user_id
  ) RETURNING id INTO v_t1_overlook_id;

  -- ─── 11. Themes – Project 2 ─────────────────────────────────

  INSERT INTO public.themes (project_id, name, summary, research_question, creator_id)
  VALUES (
    v_proj2_id,
    'Protected Cycling Infrastructure',
    'Cyclists identify Division Street as one of the most stressful '
    'bike routes in the city. The absence of any physical separation '
    'between cyclists and moving or parked cars creates a daily '
    'gauntlet of dooring risk, aggressive driver behaviour, and '
    'delivery vehicle conflicts. A protected lane is the top '
    'priority for this user group.',
    'What improvements would make you more likely to walk, bike, or take transit on Division Street?',
    v_user_id
  ) RETURNING id INTO v_t2_cycling_id;

  INSERT INTO public.themes (project_id, name, summary, research_question, creator_id)
  VALUES (
    v_proj2_id,
    'SE 30th Intersection Safety Hotspot',
    'The intersection at SE 30th and Division is the single most '
    'frequently cited danger point along the corridor. Informal '
    'double-parking in the loading zone, high turning volumes, and '
    'poor sightlines converge to create frequent near-miss incidents '
    'for both cyclists and pedestrians. Design interventions here '
    'are seen as urgent.',
    'Which intersections or segments feel most dangerous to you, and why?',
    v_user_id
  ) RETURNING id INTO v_t2_hotspot_id;

  INSERT INTO public.themes (project_id, name, summary, research_question, creator_id)
  VALUES (
    v_proj2_id,
    'Safe Crossings to Powell Park',
    'Families in the adjacent neighbourhood are effectively cut off '
    'from Powell Park by the absence of a safe crossing on Division '
    'near the park entrance. The four-block gap without a crosswalk '
    'forces residents to drive to a park within walking distance—'
    'or simply not go. A protected crossing or raised crosswalk '
    'near the park is a consistently prioritised request.',
    'Which intersections or segments feel most dangerous to you, and why?',
    v_user_id
  ) RETURNING id INTO v_t2_crossing_id;

  -- ─── 12. Data Points – Project 1 ────────────────────────────

  INSERT INTO public.data_points
    (project_id, conversation_id, content, research_question, feature_id, location, theme_ids, creator_id)
  VALUES
    (v_proj1_id, v_conv1_id,
     'The waterfront path has severe pavement cracking from tree root '
     'damage, creating trip hazards for daily users including walkers '
     'and cyclists.',
     'What safety or accessibility concerns do you have about the current waterfront path and facilities?',
     v_f1_path_id, NULL,
     ARRAY[v_t1_path_id::TEXT],
     v_user_id),

    (v_proj1_id, v_conv1_id,
     'Lighting under the bridges is inadequate, making the path feel '
     'unsafe for solo users at dawn and dusk.',
     'What safety or accessibility concerns do you have about the current waterfront path and facilities?',
     v_f1_path_id, NULL,
     ARRAY[v_t1_path_id::TEXT],
     v_user_id),

    (v_proj1_id, v_conv1_id,
     'Community members want both scheduled fitness programming in the '
     'Central Event Plaza and permanently installed outdoor equipment '
     'along the path for spontaneous use.',
     'How do you currently use the waterfront area, and what activities would you like to see supported there?',
     v_f1_plaza_id, NULL,
     ARRAY[v_t1_fitness_id::TEXT],
     v_user_id),

    (v_proj1_id, v_conv1_id,
     'The River Overlook is the park''s most loved feature. Community '
     'members want seating and ecological interpretation panels there '
     'to celebrate the river environment.',
     'What natural or ecological features of the riverbank are most important to you?',
     v_f1_overlook_id,
     '{"lat":45.5230,"lng":-122.6672}'::jsonb,
     ARRAY[v_t1_overlook_id::TEXT],
     v_user_id),

    (v_proj1_id, v_conv1_id,
     'Street-level ramps to the waterfront are too steep for elderly '
     'visitors and stroller users. More ADA-compliant access points '
     'are needed at multiple locations along the path.',
     'What safety or accessibility concerns do you have about the current waterfront path and facilities?',
     NULL, NULL,
     ARRAY[v_t1_path_id::TEXT],
     v_user_id);

  -- ─── 13. Data Points – Project 2 ────────────────────────────

  INSERT INTO public.data_points
    (project_id, conversation_id, content, research_question, feature_id, location, theme_ids, creator_id)
  VALUES
    (v_proj2_id, v_conv2_id,
     'Cyclists face daily dooring risk on Division due to cars using '
     'the travel lane as informal parking. There is no physical '
     'separation between cyclists and vehicle traffic.',
     'How do you travel along Division Street today, and what makes your journey difficult or unsafe?',
     v_f2_corridor_id, NULL,
     ARRAY[v_t2_cycling_id::TEXT],
     v_user_id),

    (v_proj2_id, v_conv2_id,
     'The SE 30th and Division intersection is the highest-risk point '
     'on the corridor. Double-parked delivery trucks in the loading '
     'zone push cyclists into traffic during morning rush.',
     'Which intersections or segments feel most dangerous to you, and why?',
     v_f2_node_id,
     '{"lat":45.5044,"lng":-122.6370}'::jsonb,
     ARRAY[v_t2_hotspot_id::TEXT],
     v_user_id),

    (v_proj2_id, v_conv2_id,
     'Families cannot safely walk to Powell Park because there is no '
     'crosswalk on Division for approximately 4 blocks near the park '
     'entrance. Some families now drive to the park instead.',
     'Which intersections or segments feel most dangerous to you, and why?',
     v_f2_park_id,
     '{"lat":45.5040,"lng":-122.6420}'::jsonb,
     ARRAY[v_t2_crossing_id::TEXT],
     v_user_id),

    (v_proj2_id, v_conv2_id,
     'A protected bike lane is the single most-requested improvement '
     'from cycling community members, who describe the current '
     'conditions as a daily gauntlet.',
     'What improvements would make you more likely to walk, bike, or take transit on Division Street?',
     v_f2_corridor_id, NULL,
     ARRAY[v_t2_cycling_id::TEXT],
     v_user_id),

    (v_proj2_id, v_conv2_id,
     'A raised crosswalk or protected pedestrian crossing near the '
     'Powell Park entrance would restore safe, active access for '
     'the adjacent residential neighbourhood.',
     'What improvements would make you more likely to walk, bike, or take transit on Division Street?',
     v_f2_park_id, NULL,
     ARRAY[v_t2_crossing_id::TEXT],
     v_user_id);

  -- ─── 14. Mark conversations as extracted ────────────────────
  -- The message trigger sets extraction_status back to 'pending' on
  -- every new message, so we update to 'complete' here at the end.

  UPDATE public.conversations
  SET extraction_status = 'complete'
  WHERE id IN (v_conv1_id, v_conv2_id);

  -- ─── Done ───────────────────────────────────────────────────
  RAISE NOTICE '--------------------------------------------';
  RAISE NOTICE 'Seed complete.';
  RAISE NOTICE 'User promoted: %', v_user_id;
  RAISE NOTICE 'Project 1 – Eastside Waterfront: %', v_proj1_id;
  RAISE NOTICE 'Project 2 – Division Street:     %', v_proj2_id;
  RAISE NOTICE '--------------------------------------------';
  RAISE NOTICE 'Sign out and back in, then visit /dashboard';

END;
$$;
