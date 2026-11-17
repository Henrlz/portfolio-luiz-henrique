// Motor fiscal do FiscalView: classificação por canal, consolidação, base
// analítica e conferências. Não conhece a interface; recebe dados e devolve
// números. Valores somados em centavos inteiros para não acumular erro de
// arredondamento em centenas de linhas.

const c = (v) => Math.round((Number(v) || 0) * 100);
const r = (cent) => cent / 100;

export const TRIBUTOS = ['icms', 'ipi', 'pis', 'cofins', 'difal'];
export const NOME_TRIBUTO = { icms: 'ICMS', ipi: 'IPI', pis: 'PIS', cofins: 'COFINS', difal: 'DIFAL' };

/** Normaliza texto para comparação: minúsculo, sem acento, sem espaço sobrando. */
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lista "5102, 6108" vira ['5102', '6108']. */
export function listaCfop(texto) {
  return String(texto ?? '')
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Acha a regra de canal que vale para o lançamento. As regras são lidas em
 * ordem de prioridade; uma regra vale quando todas as condições preenchidas
 * batem (condição vazia sempre bate). Devolve a regra e o motivo legível,
 * que a ficha do lançamento mostra para explicar a classificação.
 */
export function regraAplicada(lanc, regras) {
  const ordenadas = [...regras].sort((a, b) => a.prioridade - b.prioridade);
  const empresa = normalizar(lanc.empresa);
  const serie = normalizar(lanc.serie);
  const cfop = String(lanc.cfop ?? '').trim();

  for (const regra of ordenadas) {
    const motivos = [];
    if (regra.empresa) {
      if (!empresa.includes(normalizar(regra.empresa))) continue;
      motivos.push(`empresa contém "${regra.empresa}"`);
    }
    if (regra.serie) {
      if (!serie.includes(normalizar(regra.serie))) continue;
      motivos.push(`série contém "${regra.serie}"`);
    }
    if (regra.cfops) {
      if (!listaCfop(regra.cfops).includes(cfop)) continue;
      motivos.push(`CFOP ${cfop} está em ${listaCfop(regra.cfops).join(', ')}`);
    }
    return { regra, motivo: motivos.length ? motivos.join(' e ') : 'nenhuma regra anterior bateu (pega-tudo)' };
  }
  return { regra: null, motivo: 'nenhuma regra cadastrada' };
}

export function canalDe(lanc, regras) {
  return regraAplicada(lanc, regras).regra?.canal ?? 'SEM REGRA';
}

/** Valor da venda como aparece na nota: produto + IPI + despesas acessórias. */
export function valorVenda(l) {
  return r(c(l.vlrProduto) + c(l.ipi) + c(l.despAces));
}

/** Soma dos tributos destacados no lançamento. */
export function tributosDe(l) {
  return r(TRIBUTOS.reduce((s, t) => s + c(l[t]), 0));
}

function acumuladorVazio(canal) {
  return { canal, total: 0, trocas: 0, descontos: 0, icms: 0, ipi: 0, pis: 0, cofins: 0, difal: 0, qtdVendas: 0, qtdTrocas: 0, linhas: 0 };
}

function fechar(acc) {
  const liquido = acc.total - acc.trocas - Math.abs(acc.descontos);
  const tributos = TRIBUTOS.reduce((s, t) => s + acc[t], 0);
  const saida = { canal: acc.canal, linhas: acc.linhas, qtdVendas: acc.qtdVendas, qtdTrocas: acc.qtdTrocas };
  for (const k of ['total', 'trocas', 'descontos', ...TRIBUTOS]) saida[k] = r(acc[k]);
  saida.liquido = r(liquido);
  saida.tributos = r(tributos);
  saida.vendasLiquidas = r(liquido - tributos);
  saida.carga = liquido > 0 ? tributos / liquido : 0;
  return saida;
}

/** Agrupa as devoluções por nota fiscal (mesma nota, empresa, série e CFOP). */
export function agruparDevolucoes(entradas) {
  const grupos = new Map();
  for (const d of entradas) {
    const chave = [d.nota, d.empresa, d.serie, d.cfop].join('|');
    if (!grupos.has(chave)) {
      grupos.set(chave, { chave, nota: d.nota, empresa: d.empresa, serie: d.serie, cfop: d.cfop, emissao: d.emissao, itens: [] });
    }
    grupos.get(chave).itens.push(d);
  }
  for (const g of grupos.values()) {
    g.vlrProduto = r(g.itens.reduce((s, i) => s + c(i.vlrProduto), 0));
    g.ipi = r(g.itens.reduce((s, i) => s + c(i.ipi), 0));
    g.troca = Math.abs(r(c(g.vlrProduto) + c(g.ipi)));
    g.qtd = g.itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0);
  }
  return [...grupos.values()].sort((a, b) => String(a.emissao).localeCompare(String(b.emissao)));
}

