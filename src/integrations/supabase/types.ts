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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          currency: string
          id: number
          payment_methods: Json
          withdrawal_fee_fixed: number
          withdrawal_fee_percent: number
        }
        Insert: {
          currency?: string
          id?: number
          payment_methods?: Json
          withdrawal_fee_fixed?: number
          withdrawal_fee_percent?: number
        }
        Update: {
          currency?: string
          id?: number
          payment_methods?: Json
          withdrawal_fee_fixed?: number
          withdrawal_fee_percent?: number
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          proof_url: string | null
          reference: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          proof_url?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          proof_url?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      lease_contracts: {
        Row: {
          created_at: string
          deposit_amount: number
          due_day: number
          duration_months: number
          id: string
          landlord_id: string
          property_id: string
          reference: string
          rent_amount: number
          start_date: string
          tenancy_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_amount?: number
          due_day?: number
          duration_months?: number
          id?: string
          landlord_id: string
          property_id: string
          reference: string
          rent_amount?: number
          start_date?: string
          tenancy_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_amount?: number
          due_day?: number
          duration_months?: number
          id?: string
          landlord_id?: string
          property_id?: string
          reference?: string
          rent_amount?: number
          start_date?: string
          tenancy_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_contracts_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: true
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      offline_payment_claims: {
        Row: {
          amount: number
          created_at: string
          cycle_id: string
          id: string
          landlord_id: string
          note: string | null
          reviewed_at: string | null
          status: Database["public"]["Enums"]["request_status"]
          tenancy_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          cycle_id: string
          id?: string
          landlord_id: string
          note?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tenancy_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          cycle_id?: string
          id?: string
          landlord_id?: string
          note?: string | null
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tenancy_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offline_payment_claims_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "rent_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offline_payment_claims_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_methods: {
        Row: {
          account_name: string | null
          account_number: string
          created_at: string
          id: string
          network: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          created_at?: string
          id?: string
          network: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          created_at?: string
          id?: string
          network?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          biometric_credential: Json | null
          biometric_enabled: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          pin_hash: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          biometric_credential?: Json | null
          biometric_enabled?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          biometric_credential?: Json | null
          biometric_enabled?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          pin_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          description: string | null
          district: string | null
          due_day: number
          id: string
          landlord_id: string
          name: string
          photos: string[]
          rent_amount: number
          type: Database["public"]["Enums"]["property_type"]
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          due_day?: number
          id?: string
          landlord_id: string
          name: string
          photos?: string[]
          rent_amount?: number
          type?: Database["public"]["Enums"]["property_type"]
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          district?: string | null
          due_day?: number
          id?: string
          landlord_id?: string
          name?: string
          photos?: string[]
          rent_amount?: number
          type?: Database["public"]["Enums"]["property_type"]
        }
        Relationships: []
      }
      rent_cycles: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string
          formal_notice_at: string | null
          id: string
          landlord_id: string
          late_notified_at: string | null
          period: string
          status: string
          tenancy_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date: string
          formal_notice_at?: string | null
          id?: string
          landlord_id: string
          late_notified_at?: string | null
          period: string
          status?: string
          tenancy_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          formal_notice_at?: string | null
          id?: string
          landlord_id?: string
          late_notified_at?: string | null
          period?: string
          status?: string
          tenancy_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_cycles_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          landlord_id: string
          mode: string
          tenancy_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          landlord_id: string
          mode?: string
          tenancy_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          landlord_id?: string
          mode?: string
          tenancy_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_payments_tenancy_id_fkey"
            columns: ["tenancy_id"]
            isOneToOne: false
            referencedRelation: "tenancies"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancies: {
        Row: {
          active: boolean
          created_at: string
          cycle_start: string
          id: string
          landlord_id: string
          paid_current_cycle: number
          property_id: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cycle_start?: string
          id?: string
          landlord_id: string
          paid_current_cycle?: number
          property_id: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cycle_start?: string
          id?: string
          landlord_id?: string
          paid_current_cycle?: number
          property_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          label: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          account_number: string
          amount: number
          created_at: string
          fee: number
          id: string
          net_amount: number
          network: string
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          account_number: string
          amount: number
          created_at?: string
          fee?: number
          id?: string
          net_amount?: number
          network: string
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          account_number?: string
          amount?: number
          created_at?: string
          fee?: number
          id?: string
          net_amount?: number
          network?: string
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_update_settings: {
        Args: { _fee_fixed: number; _fee_percent: number; _methods: Json }
        Returns: undefined
      }
      allocate_rent: {
        Args: { _amount: number; _tenancy_id: string }
        Returns: number
      }
      assign_tenant: {
        Args: { _property_id: string; _tenant_id: string }
        Returns: string
      }
      become_landlord: { Args: never; Returns: undefined }
      claim_tenancy: { Args: { _property_id: string }; Returns: string }
      declare_offline_payment: {
        Args: { _amount: number; _cycle_id: string; _note?: string }
        Returns: string
      }
      ensure_rent_cycles: { Args: { _tenancy_id: string }; Returns: undefined }
      generate_lease_contract: {
        Args: { _tenancy_id: string }
        Returns: string
      }
      get_app_settings: {
        Args: never
        Returns: {
          currency: string
          id: number
          payment_methods: Json
          withdrawal_fee_fixed: number
          withdrawal_fee_percent: number
        }[]
      }
      get_my_biometric: { Args: never; Returns: Json }
      has_pin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_landlord_properties: {
        Args: { _landlord_id: string }
        Returns: {
          city: string
          district: string
          due_day: number
          id: string
          name: string
          rent_amount: number
          type: Database["public"]["Enums"]["property_type"]
        }[]
      }
      pay_rent: {
        Args: { _amount: number; _mode?: string; _tenancy_id: string }
        Returns: string
      }
      refresh_my_rent: { Args: never; Returns: undefined }
      review_deposit: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      review_offline_payment: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      review_withdrawal: {
        Args: { _approve: boolean; _id: string }
        Returns: undefined
      }
      search_users: {
        Args: { _q: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      set_pin: { Args: { _pin: string }; Returns: undefined }
      settle_arrears: { Args: { _user_id: string }; Returns: number }
      verify_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "landlord" | "tenant" | "user"
      property_type:
        | "studio"
        | "studio_americain"
        | "2_pieces"
        | "3_pieces"
        | "4_pieces"
        | "villa"
        | "villa_piscine"
        | "appart_1"
        | "appart_2"
        | "appart_3"
        | "magasin"
        | "bureau"
        | "autre"
      request_status: "pending" | "approved" | "rejected"
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
      app_role: ["admin", "landlord", "tenant", "user"],
      property_type: [
        "studio",
        "studio_americain",
        "2_pieces",
        "3_pieces",
        "4_pieces",
        "villa",
        "villa_piscine",
        "appart_1",
        "appart_2",
        "appart_3",
        "magasin",
        "bureau",
        "autre",
      ],
      request_status: ["pending", "approved", "rejected"],
    },
  },
} as const
