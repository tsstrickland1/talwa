// ─── Core Domain Types ────────────────────────────────────────────────────────

export type Location = {
  lat: number
  lng: number
}

export type User = {
  id: string
  name_first: string
  name_last: string
  avatar: string | null
  email: string
  user_type: 'community_contributor' | 'project_creator' | 'admin'
}

export type CreatorProfileType = 'individual' | 'organization'

export type CreatorProfile = {
  id: string
  type: CreatorProfileType
  name: string
  slug: string
  avatar: string | null
  description: string
  created_at: string
}

export type OrganizationMemberRole = 'owner' | 'admin' | 'member'

export type OrganizationMember = {
  id: string
  creator_profile_id: string
  user_id: string
  role: OrganizationMemberRole
  created_at: string
}

export type OrganizationInvitation = {
  id: string
  creator_profile_id: string
  invitee_email: string
  role: 'admin' | 'member'
  status: 'pending' | 'accepted' | 'expired' | 'declined'
  expiration: string
  created_at: string
}

export type Project = {
  id: string
  name: string
  short_description: string
  long_description: string
  featured_image: string | null
  contributor_count: number
  status: 'draft' | 'active' | 'completed' | 'archived'
  location: string
  /** Neighborhood name, populated via /api/admin/geocode-projects */
  neighborhood: string | null
  /** WGS84 latitude, populated via /api/admin/geocode-projects */
  lat: number | null
  /** WGS84 longitude, populated via /api/admin/geocode-projects */
  lng: number | null
  publicly_visible: boolean
  creator_profile_id: string
  /** @deprecated Use creator_profile_id. Kept during migration rollout. */
  creator_id?: string
  dialogue_framework: string[]
  created_at: string
}

export type ProjectFollower = {
  user_id: string
  project_id: string
  created_at: string
}

export type ProjectPermission =
  | 'contribute'
  | 'update_project'
  | 'manage_users'
  | 'generate_reports'
  | 'manage_files'
  | 'configure_frameworks'

export type ProjectAccess = {
  id: string
  user_id: string
  project_id: string
  permissions: ProjectPermission[]
  role: string
}

export type Invitation = {
  id: string
  invitee_email: string
  invitee_first_name: string
  invitee_last_name: string
  project_id: string
  permissions: ProjectPermission[]
  status: 'pending' | 'accepted' | 'expired' | 'declined'
  expiration: string
}

export type Feature = {
  id: string
  project_id: string
  name: string
  type: 'path' | 'park' | 'plaza' | 'landmark' | 'other'
  description: string
  geojson: string
  source: 'creator' | 'contributor'
  creator_id: string
}

export type Perspective = {
  id: string
  project_id: string
  feature_id: string
  image: string
  caption: string
  creator_id: string
}

export type Sketch = {
  id: string
  project_id: string
  feature_id: string
  perspective_id: string | null
  image: string
  caption: string
  creator_id: string
}

export type Conversation = {
  id: string
  project_id: string
  creator_id: string
  last_message_at: string
  extraction_status: 'pending' | 'processing' | 'complete' | 'failed'
  vector_store_id: string | null
  created_at: string
}

export type Message = {
  id: string
  conversation_id: string
  sender: 'human' | 'ai_facilitator'
  content: string
  referenced_feature_ids: string[]
  location: Location | null
  creator_id: string
  created_at: string
}

export type AnalyticalFramework = {
  id: string
  project_id: string
  name: string
  research_questions: string[]
  creator_id: string
}

export type DataPoint = {
  id: string
  project_id: string
  conversation_id: string
  content: string
  research_question: string
  feature_id: string | null
  location: Location | null
  theme_ids: string[]
  creator_id: string
}

export type Theme = {
  id: string
  project_id: string
  name: string
  summary: string
  research_question: string
  creator_id: string
}

export type ProjectFile = {
  id: string
  project_id: string
  name: string
  file_url: string
  description: string
}

export type ProjectUpdate = {
  id: string
  project_id: string
  title: string
  content: string
  creator_id: string
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  content: string
  status: 'unread' | 'read'
  type: 'new_update' | 'new_insight' | 'access_granted' | 'invitation'
  link: string
  project_id: string
}

export type DialogueTemplate = {
  id: string
  name: string
  description: string
  questions: string[]
}

// ─── Derived Union Helpers ────────────────────────────────────────────────────

export type ProjectStatus = Project['status']
export type ConversationExtractionStatus = Conversation['extraction_status']
export type NotificationType = Notification['type']
export type InvitationStatus = Invitation['status']
export type UserType = User['user_type']
export type FeatureType = Feature['type']
export type CreatorProfileTypeUnion = CreatorProfile['type']
export type OrganizationMemberRoleUnion = OrganizationMember['role']
export type OrganizationInvitationStatus = OrganizationInvitation['status']

// ─── API Request / Response Shapes ───────────────────────────────────────────

export type MessageContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string }

export type FacilitatorRequestBody = {
  messages: Array<{
    id?: string
    role: 'user' | 'assistant' | 'system'
    content: string | MessageContentBlock[]
  }>
  location: Location | null
  feature_id: string | null
  contributor_drew: boolean
  project_id: string
  conversation_id: string
  vector_store_id: string | null
  insights_mode?: boolean
}

export type ExtractRequestBody = {
  conversation_id: string
  project_id: string
}

export type SynthesizeRequestBody = {
  project_id: string
  new_data_point_ids: string[]
  research_question: string
}

export type ClassifyRequestBody = {
  project_id: string
  data_point_ids: string[]
}

// ─── GeoJSON Helpers ──────────────────────────────────────────────────────────

export type FeatureGeoJSON =
  | GeoJSON.Point
  | GeoJSON.LineString
  | GeoJSON.Polygon
  | GeoJSON.MultiPoint
  | GeoJSON.MultiLineString
  | GeoJSON.MultiPolygon
  | GeoJSON.GeometryCollection

// ─── Analyst Bot Context ──────────────────────────────────────────────────────

export type AnalystRequestBody = {
  messages: Array<{
    id?: string
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  project_id: string
  selected_theme_id?: string | null
  selected_data_point_id?: string | null
}