/**
 * Consolidação por canal. Saídas fora dos CFOPs válidos e devoluções fora
 * da lista de CFOPs de devolução ficam de fora (e aparecem na conferência).
 * Devolução entra como troca, nunca como venda negativa.
 */
export function consolidar({ saidas, entradas }, cfg) {
  const porCanal = new Map();
  const pegar = (canal) => {
    if (!porCanal.has(canal)) porCanal.set(canal, acumuladorVazio(canal));
    return porCanal.get(canal);
  };

  for (const l of saidas) {
    if (!cfg.cfopsSaida.includes(String(l.cfop))) continue;
    const acc = pegar(canalDe(l, cfg.regras));
    acc.linhas += 1;
    if (l.troca) {
      acc.trocas += c(valorVenda(l));
      acc.qtdTrocas += Math.abs(Number(l.qtd) || 0);
    } else {
      acc.total += c(valorVenda(l));
      acc.qtdVendas += Number(l.qtd) || 0;
    }
    acc.descontos += c(l.desconto);
    for (const t of TRIBUTOS) acc[t] += c(l[t]);
  }

  const devolucoesValidas = entradas.filter((d) => cfg.cfopsDevolucao.includes(String(d.cfop)));
  for (const d of devolucoesValidas) {
    const acc = pegar(canalDe(d, cfg.regras));
    acc.linhas += 1;
    acc.trocas += Math.abs(c(d.vlrProduto) + c(d.ipi));
    acc.qtdTrocas += Math.abs(Number(d.qtd) || 0);
    acc.descontos += c(d.desconto);
    for (const t of TRIBUTOS) acc[t] += c(d[t]);
  }

  const total = acumuladorVazio('TOTAL');
  for (const acc of porCanal.values()) {
    for (const k of Object.keys(total)) if (k !== 'canal') total[k] += acc[k];
  }

  return {
    canais: [...porCanal.values()].map(fechar).sort((a, b) => b.total - a.total),
    total: fechar(total),
  };
}

export function consolidarServicos(servicos) {
  const porLoja = new Map();
  for (const s of servicos) {
    const loja = s.loja || 'SEM LOJA';
    if (!porLoja.has(loja)) porLoja.set(loja, { loja, notas: 0, bruto: 0, iss: 0, pis: 0, cofins: 0 });
    const acc = porLoja.get(loja);
    acc.notas += 1;
    acc.bruto += c(s.valor);
    acc.iss += c(s.iss);
    acc.pis += c(s.pis);
    acc.cofins += c(s.cofins);
  }
  const lojas = [...porLoja.values()].map((a) => ({
    loja: a.loja,
    notas: a.notas,
    bruto: r(a.bruto),
    iss: r(a.iss),
    pis: r(a.pis),
    cofins: r(a.cofins),
    liquido: r(a.bruto - a.iss - a.pis - a.cofins),
  }));
  const soma = (k) => r(lojas.reduce((s, l) => s + c(l[k]), 0));
  return {
    lojas: lojas.sort((a, b) => b.bruto - a.bruto),
    total: { notas: lojas.reduce((s, l) => s + l.notas, 0), bruto: soma('bruto'), iss: soma('iss'), pis: soma('pis'), cofins: soma('cofins'), liquido: soma('liquido') },
  };
}

/** Alíquota efetiva de ICMS de um lançamento (0..1), sobre o valor já com desconto. */
export function aliquotaIcms(l) {
  const base = (Number(l.vlrProduto) || 0) - Math.abs(Number(l.desconto) || 0);
  return base > 0 ? (Number(l.icms) || 0) / base : 0;
}

/**
 * Base analítica: uma linha por lançamento, com as colunas calculadas que a
 * planilha da macro original tinha (Líquido NF, Valor Total, Troca, Qtde).
 */
