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
      accounts_payable: {
        Row: {
          amount: number
          attachment_url: string | null
          bank_account_id: string | null
          category_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string
          document_number: string | null
          due_date: string
          id: string
          installment_number: number | null
          installment_total: number | null
          is_recurring: boolean
          issue_date: string | null
          notes: string | null
          payment_date: string | null
          payment_method_id: string | null
          pessoa_tipo: Database["public"]["Enums"]["pessoa_tipo"]
          recurrence_interval:
            | Database["public"]["Enums"]["recurrence_interval"]
            | null
          status: Database["public"]["Enums"]["payable_status"]
          supplier_id: string | null
          supplier_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description: string
          document_number?: string | null
          due_date: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          is_recurring?: boolean
          issue_date?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method_id?: string | null
          pessoa_tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          recurrence_interval?:
            | Database["public"]["Enums"]["recurrence_interval"]
            | null
          status?: Database["public"]["Enums"]["payable_status"]
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          category_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string
          document_number?: string | null
          due_date?: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          is_recurring?: boolean
          issue_date?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method_id?: string | null
          pessoa_tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          recurrence_interval?:
            | Database["public"]["Enums"]["recurrence_interval"]
            | null
          status?: Database["public"]["Enums"]["payable_status"]
          supplier_id?: string | null
          supplier_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_payable_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      bancos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cash_transactions: {
        Row: {
          account_payable_id: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          description: string | null
          id: string
          transaction_date: string
          type: Database["public"]["Enums"]["cash_transaction_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_payable_id?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          transaction_date?: string
          type: Database["public"]["Enums"]["cash_transaction_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_payable_id?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          transaction_date?: string
          type?: Database["public"]["Enums"]["cash_transaction_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_account_payable_id_fkey"
            columns: ["account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          categoria_pai_id: string | null
          created_at: string
          id: string
          nome: string
          ordem: number
          tipo: Database["public"]["Enums"]["tipo_financeiro"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          categoria_pai_id?: string | null
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          tipo: Database["public"]["Enums"]["tipo_financeiro"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          categoria_pai_id?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          tipo?: Database["public"]["Enums"]["tipo_financeiro"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_financeiras_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          nome_completo: string | null
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      colaboradores: {
        Row: {
          ativo: boolean
          cargo: string | null
          cpf: string
          created_at: string
          data_admissao: string | null
          departamento: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          salario: number | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cpf: string
          created_at?: string
          data_admissao?: string | null
          departamento?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          salario?: number | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string
          created_at?: string
          data_admissao?: string | null
          departamento?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          salario?: number | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contas_bancarias: {
        Row: {
          ativo: boolean
          banco: string | null
          banco_id: string | null
          created_at: string
          id: string
          nome: string
          pessoa_tipo: Database["public"]["Enums"]["pessoa_tipo"]
          saldo_inicial: number
          tipo: Database["public"]["Enums"]["tipo_conta_bancaria"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          banco_id?: string | null
          created_at?: string
          id?: string
          nome: string
          pessoa_tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          saldo_inicial?: number
          tipo?: Database["public"]["Enums"]["tipo_conta_bancaria"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          banco_id?: string | null
          created_at?: string
          id?: string
          nome?: string
          pessoa_tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          saldo_inicial?: number
          tipo?: Database["public"]["Enums"]["tipo_conta_bancaria"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "bancos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string
          created_at: string
          email: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj: string
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      formas_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          numero_cartao: string | null
          tipo: Database["public"]["Enums"]["tipo_forma_pagamento"]
          tipo_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          numero_cartao?: string | null
          tipo?: Database["public"]["Enums"]["tipo_forma_pagamento"]
          tipo_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          numero_cartao?: string | null
          tipo?: Database["public"]["Enums"]["tipo_forma_pagamento"]
          tipo_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_forma_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          email: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          nome_completo: string | null
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      menu_permissions: {
        Row: {
          can_view: boolean
          created_at: string
          id: string
          menu_id: string
          role: string
        }
        Insert: {
          can_view?: boolean
          created_at?: string
          id?: string
          menu_id: string
          role?: string
        }
        Update: {
          can_view?: boolean
          created_at?: string
          id?: string
          menu_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_permissions_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          is_visible: boolean
          module: string
          name: string
          order_index: number
          parent_id: string | null
          route: string | null
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          module?: string
          name: string
          order_index?: number
          parent_id?: string | null
          route?: string | null
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          is_visible?: boolean
          module?: string
          name?: string
          order_index?: number
          parent_id?: string | null
          route?: string | null
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      pluggy_bank_accounts: {
        Row: {
          balance: number
          bank_data: Json | null
          connection_id: string | null
          created_at: string
          credit_available: number | null
          credit_bill_amount: number | null
          credit_bill_due_date: string | null
          credit_limit: number | null
          currency_code: string | null
          id: string
          name: string
          pluggy_account_id: string
          pluggy_item_id: string
          subtype: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          bank_data?: Json | null
          connection_id?: string | null
          created_at?: string
          credit_available?: number | null
          credit_bill_amount?: number | null
          credit_bill_due_date?: string | null
          credit_limit?: number | null
          currency_code?: string | null
          id?: string
          name: string
          pluggy_account_id: string
          pluggy_item_id: string
          subtype?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          bank_data?: Json | null
          connection_id?: string | null
          created_at?: string
          credit_available?: number | null
          credit_bill_amount?: number | null
          credit_bill_due_date?: string | null
          credit_limit?: number | null
          currency_code?: string | null
          id?: string
          name?: string
          pluggy_account_id?: string
          pluggy_item_id?: string
          subtype?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pluggy_bank_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "pluggy_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      pluggy_connections: {
        Row: {
          connector_name: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          pluggy_item_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connector_name?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          pluggy_item_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connector_name?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          pluggy_item_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pluggy_notifications: {
        Row: {
          created_at: string
          descricao: string
          id: string
          lida: boolean
          tipo: string
          titulo: string
          user_id: string
          webhook_log_id: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          lida?: boolean
          tipo?: string
          titulo: string
          user_id: string
          webhook_log_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          lida?: boolean
          tipo?: string
          titulo?: string
          user_id?: string
          webhook_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pluggy_notifications_webhook_log_id_fkey"
            columns: ["webhook_log_id"]
            isOneToOne: false
            referencedRelation: "pluggy_webhooks_log"
            referencedColumns: ["id"]
          },
        ]
      }
      pluggy_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          payment_data: Json | null
          pluggy_account_id: string
          pluggy_transaction_id: string
          reconciled: boolean
          reconciled_payable_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          payment_data?: Json | null
          pluggy_account_id: string
          pluggy_transaction_id: string
          reconciled?: boolean
          reconciled_payable_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          payment_data?: Json | null
          pluggy_account_id?: string
          pluggy_transaction_id?: string
          reconciled?: boolean
          reconciled_payable_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pluggy_transactions_reconciled_payable_id_fkey"
            columns: ["reconciled_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
        ]
      }
      pluggy_webhooks_log: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          item_id: string | null
          payload: Json
          processed: boolean
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          item_id?: string | null
          payload?: Json
          processed?: boolean
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          item_id?: string | null
          payload?: Json
          processed?: boolean
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          descricao: string | null
          estoque_atual: number | null
          estoque_minimo: number | null
          id: string
          nome: string
          preco_custo: number | null
          preco_venda: number | null
          sku: string | null
          unidade: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          nome: string
          preco_custo?: number | null
          preco_venda?: number | null
          sku?: string | null
          unidade?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          estoque_atual?: number | null
          estoque_minimo?: number | null
          id?: string
          nome?: string
          preco_custo?: number | null
          preco_venda?: number | null
          sku?: string | null
          unidade?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tipos_forma_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      seed_default_bancos: { Args: { p_user_id: string }; Returns: undefined }
      seed_default_menus: { Args: { p_user_id: string }; Returns: undefined }
      seed_default_tipos_pagamento: {
        Args: { p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      cash_transaction_type: "income" | "expense"
      payable_status: "pending" | "paid" | "overdue" | "cancelled"
      pessoa_tipo: "pf" | "pj"
      recurrence_interval: "monthly" | "weekly" | "yearly"
      tipo_conta_bancaria:
        | "corrente"
        | "poupanca"
        | "caixa"
        | "carteira_digital"
      tipo_financeiro: "receita" | "despesa" | "custo" | "ajuste"
      tipo_forma_pagamento:
        | "pix"
        | "boleto"
        | "cartao"
        | "transferencia"
        | "dinheiro"
      unidade_medida:
        | "un"
        | "kg"
        | "g"
        | "l"
        | "ml"
        | "m"
        | "cm"
        | "cx"
        | "pc"
        | "par"
        | "kit"
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
      cash_transaction_type: ["income", "expense"],
      payable_status: ["pending", "paid", "overdue", "cancelled"],
      pessoa_tipo: ["pf", "pj"],
      recurrence_interval: ["monthly", "weekly", "yearly"],
      tipo_conta_bancaria: [
        "corrente",
        "poupanca",
        "caixa",
        "carteira_digital",
      ],
      tipo_financeiro: ["receita", "despesa", "custo", "ajuste"],
      tipo_forma_pagamento: [
        "pix",
        "boleto",
        "cartao",
        "transferencia",
        "dinheiro",
      ],
      unidade_medida: [
        "un",
        "kg",
        "g",
        "l",
        "ml",
        "m",
        "cm",
        "cx",
        "pc",
        "par",
        "kit",
      ],
    },
  },
} as const
