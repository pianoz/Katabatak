export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_skills: {
        Row: {
          cooldown: number | null
          effect: Json | null
          id: string
          name: string
          type: string | null
          use: string | null
        }
        Insert: {
          cooldown?: number | null
          effect?: Json | null
          id?: string
          name: string
          type?: string | null
          use?: string | null
        }
        Update: {
          cooldown?: number | null
          effect?: Json | null
          id?: string
          name?: string
          type?: string | null
          use?: string | null
        }
        Relationships: []
      }
      active_skills: {
        Row: {
          cooldown: number | null
          created_at: string
          description: string | null
          effects: Json
          id: string
          name: string
        }
        Insert: {
          cooldown?: number | null
          created_at?: string
          description?: string | null
          effects?: Json
          id?: string
          name: string
        }
        Update: {
          cooldown?: number | null
          created_at?: string
          description?: string | null
          effects?: Json
          id?: string
          name?: string
        }
        Relationships: []
      }
      attributes: {
        Row: {
          id: number
          name: string | null
        }
        Insert: {
          id?: number
          name?: string | null
        }
        Update: {
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      campaign_facts: {
        Row: {
          created_at: string | null
          discovered_at_tick: number | null
          fact_summary: string
          game_id: string
          id: string
          subject_entity: string
          visibility: string
        }
        Insert: {
          created_at?: string | null
          discovered_at_tick?: number | null
          fact_summary: string
          game_id: string
          id?: string
          subject_entity: string
          visibility?: string
        }
        Update: {
          created_at?: string | null
          discovered_at_tick?: number | null
          fact_summary?: string
          game_id?: string
          id?: string
          subject_entity?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_facts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      character_action_skills: {
        Row: {
          action_skill_id: string
          character_id: string
          id: string
        }
        Insert: {
          action_skill_id: string
          character_id: string
          id?: string
        }
        Update: {
          action_skill_id?: string
          character_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_action_skills_action_skill_id_fkey"
            columns: ["action_skill_id"]
            isOneToOne: false
            referencedRelation: "action_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_action_skills_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_active_skills: {
        Row: {
          active_skill_id: string
          character_id: string
          id: string
        }
        Insert: {
          active_skill_id: string
          character_id: string
          id?: string
        }
        Update: {
          active_skill_id?: string
          character_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_active_skills_active_skill_id_fkey"
            columns: ["active_skill_id"]
            isOneToOne: false
            referencedRelation: "active_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_active_skills_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_history: {
        Row: {
          character_id: string
          id: string
          sold_objects_affected: Json | null
          summary: string | null
        }
        Insert: {
          character_id?: string
          id?: string
          sold_objects_affected?: Json | null
          summary?: string | null
        }
        Update: {
          character_id?: string
          id?: string
          sold_objects_affected?: Json | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_history_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_inventory: {
        Row: {
          acquired_at: string | null
          character_id: string | null
          condition: number | null
          custom_notes: string | null
          id: string
          is_equipped: boolean | null
          item_id: string | null
          quantity: number | null
        }
        Insert: {
          acquired_at?: string | null
          character_id?: string | null
          condition?: number | null
          custom_notes?: string | null
          id?: string
          is_equipped?: boolean | null
          item_id?: string | null
          quantity?: number | null
        }
        Update: {
          acquired_at?: string | null
          character_id?: string | null
          condition?: number | null
          custom_notes?: string | null
          id?: string
          is_equipped?: boolean | null
          item_id?: string | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "character_inventory_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      character_skills: {
        Row: {
          character_id: string
          current_rank: number | null
          skill_id: string
          unlocked_at: string | null
        }
        Insert: {
          character_id: string
          current_rank?: number | null
          skill_id: string
          unlocked_at?: string | null
        }
        Update: {
          character_id?: string
          current_rank?: number | null
          skill_id?: string
          unlocked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_skills_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      character_snapshots: {
        Row: {
          character_id: string
          id: string
          label: string | null
          snapshot: Json
          taken_at: string
        }
        Insert: {
          character_id: string
          id?: string
          label?: string | null
          snapshot: Json
          taken_at: string
        }
        Update: {
          character_id?: string
          id?: string
          label?: string | null
          snapshot?: Json
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_snapshots_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_spells: {
        Row: {
          character_id: string | null
          id: string
          spell_id: number | null
        }
        Insert: {
          character_id?: string | null
          id?: string
          spell_id?: number | null
        }
        Update: {
          character_id?: string | null
          id?: string
          spell_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "character_spells_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_spells_spell_id_fkey"
            columns: ["spell_id"]
            isOneToOne: false
            referencedRelation: "spells"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          background_primary: string | null
          background_secondary: string | null
          backstory: string | null
          carrying_capacity: number | null
          class_archetype: string | null
          condition_text: string | null
          created_at: string | null
          current_carry_weight: number | null
          current_essence: number | null
          current_health: number | null
          current_location_building: string | null
          current_location_local: string | null
          current_location_polis: string | null
          current_location_region: string
          current_location_text: string | null
          current_power: number | null
          current_will: number | null
          denarius: number | null
          essence_max: number | null
          health_max: number | null
          height: number | null
          id: string
          in_game: boolean | null
          is_active: boolean | null
          level: number | null
          name: string
          notes: string | null
          physical_description: string | null
          power_max: number | null
          speed: number | null
          unused_skill_points: number
          user_id: string | null
          weight_kgs: number | null
          will_max: number | null
        }
        Insert: {
          background_primary?: string | null
          background_secondary?: string | null
          backstory?: string | null
          carrying_capacity?: number | null
          class_archetype?: string | null
          condition_text?: string | null
          created_at?: string | null
          current_carry_weight?: number | null
          current_essence?: number | null
          current_health?: number | null
          current_location_building?: string | null
          current_location_local?: string | null
          current_location_polis?: string | null
          current_location_region?: string
          current_location_text?: string | null
          current_power?: number | null
          current_will?: number | null
          denarius?: number | null
          essence_max?: number | null
          health_max?: number | null
          height?: number | null
          id?: string
          in_game?: boolean | null
          is_active?: boolean | null
          level?: number | null
          name: string
          notes?: string | null
          physical_description?: string | null
          power_max?: number | null
          speed?: number | null
          unused_skill_points?: number
          user_id?: string | null
          weight_kgs?: number | null
          will_max?: number | null
        }
        Update: {
          background_primary?: string | null
          background_secondary?: string | null
          backstory?: string | null
          carrying_capacity?: number | null
          class_archetype?: string | null
          condition_text?: string | null
          created_at?: string | null
          current_carry_weight?: number | null
          current_essence?: number | null
          current_health?: number | null
          current_location_building?: string | null
          current_location_local?: string | null
          current_location_polis?: string | null
          current_location_region?: string
          current_location_text?: string | null
          current_power?: number | null
          current_will?: number | null
          denarius?: number | null
          essence_max?: number | null
          health_max?: number | null
          height?: number | null
          id?: string
          in_game?: boolean | null
          is_active?: boolean | null
          level?: number | null
          name?: string
          notes?: string | null
          physical_description?: string | null
          power_max?: number | null
          speed?: number | null
          unused_skill_points?: number
          user_id?: string | null
          weight_kgs?: number | null
          will_max?: number | null
        }
        Relationships: []
      }
      creatures: {
        Row: {
          armor_class: number | null
          attack_cost: number | null
          attack_damage: number | null
          attribute_cost_name: string | null
          created_at: string | null
          created_by: string | null
          current_essence: number | null
          current_health: number | null
          current_power: number | null
          current_will: number | null
          defence: number | null
          defence_cost: number | null
          description: string | null
          essence_max: number | null
          health_max: number | null
          id: string
          image_url: string | null
          level: number | null
          name: string
          power_max: number | null
          speed: number | null
          strong_attack: number | null
          strong_cost: number | null
          strong_defence: number | null
          will_max: number | null
        }
        Insert: {
          armor_class?: number | null
          attack_cost?: number | null
          attack_damage?: number | null
          attribute_cost_name?: string | null
          created_at?: string | null
          created_by?: string | null
          current_essence?: number | null
          current_health?: number | null
          current_power?: number | null
          current_will?: number | null
          defence?: number | null
          defence_cost?: number | null
          description?: string | null
          essence_max?: number | null
          health_max?: number | null
          id?: string
          image_url?: string | null
          level?: number | null
          name: string
          power_max?: number | null
          speed?: number | null
          strong_attack?: number | null
          strong_cost?: number | null
          strong_defence?: number | null
          will_max?: number | null
        }
        Update: {
          armor_class?: number | null
          attack_cost?: number | null
          attack_damage?: number | null
          attribute_cost_name?: string | null
          created_at?: string | null
          created_by?: string | null
          current_essence?: number | null
          current_health?: number | null
          current_power?: number | null
          current_will?: number | null
          defence?: number | null
          defence_cost?: number | null
          description?: string | null
          essence_max?: number | null
          health_max?: number | null
          id?: string
          image_url?: string | null
          level?: number | null
          name?: string
          power_max?: number | null
          speed?: number | null
          strong_attack?: number | null
          strong_cost?: number | null
          strong_defence?: number | null
          will_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "creatures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_creatures: {
        Row: {
          attack_cost: number | null
          attack_damage: number | null
          created_at: string | null
          creature_id: string
          current_essence: number | null
          current_health: number | null
          current_power: number | null
          current_will: number | null
          defence: number | null
          essence_max: number | null
          game_id: string
          health_max: number | null
          id: string
          is_alive: boolean
          level: number | null
          name: string
          power_max: number | null
          strong_attack: number | null
          will_max: number | null
        }
        Insert: {
          attack_cost?: number | null
          attack_damage?: number | null
          created_at?: string | null
          creature_id: string
          current_essence?: number | null
          current_health?: number | null
          current_power?: number | null
          current_will?: number | null
          defence?: number | null
          essence_max?: number | null
          game_id: string
          health_max?: number | null
          id?: string
          is_alive?: boolean
          level?: number | null
          name: string
          power_max?: number | null
          strong_attack?: number | null
          will_max?: number | null
        }
        Update: {
          attack_cost?: number | null
          attack_damage?: number | null
          created_at?: string | null
          creature_id?: string
          current_essence?: number | null
          current_health?: number | null
          current_power?: number | null
          current_will?: number | null
          defence?: number | null
          essence_max?: number | null
          game_id?: string
          health_max?: number | null
          id?: string
          is_alive?: boolean
          level?: number | null
          name?: string
          power_max?: number | null
          strong_attack?: number | null
          will_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_creatures_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_creatures_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      friends: {
        Row: {
          created_at: string | null
          friend_1: string
          friend_2: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          friend_1: string
          friend_2: string
          id?: string
          status: string
        }
        Update: {
          created_at?: string | null
          friend_1?: string
          friend_2?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friends_friend_1_fkey"
            columns: ["friend_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_friend_2_fkey"
            columns: ["friend_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_items: {
        Row: {
          custom_price_override: number | null
          discovery_status: string | null
          game_id: string | null
          id: string
          is_available_in_shop: boolean | null
          item_id: string | null
          stock_quantity: number | null
        }
        Insert: {
          custom_price_override?: number | null
          discovery_status?: string | null
          game_id?: string | null
          id?: string
          is_available_in_shop?: boolean | null
          item_id?: string | null
          stock_quantity?: number | null
        }
        Update: {
          custom_price_override?: number | null
          discovery_status?: string | null
          game_id?: string | null
          id?: string
          is_available_in_shop?: boolean | null
          item_id?: string | null
          stock_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_items_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      game_members: {
        Row: {
          character_id: string | null
          game_id: string
          id: string
          member_status: string
          profile_id: string
          role: string | null
        }
        Insert: {
          character_id?: string | null
          game_id: string
          id?: string
          member_status?: string
          profile_id: string
          role?: string | null
        }
        Update: {
          character_id?: string | null
          game_id?: string
          id?: string
          member_status?: string
          profile_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_members_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_members_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          active_turn_index: number | null
          archived: boolean
          combat_log: string[] | null
          created_at: string | null
          current_turn_order: string[] | null
          gm_id: string
          gm_profile_id: string | null
          id: string
          is_in_combat: boolean | null
          is_in_session: boolean
          is_private: boolean | null
          join_code: string | null
          name: string
          session_number: number | null
          starting_level: number
        }
        Insert: {
          active_turn_index?: number | null
          archived?: boolean
          combat_log?: string[] | null
          created_at?: string | null
          current_turn_order?: string[] | null
          gm_id: string
          gm_profile_id?: string | null
          id?: string
          is_in_combat?: boolean | null
          is_in_session?: boolean
          is_private?: boolean | null
          join_code?: string | null
          name: string
          session_number?: number | null
          starting_level?: number
        }
        Update: {
          active_turn_index?: number | null
          archived?: boolean
          combat_log?: string[] | null
          created_at?: string | null
          current_turn_order?: string[] | null
          gm_id?: string
          gm_profile_id?: string | null
          id?: string
          is_in_combat?: boolean | null
          is_in_session?: boolean
          is_private?: boolean | null
          join_code?: string | null
          name?: string
          session_number?: number | null
          starting_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_gm_profile_id_fkey"
            columns: ["gm_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          action_text: string | null
          coefficient: number | null
          coefficient_attribute_name: string | null
          consumable: boolean | null
          cost: number | null
          cost_attribute_name: string | null
          cost_gold: number | null
          damage: string | null
          default_condition: number | null
          defence: number | null
          die_count: number | null
          effects: Json
          hidden: boolean | null
          id: string
          image_url: string | null
          is_magical: boolean | null
          long_description: string | null
          modifier: number | null
          modifier_attribute_name: string | null
          name: string
          rarity: string | null
          required_skill: string | null
          short_description: string | null
          strong_cost: number | null
          strong_damage: number | null
          strong_defence: number | null
          subtype: string | null
          type: string | null
          weight: number | null
        }
        Insert: {
          action_text?: string | null
          coefficient?: number | null
          coefficient_attribute_name?: string | null
          consumable?: boolean | null
          cost?: number | null
          cost_attribute_name?: string | null
          cost_gold?: number | null
          damage?: string | null
          default_condition?: number | null
          defence?: number | null
          die_count?: number | null
          effects?: Json
          hidden?: boolean | null
          id?: string
          image_url?: string | null
          is_magical?: boolean | null
          long_description?: string | null
          modifier?: number | null
          modifier_attribute_name?: string | null
          name: string
          rarity?: string | null
          required_skill?: string | null
          short_description?: string | null
          strong_cost?: number | null
          strong_damage?: number | null
          strong_defence?: number | null
          subtype?: string | null
          type?: string | null
          weight?: number | null
        }
        Update: {
          action_text?: string | null
          coefficient?: number | null
          coefficient_attribute_name?: string | null
          consumable?: boolean | null
          cost?: number | null
          cost_attribute_name?: string | null
          cost_gold?: number | null
          damage?: string | null
          default_condition?: number | null
          defence?: number | null
          die_count?: number | null
          effects?: Json
          hidden?: boolean | null
          id?: string
          image_url?: string | null
          is_magical?: boolean | null
          long_description?: string | null
          modifier?: number | null
          modifier_attribute_name?: string | null
          name?: string
          rarity?: string | null
          required_skill?: string | null
          short_description?: string | null
          strong_cost?: number | null
          strong_damage?: number | null
          strong_defence?: number | null
          subtype?: string | null
          type?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_coefficient_attribute_name_fkey"
            columns: ["coefficient_attribute_name"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "items_cost_attribute_name_fkey"
            columns: ["cost_attribute_name"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "items_modifier_attribute_name_fkey"
            columns: ["modifier_attribute_name"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "items_required_skill_fkey"
            columns: ["required_skill"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      npcs: {
        Row: {
          attribute_modifiers: Json
          current_location_id: string
          disposition_to_players: number | null
          faction: string | null
          game_id: string
          id: string
          is_alive: boolean | null
          last_seen_tick: number | null
          name: string
          personality_profile: Json
          title: string | null
        }
        Insert: {
          attribute_modifiers?: Json
          current_location_id?: string
          disposition_to_players?: number | null
          faction?: string | null
          game_id: string
          id?: string
          is_alive?: boolean | null
          last_seen_tick?: number | null
          name: string
          personality_profile?: Json
          title?: string | null
        }
        Update: {
          attribute_modifiers?: Json
          current_location_id?: string
          disposition_to_players?: number | null
          faction?: string | null
          game_id?: string
          id?: string
          is_alive?: boolean | null
          last_seen_tick?: number | null
          name?: string
          personality_profile?: Json
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "npcs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_offers: {
        Row: {
          character_id: string
          condition: number | null
          created_at: string | null
          game_id: string
          giver_inventory_id: string | null
          id: string
          quantity: number | null
          source_id: string | null
          type: Database["public"]["Enums"]["offer_type"]
        }
        Insert: {
          character_id: string
          condition?: number | null
          created_at?: string | null
          game_id: string
          giver_inventory_id?: string | null
          id?: string
          quantity?: number | null
          source_id?: string | null
          type: Database["public"]["Enums"]["offer_type"]
        }
        Update: {
          character_id?: string
          condition?: number | null
          created_at?: string | null
          game_id?: string
          giver_inventory_id?: string | null
          id?: string
          quantity?: number | null
          source_id?: string | null
          type?: Database["public"]["Enums"]["offer_type"]
        }
        Relationships: [
          {
            foreignKeyName: "pending_offers_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_offers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_offers_giver_inventory_id_fkey"
            columns: ["giver_inventory_id"]
            isOneToOne: false
            referencedRelation: "character_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          id: string
          is_dev: boolean | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          id: string
          is_dev?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          id?: string
          is_dev?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      roll_events: {
        Row: {
          base_roll: number
          character_id: string
          context: Json
          id: string
          modifier: number
          rolled_at: string
          total: number
          type: string
        }
        Insert: {
          base_roll: number
          character_id: string
          context?: Json
          id?: string
          modifier?: number
          rolled_at?: string
          total: number
          type: string
        }
        Update: {
          base_roll?: number
          character_id?: string
          context?: Json
          id?: string
          modifier?: number
          rolled_at?: string
          total?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "roll_events_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_edges: {
        Row: {
          child_skill_id: string | null
          edge_type: string | null
          id: string
          parent_skill_id: string | null
          required_rank: number | null
        }
        Insert: {
          child_skill_id?: string | null
          edge_type?: string | null
          id?: string
          parent_skill_id?: string | null
          required_rank?: number | null
        }
        Update: {
          child_skill_id?: string | null
          edge_type?: string | null
          id?: string
          parent_skill_id?: string | null
          required_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "skill_edges_child_skill_id_fkey"
            columns: ["child_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_edges_parent_skill_id_fkey"
            columns: ["parent_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          created_at: string | null
          effects: Json | null
          id: string
          in_development: boolean
          is_passive: boolean | null
          max_rank: number | null
          min_level: number
          name: string
          skill_text: string | null
          unlock_hint: string | null
          unlock_key: string | null
        }
        Insert: {
          created_at?: string | null
          effects?: Json | null
          id?: string
          in_development?: boolean
          is_passive?: boolean | null
          max_rank?: number | null
          min_level?: number
          name: string
          skill_text?: string | null
          unlock_hint?: string | null
          unlock_key?: string | null
        }
        Update: {
          created_at?: string | null
          effects?: Json | null
          id?: string
          in_development?: boolean
          is_passive?: boolean | null
          max_rank?: number | null
          min_level?: number
          name?: string
          skill_text?: string | null
          unlock_hint?: string | null
          unlock_key?: string | null
        }
        Relationships: []
      }
      spells: {
        Row: {
          active: boolean | null
          aoe_m: number | null
          cast_time_min: number | null
          coefficient: number | null
          coefficient_attribute_name: string | null
          cooldown_min: number | null
          cost: number | null
          cost_attribute_name: string | null
          damage: number | null
          defence: number | null
          description: string | null
          effects: Json
          id: number
          modifier: number | null
          modifier_attribute_name: string | null
          name: string | null
          range_m: number | null
          remain_time_min: number | null
          req_item_1: string | null
          req_item_2: string | null
          req_item_3: string | null
          req_skill_1: string | null
          req_skill_2: string | null
          subtype: string | null
          type: string | null
        }
        Insert: {
          active?: boolean | null
          aoe_m?: number | null
          cast_time_min?: number | null
          coefficient?: number | null
          coefficient_attribute_name?: string | null
          cooldown_min?: number | null
          cost?: number | null
          cost_attribute_name?: string | null
          damage?: number | null
          defence?: number | null
          description?: string | null
          effects?: Json
          id?: number
          modifier?: number | null
          modifier_attribute_name?: string | null
          name?: string | null
          range_m?: number | null
          remain_time_min?: number | null
          req_item_1?: string | null
          req_item_2?: string | null
          req_item_3?: string | null
          req_skill_1?: string | null
          req_skill_2?: string | null
          subtype?: string | null
          type?: string | null
        }
        Update: {
          active?: boolean | null
          aoe_m?: number | null
          cast_time_min?: number | null
          coefficient?: number | null
          coefficient_attribute_name?: string | null
          cooldown_min?: number | null
          cost?: number | null
          cost_attribute_name?: string | null
          damage?: number | null
          defence?: number | null
          description?: string | null
          effects?: Json
          id?: number
          modifier?: number | null
          modifier_attribute_name?: string | null
          name?: string | null
          range_m?: number | null
          remain_time_min?: number | null
          req_item_1?: string | null
          req_item_2?: string | null
          req_item_3?: string | null
          req_skill_1?: string | null
          req_skill_2?: string | null
          subtype?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spells_coefficient_attribute_name_fkey"
            columns: ["coefficient_attribute_name"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "spells_cost_attribute_name_fkey"
            columns: ["cost_attribute_name"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "spells_modifier_attribute_name_fkey"
            columns: ["modifier_attribute_name"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "spells_req_item_1_fkey"
            columns: ["req_item_1"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spells_req_item_2_fkey"
            columns: ["req_item_2"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spells_req_item_3_fkey"
            columns: ["req_item_3"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spells_req_skill_1_fkey"
            columns: ["req_skill_1"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spells_req_skill_2_fkey"
            columns: ["req_skill_2"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      world_lore: {
        Row: {
          attributes: Json | null
          category: Database["public"]["Enums"]["lore_type"]
          created_at: string | null
          id: number
          long_desc: string
          name: string
          search_vector: unknown
          short_desc: string
        }
        Insert: {
          attributes?: Json | null
          category: Database["public"]["Enums"]["lore_type"]
          created_at?: string | null
          id?: number
          long_desc: string
          name: string
          search_vector?: unknown
          short_desc: string
        }
        Update: {
          attributes?: Json | null
          category?: Database["public"]["Enums"]["lore_type"]
          created_at?: string | null
          id?: number
          long_desc?: string
          name?: string
          search_vector?: unknown
          short_desc?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_user_is_game_member: {
        Args: { p_game_id: string }
        Returns: boolean
      }
      delete_giver_inventory_for_offer: {
        Args: { p_giver_inventory_id: string; p_offer_id: string }
        Returns: undefined
      }
      is_dev: { Args: never; Returns: boolean }
      is_game_gm: { Args: { p_game_id: string }; Returns: boolean }
      is_game_member: { Args: { p_game_id: string }; Returns: boolean }
      save_skill_edges_delta: {
        Args: { p_delete_ids: string[]; p_upsert_edges: Json }
        Returns: undefined
      }
      search_world_lore: {
        Args: { search_query: string }
        Returns: {
          attributes: Json
          category: Database["public"]["Enums"]["lore_type"]
          id: number
          long_desc: string
          name: string
          rank: number
          short_desc: string
        }[]
      }
      set_user_dev_status: {
        Args: { dev_status: boolean; target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      lore_type:
        | "nation"
        | "region"
        | "polis"
        | "location"
        | "npc"
        | "item"
        | "faction"
      offer_type: "item" | "denarius" | "skill_point" | "spell"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      lore_type: [
        "nation",
        "region",
        "polis",
        "location",
        "npc",
        "item",
        "faction",
      ],
      offer_type: ["item", "denarius", "skill_point", "spell"],
    },
  },
} as const