export function baseAnalitica({ saidas, entradas, servicos }, cfg, canceladas = []) {
  const notasCanceladas = new Set(canceladas.map((x) => String(x).trim()).filter(Boolean));
  const linhas = [];

  for (const l of saidas) {
    const vt = valorVenda(l);
    linhas.push({
      id: l.id, origem: 'saida', emissao: l.emissao, empresa: l.empresa, serie: l.serie, nota: l.nota, chave: l.chave,
      cfop: String(l.cfop), produto: l.produto, descricao: l.descricao, qtd: Number(l.qtd) || 0,
      vlrProduto: Number(l.vlrProduto) || 0, desconto: Number(l.desconto) || 0,
      icms: Number(l.icms) || 0, ipi: Number(l.ipi) || 0, pis: Number(l.pis) || 0, cofins: Number(l.cofins) || 0, difal: Number(l.difal) || 0,
      liquidoNF: r(c(vt) - Math.abs(c(l.desconto))),
      valorTotal: l.troca ? 0 : vt,
      troca: l.troca ? vt : 0,
      qtdVendas: l.troca ? 0 : Number(l.qtd) || 0,
      qtdTrocas: l.troca ? Math.abs(Number(l.qtd) || 0) : 0,
      canal: canalDe(l, cfg.regras),
      valida: cfg.cfopsSaida.includes(String(l.cfop)),
      cancelada: notasCanceladas.has(String(l.chave)) || notasCanceladas.has(String(l.nota)),
    });
  }

  for (const d of entradas) {
    const troca = Math.abs(r(c(d.vlrProduto) + c(d.ipi)));
    linhas.push({
      id: d.id, origem: 'entrada', emissao: d.emissao, empresa: d.empresa, serie: d.serie, nota: d.nota, chave: d.chave,
      cfop: String(d.cfop), produto: d.produto, descricao: d.descricao, qtd: Number(d.qtd) || 0,
      vlrProduto: Number(d.vlrProduto) || 0, desconto: Number(d.desconto) || 0,
      icms: Number(d.icms) || 0, ipi: Number(d.ipi) || 0, pis: Number(d.pis) || 0, cofins: Number(d.cofins) || 0, difal: Number(d.difal) || 0,
      liquidoNF: r(c(d.vlrProduto) + c(d.ipi) - Math.abs(c(d.desconto))),
      valorTotal: 0,
      troca,
      qtdVendas: 0,
      qtdTrocas: Math.abs(Number(d.qtd) || 0),
      canal: canalDe(d, cfg.regras),
      valida: cfg.cfopsDevolucao.includes(String(d.cfop)),
      cancelada: notasCanceladas.has(String(d.chave)) || notasCanceladas.has(String(d.nota)),
    });
  }

  for (const s of servicos) {
    linhas.push({
      id: s.id, origem: 'servico', emissao: s.emissao, empresa: s.loja, serie: '', nota: s.nota, chave: '',
      cfop: 'SERV', produto: s.codigo, descricao: s.servico, qtd: 1,
      vlrProduto: Number(s.valor) || 0, desconto: 0, icms: 0, ipi: 0,
      pis: Number(s.pis) || 0, cofins: Number(s.cofins) || 0, difal: 0, iss: Number(s.iss) || 0,
      liquidoNF: Number(s.valor) || 0, valorTotal: Number(s.valor) || 0, troca: 0, qtdVendas: 1, qtdTrocas: 0,
      canal: `SERVIÇOS ${s.loja || ''}`.trim(), valida: true, cancelada: notasCanceladas.has(String(s.nota)),
    });
  }

  return linhas.sort((a, b) => String(a.emissao).localeCompare(String(b.emissao)) || String(a.nota).localeCompare(String(b.nota)));
}

/**
 * Conferências de auditoria. Cada uma devolve status, um resumo e o filtro
 * que a tela usa para mostrar só os lançamentos envolvidos.
 */
