// Generated from migrated local Supabase. Run npm run db:types; do not edit.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      agencies: {
        Row: {
          ars_per_usd: number;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          ars_per_usd: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
        };
        Update: {
          ars_per_usd?: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      agency_invitations: {
        Row: {
          accepted_at: string | null;
          agency_id: string;
          created_at: string;
          display_name: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          status: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          agency_id: string;
          created_at?: string;
          display_name: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          agency_id?: string;
          created_at?: string;
          display_name?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agency_invitations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_invitations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_user_invitations: {
        Row: {
          accepted_at: string | null;
          agency_id: string;
          created_at: string;
          display_name: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: string;
          status: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          agency_id: string;
          created_at?: string;
          display_name: string;
          email: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          role: string;
          status?: string;
          user_id?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          agency_id?: string;
          created_at?: string;
          display_name?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          role?: string;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "agency_user_invitations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_user_invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_user_invitations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string;
          agency_id: string;
          created_at: string;
          id: string;
          invitation_id: string | null;
          membership_id: string | null;
          new_role: string | null;
          previous_role: string | null;
          target_user_id: string | null;
          user_invitation_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id: string;
          agency_id: string;
          created_at?: string;
          id?: string;
          invitation_id?: string | null;
          membership_id?: string | null;
          new_role?: string | null;
          previous_role?: string | null;
          target_user_id?: string | null;
          user_invitation_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string;
          agency_id?: string;
          created_at?: string;
          id?: string;
          invitation_id?: string | null;
          membership_id?: string | null;
          new_role?: string | null;
          previous_role?: string | null;
          target_user_id?: string | null;
          user_invitation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "agency_invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_membership_fk";
            columns: ["agency_id", "membership_id"];
            isOneToOne: false;
            referencedRelation: "memberships";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "audit_events_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_user_invitation_fk";
            columns: ["agency_id", "user_invitation_id"];
            isOneToOne: false;
            referencedRelation: "agency_user_invitations";
            referencedColumns: ["agency_id", "id"];
          },
        ];
      };
      memberships: {
        Row: {
          agency_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          role: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          role: string;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_admins: {
        Row: {
          created_at: string;
          is_active: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          is_active?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_agency_user_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      accept_superadmin_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      assign_initial_agency_superadmin: {
        Args: { p_agency_id: string; p_user_id: string };
        Returns: string;
      };
      begin_agency_user_invitation: {
        Args: {
          p_agency_id: string;
          p_display_name: string;
          p_email: string;
          p_role: string;
        };
        Returns: string;
      };
      begin_superadmin_invitation: {
        Args: { p_agency_id: string; p_display_name: string; p_email: string };
        Returns: string;
      };
      cancel_agency_user_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      cancel_superadmin_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      create_agency: {
        Args: { p_ars_per_usd: string; p_name: string; p_slug: string };
        Returns: string;
      };
      finish_agency_user_invitation: {
        Args: {
          p_delivered: boolean;
          p_invitation_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      finish_superadmin_invitation: {
        Args: {
          p_delivered: boolean;
          p_invitation_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      list_agency_members: {
        Args: { p_agency_id: string; p_offset?: number };
        Returns: {
          created_at: string;
          display_name: string;
          id: string;
          is_active: boolean;
          role: string;
          user_id: string;
        }[];
      };
      prepare_existing_agency_user_invitation: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      prepare_existing_invitation_profile: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      set_agency_member_active: {
        Args: {
          p_agency_id: string;
          p_expected_is_active: boolean;
          p_is_active: boolean;
          p_membership_id: string;
        };
        Returns: string;
      };
      set_agency_member_role: {
        Args: {
          p_agency_id: string;
          p_expected_is_active: boolean;
          p_expected_role: string;
          p_membership_id: string;
          p_role: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
