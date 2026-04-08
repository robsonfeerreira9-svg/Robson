/**
 * Calcula o percentual de desconto para pagamento via PIX.
 * subtotal <= 550  → 7%
 * subtotal > 550   → 9%
 * subtotal > 700   → 10%
 */
export function calcularPercentualDescontoPix(subtotal: number): number {
  if (subtotal > 700) return 10
  if (subtotal > 550) return 9
  return 7
}

/**
 * Retorna o valor absoluto do desconto PIX.
 */
export function calcularDescontoPix(subtotal: number): number {
  const pct = calcularPercentualDescontoPix(subtotal)
  return Number((subtotal * pct / 100).toFixed(2))
}

/**
 * Calcula preço de venda a partir do custo e markup percentual.
 * Ex: custo=50, markupPct=100 → preço = 50 * (1 + 100/100) = 100
 */
export function calcularPrecoVenda(custo: number, markupPct: number): number {
  return Number((custo * (1 + markupPct / 100)).toFixed(2))
}

/**
 * Formata um número como moeda brasileira.
 * Ex: 1250 → "R$ 1.250,00"
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(valor)
}

/**
 * Formata CPF: "12345678901" → "123.456.789-01"
 */
export function formatarCPF(cpf: string): string {
  return cpf
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/**
 * Formata telefone: "11999998888" → "(11) 99999-8888"
 */
export function formatarTelefone(tel: string): string {
  return tel
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{4})$/, '$1-$2')
}

/**
 * Valida CPF (apenas formato, não dígitos verificadores).
 */
export function cpfValido(cpf: string): boolean {
  return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf) || /^\d{11}$/.test(cpf.replace(/\D/g, ''))
}
