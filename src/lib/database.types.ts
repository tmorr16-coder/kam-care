
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "access_log": {
                  Row: {
                    "action": string,"at": string,"case_id": string | null,"id": number,"person_id": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"at"?: string,"case_id"?: string | null,"id"?: never,"person_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"at"?: string,"case_id"?: string | null,"id"?: never,"person_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_log_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "care_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_log_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"attendance": {
                  Row: {
                    "id": number,"kind": string,"meeting_date": string,"oc_attendance_id": number | null,"person_id": string,"via": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"kind": string,"meeting_date": string,"oc_attendance_id"?: number | null,"person_id": string,"via"?: string
                  }
                  Update: {
                    "id"?: never,"kind"?: string,"meeting_date"?: string,"oc_attendance_id"?: number | null,"person_id"?: string,"via"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"campuses": {
                  Row: {
                    "id": string,"name": string,"oc_location_id": number | null,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"name": string,"oc_location_id"?: number | null,"sort"?: number
                  }
                  Update: {
                    "id"?: string,"name"?: string,"oc_location_id"?: number | null,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"care_cases": {
                  Row: {
                    "action_channels": (Database["public"]['Enums']["channel"])[],"action_detail": string | null,"action_title": string,"closed_at": string | null,"confidence": string | null,"dedupe_key": string | null,"due_on": string | null,"first_touch_at": string | null,"flagged_by": string | null,"household_label": string | null,"id": string,"moment_type": Database["public"]['Enums']["moment_type"] | null,"opened_at": string,"owner_team_id": string | null,"person_id": string,"sensitive": boolean,"sensitive_reason": string | null,"sensitive_visibility": Database["public"]['Enums']["sensitive_visibility"] | null,"snoozed_until": string | null,"status": Database["public"]['Enums']["case_status"],"suggested_message": string | null,"urgency": Database["public"]['Enums']["urgency"],"why_flagged": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_channels"?: (Database["public"]['Enums']["channel"])[],"action_detail"?: string | null,"action_title": string,"closed_at"?: string | null,"confidence"?: string | null,"dedupe_key"?: string | null,"due_on"?: string | null,"first_touch_at"?: string | null,"flagged_by"?: string | null,"household_label"?: string | null,"id"?: string,"moment_type"?: Database["public"]['Enums']["moment_type"] | null,"opened_at"?: string,"owner_team_id"?: string | null,"person_id": string,"sensitive"?: boolean,"sensitive_reason"?: string | null,"sensitive_visibility"?: Database["public"]['Enums']["sensitive_visibility"] | null,"snoozed_until"?: string | null,"status"?: Database["public"]['Enums']["case_status"],"suggested_message"?: string | null,"urgency"?: Database["public"]['Enums']["urgency"],"why_flagged": string
                  }
                  Update: {
                    "action_channels"?: (Database["public"]['Enums']["channel"])[],"action_detail"?: string | null,"action_title"?: string,"closed_at"?: string | null,"confidence"?: string | null,"dedupe_key"?: string | null,"due_on"?: string | null,"first_touch_at"?: string | null,"flagged_by"?: string | null,"household_label"?: string | null,"id"?: string,"moment_type"?: Database["public"]['Enums']["moment_type"] | null,"opened_at"?: string,"owner_team_id"?: string | null,"person_id"?: string,"sensitive"?: boolean,"sensitive_reason"?: string | null,"sensitive_visibility"?: Database["public"]['Enums']["sensitive_visibility"] | null,"snoozed_until"?: string | null,"status"?: Database["public"]['Enums']["case_status"],"suggested_message"?: string | null,"urgency"?: Database["public"]['Enums']["urgency"],"why_flagged"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_cases_owner_team_id_fkey"
      columns: ["owner_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_cases_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"care_ratings": {
                  Row: {
                    "created_at": string,"id": string,"person_id": string,"rating": number,"touch_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"person_id": string,"rating": number,"touch_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"person_id"?: string,"rating"?: number,"touch_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_ratings_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_ratings_touch_id_fkey"
      columns: ["touch_id"]
isOneToOne: false
      referencedRelation: "touches"
      referencedColumns: ["id"]
    }
                  ]
                },"care_requests": {
                  Row: {
                    "body": string | null,"case_id": string | null,"contact_pref": Database["public"]['Enums']["channel"] | null,"created_at": string,"id": string,"items": (string)[],"kind": Database["public"]['Enums']["request_kind"],"oc_form_entry_id": number | null,"person_id": string,"source": string,"status": Database["public"]['Enums']["request_status"],"team_id": string | null,"topic": string | null,"visibility": Database["public"]['Enums']["request_visibility"],"wants_call": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"case_id"?: string | null,"contact_pref"?: Database["public"]['Enums']["channel"] | null,"created_at"?: string,"id"?: string,"items"?: (string)[],"kind": Database["public"]['Enums']["request_kind"],"oc_form_entry_id"?: number | null,"person_id": string,"source"?: string,"status"?: Database["public"]['Enums']["request_status"],"team_id"?: string | null,"topic"?: string | null,"visibility"?: Database["public"]['Enums']["request_visibility"],"wants_call"?: boolean
                  }
                  Update: {
                    "body"?: string | null,"case_id"?: string | null,"contact_pref"?: Database["public"]['Enums']["channel"] | null,"created_at"?: string,"id"?: string,"items"?: (string)[],"kind"?: Database["public"]['Enums']["request_kind"],"oc_form_entry_id"?: number | null,"person_id"?: string,"source"?: string,"status"?: Database["public"]['Enums']["request_status"],"team_id"?: string | null,"topic"?: string | null,"visibility"?: Database["public"]['Enums']["request_visibility"],"wants_call"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_requests_case_fk"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "care_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_requests_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_requests_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"care_team_members": {
                  Row: {
                    "person_id": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "person_id": string,"team_id": string
                  }
                  Update: {
                    "person_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_team_members_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"care_teams": {
                  Row: {
                    "active": boolean,"campus_id": string | null,"gifted_for": (string)[],"id": string,"kind": string,"name": string,"oc_group_id": number | null,"person_id": string | null,"slug": string,"subtitle": string | null,"weekly_capacity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"campus_id"?: string | null,"gifted_for"?: (string)[],"id"?: string,"kind"?: string,"name": string,"oc_group_id"?: number | null,"person_id"?: string | null,"slug": string,"subtitle"?: string | null,"weekly_capacity"?: number
                  }
                  Update: {
                    "active"?: boolean,"campus_id"?: string | null,"gifted_for"?: (string)[],"id"?: string,"kind"?: string,"name"?: string,"oc_group_id"?: number | null,"person_id"?: string | null,"slug"?: string,"subtitle"?: string | null,"weekly_capacity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "care_teams_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "care_teams_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"checkins": {
                  Row: {
                    "created_at": string,"id": string,"note": string | null,"person_id": string,"score": number,"source": string,"wants_contact": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"person_id": string,"score": number,"source"?: string,"wants_contact"?: boolean
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"person_id"?: string,"score"?: number,"source"?: string,"wants_contact"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "checkins_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"consents": {
                  Row: {
                    "celebrate_milestones": boolean,"emails": boolean,"person_id": string,"social_connected": boolean,"social_provider": string | null,"texts": boolean,"updated_at": string,"use_attendance": boolean,"use_giving": boolean,"weekly_checkin": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "celebrate_milestones"?: boolean,"emails"?: boolean,"person_id": string,"social_connected"?: boolean,"social_provider"?: string | null,"texts"?: boolean,"updated_at"?: string,"use_attendance"?: boolean,"use_giving"?: boolean,"weekly_checkin"?: boolean
                  }
                  Update: {
                    "celebrate_milestones"?: boolean,"emails"?: boolean,"person_id"?: string,"social_connected"?: boolean,"social_provider"?: string | null,"texts"?: boolean,"updated_at"?: string,"use_attendance"?: boolean,"use_giving"?: boolean,"weekly_checkin"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_person_id_fkey"
      columns: ["person_id"]
isOneToOne: true
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"giving_patterns": {
                  Row: {
                    "first_gift_on": string | null,"gifts_last_90d": number,"has_recurring": boolean,"last_gift_on": string | null,"person_id": string,"recurring_stopped_on": string | null,"trend": string | null,"updated_at": string,"years_giving": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "first_gift_on"?: string | null,"gifts_last_90d"?: number,"has_recurring"?: boolean,"last_gift_on"?: string | null,"person_id": string,"recurring_stopped_on"?: string | null,"trend"?: string | null,"updated_at"?: string,"years_giving"?: number | null
                  }
                  Update: {
                    "first_gift_on"?: string | null,"gifts_last_90d"?: number,"has_recurring"?: boolean,"last_gift_on"?: string | null,"person_id"?: string,"recurring_stopped_on"?: string | null,"trend"?: string | null,"updated_at"?: string,"years_giving"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "giving_patterns_person_id_fkey"
      columns: ["person_id"]
isOneToOne: true
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "id": string,"name": string | null,"oc_family_id": number | null,"synced_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name"?: string | null,"oc_family_id"?: number | null,"synced_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"name"?: string | null,"oc_family_id"?: number | null,"synced_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"life_moments": {
                  Row: {
                    "case_id": string | null,"created_at": string,"id": string,"moment_date": string,"note": string | null,"person_id": string,"remind_yearly": boolean,"share_with_church": boolean,"source": string,"status": string,"type": Database["public"]['Enums']["moment_type"],"who": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "case_id"?: string | null,"created_at"?: string,"id"?: string,"moment_date": string,"note"?: string | null,"person_id": string,"remind_yearly"?: boolean,"share_with_church"?: boolean,"source"?: string,"status"?: string,"type": Database["public"]['Enums']["moment_type"],"who"?: string | null
                  }
                  Update: {
                    "case_id"?: string | null,"created_at"?: string,"id"?: string,"moment_date"?: string,"note"?: string | null,"person_id"?: string,"remind_yearly"?: boolean,"share_with_church"?: boolean,"source"?: string,"status"?: string,"type"?: Database["public"]['Enums']["moment_type"],"who"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "life_moments_case_fk"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "care_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "life_moments_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"match_reviews": {
                  Row: {
                    "candidate_person_ids": (string)[],"created_at": string,"id": string,"label": string,"reason": string,"resolved_by": string | null,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidate_person_ids"?: (string)[],"created_at"?: string,"id"?: string,"label": string,"reason": string,"resolved_by"?: string | null,"status"?: string,"user_id": string
                  }
                  Update: {
                    "candidate_person_ids"?: (string)[],"created_at"?: string,"id"?: string,"label"?: string,"reason"?: string,"resolved_by"?: string | null,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"message_templates": {
                  Row: {
                    "body": string,"channel": Database["public"]['Enums']["channel"],"id": string,"moment_type": Database["public"]['Enums']["moment_type"] | null,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"channel": Database["public"]['Enums']["channel"],"id"?: string,"moment_type"?: Database["public"]['Enums']["moment_type"] | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"channel"?: Database["public"]['Enums']["channel"],"id"?: string,"moment_type"?: Database["public"]['Enums']["moment_type"] | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"oc_webhook_events": {
                  Row: {
                    "error": string | null,"event": string,"http_status": number,"id": number,"payload": NonNullable<Json>,"processed_at": string | null,"received_at": string,"status": string,"summary": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"event": string,"http_status"?: number,"id"?: never,"payload": NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"status"?: string,"summary"?: string | null
                  }
                  Update: {
                    "error"?: string | null,"event"?: string,"http_status"?: number,"id"?: never,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"received_at"?: string,"status"?: string,"summary"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"oc_webhook_subscriptions": {
                  Row: {
                    "created_at": string,"event": string,"oc_subscription_id": number,"url": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event": string,"oc_subscription_id": number,"url": string
                  }
                  Update: {
                    "created_at"?: string,"event"?: string,"oc_subscription_id"?: number,"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pastoral_notes": {
                  Row: {
                    "author": string | null,"body": string,"created_at": string,"id": string,"person_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author"?: string | null,"body": string,"created_at"?: string,"id"?: string,"person_id": string
                  }
                  Update: {
                    "author"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"person_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pastoral_notes_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"people": {
                  Row: {
                    "anniversary": string | null,"archived": boolean,"birthday": string | null,"campus_id": string | null,"created_at": string,"deceased": boolean,"display_name": string | null,"email": string | null,"family_position": string | null,"first_name": string,"household_id": string | null,"id": string,"is_guest": boolean,"last_name": string,"member_since": string | null,"ministries": (string)[],"oc_person_id": number | null,"phone": string | null,"synced_at": string | null,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anniversary"?: string | null,"archived"?: boolean,"birthday"?: string | null,"campus_id"?: string | null,"created_at"?: string,"deceased"?: boolean,"display_name"?: never,"email"?: string | null,"family_position"?: string | null,"first_name": string,"household_id"?: string | null,"id"?: string,"is_guest"?: boolean,"last_name": string,"member_since"?: string | null,"ministries"?: (string)[],"oc_person_id"?: number | null,"phone"?: string | null,"synced_at"?: string | null,"title"?: string | null
                  }
                  Update: {
                    "anniversary"?: string | null,"archived"?: boolean,"birthday"?: string | null,"campus_id"?: string | null,"created_at"?: string,"deceased"?: boolean,"display_name"?: never,"email"?: string | null,"family_position"?: string | null,"first_name"?: string,"household_id"?: string | null,"id"?: string,"is_guest"?: boolean,"last_name"?: string,"member_since"?: string | null,"ministries"?: (string)[],"oc_person_id"?: number | null,"phone"?: string | null,"synced_at"?: string | null,"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "people_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "people_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"person_care": {
                  Row: {
                    "care_score": number | null,"care_score_delta_14d": number | null,"email_ignored": boolean | null,"is_shut_in": boolean,"last_touch_at": string | null,"last_touch_summary": string | null,"lives_alone": boolean,"person_id": string,"preferred_channel": Database["public"]['Enums']["channel"] | null,"primary_team_id": string | null,"text_read_fast": boolean | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "care_score"?: number | null,"care_score_delta_14d"?: number | null,"email_ignored"?: boolean | null,"is_shut_in"?: boolean,"last_touch_at"?: string | null,"last_touch_summary"?: string | null,"lives_alone"?: boolean,"person_id": string,"preferred_channel"?: Database["public"]['Enums']["channel"] | null,"primary_team_id"?: string | null,"text_read_fast"?: boolean | null,"updated_at"?: string
                  }
                  Update: {
                    "care_score"?: number | null,"care_score_delta_14d"?: number | null,"email_ignored"?: boolean | null,"is_shut_in"?: boolean,"last_touch_at"?: string | null,"last_touch_summary"?: string | null,"lives_alone"?: boolean,"person_id"?: string,"preferred_channel"?: Database["public"]['Enums']["channel"] | null,"primary_team_id"?: string | null,"text_read_fast"?: boolean | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "person_care_person_id_fkey"
      columns: ["person_id"]
isOneToOne: true
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "person_care_primary_team_fk"
      columns: ["primary_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    }
                  ]
                },"playbooks": {
                  Row: {
                    "action_channels": (Database["public"]['Enums']["channel"])[],"action_title": string,"label": string,"moment_type": Database["public"]['Enums']["moment_type"],"sensitive": boolean,"steps": NonNullable<Json>,"summary": string,"urgency": Database["public"]['Enums']["urgency"]
                  }
                  ComputedFields: never
                  Insert: {
                    "action_channels"?: (Database["public"]['Enums']["channel"])[],"action_title": string,"label": string,"moment_type": Database["public"]['Enums']["moment_type"],"sensitive"?: boolean,"steps"?: NonNullable<Json>,"summary": string,"urgency"?: Database["public"]['Enums']["urgency"]
                  }
                  Update: {
                    "action_channels"?: (Database["public"]['Enums']["channel"])[],"action_title"?: string,"label"?: string,"moment_type"?: Database["public"]['Enums']["moment_type"],"sensitive"?: boolean,"steps"?: NonNullable<Json>,"summary"?: string,"urgency"?: Database["public"]['Enums']["urgency"]
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "campus_id": string | null,"created_at": string,"is_admin": boolean,"last_role_sync_at": string | null,"match_status": string,"person_id": string | null,"role": Database["public"]['Enums']["app_role"],"role_source": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campus_id"?: string | null,"created_at"?: string,"is_admin"?: boolean,"last_role_sync_at"?: string | null,"match_status"?: string,"person_id"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"role_source"?: string,"user_id": string
                  }
                  Update: {
                    "campus_id"?: string | null,"created_at"?: string,"is_admin"?: boolean,"last_role_sync_at"?: string | null,"match_status"?: string,"person_id"?: string | null,"role"?: Database["public"]['Enums']["app_role"],"role_source"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profiles_person_id_fkey"
      columns: ["person_id"]
isOneToOne: true
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"role_mappings": {
                  Row: {
                    "grants_admin": boolean,"group_name": string,"oc_group_id": number,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "grants_admin"?: boolean,"group_name": string,"oc_group_id": number,"role": Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "grants_admin"?: boolean,"group_name"?: string,"oc_group_id"?: number,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    
                  ]
                },"signals": {
                  Row: {
                    "data": NonNullable<Json>,"dedupe_key": string | null,"id": string,"kind": Database["public"]['Enums']["signal_kind"],"occurred_at": string,"pastors_only": boolean,"person_id": string,"severity": Database["public"]['Enums']["urgency"],"source": string,"summary": string
                  }
                  ComputedFields: never
                  Insert: {
                    "data"?: NonNullable<Json>,"dedupe_key"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["signal_kind"],"occurred_at"?: string,"pastors_only"?: boolean,"person_id": string,"severity"?: Database["public"]['Enums']["urgency"],"source": string,"summary": string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"dedupe_key"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["signal_kind"],"occurred_at"?: string,"pastors_only"?: boolean,"person_id"?: string,"severity"?: Database["public"]['Enums']["urgency"],"source"?: string,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "signals_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"sync_runs": {
                  Row: {
                    "error": string | null,"finished_at": string | null,"id": number,"kind": string,"ok": boolean | null,"started_at": string,"stats": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: never,"kind": string,"ok"?: boolean | null,"started_at"?: string,"stats"?: NonNullable<Json>
                  }
                  Update: {
                    "error"?: string | null,"finished_at"?: string | null,"id"?: never,"kind"?: string,"ok"?: boolean | null,"started_at"?: string,"stats"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"tasks": {
                  Row: {
                    "assignee_team_id": string | null,"case_id": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"due_on": string,"escalated_at": string | null,"escalation_level": number,"id": string,"instructions": string | null,"notified_at": string | null,"outcome": Database["public"]['Enums']["task_outcome"] | null,"person_id": string,"sensitive": boolean,"status": Database["public"]['Enums']["task_status"],"subtitle": string | null,"task_type": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_team_id"?: string | null,"case_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_on": string,"escalated_at"?: string | null,"escalation_level"?: number,"id"?: string,"instructions"?: string | null,"notified_at"?: string | null,"outcome"?: Database["public"]['Enums']["task_outcome"] | null,"person_id": string,"sensitive"?: boolean,"status"?: Database["public"]['Enums']["task_status"],"subtitle"?: string | null,"task_type"?: string,"title": string
                  }
                  Update: {
                    "assignee_team_id"?: string | null,"case_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"due_on"?: string,"escalated_at"?: string | null,"escalation_level"?: number,"id"?: string,"instructions"?: string | null,"notified_at"?: string | null,"outcome"?: Database["public"]['Enums']["task_outcome"] | null,"person_id"?: string,"sensitive"?: boolean,"status"?: Database["public"]['Enums']["task_status"],"subtitle"?: string | null,"task_type"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_team_id_fkey"
      columns: ["assignee_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "care_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"touches": {
                  Row: {
                    "body": string | null,"by_team_id": string | null,"by_user": string | null,"case_id": string | null,"channel": Database["public"]['Enums']["channel"],"delivery_status": string | null,"id": string,"oc_note_id": number | null,"oc_written_at": string | null,"occurred_at": string,"outcome": Database["public"]['Enums']["task_outcome"] | null,"person_id": string,"summary": string,"task_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"by_team_id"?: string | null,"by_user"?: string | null,"case_id"?: string | null,"channel": Database["public"]['Enums']["channel"],"delivery_status"?: string | null,"id"?: string,"oc_note_id"?: number | null,"oc_written_at"?: string | null,"occurred_at"?: string,"outcome"?: Database["public"]['Enums']["task_outcome"] | null,"person_id": string,"summary": string,"task_id"?: string | null
                  }
                  Update: {
                    "body"?: string | null,"by_team_id"?: string | null,"by_user"?: string | null,"case_id"?: string | null,"channel"?: Database["public"]['Enums']["channel"],"delivery_status"?: string | null,"id"?: string,"oc_note_id"?: number | null,"oc_written_at"?: string | null,"occurred_at"?: string,"outcome"?: Database["public"]['Enums']["task_outcome"] | null,"person_id"?: string,"summary"?: string,"task_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "touches_by_team_id_fkey"
      columns: ["by_team_id"]
isOneToOne: false
      referencedRelation: "care_teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "touches_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "care_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "touches_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "touches_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "can_see_case":
{ Args: { "p_sensitive": boolean,"p_vis": Database["public"]['Enums']["sensitive_visibility"] }; Returns: boolean
                           },
"can_see_case_id":
{ Args: { "p_case": string }; Returns: boolean
                           },
"current_app_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"current_person_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_app_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_care_role":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_care_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_pastor":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"leader_can_see_person":
{ Args: { "p": string }; Returns: boolean
                           },
"log_task_outcome":
{ Args: { "p_channel"?: Database["public"]['Enums']["channel"],"p_outcome": Database["public"]['Enums']["task_outcome"],"p_task": string }; Returns: undefined
                           },
"my_team_ids":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           }
          }
          Enums: {
            "app_role": "member"|"care_leader"|"staff"|"pastor","case_status": "open"|"closed","channel": "text"|"call"|"visit"|"email"|"app"|"card","moment_type": "birth"|"wedding"|"promotion"|"award"|"anniversary"|"work_anniversary"|"moved"|"sickness"|"bereavement"|"job_loss"|"shut_in"|"birthday"|"other","request_kind": "prayer"|"pastor_call"|"practical"|"counseling","request_status": "received"|"in_progress"|"approved"|"closed","request_visibility": "pastors"|"prayer_team"|"church","sensitive_visibility": "pastors"|"pastors_and_staff","signal_kind": "checkin_drop"|"checkin_low"|"missed_attendance"|"livestream_absent"|"giving_first"|"giving_lapse"|"giving_increase"|"giving_new_recurring"|"giving_quiet"|"prayer_request"|"care_request"|"life_moment"|"guest_visit"|"shut_in_due"|"social_post"|"flagged"|"touch"|"engagement"|"safety","task_outcome": "reached"|"left_message"|"needs_pastor","task_status": "scheduled"|"due"|"done"|"cancelled","urgency": "urgent"|"high"|"normal"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["member", "care_leader", "staff", "pastor"],"case_status": ["open", "closed"],"channel": ["text", "call", "visit", "email", "app", "card"],"moment_type": ["birth", "wedding", "promotion", "award", "anniversary", "work_anniversary", "moved", "sickness", "bereavement", "job_loss", "shut_in", "birthday", "other"],"request_kind": ["prayer", "pastor_call", "practical", "counseling"],"request_status": ["received", "in_progress", "approved", "closed"],"request_visibility": ["pastors", "prayer_team", "church"],"sensitive_visibility": ["pastors", "pastors_and_staff"],"signal_kind": ["checkin_drop", "checkin_low", "missed_attendance", "livestream_absent", "giving_first", "giving_lapse", "giving_increase", "giving_new_recurring", "giving_quiet", "prayer_request", "care_request", "life_moment", "guest_visit", "shut_in_due", "social_post", "flagged", "touch", "engagement", "safety"],"task_outcome": ["reached", "left_message", "needs_pastor"],"task_status": ["scheduled", "due", "done", "cancelled"],"urgency": ["urgent", "high", "normal"]
          }
        }
} as const
