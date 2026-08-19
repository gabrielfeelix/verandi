/*
 * GERADO. Não edite à mão.
 *
 *   npm run tipos          (com o Supabase local de pé)
 *
 * Sai de `supabase gen types typescript --local --schema app_verandi`, e é a
 * forma do banco em TypeScript: toda tabela, toda coluna, toda chave
 * estrangeira. Enquanto isto não existia, `db.from('pessoa').select(...)`
 * devolvia `GenericStringError`, e cada consulta precisava dizer o que
 * esperava com `.returns<T[]>()`: um tipo escrito à mão, ao lado de um
 * `select` em texto, sem nada checando que os dois falavam da mesma coluna.
 * Errar o nome de uma coluna só aparecia em produção.
 *
 * **Migration nova pede tipo novo.** Aplique a migration no banco local
 * (`npx supabase db reset`) e rode `npm run tipos`. Se esquecer, o `tsc`
 * continua passando com a forma antiga, e é justamente esse silêncio que este
 * arquivo veio tirar.
 *
 * **Nada de escrever aqui.** Este arquivo é reescrito inteiro a cada geração, e
 * o que estiver no fim dele some sem aviso. Atalho e tipo derivado moram em
 * `banco.ts`, ao lado.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  app_verandi: {
    Tables: {
      aceite_de_termos: {
        Row: {
          aceito_em: string
          agente: string | null
          conta_id: string | null
          documento: string
          id: string
          ip: string | null
          origem: string
          usuario_id: string
          versao: string
        }
        Insert: {
          aceito_em?: string
          agente?: string | null
          conta_id?: string | null
          documento: string
          id?: string
          ip?: string | null
          origem: string
          usuario_id: string
          versao: string
        }
        Update: {
          aceito_em?: string
          agente?: string | null
          conta_id?: string | null
          documento?: string
          id?: string
          ip?: string | null
          origem?: string
          usuario_id?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "aceite_de_termos_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      acesso_suporte: {
        Row: {
          conta_id: string
          encerrado_em: string | null
          id: string
          iniciado_em: string
          usuario_id: string
        }
        Insert: {
          conta_id: string
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string
          usuario_id: string
        }
        Update: {
          conta_id?: string
          encerrado_em?: string | null
          id?: string
          iniciado_em?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acesso_suporte_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      alerta_enviado: {
        Row: {
          assinatura: string
          avisado_em: string
          ocorrencias: number
          primeiro_em: string
          resumo: string
          ultimo_em: string
        }
        Insert: {
          assinatura: string
          avisado_em?: string
          ocorrencias?: number
          primeiro_em?: string
          resumo: string
          ultimo_em?: string
        }
        Update: {
          assinatura?: string
          avisado_em?: string
          ocorrencias?: number
          primeiro_em?: string
          resumo?: string
          ultimo_em?: string
        }
        Relationships: []
      }
      avaliacao: {
        Row: {
          conta_id: string
          criado_em: string
          criado_por_usuario_id: string | null
          data: string
          id: string
          observacao: string | null
          pessoa_id: string
          profissional_id: string | null
        }
        Insert: {
          conta_id: string
          criado_em?: string
          criado_por_usuario_id?: string | null
          data: string
          id?: string
          observacao?: string | null
          pessoa_id: string
          profissional_id?: string | null
        }
        Update: {
          conta_id?: string
          criado_em?: string
          criado_por_usuario_id?: string | null
          data?: string
          id?: string
          observacao?: string | null
          pessoa_id?: string
          profissional_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacao_foto: {
        Row: {
          avaliacao_id: string
          conta_id: string
          criado_em: string
          id: string
          observacao: string | null
          path: string
          posicao_id: string
        }
        Insert: {
          avaliacao_id: string
          conta_id: string
          criado_em?: string
          id?: string
          observacao?: string | null
          path: string
          posicao_id: string
        }
        Update: {
          avaliacao_id?: string
          conta_id?: string
          criado_em?: string
          id?: string
          observacao?: string | null
          path?: string
          posicao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacao_foto_avaliacao_id_fkey"
            columns: ["avaliacao_id"]
            isOneToOne: false
            referencedRelation: "avaliacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_foto_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacao_foto_posicao_id_fkey"
            columns: ["posicao_id"]
            isOneToOne: false
            referencedRelation: "posicao_avaliacao"
            referencedColumns: ["id"]
          },
        ]
      }
      chave_api: {
        Row: {
          conta_id: string
          criada_por_usuario_id: string | null
          criado_em: string
          hash: string
          id: string
          nome: string
          prefixo: string
          revogada_em: string | null
          ultimo_uso_em: string | null
        }
        Insert: {
          conta_id: string
          criada_por_usuario_id?: string | null
          criado_em?: string
          hash: string
          id?: string
          nome: string
          prefixo: string
          revogada_em?: string | null
          ultimo_uso_em?: string | null
        }
        Update: {
          conta_id?: string
          criada_por_usuario_id?: string | null
          criado_em?: string
          hash?: string
          id?: string
          nome?: string
          prefixo?: string
          revogada_em?: string | null
          ultimo_uso_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chave_api_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca: {
        Row: {
          competencia: string
          conta_id: string
          contrato_id: string
          criado_em: string
          id: string
          motivo_cancelamento: string | null
          origem: string
          pessoa_id: string
          status: string
          valor_cent: number
          vencimento: string
        }
        Insert: {
          competencia: string
          conta_id: string
          contrato_id: string
          criado_em?: string
          id?: string
          motivo_cancelamento?: string | null
          origem?: string
          pessoa_id: string
          status?: string
          valor_cent: number
          vencimento: string
        }
        Update: {
          competencia?: string
          conta_id?: string
          contrato_id?: string
          criado_em?: string
          id?: string
          motivo_cancelamento?: string | null
          origem?: string
          pessoa_id?: string
          status?: string
          valor_cent?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      conta: {
        Row: {
          assinatura_cargo: string | null
          assinatura_nome: string | null
          assinatura_path: string | null
          ativo: boolean
          capacidade_padrao: number
          credito_falta_avisada: boolean
          criado_em: string
          documento: string | null
          duracao_padrao_min: number
          encaixe_acima: boolean
          endereco_emitente: string | null
          fuso: string
          horarios_sugeridos: string[]
          id: string
          interna: boolean
          intervalo_min: number
          nome: string
          prazo_reposicao_dias: number
          razao_social: string | null
          serie_recibo: string
          slug: string
          telefone_emitente: string | null
        }
        Insert: {
          assinatura_cargo?: string | null
          assinatura_nome?: string | null
          assinatura_path?: string | null
          ativo?: boolean
          capacidade_padrao?: number
          credito_falta_avisada?: boolean
          criado_em?: string
          documento?: string | null
          duracao_padrao_min?: number
          encaixe_acima?: boolean
          endereco_emitente?: string | null
          fuso?: string
          horarios_sugeridos?: string[]
          id?: string
          interna?: boolean
          intervalo_min?: number
          nome: string
          prazo_reposicao_dias?: number
          razao_social?: string | null
          serie_recibo?: string
          slug: string
          telefone_emitente?: string | null
        }
        Update: {
          assinatura_cargo?: string | null
          assinatura_nome?: string | null
          assinatura_path?: string | null
          ativo?: boolean
          capacidade_padrao?: number
          credito_falta_avisada?: boolean
          criado_em?: string
          documento?: string | null
          duracao_padrao_min?: number
          encaixe_acima?: boolean
          endereco_emitente?: string | null
          fuso?: string
          horarios_sugeridos?: string[]
          id?: string
          interna?: boolean
          intervalo_min?: number
          nome?: string
          prazo_reposicao_dias?: number
          razao_social?: string | null
          serie_recibo?: string
          slug?: string
          telefone_emitente?: string | null
        }
        Relationships: []
      }
      contador_recibo: {
        Row: {
          conta_id: string
          proximo: number
          serie: string
        }
        Insert: {
          conta_id: string
          proximo?: number
          serie: string
        }
        Update: {
          conta_id?: string
          proximo?: number
          serie?: string
        }
        Relationships: [
          {
            foreignKeyName: "contador_recibo_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato: {
        Row: {
          conta_id: string
          criado_em: string
          criado_por_usuario_id: string | null
          dia_vencimento: number | null
          fim: string | null
          forma_pagamento: string | null
          id: string
          inicio: string
          pessoa_id: string
          plano_id: string
          preco_aplicado_cent: number
          sessoes_contratadas: number | null
          status: string
          vinculo_usado: boolean
        }
        Insert: {
          conta_id: string
          criado_em?: string
          criado_por_usuario_id?: string | null
          dia_vencimento?: number | null
          fim?: string | null
          forma_pagamento?: string | null
          id?: string
          inicio: string
          pessoa_id: string
          plano_id: string
          preco_aplicado_cent: number
          sessoes_contratadas?: number | null
          status?: string
          vinculo_usado?: boolean
        }
        Update: {
          conta_id?: string
          criado_em?: string
          criado_por_usuario_id?: string | null
          dia_vencimento?: number | null
          fim?: string | null
          forma_pagamento?: string | null
          id?: string
          inicio?: string
          pessoa_id?: string
          plano_id?: string
          preco_aplicado_cent?: number
          sessoes_contratadas?: number | null
          status?: string
          vinculo_usado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contrato_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plano"
            referencedColumns: ["id"]
          },
        ]
      }
      convite: {
        Row: {
          aceito_em: string | null
          aceito_por_usuario_id: string | null
          conta_id: string
          criado_em: string
          criado_por_usuario_id: string | null
          email: string
          entrega: string | null
          entrega_em: string | null
          expira_em: string
          id: string
          papel: Database["app_verandi"]["Enums"]["papel"]
          revogado_em: string | null
          tipo: string
          token_hash: string
        }
        Insert: {
          aceito_em?: string | null
          aceito_por_usuario_id?: string | null
          conta_id: string
          criado_em?: string
          criado_por_usuario_id?: string | null
          email: string
          entrega?: string | null
          entrega_em?: string | null
          expira_em: string
          id?: string
          papel: Database["app_verandi"]["Enums"]["papel"]
          revogado_em?: string | null
          tipo?: string
          token_hash: string
        }
        Update: {
          aceito_em?: string | null
          aceito_por_usuario_id?: string | null
          conta_id?: string
          criado_em?: string
          criado_por_usuario_id?: string | null
          email?: string
          entrega?: string | null
          entrega_em?: string | null
          expira_em?: string
          id?: string
          papel?: Database["app_verandi"]["Enums"]["papel"]
          revogado_em?: string | null
          tipo?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "convite_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      envio_de_recibo: {
        Row: {
          conta_id: string
          entregue: boolean
          enviado_em: string
          enviado_por_usuario_id: string | null
          erro: string | null
          id: string
          para: string
          recibo_id: string
        }
        Insert: {
          conta_id: string
          entregue?: boolean
          enviado_em?: string
          enviado_por_usuario_id?: string | null
          erro?: string | null
          id?: string
          para: string
          recibo_id: string
        }
        Update: {
          conta_id?: string
          entregue?: boolean
          enviado_em?: string
          enviado_por_usuario_id?: string | null
          erro?: string | null
          id?: string
          para?: string
          recibo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "envio_de_recibo_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "envio_de_recibo_recibo_id_fkey"
            columns: ["recibo_id"]
            isOneToOne: false
            referencedRelation: "recibo"
            referencedColumns: ["id"]
          },
        ]
      }
      espera: {
        Row: {
          avisado_em: string | null
          cancelado_em: string | null
          conta_id: string
          criado_em: string
          id: string
          pessoa_id: string
          sessao_id: string
        }
        Insert: {
          avisado_em?: string | null
          cancelado_em?: string | null
          conta_id: string
          criado_em?: string
          id?: string
          pessoa_id: string
          sessao_id: string
        }
        Update: {
          avisado_em?: string | null
          cancelado_em?: string | null
          conta_id?: string
          criado_em?: string
          id?: string
          pessoa_id?: string
          sessao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "espera_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espera_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espera_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "espera_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessao"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_saida: {
        Row: {
          conta_id: string
          criado_em: string
          dados: Json
          entregue_em: string | null
          id: string
          proxima_tentativa_em: string | null
          tentativas: number
          tipo: string
          ultimo_erro: string | null
        }
        Insert: {
          conta_id: string
          criado_em?: string
          dados: Json
          entregue_em?: string | null
          id?: string
          proxima_tentativa_em?: string | null
          tentativas?: number
          tipo: string
          ultimo_erro?: string | null
        }
        Update: {
          conta_id?: string
          criado_em?: string
          dados?: Json
          entregue_em?: string | null
          id?: string
          proxima_tentativa_em?: string | null
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_saida_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      excecao_calendario: {
        Row: {
          acao: string
          conta_id: string
          data: string
          descricao: string | null
          id: string
          tipo: string
        }
        Insert: {
          acao?: string
          conta_id: string
          data: string
          descricao?: string | null
          id?: string
          tipo: string
        }
        Update: {
          acao?: string
          conta_id?: string
          data?: string
          descricao?: string | null
          id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "excecao_calendario_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionamento: {
        Row: {
          abre: string
          conta_id: string
          dia_semana: number
          fecha: string
        }
        Insert: {
          abre: string
          conta_id: string
          dia_semana: number
          fecha: string
        }
        Update: {
          abre?: string
          conta_id?: string
          dia_semana?: number
          fecha?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionamento_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      local: {
        Row: {
          ativo: boolean
          capacidade: number | null
          conta_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          capacidade?: number | null
          conta_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          capacidade?: number | null
          conta_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      log_configuracao: {
        Row: {
          acao: string
          conta_id: string
          detalhe: Json
          em: string
          entidade: string
          entidade_id: string | null
          id: string
          por_usuario_id: string | null
        }
        Insert: {
          acao: string
          conta_id: string
          detalhe?: Json
          em?: string
          entidade: string
          entidade_id?: string | null
          id?: string
          por_usuario_id?: string | null
        }
        Update: {
          acao?: string
          conta_id?: string
          detalhe?: Json
          em?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          por_usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_configuracao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding: {
        Row: {
          concluido_em: string | null
          conta_id: string
          criado_em: string
          id: string
          passo: number
          pulado_em: string | null
          roteiro: string
          usuario_id: string
        }
        Insert: {
          concluido_em?: string | null
          conta_id: string
          criado_em?: string
          id?: string
          passo?: number
          pulado_em?: string | null
          roteiro: string
          usuario_id: string
        }
        Update: {
          concluido_em?: string | null
          conta_id?: string
          criado_em?: string
          id?: string
          passo?: number
          pulado_em?: string | null
          roteiro?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamento: {
        Row: {
          cobranca_id: string
          conta_id: string
          criado_em: string
          estornado_em: string | null
          forma: string
          id: string
          motivo_estorno: string | null
          observacao: string | null
          recebido_em: string
          registrado_por_usuario_id: string | null
          valor_cent: number
        }
        Insert: {
          cobranca_id: string
          conta_id: string
          criado_em?: string
          estornado_em?: string | null
          forma: string
          id?: string
          motivo_estorno?: string | null
          observacao?: string | null
          recebido_em: string
          registrado_por_usuario_id?: string | null
          valor_cent: number
        }
        Update: {
          cobranca_id?: string
          conta_id?: string
          criado_em?: string
          estornado_em?: string | null
          forma?: string
          id?: string
          motivo_estorno?: string | null
          observacao?: string | null
          recebido_em?: string
          registrado_por_usuario_id?: string | null
          valor_cent?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamento_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobranca"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamento_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobranca_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamento_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      participacao: {
        Row: {
          conta_id: string
          contrato_id: string | null
          id: string
          observacao: string | null
          observacao_visivel: string
          origem: Database["app_verandi"]["Enums"]["origem_participacao"]
          pessoa_id: string
          registrado_em: string
          registrado_por_origem: Database["app_verandi"]["Enums"]["origem_registro"]
          registrado_por_usuario_id: string | null
          reposicao_de_id: string | null
          sessao_id: string
          status: Database["app_verandi"]["Enums"]["status_participacao"]
        }
        Insert: {
          conta_id: string
          contrato_id?: string | null
          id?: string
          observacao?: string | null
          observacao_visivel?: string
          origem: Database["app_verandi"]["Enums"]["origem_participacao"]
          pessoa_id: string
          registrado_em?: string
          registrado_por_origem?: Database["app_verandi"]["Enums"]["origem_registro"]
          registrado_por_usuario_id?: string | null
          reposicao_de_id?: string | null
          sessao_id: string
          status?: Database["app_verandi"]["Enums"]["status_participacao"]
        }
        Update: {
          conta_id?: string
          contrato_id?: string | null
          id?: string
          observacao?: string | null
          observacao_visivel?: string
          origem?: Database["app_verandi"]["Enums"]["origem_participacao"]
          pessoa_id?: string
          registrado_em?: string
          registrado_por_origem?: Database["app_verandi"]["Enums"]["origem_registro"]
          registrado_por_usuario_id?: string | null
          reposicao_de_id?: string | null
          sessao_id?: string
          status?: Database["app_verandi"]["Enums"]["status_participacao"]
        }
        Relationships: [
          {
            foreignKeyName: "participacao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participacao_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participacao_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participacao_reposicao_de_id_fkey"
            columns: ["reposicao_de_id"]
            isOneToOne: false
            referencedRelation: "participacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participacao_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "sessao"
            referencedColumns: ["id"]
          },
        ]
      }
      pausa: {
        Row: {
          conta_id: string
          contrato_id: string
          criado_em: string
          fim: string | null
          id: string
          inicio: string
          motivo: string | null
        }
        Insert: {
          conta_id: string
          contrato_id: string
          criado_em?: string
          fim?: string | null
          id?: string
          inicio: string
          motivo?: string | null
        }
        Update: {
          conta_id?: string
          contrato_id?: string
          criado_em?: string
          fim?: string | null
          id?: string
          inicio?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pausa_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausa_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_idempotente: {
        Row: {
          chave: string
          conta_id: string
          corpo: Json
          corpo_hash: string
          criado_em: string
          rota: string
          status: number
        }
        Insert: {
          chave: string
          conta_id: string
          corpo: Json
          corpo_hash: string
          criado_em?: string
          rota: string
          status: number
        }
        Update: {
          chave?: string
          conta_id?: string
          corpo?: Json
          corpo_hash?: string
          criado_em?: string
          rota?: string
          status?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_idempotente_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencia_dispensada: {
        Row: {
          conta_id: string
          dispensado_em: string
          dispensado_por_usuario_id: string | null
          id: string
          motivo: string
          referencia_id: string
          tipo: string
        }
        Insert: {
          conta_id: string
          dispensado_em?: string
          dispensado_por_usuario_id?: string | null
          id?: string
          motivo: string
          referencia_id: string
          tipo: string
        }
        Update: {
          conta_id?: string
          dispensado_em?: string
          dispensado_por_usuario_id?: string | null
          id?: string
          motivo?: string
          referencia_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pendencia_dispensada_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa: {
        Row: {
          anonimizada_em: string | null
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          conta_id: string
          cpf: string | null
          criado_em: string
          email: string | null
          endereco: string | null
          endereco_numero: string | null
          estado_civil: string | null
          foto_path: string | null
          id: string
          identificador_externo: string | null
          nascimento: string | null
          nome: string
          nome_busca: string | null
          observacao: string | null
          observacao_visivel: string
          profissao: string | null
          rg: string | null
          sexo: string | null
          telefone: string | null
          telefone_comercial: string | null
          telefone_disca: boolean | null
          telefone_residencial: string | null
          uf: string | null
          vencimento_plano: string | null
        }
        Insert: {
          anonimizada_em?: string | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta_id: string
          cpf?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          endereco_numero?: string | null
          estado_civil?: string | null
          foto_path?: string | null
          id?: string
          identificador_externo?: string | null
          nascimento?: string | null
          nome: string
          nome_busca?: string | null
          observacao?: string | null
          observacao_visivel?: string
          profissao?: string | null
          rg?: string | null
          sexo?: string | null
          telefone?: string | null
          telefone_comercial?: string | null
          telefone_disca?: boolean | null
          telefone_residencial?: string | null
          uf?: string | null
          vencimento_plano?: string | null
        }
        Update: {
          anonimizada_em?: string | null
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta_id?: string
          cpf?: string | null
          criado_em?: string
          email?: string | null
          endereco?: string | null
          endereco_numero?: string | null
          estado_civil?: string | null
          foto_path?: string | null
          id?: string
          identificador_externo?: string | null
          nascimento?: string | null
          nome?: string
          nome_busca?: string | null
          observacao?: string | null
          observacao_visivel?: string
          profissao?: string | null
          rg?: string | null
          sexo?: string | null
          telefone?: string | null
          telefone_comercial?: string | null
          telefone_disca?: boolean | null
          telefone_residencial?: string | null
          uf?: string | null
          vencimento_plano?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_tag: {
        Row: {
          conta_id: string
          pessoa_id: string
          tag: string
        }
        Insert: {
          conta_id: string
          pessoa_id: string
          tag: string
        }
        Update: {
          conta_id?: string
          pessoa_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_tag_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_tag_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pessoa_tag_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      plano: {
        Row: {
          ativo: boolean
          codigo: string
          conta_id: string
          criado_em: string
          frequencia_semanal: number | null
          id: string
          nome: string
          parcelas: number
          preco_avulso_cent: number
          preco_vinculado_cent: number
          recorrencia: string
          servico_id: string
          sessoes_no_pacote: number | null
          validade_meses: number | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          conta_id: string
          criado_em?: string
          frequencia_semanal?: number | null
          id?: string
          nome: string
          parcelas?: number
          preco_avulso_cent: number
          preco_vinculado_cent: number
          recorrencia: string
          servico_id: string
          sessoes_no_pacote?: number | null
          validade_meses?: number | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          conta_id?: string
          criado_em?: string
          frequencia_semanal?: number | null
          id?: string
          nome?: string
          parcelas?: number
          preco_avulso_cent?: number
          preco_vinculado_cent?: number
          recorrencia?: string
          servico_id?: string
          sessoes_no_pacote?: number | null
          validade_meses?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plano_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      posicao_avaliacao: {
        Row: {
          ativo: boolean
          conta_id: string
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          conta_id: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          conta_id?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "posicao_avaliacao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      preferencia_home: {
        Row: {
          atualizado_em: string
          blocos: Json
          conta_id: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          blocos?: Json
          conta_id: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          blocos?: Json
          conta_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferencia_home_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional: {
        Row: {
          ativo: boolean
          conta_id: string
          cor: string | null
          email: string | null
          foto_path: string | null
          id: string
          nome: string
          telefone: string | null
          usuario_id: string | null
        }
        Insert: {
          ativo?: boolean
          conta_id: string
          cor?: string | null
          email?: string | null
          foto_path?: string | null
          id?: string
          nome: string
          telefone?: string | null
          usuario_id?: string | null
        }
        Update: {
          ativo?: boolean
          conta_id?: string
          cor?: string | null
          email?: string | null
          foto_path?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissional_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_servico: {
        Row: {
          conta_id: string
          profissional_id: string
          servico_id: string
        }
        Insert: {
          conta_id: string
          profissional_id: string
          servico_id: string
        }
        Update: {
          conta_id?: string
          profissional_id?: string
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profissional_servico_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_servico_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_servico_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      recibo: {
        Row: {
          cancelado_em: string | null
          conta_id: string
          contrato_id: string | null
          corpo: Json
          emitido_em: string
          emitido_por_usuario_id: string | null
          id: string
          motivo: string | null
          numero: number
          pagamento_id: string | null
          pessoa_id: string | null
          serie: string
          status: string
          substitui_id: string | null
          valor_cent: number
          versao: number
        }
        Insert: {
          cancelado_em?: string | null
          conta_id: string
          contrato_id?: string | null
          corpo: Json
          emitido_em?: string
          emitido_por_usuario_id?: string | null
          id?: string
          motivo?: string | null
          numero: number
          pagamento_id?: string | null
          pessoa_id?: string | null
          serie: string
          status?: string
          substitui_id?: string | null
          valor_cent: number
          versao?: number
        }
        Update: {
          cancelado_em?: string | null
          conta_id?: string
          contrato_id?: string | null
          corpo?: Json
          emitido_em?: string
          emitido_por_usuario_id?: string | null
          id?: string
          motivo?: string | null
          numero?: number
          pagamento_id?: string | null
          pessoa_id?: string | null
          serie?: string
          status?: string
          substitui_id?: string | null
          valor_cent?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "recibo_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibo_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibo_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibo_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibo_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recibo_substitui_id_fkey"
            columns: ["substitui_id"]
            isOneToOne: false
            referencedRelation: "recibo"
            referencedColumns: ["id"]
          },
        ]
      }
      serie: {
        Row: {
          ativo: boolean
          capacidade: number
          codigo: string | null
          conta_id: string
          criado_em: string
          dia_semana: number
          duracao_min: number
          hora_inicio: string
          id: string
          local_id: string | null
          profissional_id: string | null
          servico_id: string
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean
          capacidade: number
          codigo?: string | null
          conta_id: string
          criado_em?: string
          dia_semana: number
          duracao_min: number
          hora_inicio: string
          id?: string
          local_id?: string | null
          profissional_id?: string | null
          servico_id: string
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          ativo?: boolean
          capacidade?: number
          codigo?: string | null
          conta_id?: string
          criado_em?: string
          dia_semana?: number
          duracao_min?: number
          hora_inicio?: string
          id?: string
          local_id?: string | null
          profissional_id?: string | null
          servico_id?: string
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "serie_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serie_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "local"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serie_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serie_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      servico: {
        Row: {
          ativo: boolean
          capacidade_padrao: number
          categoria: string | null
          conta_id: string
          duracao_min: number
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          capacidade_padrao?: number
          categoria?: string | null
          conta_id: string
          duracao_min?: number
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          capacidade_padrao?: number
          categoria?: string | null
          conta_id?: string
          duracao_min?: number
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "servico_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      sessao: {
        Row: {
          capacidade: number
          conta_id: string
          criado_em: string
          duracao_min: number
          id: string
          inicio: string
          local_id: string | null
          motivo_cancelamento: string | null
          profissional_id: string | null
          serie_id: string | null
          servico_id: string
          status: Database["app_verandi"]["Enums"]["status_sessao"]
        }
        Insert: {
          capacidade: number
          conta_id: string
          criado_em?: string
          duracao_min: number
          id?: string
          inicio: string
          local_id?: string | null
          motivo_cancelamento?: string | null
          profissional_id?: string | null
          serie_id?: string | null
          servico_id: string
          status?: Database["app_verandi"]["Enums"]["status_sessao"]
        }
        Update: {
          capacidade?: number
          conta_id?: string
          criado_em?: string
          duracao_min?: number
          id?: string
          inicio?: string
          local_id?: string | null
          motivo_cancelamento?: string | null
          profissional_id?: string | null
          serie_id?: string | null
          servico_id?: string
          status?: Database["app_verandi"]["Enums"]["status_sessao"]
        }
        Relationships: [
          {
            foreignKeyName: "sessao_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_local_id_fkey"
            columns: ["local_id"]
            isOneToOne: false
            referencedRelation: "local"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "serie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessao_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servico"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_conta: {
        Row: {
          ativo: boolean
          conta_id: string
          criado_em: string
          papel: Database["app_verandi"]["Enums"]["papel"]
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          conta_id: string
          criado_em?: string
          papel: Database["app_verandi"]["Enums"]["papel"]
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          conta_id?: string
          criado_em?: string
          papel?: Database["app_verandi"]["Enums"]["papel"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_conta_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      vaga: {
        Row: {
          conta_id: string
          contrato_id: string | null
          criado_em: string
          fim: string | null
          id: string
          inicio: string
          pessoa_id: string
          serie_id: string
        }
        Insert: {
          conta_id: string
          contrato_id?: string | null
          criado_em?: string
          fim?: string | null
          id?: string
          inicio: string
          pessoa_id: string
          serie_id: string
        }
        Update: {
          conta_id?: string
          contrato_id?: string | null
          criado_em?: string
          fim?: string | null
          id?: string
          inicio?: string
          pessoa_id?: string
          serie_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaga_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaga_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaga_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaga_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaga_serie_id_fkey"
            columns: ["serie_id"]
            isOneToOne: false
            referencedRelation: "serie"
            referencedColumns: ["id"]
          },
        ]
      }
      vocabulario: {
        Row: {
          chave: string
          conta_id: string
          plural: string
          singular: string
        }
        Insert: {
          chave: string
          conta_id: string
          plural: string
          singular: string
        }
        Update: {
          chave?: string
          conta_id?: string
          plural?: string
          singular?: string
        }
        Relationships: [
          {
            foreignKeyName: "vocabulario_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook: {
        Row: {
          ativo: boolean
          conta_id: string
          criado_em: string
          id: string
          segredo: string
          url: string
        }
        Insert: {
          ativo?: boolean
          conta_id: string
          criado_em?: string
          id?: string
          segredo: string
          url: string
        }
        Update: {
          ativo?: boolean
          conta_id?: string
          criado_em?: string
          id?: string
          segredo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: true
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cobranca_resumo: {
        Row: {
          competencia: string | null
          conta_id: string | null
          contrato_id: string | null
          criado_em: string | null
          id: string | null
          motivo_cancelamento: string | null
          origem: string | null
          pessoa_id: string | null
          situacao: string | null
          status: string | null
          valor_cent: number | null
          valor_pago_cent: number | null
          vencimento: string | null
        }
        Insert: {
          competencia?: string | null
          conta_id?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          id?: string | null
          motivo_cancelamento?: string | null
          origem?: string | null
          pessoa_id?: string | null
          situacao?: never
          status?: string | null
          valor_cent?: number | null
          valor_pago_cent?: never
          vencimento?: string | null
        }
        Update: {
          competencia?: string | null
          conta_id?: string | null
          contrato_id?: string | null
          criado_em?: string | null
          id?: string | null
          motivo_cancelamento?: string | null
          origem?: string | null
          pessoa_id?: string | null
          situacao?: never
          status?: string | null
          valor_cent?: number | null
          valor_pago_cent?: never
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contrato"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_pessoa_id_fkey"
            columns: ["pessoa_id"]
            isOneToOne: false
            referencedRelation: "pessoa_resumo"
            referencedColumns: ["id"]
          },
        ]
      }
      pessoa_resumo: {
        Row: {
          anonimizada_em: string | null
          ativo: boolean | null
          conta_id: string | null
          criado_em: string | null
          email: string | null
          faltas_recentes: number | null
          foto_path: string | null
          id: string | null
          identificador_externo: string | null
          nascimento: string | null
          nome: string | null
          nome_busca: string | null
          observacao: string | null
          observacao_visivel: string | null
          reposicoes_abertas: number | null
          telefone: string | null
          telefone_disca: boolean | null
          ultima_presenca: string | null
          vagas_ativas: number | null
          vencimento_plano: string | null
        }
        Insert: {
          anonimizada_em?: string | null
          ativo?: boolean | null
          conta_id?: string | null
          criado_em?: string | null
          email?: string | null
          faltas_recentes?: never
          foto_path?: string | null
          id?: string | null
          identificador_externo?: string | null
          nascimento?: string | null
          nome?: string | null
          nome_busca?: string | null
          observacao?: string | null
          observacao_visivel?: string | null
          reposicoes_abertas?: never
          telefone?: string | null
          telefone_disca?: boolean | null
          ultima_presenca?: never
          vagas_ativas?: never
          vencimento_plano?: string | null
        }
        Update: {
          anonimizada_em?: string | null
          ativo?: boolean | null
          conta_id?: string | null
          criado_em?: string | null
          email?: string | null
          faltas_recentes?: never
          foto_path?: string | null
          id?: string | null
          identificador_externo?: string | null
          nascimento?: string | null
          nome?: string | null
          nome_busca?: string | null
          observacao?: string | null
          observacao_visivel?: string | null
          reposicoes_abertas?: never
          telefone?: string | null
          telefone_disca?: boolean | null
          ultima_presenca?: never
          vagas_ativas?: never
          vencimento_plano?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pessoa_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "conta"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      contas_do_usuario: { Args: never; Returns: string[] }
      proximo_numero_recibo: {
        Args: { p_conta: string; p_serie: string }
        Returns: number
      }
      sem_acento: { Args: { t: string }; Returns: string }
      tem_papel: {
        Args: {
          p_conta: string
          p_papeis: Database["app_verandi"]["Enums"]["papel"][]
        }
        Returns: boolean
      }
      usuarios_da_conta: {
        Args: { p_conta: string }
        Returns: {
          ativo: boolean
          criado_em: string
          email: string
          papel: Database["app_verandi"]["Enums"]["papel"]
          ultimo_acesso: string
          usuario_id: string
        }[]
      }
    }
    Enums: {
      origem_participacao:
        | "recorrente"
        | "avulso"
        | "reposicao"
        | "encaixe"
        | "reserva"
      origem_registro:
        | "profissional"
        | "recepcao"
        | "bot"
        | "sistema"
        | "importacao"
      papel: "dono" | "recepcao" | "profissional" | "suporte"
      status_participacao:
        | "esperada"
        | "confirmada"
        | "presente"
        | "falta"
        | "falta_avisada"
        | "licenca"
        | "cancelada"
      status_sessao: "prevista" | "realizada" | "cancelada"
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
  app_verandi: {
    Enums: {
      origem_participacao: [
        "recorrente",
        "avulso",
        "reposicao",
        "encaixe",
        "reserva",
      ],
      origem_registro: [
        "profissional",
        "recepcao",
        "bot",
        "sistema",
        "importacao",
      ],
      papel: ["dono", "recepcao", "profissional", "suporte"],
      status_participacao: [
        "esperada",
        "confirmada",
        "presente",
        "falta",
        "falta_avisada",
        "licenca",
        "cancelada",
      ],
      status_sessao: ["prevista", "realizada", "cancelada"],
    },
  },
} as const

