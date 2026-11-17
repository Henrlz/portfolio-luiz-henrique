// Dados fictícios e utilitários de documento. A empresa emissora, os
// clientes e os CNPJs são inventados (CNPJs gerados com dígito verificador
// válido só para a validação da tela ter o que conferir).

export const EMISSORA = { nome: 'Norte Serviços Compartilhados Ltda', filial: '0001' };

/** Calcula os dois dígitos verificadores de um CNPJ a partir dos 12 primeiros. */
function digitosCnpj(base12) {
  const calc = (nums, pesos) => {
    const soma = nums.reduce((s, n, i) => s + n * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const n = base12.split('').map(Number);
  const d1 = calc(n, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc([...n, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${d1}${d2}`;
}

export function somenteDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

export function cnpjValido(v) {
  const d = somenteDigitos(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  return digitosCnpj(d.slice(0, 12)) === d.slice(12);
}

export function formatarCnpj(v) {
  const d = somenteDigitos(v);
  if (d.length !== 14) return String(v ?? '');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function cnpj(base8, filial = '0001') {
  const b = `${base8}${filial}`;
  return formatarCnpj(b + digitosCnpj(b));
}

/** CNPJ com o último dígito trocado: serve para a demo mostrar a validação. */
function cnpjComErro(base8) {
  const certo = somenteDigitos(cnpj(base8));
  return formatarCnpj(certo.slice(0, 13) + ((Number(certo[13]) + 3) % 10));
}

export const EMISSORA_CNPJ = cnpj('91827364');

export function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function somarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dadosIniciais() {
  const hoje = hojeIso();
  const contas = [
    { id: 'c1', codigo: '1.1.2.01.0001', descricao: 'Clientes nacionais - serviços', natureza: 'Ativo' },
    { id: 'c2', codigo: '1.1.2.01.0002', descricao: 'Clientes nacionais - reembolso de despesas', natureza: 'Ativo' },
    { id: 'c3', codigo: '1.1.2.02.0001', descricao: 'Clientes no exterior - serviços', natureza: 'Ativo' },
    { id: 'c4', codigo: '1.1.2.03.0001', descricao: 'Partes relacionadas - grupo econômico', natureza: 'Ativo' },
    { id: 'c5', codigo: '1.1.2.09.0001', descricao: 'Outros créditos a receber', natureza: 'Ativo' },
  ];

  const destinatarios = [
    { id: 'd1', codigo: '2063', razao: 'Vento Sul Energia Renovável S.A.', cnpj: cnpj('91402117'), chaves: ['VENTO SUL', 'VENTO SUL ENERGIA'], conta: 'c1', centro: '3100' },
    { id: 'd2', codigo: '2382', razao: 'Ateliê Paralelo Arquitetura Ltda', cnpj: cnpj('93115820'), chaves: ['PARALELO', 'ATELIE PARALELO'], conta: 'c1', centro: '3100' },
    { id: 'd3', codigo: '2411', razao: 'Mareira Logística Portuária Ltda', cnpj: cnpj('90731456'), chaves: ['MAREIRA', 'MAREIRA LOG'], conta: 'c1', centro: '3200' },
    { id: 'd4', codigo: '2450', razao: 'Grupo Sabiá Alimentos S.A.', cnpj: cnpj('94660213'), chaves: ['SABIA', 'SABIA FOODS'], conta: 'c4', centro: '3300' },
    { id: 'd5', codigo: '2511', razao: 'Clínica Horizonte Diagnósticos Ltda', cnpj: cnpj('92288470'), chaves: ['HORIZONTE', 'CLINICA HORIZONTE'], conta: 'c1', centro: '3100' },
    { id: 'd6', codigo: '2604', razao: 'Tecelagem Ipê Branco Ltda', cnpj: cnpj('95503189'), chaves: ['IPE BRANCO'], conta: 'c2', centro: '3200' },
    { id: 'd7', codigo: '2650', razao: 'Lumen Software House Ltda', cnpj: cnpj('96017742'), chaves: ['LUMEN', 'LUMEN SOFTWARE'], conta: 'c1', centro: '3100' },
    { id: 'd8', codigo: '2702', razao: 'Northwind Shared Services GmbH', cnpj: '', chaves: ['NORTHWIND', 'NORTHWIND GMBH'], conta: 'c3', centro: '3400', exterior: true },
    { id: 'd9', codigo: '2719', razao: 'Cooperativa Vale do Itapocu', cnpj: cnpjComErro('97012345'), chaves: ['ITAPOCU'], conta: '', centro: '3200' },
  ];

  const titulo = (destinatario, valor, dias, extra = {}) => ({
    id: `t${Math.random().toString(36).slice(2, 9)}`,
    destinatario,
    conta: '',
    projeto: '',
    especificacao: '',
    observacao: '',
    emissao: hoje,
    vencimento: somarDias(hoje, dias),
    valor,
    parcela: 1,
    origem: 'manual',
    ...extra,
  });

  const rascunho = [
    titulo('d1', 48250.0, 18, { projeto: 'PJ-2026-114', especificacao: 'Outsourcing contábil - competência anterior' }),
    titulo('d4', 31780.4, 25, { projeto: 'PJ-2026-097', especificacao: 'Folha de pagamento e obrigações acessórias' }),
    titulo('d7', 12900.0, 10, { projeto: 'PJ-2026-131', especificacao: 'Implantação de rotina fiscal' }),
    titulo('d5', 8640.0, 18, { projeto: 'PJ-2026-102', especificacao: 'Escrituração fiscal e apuração de tributos' }),
    titulo('d9', 5210.0, -2, { projeto: 'PJ-2026-140', especificacao: 'Consultoria tributária pontual', observacao: 'Cliente pediu vencimento retroativo, conferir.' }),
  ];

  const emitido = (numero, diasAtras, itens) => ({
    id: `b${numero}`,
    numero,
    emitidoEm: `${somarDias(hoje, -diasAtras)}T${String(9 + (numero % 7)).padStart(2, '0')}:${String((numero * 13) % 60).padStart(2, '0')}:00`,
    titulos: itens.map(([d, valor, venc, projeto, esp]) => titulo(d, valor, 0, {
      emissao: somarDias(hoje, -diasAtras),
      vencimento: somarDias(hoje, -diasAtras + venc),
      projeto,
      especificacao: esp,
    })),
  });

  const arquivo = [
    emitido(41, 64, [['d1', 46900, 20, 'PJ-2026-114', 'Outsourcing contábil'], ['d2', 9850, 15, 'PJ-2026-088', 'Contabilidade mensal'], ['d3', 22410.75, 30, 'PJ-2026-076', 'Fiscal e folha'], ['d8', 18300, 30, 'PJ-2026-063', 'Shared services - monthly fee']]),
    emitido(42, 49, [['d4', 31780.4, 20, 'PJ-2026-097', 'Folha de pagamento'], ['d6', 4120, 10, 'PJ-2026-091', 'Reembolso de despesas de viagem']]),
    emitido(43, 30, [['d7', 12900, 20, 'PJ-2026-131', 'Implantação de rotina fiscal'], ['d2', 9850, 15, 'PJ-2026-088', 'Contabilidade mensal'], ['d5', 8640, 25, 'PJ-2026-102', 'Escrituração fiscal'], ['d3', 22410.75, 25, 'PJ-2026-076', 'Fiscal e folha'], ['d8', 18300, 25, 'PJ-2026-063', 'Shared services - monthly fee']]),
  ];

  return { contas, destinatarios, rascunho, arquivo, proximoNumero: 44, padraoVencimento: 20 };
}

/** Linhas da planilha de receita de exemplo, no formato que vem da matriz no exterior. */
export function receitaExemplo() {
  return [
    ['REVENUE REPORT - SHARED SERVICES BRAZIL'],
    ['Period: current month', '', '', 'Currency: BRL'],
    [],
    ['Client', 'Project no.', 'Specification', 'Inv. Amount', 'Observação'],
    ['Vento Sul', 'PJ-2026-114', 'Accounting outsourcing', '48.250,00', ''],
    ['MAREIRA LOG', 'PJ-2026-076', 'Tax and payroll', '22.410,75', ''],
    ['Paralelo', 'PJ-2026-088', 'Monthly bookkeeping', '9.850,00', ''],
    ['Northwind GmbH', 'PJ-2026-063', 'Shared services - monthly fee', '18.300,00', 'Invoice in BRL'],
    ['Casa Bromélia Hotelaria', 'PJ-2026-150', 'Onboarding - first month', '7.400,00', 'Cliente novo'],
    ['Sabia Foods', 'PJ-2026-097', 'Payroll', '0,00', 'Sem faturamento no mês'],
    ['Total', '', '', '106.210,75', ''],
  ];
}
