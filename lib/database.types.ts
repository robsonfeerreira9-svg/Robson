export type RoleUsuario = 'socio' | 'funcionario'
export type TamanhoProduto = 'PP' | 'P' | 'M' | 'G' | 'GG' | 'UNICO'
export type CanalProduto = 'fisico' | 'online' | 'ambos'
export type CanalVenda = 'fisico' | 'whatsapp' | 'instagram'
export type MetodoPagamento = 'pix' | 'credito' | 'debito' | 'dinheiro'
export type TipoMovimentacao = 'entrada' | 'saida'
export type CategoriaMovimentacao = 'venda' | 'compra_estoque' | 'custo_operacional' | 'outro' | 'aporte' | 'capital_giro' | 'administrativo' | 'midia_marketing' | 'funcionarios'

export interface Usuario {
  id: string
  nome: string
  email: string
  role: RoleUsuario
  ativo: boolean
  meta_mensal: number | null
  criado_em: string
}

export interface Cliente {
  id: string
  cpf: string | null
  nome: string
  telefone: string | null
  data_nascimento: string | null
  criado_em: string
}

export interface Produto {
  id: string
  nome: string
  foto_url: string | null
  tamanho: TamanhoProduto
  numero: string | null
  custo: number
  preco_venda: number
  markup_percentual: number
  canal: CanalProduto
  ativo: boolean
  criado_em: string
}

export interface Estoque {
  id: string
  produto_id: string
  quantidade: number
  ultima_venda_em: string | null
  atualizado_em: string
}

export interface ProdutoComEstoque extends Produto {
  estoque: Estoque[]
}

export interface Venda {
  id: string
  vendedor_id: string
  cliente_id: string | null
  canal_venda: CanalVenda
  metodo_pagamento: MetodoPagamento
  subtotal: number
  desconto_aplicado: number
  total_final: number
  criado_em: string
}

export interface ItemVenda {
  id: string
  venda_id: string
  produto_id: string
  quantidade: number
  preco_unitario: number
  subtotal_item: number
}

export interface Comissao {
  id: string
  venda_id: string
  vendedor_id: string
  percentual: number
  valor_comissao: number
  pago: boolean
  criado_em: string
}

export interface MovimentacaoCaixa {
  id: string
  tipo: TipoMovimentacao
  categoria: CategoriaMovimentacao
  descricao: string | null
  valor: number
  referencia_venda_id: string | null
  vence_em: string | null
  pago: boolean
  criado_em: string
}

export interface Campanha {
  id: string
  nome: string
  descricao: string | null
  desconto_pct: number
  ativa: boolean
  criado_em: string
}

// Tipo para a procedure realizar_venda
export interface ItemVendaInput {
  produto_id: string
  quantidade: number
  preco_unitario: number
  subtotal_item: number
}

export interface RealizarVendaParams {
  p_vendedor_id: string
  p_canal_venda: CanalVenda
  p_metodo_pagamento: MetodoPagamento
  p_subtotal: number
  p_desconto_aplicado: number
  p_total_final: number
  p_itens: ItemVendaInput[]
  p_cliente_cpf?: string
  p_cliente_nome?: string
  p_cliente_telefone?: string
  p_cliente_nascimento?: string
}

export type Database = {
  public: {
    Tables: {
      usuarios: { Row: Usuario; Insert: Omit<Usuario, 'id' | 'criado_em'>; Update: Partial<Usuario> }
      clientes: { Row: Cliente; Insert: Omit<Cliente, 'id' | 'criado_em'>; Update: Partial<Cliente> }
      produtos: { Row: Produto; Insert: Omit<Produto, 'id' | 'criado_em'>; Update: Partial<Produto> }
      estoque: { Row: Estoque; Insert: Omit<Estoque, 'id'>; Update: Partial<Estoque> }
      vendas: { Row: Venda; Insert: Omit<Venda, 'id' | 'criado_em'>; Update: Partial<Venda> }
      itens_venda: { Row: ItemVenda; Insert: Omit<ItemVenda, 'id'>; Update: Partial<ItemVenda> }
      comissoes: { Row: Comissao; Insert: Omit<Comissao, 'id' | 'criado_em'>; Update: Partial<Comissao> }
      movimentacao_caixa: { Row: MovimentacaoCaixa; Insert: Omit<MovimentacaoCaixa, 'id' | 'criado_em'>; Update: Partial<MovimentacaoCaixa> }
    }
    Functions: {
      realizar_venda: { Args: RealizarVendaParams; Returns: string }
      get_current_user_role: { Args: Record<never, never>; Returns: string }
    }
  }
}
