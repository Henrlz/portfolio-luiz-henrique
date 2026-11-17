// Leitura e escrita de planilhas. A biblioteca SheetJS só é baixada quando
// alguém importa ou exporta, para a demo abrir leve.

import { normalizar } from './motor.js';

const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let carregando = null;

export function sheetjs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!carregando) {
    carregando = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = SHEETJS;
      s.onload = () => ok(window.XLSX);
      s.onerror = () => {
        carregando = null;
        falha(new Error('Não foi possível carregar o leitor de planilhas. Verifique a conexão.'));
      };
      document.head.appendChild(s);
    });
  }
  return carregando;
}

// Campos que cada livro precisa, com os nomes que costumam aparecer nos
// relatórios dos sistemas fiscais. A primeira palavra-chave que bater ganha.
export const CAMPOS = {
  saida: [
    { campo: 'empresa', rotulo: 'Empresa', chaves: ['empresa', 'filial', 'estabelecimento'] },
    { campo: 'serie', rotulo: 'Série', chaves: ['serie'] },
    { campo: 'nota', rotulo: 'Nº da nota', chaves: ['nro docto', 'numero nota', 'nota fiscal', 'nf', 'documento', 'nota'] },
    { campo: 'emissao', rotulo: 'Emissão', chaves: ['dt emissao', 'data emissao', 'emissao', 'data'] },
    { campo: 'chave', rotulo: 'Chave NF-e', chaves: ['chave nfe', 'chave de acesso', 'chave'] },
    { campo: 'cfop', rotulo: 'CFOP', chaves: ['cfop', 'codigo fiscal'], obrigatorio: true },
    { campo: 'produto', rotulo: 'Código do produto', chaves: ['cod produto', 'codigo produto', 'produto', 'item', 'sku'] },
    { campo: 'descricao', rotulo: 'Descrição', chaves: ['descricao', 'desc produto', 'nome produto'] },
    { campo: 'qtd', rotulo: 'Quantidade', chaves: ['quantidade', 'qtde', 'qtd'] },
    { campo: 'vlrProduto', rotulo: 'Valor do produto', chaves: ['vlr produto', 'valor produto', 'valor mercadoria', 'vlr total item', 'valor'], obrigatorio: true },
    { campo: 'desconto', rotulo: 'Desconto', chaves: ['desconto', 'vlr desconto'] },
    { campo: 'icms', rotulo: 'ICMS', chaves: ['vlr icms', 'valor icms', 'icms'] },
    { campo: 'ipi', rotulo: 'IPI', chaves: ['vlr ipi', 'valor ipi', 'ipi'] },
    { campo: 'pis', rotulo: 'PIS', chaves: ['vlr pis', 'valor pis', 'pis'] },
    { campo: 'cofins', rotulo: 'COFINS', chaves: ['vlr cofins', 'valor cofins', 'cofins'] },
    { campo: 'difal', rotulo: 'DIFAL', chaves: ['difal', 'icms uf destino', 'dicms destino', 'nc valor'] },
    { campo: 'despAces', rotulo: 'Desp. acessórias', chaves: ['desp aces', 'despesas acessorias', 'outras despesas', 'frete'] },
    { campo: 'troca', rotulo: 'Troca (S/N)', chaves: ['troca', 'vlr troca'] },
  ],
  servicos: [
    { campo: 'nota', rotulo: 'Nº da nota', chaves: ['numero nfs', 'nota', 'nfs-e', 'nfse', 'numero'] , obrigatorio: true },
    { campo: 'emissao', rotulo: 'Emissão', chaves: ['emissao', 'data'] },
    { campo: 'cliente', rotulo: 'Tomador', chaves: ['tomador', 'cliente', 'razao social'] },
    { campo: 'documento', rotulo: 'CPF/CNPJ', chaves: ['cnpj', 'cpf', 'documento'] },
    { campo: 'codigo', rotulo: 'Código do serviço', chaves: ['codigo servico', 'item lista', 'codigo'] },
    { campo: 'servico', rotulo: 'Discriminação', chaves: ['discriminacao', 'servico', 'descricao'] },
    { campo: 'valor', rotulo: 'Valor contábil', chaves: ['valor contabil', 'valor servico', 'valor bruto', 'valor'], obrigatorio: true },
    { campo: 'aliqIss', rotulo: 'Alíquota ISS (%)', chaves: ['aliquota iss', 'aliq iss', 'aliquota'] },
    { campo: 'iss', rotulo: 'ISS', chaves: ['valor iss', 'vlr iss', 'iss'] },
    { campo: 'pis', rotulo: 'PIS', chaves: ['valor pis', 'pis'] },
    { campo: 'cofins', rotulo: 'COFINS', chaves: ['valor cofins', 'cofins'] },
  ],
};
CAMPOS.entrada = CAMPOS.saida.filter((f) => f.campo !== 'troca');

const NUMERICOS = new Set(['qtd', 'vlrProduto', 'desconto', 'icms', 'ipi', 'pis', 'cofins', 'difal', 'despAces', 'valor', 'aliqIss', 'iss']);