export function conferir(dados, cfg, consolidado, base) {
  const out = [];
  const moeda = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // 1. A base analítica (produtos e devoluções válidos) fecha com a consolidação?
  const valid = base.filter((l) => l.origem !== 'servico' && l.valida);
  const somaBase = r(valid.reduce((s, l) => s + c(l.valorTotal) - c(l.troca), 0));
  const somaCons = r(c(consolidado.total.total) - c(consolidado.total.trocas));
  const dif = Math.abs(somaBase - somaCons);
  out.push({
    id: 'fechamento',
    status: dif < 0.01 ? 'ok' : 'erro',
    titulo: 'Base analítica fecha com a apuração',
    detalhe: dif < 0.01 ? `Diferença zero. Vendas menos trocas: ${moeda(somaBase)}.` : `Diferença de ${moeda(dif)} entre a base e a apuração.`,
    filtro: null,
  });

  // 2. Lançamentos com CFOP fora das listas válidas.
  const fora = base.filter((l) => l.origem !== 'servico' && !l.valida);
  const valorFora = r(fora.reduce((s, l) => s + c(l.vlrProduto), 0));
  out.push({
    id: 'cfop',
    status: fora.length ? 'aviso' : 'ok',
    titulo: 'CFOP fora das listas válidas',
    detalhe: fora.length
      ? `${fora.length} lançamento(s), ${moeda(valorFora)}, ficaram fora da apuração (CFOP ${[...new Set(fora.map((l) => l.cfop))].join(', ')}).`
      : 'Todos os CFOPs estão nas listas de saída ou devolução.',
    filtro: fora.length ? { tipo: 'cfop-invalido' } : null,
    qtd: fora.length,
  });

  // 3. Caíram na regra pega-tudo?
  const ultima = [...cfg.regras].sort((a, b) => b.prioridade - a.prioridade)[0];
  const pegaTudo = ultima && !ultima.empresa && !ultima.serie && !ultima.cfops ? ultima.canal : null;
  const semCanal = base.filter((l) => l.origem !== 'servico' && l.valida && (l.canal === pegaTudo || l.canal === 'SEM REGRA'));
  out.push({
    id: 'pega-tudo',
    status: semCanal.length ? 'aviso' : 'ok',
    titulo: 'Lançamentos sem regra específica',
    detalhe: semCanal.length
      ? `${semCanal.length} lançamento(s) caíram em "${pegaTudo ?? 'SEM REGRA'}". Vale criar uma regra para eles.`
      : 'Todo lançamento válido foi classificado por uma regra específica.',
    filtro: semCanal.length ? { tipo: 'pega-tudo', canal: pegaTudo ?? 'SEM REGRA' } : null,
    qtd: semCanal.length,
  });

  // 4. Alíquota efetiva de ICMS fora da faixa esperada.
  const faixa = cfg.faixaIcms;
  const fora_aliq = dados.saidas.filter((l) => {
    if (!cfg.cfopsSaida.includes(String(l.cfop)) || !(Number(l.vlrProduto) > 0)) return false;
    if (Number(l.icms) === 0) return false;
    const a = Math.round(aliquotaIcms(l) * 1000) / 10;
    return a < faixa.min || a > faixa.max;
  });
  out.push({
    id: 'aliquota',
    status: fora_aliq.length ? 'erro' : 'ok',
    titulo: `ICMS efetivo fora de ${faixa.min}% a ${faixa.max}%`,
    detalhe: fora_aliq.length
      ? `${fora_aliq.length} lançamento(s) com alíquota efetiva estranha. Confira a base de cálculo na nota.`
      : 'Nenhuma alíquota efetiva de ICMS fora da faixa.',
    filtro: fora_aliq.length ? { tipo: 'ids', ids: fora_aliq.map((l) => l.id) } : null,
    qtd: fora_aliq.length,
  });

  // 5. Devolução de produto que não foi vendido no período.
  const vendidos = new Set(dados.saidas.map((l) => `${normalizar(l.empresa)}|${l.produto}`));
  const orfas = dados.entradas.filter((d) => !vendidos.has(`${normalizar(d.empresa)}|${d.produto}`));
  out.push({
    id: 'orfas',
    status: orfas.length ? 'aviso' : 'ok',
    titulo: 'Devolução sem venda no período',
    detalhe: orfas.length
      ? `${orfas.length} item(ns) devolvido(s) sem saída do mesmo produto na mesma empresa. Pode ser venda de mês anterior.`
      : 'Todo item devolvido tem venda no período.',
    filtro: orfas.length ? { tipo: 'ids', ids: orfas.map((d) => d.id) } : null,
    qtd: orfas.length,
  });

  return out;
}
