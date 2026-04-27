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
          categoria_financeira_id: string | null
          category_id: string | null
          cliente_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string
          document_number: string | null
          due_date: string
          empresa_id: string | null
          grupo_id: string | null
          id: string
          import_id: string | null
          installment_number: number | null
          installment_total: number | null
          is_recurring: boolean
          issue_date: string | null
          juros_multa: number
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
          categoria_financeira_id?: string | null
          category_id?: string | null
          cliente_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description: string
          document_number?: string | null
          due_date: string
          empresa_id?: string | null
          grupo_id?: string | null
          id?: string
          import_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_recurring?: boolean
          issue_date?: string | null
          juros_multa?: number
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
          categoria_financeira_id?: string | null
          category_id?: string | null
          cliente_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string
          document_number?: string | null
          due_date?: string
          empresa_id?: string | null
          grupo_id?: string | null
          id?: string
          import_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_recurring?: boolean
          issue_date?: string | null
          juros_multa?: number
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
            foreignKeyName: "accounts_payable_categoria_financeira_id_fkey"
            columns: ["categoria_financeira_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categorias_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_payable_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
            foreignKeyName: "accounts_payable_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
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
      accounts_receivable: {
        Row: {
          amount: number
          attachment_url: string | null
          bank_account_id: string | null
          categoria_financeira_id: string | null
          category_id: string | null
          cliente_id: string | null
          cost_center_id: string | null
          created_at: string
          description: string
          document_number: string | null
          due_date: string
          empresa_id: string | null
          grupo_id: string | null
          id: string
          import_id: string | null
          installment_number: number | null
          installment_total: number | null
          is_recurring: boolean
          juros_multa: number
          notes: string | null
          payment_date: string | null
          payment_method_id: string | null
          pessoa_tipo: string
          recurrence_interval: string | null
          status: string
          supplier_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          categoria_financeira_id?: string | null
          category_id?: string | null
          cliente_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description: string
          document_number?: string | null
          due_date: string
          empresa_id?: string | null
          grupo_id?: string | null
          id?: string
          import_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_recurring?: boolean
          juros_multa?: number
          notes?: string | null
          payment_date?: string | null
          payment_method_id?: string | null
          pessoa_tipo?: string
          recurrence_interval?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          bank_account_id?: string | null
          categoria_financeira_id?: string | null
          category_id?: string | null
          cliente_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          description?: string
          document_number?: string | null
          due_date?: string
          empresa_id?: string | null
          grupo_id?: string | null
          id?: string
          import_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          is_recurring?: boolean
          juros_multa?: number
          notes?: string | null
          payment_date?: string | null
          payment_method_id?: string | null
          pessoa_tipo?: string
          recurrence_interval?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_categoria_financeira_id_fkey"
            columns: ["categoria_financeira_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categorias_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "formas_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_cobrancas: {
        Row: {
          account_receivable_id: string | null
          asaas_customer_id: string | null
          asaas_payment_id: string
          bank_slip_url: string | null
          billing_type: string
          cliente_id: string | null
          created_at: string
          due_date: string
          empresa_id: string | null
          id: string
          identification_field: string | null
          invoice_url: string | null
          payment_date: string | null
          pix_payload: string | null
          pix_qr_code: string | null
          raw_data: Json | null
          status: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          account_receivable_id?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id: string
          bank_slip_url?: string | null
          billing_type: string
          cliente_id?: string | null
          created_at?: string
          due_date: string
          empresa_id?: string | null
          id?: string
          identification_field?: string | null
          invoice_url?: string | null
          payment_date?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          raw_data?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          account_receivable_id?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string
          bank_slip_url?: string | null
          billing_type?: string
          cliente_id?: string | null
          created_at?: string
          due_date?: string
          empresa_id?: string | null
          id?: string
          identification_field?: string | null
          invoice_url?: string | null
          payment_date?: string | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          raw_data?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "asaas_cobrancas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      automacao_acoes_tipo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          label: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          label: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          label?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacao_acoes_tipo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      automacao_gatilhos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          label: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          label: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          label?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacao_gatilhos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      automacoes: {
        Row: {
          acoes: Json
          ativo: boolean
          condicoes: Json
          created_at: string
          descricao: string | null
          empresa_id: string | null
          evento_gatilho: string
          executado_count: number
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acoes?: Json
          ativo?: boolean
          condicoes?: Json
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          evento_gatilho: string
          executado_count?: number
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acoes?: Json
          ativo?: boolean
          condicoes?: Json
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          evento_gatilho?: string
          executado_count?: number
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      bancos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bancos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_transactions: {
        Row: {
          account_payable_id: string | null
          amount: number
          bank_account_id: string | null
          categoria_financeira_id: string | null
          created_at: string
          description: string | null
          empresa_id: string | null
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
          categoria_financeira_id?: string | null
          created_at?: string
          description?: string | null
          empresa_id?: string | null
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
          categoria_financeira_id?: string | null
          created_at?: string
          description?: string | null
          empresa_id?: string | null
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
          {
            foreignKeyName: "cash_transactions_categoria_financeira_id_fkey"
            columns: ["categoria_financeira_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_transactions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_forecasts: {
        Row: {
          amount: number
          bank_account_id: string | null
          category: string | null
          created_at: string
          dedup_hash: string
          description: string
          direction: Database["public"]["Enums"]["cashflow_direction"]
          document_number: string | null
          empresa_id: string | null
          forecast_date: string
          id: string
          import_id: string | null
          notes: string | null
          source: Database["public"]["Enums"]["cashflow_source"]
          status: Database["public"]["Enums"]["cashflow_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category?: string | null
          created_at?: string
          dedup_hash?: string
          description: string
          direction: Database["public"]["Enums"]["cashflow_direction"]
          document_number?: string | null
          empresa_id?: string | null
          forecast_date: string
          id?: string
          import_id?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["cashflow_source"]
          status?: Database["public"]["Enums"]["cashflow_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category?: string | null
          created_at?: string
          dedup_hash?: string
          description?: string
          direction?: Database["public"]["Enums"]["cashflow_direction"]
          document_number?: string | null
          empresa_id?: string | null
          forecast_date?: string
          id?: string
          import_id?: string | null
          notes?: string | null
          source?: Database["public"]["Enums"]["cashflow_source"]
          status?: Database["public"]["Enums"]["cashflow_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_forecasts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_forecasts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cf_forecasts_import_fk"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "cashflow_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      cashflow_imports: {
        Row: {
          created_at: string
          duplicate_count: number
          empresa_id: string | null
          errors: Json
          filename: string
          id: string
          inserted_count: number
          skipped_count: number
          source: Database["public"]["Enums"]["cashflow_source"]
          source_url: string | null
          target: string
          total_rows: number
          user_id: string
        }
        Insert: {
          created_at?: string
          duplicate_count?: number
          empresa_id?: string | null
          errors?: Json
          filename: string
          id?: string
          inserted_count?: number
          skipped_count?: number
          source: Database["public"]["Enums"]["cashflow_source"]
          source_url?: string | null
          target?: string
          total_rows?: number
          user_id: string
        }
        Update: {
          created_at?: string
          duplicate_count?: number
          empresa_id?: string | null
          errors?: Json
          filename?: string
          id?: string
          inserted_count?: number
          skipped_count?: number
          source?: Database["public"]["Enums"]["cashflow_source"]
          source_url?: string | null
          target?: string
          total_rows?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_imports_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_cadastro: {
        Row: {
          ativo: boolean
          categoria_pai_id: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          categoria_pai_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          categoria_pai_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_cadastro_categoria_pai_id_fkey"
            columns: ["categoria_pai_id"]
            isOneToOne: false
            referencedRelation: "categorias_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categorias_cadastro_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          ativo: boolean
          categoria_pai_id: string | null
          created_at: string
          dre_group: Database["public"]["Enums"]["dre_group"] | null
          empresa_id: string | null
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
          dre_group?: Database["public"]["Enums"]["dre_group"] | null
          empresa_id?: string | null
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
          dre_group?: Database["public"]["Enums"]["dre_group"] | null
          empresa_id?: string | null
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
          {
            foreignKeyName: "categorias_financeiras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clicksign_documentos: {
        Row: {
          clicksign_document_key: string
          cliente_id: string | null
          created_at: string
          empresa_id: string | null
          finalizado_em: string | null
          id: string
          nome: string
          raw_data: Json | null
          signatarios: Json
          status: string
          updated_at: string
          url_assinado: string | null
          url_original: string | null
          user_id: string
        }
        Insert: {
          clicksign_document_key: string
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string | null
          finalizado_em?: string | null
          id?: string
          nome: string
          raw_data?: Json | null
          signatarios?: Json
          status?: string
          updated_at?: string
          url_assinado?: string | null
          url_original?: string | null
          user_id: string
        }
        Update: {
          clicksign_document_key?: string
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string | null
          finalizado_em?: string | null
          id?: string
          nome?: string
          raw_data?: Json | null
          signatarios?: Json
          status?: string
          updated_at?: string
          url_assinado?: string | null
          url_original?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clicksign_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_documentos: {
        Row: {
          cliente_id: string
          created_at: string
          empresa_id: string | null
          id: string
          interacao_id: string | null
          nome: string
          tamanho: number | null
          tipo: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          interacao_id?: string | null
          nome: string
          tamanho?: number | null
          tipo?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          interacao_id?: string | null
          nome?: string
          tamanho?: number | null
          tipo?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_documentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_documentos_interacao_id_fkey"
            columns: ["interacao_id"]
            isOneToOne: false
            referencedRelation: "cliente_interacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_interacao_tipos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_interacao_tipos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_interacoes: {
        Row: {
          cliente_id: string
          created_at: string
          descricao: string
          empresa_id: string | null
          id: string
          tipo: string
          user_id: string
          usuario_nome: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          descricao: string
          empresa_id?: string | null
          id?: string
          tipo?: string
          user_id: string
          usuario_nome?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          descricao?: string
          empresa_id?: string | null
          id?: string
          tipo?: string
          user_id?: string
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_interacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_interacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_produtos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
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
          complemento: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          empresa_id: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          nome_completo: string | null
          nome_fantasia: string | null
          numero: string | null
          observacoes: string | null
          produto_segmento_id: string | null
          razao_social: string | null
          responsavel_interno: string | null
          tags: string[] | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          produto_segmento_id?: string | null
          razao_social?: string | null
          responsavel_interno?: string | null
          tags?: string[] | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          observacoes?: string | null
          produto_segmento_id?: string | null
          razao_social?: string | null
          responsavel_interno?: string | null
          tags?: string[] | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          salario?: number | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          ativo: boolean
          banco: string | null
          banco_id: string | null
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          pessoa_tipo: Database["public"]["Enums"]["pessoa_tipo"]
          saldo_inicial: number
          saldo_investimento: number
          tipo: Database["public"]["Enums"]["tipo_conta_bancaria"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          banco?: string | null
          banco_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          pessoa_tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          saldo_inicial?: number
          saldo_investimento?: number
          tipo?: Database["public"]["Enums"]["tipo_conta_bancaria"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          banco?: string | null
          banco_id?: string | null
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          pessoa_tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          saldo_inicial?: number
          saldo_investimento?: number
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
          {
            foreignKeyName: "contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_regras: {
        Row: {
          aplicar_em: string
          ativo: boolean
          categoria_destino_id: string
          condicao_logica: string
          condicoes: Json
          created_at: string
          empresa_id: string | null
          escopo: string
          executado_count: number
          id: string
          nome: string
          ordem: number
          ultima_execucao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          aplicar_em?: string
          ativo?: boolean
          categoria_destino_id: string
          condicao_logica?: string
          condicoes?: Json
          created_at?: string
          empresa_id?: string | null
          escopo?: string
          executado_count?: number
          id?: string
          nome: string
          ordem?: number
          ultima_execucao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          aplicar_em?: string
          ativo?: boolean
          categoria_destino_id?: string
          condicao_logica?: string
          condicoes?: Json
          created_at?: string
          empresa_id?: string | null
          escopo?: string
          executado_count?: number
          id?: string
          nome?: string
          ordem?: number
          ultima_execucao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_regras_categoria_destino_id_fkey"
            columns: ["categoria_destino_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_regras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
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
          ativo?: boolean
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
          ativo?: boolean
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "formas_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
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
          categoria_id: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          estado: string | null
          id: string
          inscricao_estadual: string | null
          inscricao_municipal: string | null
          logradouro: string | null
          nome_completo: string | null
          nome_fantasia: string | null
          observacoes: string | null
          produto_segmento_id: string | null
          razao_social: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          categoria_id?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          produto_segmento_id?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          categoria_id?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          estado?: string | null
          id?: string
          inscricao_estadual?: string | null
          inscricao_municipal?: string | null
          logradouro?: string | null
          nome_completo?: string | null
          nome_fantasia?: string | null
          observacoes?: string | null
          produto_segmento_id?: string | null
          razao_social?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      historico_sistema: {
        Row: {
          automacao_id: string | null
          contexto: Json | null
          created_at: string
          descricao: string | null
          empresa_id: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          evento: string
          id: string
          user_id: string
        }
        Insert: {
          automacao_id?: string | null
          contexto?: Json | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          evento: string
          id?: string
          user_id: string
        }
        Update: {
          automacao_id?: string | null
          contexto?: Json | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          evento?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_sistema_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historico_sistema_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integracoes_credenciais: {
        Row: {
          ambiente: string
          api_key: string
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          metadata: Json
          provider: string
          ultima_validacao: string | null
          updated_at: string
          user_id: string
          webhook_token: string | null
        }
        Insert: {
          ambiente?: string
          api_key: string
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          metadata?: Json
          provider: string
          ultima_validacao?: string | null
          updated_at?: string
          user_id: string
          webhook_token?: string | null
        }
        Update: {
          ambiente?: string
          api_key?: string
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          metadata?: Json
          provider?: string
          ultima_validacao?: string | null
          updated_at?: string
          user_id?: string
          webhook_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integracoes_credenciais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_bank_transactions: {
        Row: {
          amount: number
          bank_account_id: string | null
          categoria_financeira_id: string | null
          category: string | null
          created_at: string
          description: string
          document_number: string | null
          empresa_id: string | null
          id: string
          import_id: string | null
          notes: string | null
          pluggy_account_id: string | null
          source: string
          transaction_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          categoria_financeira_id?: string | null
          category?: string | null
          created_at?: string
          description: string
          document_number?: string | null
          empresa_id?: string | null
          id?: string
          import_id?: string | null
          notes?: string | null
          pluggy_account_id?: string | null
          source?: string
          transaction_date: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          categoria_financeira_id?: string | null
          category?: string | null
          created_at?: string
          description?: string
          document_number?: string | null
          empresa_id?: string | null
          id?: string
          import_id?: string | null
          notes?: string | null
          pluggy_account_id?: string | null
          source?: string
          transaction_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_bank_transactions_categoria_financeira_id_fkey"
            columns: ["categoria_financeira_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_bank_transactions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_bank_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "cashflow_imports"
            referencedColumns: ["id"]
          },
        ]
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
            foreignKeyName: "menus_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menus_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      niveis_permissao: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          is_system: boolean
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          is_system?: boolean
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes_sistema: {
        Row: {
          automacao_id: string | null
          created_at: string
          descricao: string | null
          empresa_id: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          id: string
          lida: boolean
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          automacao_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida?: boolean
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          automacao_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          id?: string
          lida?: boolean
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_sistema_automacao_id_fkey"
            columns: ["automacao_id"]
            isOneToOne: false
            referencedRelation: "automacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_sistema_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_overrides: {
        Row: {
          created_at: string
          description: string | null
          display_name: string | null
          features: Json
          highlight: boolean
          id: string
          product_id: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          features?: Json
          highlight?: boolean
          id?: string
          product_id: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string | null
          features?: Json
          highlight?: boolean
          id?: string
          product_id?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
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
      pluggy_investments: {
        Row: {
          amount_original: number | null
          amount_profit: number | null
          balance: number
          code: string | null
          created_at: string
          currency_code: string | null
          due_date: string | null
          fixed_annual_rate: number | null
          id: string
          investment_data: Json | null
          issuer: string | null
          name: string
          pluggy_investment_id: string
          pluggy_item_id: string
          rate: number | null
          rate_type: string | null
          status: string | null
          subtype: string | null
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_original?: number | null
          amount_profit?: number | null
          balance?: number
          code?: string | null
          created_at?: string
          currency_code?: string | null
          due_date?: string | null
          fixed_annual_rate?: number | null
          id?: string
          investment_data?: Json | null
          issuer?: string | null
          name: string
          pluggy_investment_id: string
          pluggy_item_id: string
          rate?: number | null
          rate_type?: string | null
          status?: string | null
          subtype?: string | null
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_original?: number | null
          amount_profit?: number | null
          balance?: number
          code?: string | null
          created_at?: string
          currency_code?: string | null
          due_date?: string | null
          fixed_annual_rate?: number | null
          id?: string
          investment_data?: Json | null
          issuer?: string | null
          name?: string
          pluggy_investment_id?: string
          pluggy_item_id?: string
          rate?: number | null
          rate_type?: string | null
          status?: string | null
          subtype?: string | null
          type?: string | null
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
          categoria_financeira_id: string | null
          category: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          is_internal_transfer: boolean
          payment_data: Json | null
          pluggy_account_id: string
          pluggy_transaction_id: string
          reconciled: boolean
          reconciled_payable_id: string | null
          reconciled_receivable_id: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          categoria_financeira_id?: string | null
          category?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          is_internal_transfer?: boolean
          payment_data?: Json | null
          pluggy_account_id: string
          pluggy_transaction_id: string
          reconciled?: boolean
          reconciled_payable_id?: string | null
          reconciled_receivable_id?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          categoria_financeira_id?: string | null
          category?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          is_internal_transfer?: boolean
          payment_data?: Json | null
          pluggy_account_id?: string
          pluggy_transaction_id?: string
          reconciled?: boolean
          reconciled_payable_id?: string | null
          reconciled_receivable_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pluggy_transactions_categoria_financeira_id_fkey"
            columns: ["categoria_financeira_id"]
            isOneToOne: false
            referencedRelation: "categorias_financeiras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pluggy_transactions_reconciled_payable_id_fkey"
            columns: ["reconciled_payable_id"]
            isOneToOne: false
            referencedRelation: "accounts_payable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pluggy_transactions_reconciled_receivable_id_fkey"
            columns: ["reconciled_receivable_id"]
            isOneToOne: false
            referencedRelation: "accounts_receivable"
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
          empresa_id: string | null
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
          empresa_id?: string | null
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
          empresa_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          empresa_id: string | null
          id: string
          nivel_permissao_id: string | null
          nome: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          empresa_id?: string | null
          id?: string
          nivel_permissao_id?: string | null
          nome?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          empresa_id?: string | null
          id?: string
          nivel_permissao_id?: string | null
          nome?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_nivel_permissao_id_fkey"
            columns: ["nivel_permissao_id"]
            isOneToOne: false
            referencedRelation: "niveis_permissao"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhooks_log: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed?: boolean
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          email: string
          id: string
          is_complimentary: boolean
          is_manual_trial: boolean
          last_synced_at: string
          price_id: string | null
          product_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          email: string
          id?: string
          is_complimentary?: boolean
          is_manual_trial?: boolean
          last_synced_at?: string
          price_id?: string | null
          product_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          email?: string
          id?: string
          is_complimentary?: boolean
          is_manual_trial?: boolean
          last_synced_at?: string
          price_id?: string | null
          product_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tipos_forma_pagamento: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_forma_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          action_key: string
          can_edit: boolean
          can_view: boolean
          created_at: string
          empresa_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_key: string
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_key?: string
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _fmt_brl: { Args: { v: number }; Returns: string }
      aplicar_regras_retroativo: { Args: { p_user_id: string }; Returns: Json }
      avaliar_regra_dre: {
        Args: {
          p_amount: number
          p_cliente_id: string
          p_condicoes: Json
          p_description: string
          p_logica: string
          p_payment_method_id: string
          p_supplier_id: string
          p_supplier_name: string
        }
        Returns: boolean
      }
      cashflow_check_duplicate: {
        Args: {
          p_amount: number
          p_date: string
          p_description: string
          p_direction: string
          p_document: string
          p_empresa_id: string
          p_user_id: string
        }
        Returns: {
          found: boolean
          source_description: string
          source_id: string
          source_table: string
        }[]
      }
      cashflow_consolidated:
        | {
            Args: {
              p_empresa_id: string
              p_end: string
              p_start: string
              p_user_id: string
            }
            Returns: {
              amount: number
              category: string
              description: string
              direction: string
              document_number: string
              movement_date: string
              origin: string
              source_id: string
              source_table: string
              status: string
            }[]
          }
        | {
            Args: { p_end: string; p_start: string; p_user_id: string }
            Returns: {
              amount: number
              bank_account_id: string
              bank_account_name: string
              category_id: string
              category_name: string
              description: string
              direction: string
              document_number: string
              movement_date: string
              origin: string
              source: string
              source_id: string
              status: string
            }[]
          }
      cashflow_generate_hash: {
        Args: {
          p_amount: number
          p_date: string
          p_description: string
          p_direction: string
          p_document: string
          p_empresa_id: string
          p_user_id: string
        }
        Returns: string
      }
      cashflow_normalize_text: { Args: { p_text: string }; Returns: string }
      delete_import_cascade: { Args: { p_import_id: string }; Returns: Json }
      has_active_subscription: { Args: { p_user_id: string }; Returns: boolean }
      has_permission: {
        Args: {
          p_action_key: string
          p_empresa_id: string
          p_level?: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_empresa_owner: {
        Args: { p_empresa_id: string; p_user_id: string }
        Returns: boolean
      }
      is_pluggy_internal_transfer: {
        Args: {
          p_category: string
          p_description: string
          p_payment_data: Json
        }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      normalizar_texto_regra: { Args: { p_texto: string }; Returns: string }
      processar_automacoes: {
        Args: {
          p_contexto?: Json
          p_entidade_id?: string
          p_entidade_tipo?: string
          p_evento: string
          p_user_id: string
        }
        Returns: undefined
      }
      resolver_categoria_por_regras: {
        Args: {
          p_amount: number
          p_aplicar_em: string
          p_cliente_id: string
          p_description: string
          p_empresa_id: string
          p_payment_method_id: string
          p_supplier_id: string
          p_supplier_name: string
          p_user_id: string
        }
        Returns: string
      }
      seed_default_automacao_config: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      seed_default_bancos: { Args: { p_user_id: string }; Returns: undefined }
      seed_default_menus: { Args: { p_user_id: string }; Returns: undefined }
      seed_default_tipos_pagamento: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      title_case_ptbr: { Args: { input: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      cash_transaction_type: "income" | "expense"
      cashflow_direction: "inflow" | "outflow"
      cashflow_source: "manual" | "csv" | "xlsx" | "google_sheets" | "system"
      cashflow_status: "forecast" | "confirmed" | "cancelled" | "reconciled"
      dre_group:
        | "revenue"
        | "deductions"
        | "costs"
        | "operational_expenses"
        | "financial_expenses"
        | "financial_revenue"
        | "taxes"
      payable_status: "pending" | "paid" | "overdue" | "cancelled"
      pessoa_tipo: "pf" | "pj"
      recurrence_interval: "monthly" | "weekly" | "yearly"
      tipo_conta_bancaria:
        | "corrente"
        | "poupanca"
        | "caixa"
        | "carteira_digital"
      tipo_financeiro:
        | "receita"
        | "despesa"
        | "custo"
        | "ajuste"
        | "deducao"
        | "imposto"
        | "receita_financeira"
        | "despesa_financeira"
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
      cashflow_direction: ["inflow", "outflow"],
      cashflow_source: ["manual", "csv", "xlsx", "google_sheets", "system"],
      cashflow_status: ["forecast", "confirmed", "cancelled", "reconciled"],
      dre_group: [
        "revenue",
        "deductions",
        "costs",
        "operational_expenses",
        "financial_expenses",
        "financial_revenue",
        "taxes",
      ],
      payable_status: ["pending", "paid", "overdue", "cancelled"],
      pessoa_tipo: ["pf", "pj"],
      recurrence_interval: ["monthly", "weekly", "yearly"],
      tipo_conta_bancaria: [
        "corrente",
        "poupanca",
        "caixa",
        "carteira_digital",
      ],
      tipo_financeiro: [
        "receita",
        "despesa",
        "custo",
        "ajuste",
        "deducao",
        "imposto",
        "receita_financeira",
        "despesa_financeira",
      ],
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