/** "1.234,56", "R$ 1.234,56", "(12,00)" e 1234.56 viram número. */
export function numero(valor) {
  if (typeof valor === 'number') return valor;
  let t = String(valor ?? '').trim();
  if (!t) return 0;
  const negativo = /^\(.*\)$/.test(t) || t.startsWith('-');
  t = t.replace(/[^\d,.-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Math.abs(parseFloat(t));
  return Number.isFinite(n) ? (negativo ? -n : n) : 0;
}

function dataIso(valor, XLSX) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === 'number' && XLSX) {
    const d = XLSX.SSF.parse_date_code(valor);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const t = String(valor ?? '').trim();
  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return t.slice(0, 10);
}

/** Lê o arquivo e devolve as linhas cruas da primeira aba com dados. */
export async function lerArquivo(arquivo) {
  const XLSX = await sheetjs();
  const buffer = await arquivo.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  for (const nome of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: true, defval: '' });
    if (linhas.some((l) => l.some((c) => String(c).trim() !== ''))) return { aba: nome, linhas };
  }
  return { aba: wb.SheetNames[0], linhas: [] };
}

/**
 * Procura a linha de cabeçalho nas 40 primeiras linhas: a que tiver mais
 * nomes de coluna conhecidos. Relatório de sistema fiscal costuma ter título,
 * CNPJ e período antes do cabeçalho de verdade.
 */
export function detectarCabecalho(linhas, livro) {
  const campos = CAMPOS[livro];
  let melhor = { indice: -1, acertos: 0 };
  linhas.slice(0, 40).forEach((linha, indice) => {
    const nomes = linha.map(normalizar);
    const acertos = campos.filter((f) => f.chaves.some((k) => nomes.some((n) => n === k || n.includes(k)))).length;
    if (acertos > melhor.acertos) melhor = { indice, acertos };
  });
  return melhor.acertos >= 2 ? melhor.indice : -1;
}

/** Sugere, para cada campo, a coluna da planilha. Coluna já usada não repete. */
export function sugerirMapa(cabecalho, livro) {
  const nomes = cabecalho.map(normalizar);
  const usadas = new Set();
  const mapa = {};
  for (const f of CAMPOS[livro]) {
    let achou = -1;
    for (const k of f.chaves) {
      achou = nomes.findIndex((n, i) => !usadas.has(i) && n === k);
      if (achou < 0) achou = nomes.findIndex((n, i) => !usadas.has(i) && n.includes(k));
      if (achou >= 0) break;
    }
    if (achou >= 0) usadas.add(achou);
    mapa[f.campo] = achou;
  }
  return mapa;
}

/**
 * Transforma as linhas cruas em lançamentos, aplicando aliases de empresa e
 * descartando rodapés e linhas vazias. Devolve também o que foi descartado,
 * para o registro do lote.
 */
export function montarRegistros({ linhas, cabecalho, mapa, livro, cfg, loja }) {
  const XLSX = window.XLSX;
  const aliases = new Map(cfg.aliases.map((a) => [normalizar(a.arquivo), a.interno]));
  const rodape = cfg.rodape.map(normalizar);
  const registros = [];
  const descartes = [];
  const prefixo = livro === 'saida' ? 's' : livro === 'entrada' ? 'e' : 'v';
  const lote = Date.now().toString(36);

  linhas.slice(cabecalho + 1).forEach((linha, i) => {
    const numeroLinha = cabecalho + i + 2;
    const texto = normalizar(linha.join(' '));
    if (!texto) return;
    if (rodape.some((t) => t && texto.includes(t))) {
      descartes.push(`Linha ${numeroLinha}: rodapé ("${linha.find((c) => String(c).trim()) ?? ''}")`);
      return;
    }
    const reg = { id: `${prefixo}${lote}-${i}` };
    for (const f of CAMPOS[livro]) {
      const col = mapa[f.campo];
      const bruto = col >= 0 ? linha[col] : '';
      if (NUMERICOS.has(f.campo)) reg[f.campo] = numero(bruto);
      else if (f.campo === 'emissao') reg[f.campo] = dataIso(bruto, XLSX);
      else if (f.campo === 'troca') reg.troca = /^(s|sim|x|1|true)$/i.test(String(bruto).trim()) || numero(bruto) > 0;
      else reg[f.campo] = String(bruto ?? '').trim();
    }
    const faltando = CAMPOS[livro].filter((f) => f.obrigatorio && !reg[f.campo]);
    if (faltando.length) {
      descartes.push(`Linha ${numeroLinha}: sem ${faltando.map((f) => f.rotulo).join(' e ')}`);
      return;
    }
    if (reg.empresa) reg.empresa = aliases.get(normalizar(reg.empresa)) ?? reg.empresa.toUpperCase();
    if (reg.cfop) reg.cfop = String(reg.cfop).replace(/\D/g, '').slice(0, 4);
    if (livro === 'servicos') {
      reg.loja = loja;
      if (!reg.iss && reg.aliqIss) reg.iss = Math.round(reg.valor * reg.aliqIss) / 100;
      if (!reg.aliqIss && reg.iss && reg.valor) reg.aliqIss = Math.round((reg.iss / reg.valor) * 10000) / 100;
    }
    if (!reg.qtd && livro !== 'servicos') reg.qtd = 1;
    registros.push(reg);
  });

  return { registros, descartes };
}

/** Exporta uma lista de objetos para .xlsx com as colunas e rótulos dados. */
export async function exportar(nomeArquivo, abas) {
  const XLSX = await sheetjs();
  const wb = XLSX.utils.book_new();
  for (const { nome, colunas, linhas } of abas) {
    const dados = [colunas.map((c) => c.rotulo), ...linhas.map((l) => colunas.map((c) => (c.valor ? c.valor(l) : l[c.campo])))];
    const ws = XLSX.utils.aoa_to_sheet(dados);
    ws['!cols'] = colunas.map((c) => ({ wch: Math.max(10, c.rotulo.length + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
  }
  XLSX.writeFile(wb, nomeArquivo);
}
