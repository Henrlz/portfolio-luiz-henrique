// FiscalView: interface. Estado único, telas como funções que devolvem HTML,
// eventos por delegação (data-acao). O cálculo fica em motor.js.

import {
  TRIBUTOS, NOME_TRIBUTO, consolidar, consolidarServicos, baseAnalitica, conferir,
  regraAplicada, agruparDevolucoes, aliquotaIcms, valorVenda, normalizar, listaCfop,
} from './motor.js';
import { gerarDemo, CONFIG_PADRAO, COMPETENCIA } from './demo.js';
import { CAMPOS, lerArquivo, detectarCabecalho, sugerirMapa, montarRegistros, exportar } from './planilha.js';

const CHAVE = 'fiscalview:v2';
const POR_PAGINA = 40;

// ---------------------------------------------------------------------------
// Estado e persistência
// ---------------------------------------------------------------------------

const estado = {
  dados: null,
  cfg: null,
  canceladas: '',
  empresa: '',
  rota: 'apuracao',
  canalAberto: null,
  filtroConf: null,
  busca: { saida: '', base: '', servicos: '' },
  filtro: { canal: '', cfop: '', trocas: false, origem: '' },
  pagina: { saida: 0, base: 0 },
  ficha: null,
  simulador: { empresa: 'AURORA MATRIZ', serie: '2', cfop: '6108' },
  importacao: null,
};

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (salvo?.dados && salvo?.cfg) {
      estado.dados = salvo.dados;
      estado.cfg = { ...structuredClone(CONFIG_PADRAO), ...salvo.cfg };
      estado.canceladas = salvo.canceladas ?? '';
      return;
    }
  } catch { /* armazenamento indisponível: segue com a demo */ }
  restaurarDemo(false);
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ dados: estado.dados, cfg: estado.cfg, canceladas: estado.canceladas }));
  } catch { /* sem armazenamento, os dados valem só nesta aba */ }
}

function restaurarDemo(persistir = true) {
  estado.dados = gerarDemo();
  estado.cfg = structuredClone(CONFIG_PADRAO);
  estado.canceladas = '';
  if (persistir) salvar();
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const fmtNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = new Intl.NumberFormat('pt-BR');
const fmtPct = new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const num = (v) => fmtNum.format(Number(v) || 0);
/** Convenção contábil: negativo entre parênteses. */
const contabil = (v) => ((Number(v) || 0) < 0 ? `(${fmtNum.format(Math.abs(v))})` : fmtNum.format(Number(v) || 0));
const reais = (v) => `R$ ${num(v)}`;
const pct = (v) => fmtPct.format(Number.isFinite(v) ? v : 0);
const data = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso || '-');
const dataHora = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function competenciaPorExtenso() {
  const datas = [...estado.dados.saidas, ...estado.dados.entradas].map((l) => l.emissao).filter(Boolean).sort();
  const ref = datas.length ? datas[Math.floor(datas.length / 2)] : `${COMPETENCIA}-01`;
  const [ano, mes] = ref.split('-');
  const nome = MESES[Number(mes) - 1];
  return nome ? `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}` : ref;
}

// ---------------------------------------------------------------------------
// Derivados (recalculados a cada render, são baratos para o volume da demo)
// ---------------------------------------------------------------------------

function lojaDaEmpresa(empresa) {
  return estado.cfg.lojas.find((l) => normalizar(l.empresa) === normalizar(empresa))?.loja ?? '';
}

function dadosVisiveis() {
  const { saidas, entradas, servicos } = estado.dados;
  if (!estado.empresa) return { saidas, entradas, servicos };
  const loja = lojaDaEmpresa(estado.empresa);
  return {
    saidas: saidas.filter((l) => l.empresa === estado.empresa),
    entradas: entradas.filter((l) => l.empresa === estado.empresa),
    servicos: servicos.filter((s) => !loja || s.loja === loja),
  };
}

function derivar() {
  const dados = dadosVisiveis();
  const canceladas = estado.canceladas.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
  const consolidado = consolidar(dados, estado.cfg);
  const servicos = consolidarServicos(dados.servicos);
  const base = baseAnalitica(dados, estado.cfg, canceladas);
  const checks = conferir(dados, estado.cfg, consolidado, base);
  return { dados, consolidado, servicos, base, checks };
}

// ---------------------------------------------------------------------------
// Navegação
// ---------------------------------------------------------------------------

const ROTAS = [
  { id: 'apuracao', nome: 'Apuração' },
  { id: 'saida', nome: 'Livro de saída', conta: (d) => d.dados.saidas.length },
  { id: 'devolucoes', nome: 'Devoluções', conta: (d) => agruparDevolucoes(d.dados.entradas).length },
  { id: 'servicos', nome: 'Serviços', conta: (d) => d.dados.servicos.length },
  { id: 'base', nome: 'Base analítica', conta: (d) => d.base.length },
  { id: 'lotes', nome: 'Importações', conta: () => estado.dados.lotes.length },
  { id: 'regras', nome: 'Regras' },
];

function lerRota() {
  const id = location.hash.replace('#', '');
  estado.rota = ROTAS.some((r) => r.id === id) ? id : 'apuracao';
}

// ---------------------------------------------------------------------------
// Tela: Apuração
// ---------------------------------------------------------------------------

function telaApuracao(d) {
  const t = d.consolidado.total;
  const s = d.servicos.total;
  const bruto = t.total;
  const p = (v) => (bruto > 0 ? pct(v / bruto) : '');
  const totalConsolidado = t.vendasLiquidas + s.liquido;
  const linha = (rotulo, valor, classe = '', percentual = p(Math.abs(valor))) => `
    <li class="linha ${classe}">
      <span class="rotulo">${rotulo}</span><span class="pontos"></span>
      <span class="valor ${valor < 0 ? 'negativo' : ''}">${contabil(valor)}</span><span class="pct">${percentual}</span>
    </li>`;

  const tributosServ = s.iss + s.pis + s.cofins;
  const okCount = d.checks.filter((c) => c.status === 'ok').length;
  const somaTrib = TRIBUTOS.reduce((a, k) => a + t[k], 0) + tributosServ;
  const fatias = [
    ...TRIBUTOS.map((k, i) => ({ nome: NOME_TRIBUTO[k], v: t[k], cor: `var(--t${(i % 5) + 1})` })),
    { nome: 'Tributos sobre serviços', v: tributosServ, cor: 'var(--tinta-3)' },
  ].filter((f) => f.v > 0);

  const maiorLiquido = Math.max(...d.consolidado.canais.map((c) => c.vendasLiquidas), 1);

  return `
  <div class="grade-apuracao">
    <article class="folha demonstrativo" aria-labelledby="titulo-dem">
      <p class="sobrescrito">Demonstrativo de apuração · ${esc(competenciaPorExtenso())}${estado.empresa ? ` · ${esc(estado.empresa)}` : ''}</p>
      <h1 id="titulo-dem" class="sr">Vendas líquidas</h1>
      <p class="numero-grande"><small>R$</small>${num(totalConsolidado)}</p>
      <p class="resumo">Total consolidado depois de trocas, descontos e tributos.
        Das vendas brutas de <mark>${reais(bruto)}</mark>, sobram ${pct(bruto > 0 ? t.vendasLiquidas / bruto : 0)} em produtos.
        Carga tributária de <strong>${pct(t.carga)}</strong> sobre a receita líquida.</p>
      <ol class="linhas">
        <li class="linha titulo-grupo"><span class="rotulo">Produtos</span></li>
        ${linha('Vendas de produtos', bruto, '', bruto > 0 ? '100,0%' : '')}
        ${linha('(−) Trocas e devoluções', -t.trocas, 'menos')}
        ${linha('(−) Descontos concedidos', -Math.abs(t.descontos), 'menos')}
        ${linha('Receita líquida', t.liquido, 'subtotal')}
        ${TRIBUTOS.filter((k) => t[k] > 0).map((k) => linha(`(−) ${NOME_TRIBUTO[k]}`, -t[k], 'menos')).join('')}
        ${linha('Vendas líquidas de produtos', t.vendasLiquidas, 'total')}
        <li class="linha titulo-grupo"><span class="rotulo">Serviços</span></li>
        ${linha(`Serviços prestados (${fmtInt.format(s.notas)} notas)`, s.bruto, '', '')}
        ${linha('(−) ISS, PIS e COFINS', -tributosServ, 'menos', '')}
        ${linha('Serviços líquidos', s.liquido, 'subtotal', '')}
        ${linha('Total consolidado', totalConsolidado, 'total final', '')}
      </ol>
      <p class="nota-demo">Percentuais sobre as vendas brutas de produtos. Valores em reais. Dados fictícios de uma loja de casa e decoração.</p>
    </article>

    <div class="lateral">
      <article class="folha conferencia" aria-labelledby="titulo-conf">
        <header>
          <div><h2 id="titulo-conf">Conferência</h2><p>O que olhar antes de fechar o mês.</p></div>
          <span class="placar">${okCount} de ${d.checks.length} em ordem</span>
        </header>
        <ul class="checklist">
          ${d.checks.map((c) => `
            <li>
              <span class="selo ${c.status}" aria-label="${c.status === 'ok' ? 'Em ordem' : c.status === 'aviso' ? 'Atenção' : 'Problema'}">${c.status === 'ok' ? '✓' : c.status === 'aviso' ? '!' : '×'}</span>
              <div>
                <strong>${esc(c.titulo)}</strong>
                <p>${esc(c.detalhe)}</p>
                ${c.filtro ? `<button class="btn-link" type="button" data-acao="ver-conferencia" data-id="${c.id}">Ver ${c.qtd} lançamento${c.qtd > 1 ? 's' : ''}</button>` : ''}
              </div>
            </li>`).join('')}
        </ul>
      </article>

      <article class="folha tributos" aria-labelledby="titulo-trib">
        <header><h2 id="titulo-trib">Para onde vai o imposto</h2><p>${reais(somaTrib)} em tributos no período.</p></header>
        <div class="barra-tributos" role="img" aria-label="Composição dos tributos">
          ${fatias.map((f) => `<span style="width:${(f.v / (somaTrib || 1)) * 100}%;background:${f.cor}" title="${esc(f.nome)}"></span>`).join('')}
        </div>
        <ul class="legenda">
          ${fatias.map((f) => `<li><i style="background:${f.cor}"></i><span>${esc(f.nome)}</span><span class="v">${num(f.v)}</span><span class="p">${pct(f.v / (somaTrib || 1))}</span></li>`).join('')}
        </ul>
      </article>
    </div>
  </div>

  <section class="folha secao" aria-labelledby="titulo-canais">
    <header>
      <div><h2 id="titulo-canais">Por canal</h2><p>Clique num canal para ver CFOPs e os produtos que mais venderam.</p></div>
      <button class="btn" type="button" data-acao="exportar-canais">Exportar resumo</button>
    </header>
    <div class="rolagem">
      <table>
        <thead><tr>
          <th>Canal</th><th class="n">Vendas</th><th class="n">Trocas</th><th class="n">Descontos</th><th class="n">Receita líquida</th>
          <th class="n">Tributos</th><th>Carga</th><th class="n">Vendas líquidas</th><th>Participação</th>
        </tr></thead>
        <tbody>
          ${d.consolidado.canais.map((c) => `
            <tr class="clicavel" data-acao="abrir-canal" data-canal="${esc(c.canal)}" aria-expanded="${estado.canalAberto === c.canal}">
              <td><span class="marca-canal ${c.canal === 'OUTROS' ? 'pega-tudo' : ''}">${esc(c.canal)}</span></td>
              <td class="n">${num(c.total)}</td><td class="n">${contabil(-c.trocas)}</td><td class="n">${contabil(-Math.abs(c.descontos))}</td>
              <td class="n">${num(c.liquido)}</td><td class="n">${num(c.tributos)}</td>
              <td><span class="carga"><span class="trilho"><b style="width:${Math.min(100, (c.carga / 0.4) * 100)}%"></b></span><span class="mono">${pct(c.carga)}</span></span></td>
              <td class="n"><strong>${num(c.vendasLiquidas)}</strong></td>
              <td><div class="participacao" title="${pct(t.vendasLiquidas ? c.vendasLiquidas / t.vendasLiquidas : 0)}"><b style="width:${Math.max(0, (c.vendasLiquidas / maiorLiquido) * 100)}%"></b></div></td>
            </tr>
            ${estado.canalAberto === c.canal ? detalheCanal(c.canal, d) : ''}`).join('')}
        </tbody>
        <tfoot><tr>
          <td>Total</td><td class="n">${num(t.total)}</td><td class="n">${contabil(-t.trocas)}</td><td class="n">${contabil(-Math.abs(t.descontos))}</td>
          <td class="n">${num(t.liquido)}</td><td class="n">${num(t.tributos)}</td><td class="mono">${pct(t.carga)}</td><td class="n">${num(t.vendasLiquidas)}</td><td></td>
        </tr></tfoot>
      </table>
    </div>
  </section>

  <section class="folha secao" aria-labelledby="titulo-serv">
    <header><div><h2 id="titulo-serv">Serviços por loja</h2><p>Notas de serviço (NFS-e) com ISS, PIS e COFINS retidos na apuração.</p></div></header>
    <div class="rolagem">
      <table>
        <thead><tr><th>Loja</th><th class="n">Notas</th><th class="n">Valor bruto</th><th class="n">ISS</th><th class="n">PIS</th><th class="n">COFINS</th><th class="n">Líquido</th></tr></thead>
        <tbody>${d.servicos.lojas.map((l) => `<tr><td><span class="marca-canal">${esc(l.loja)}</span></td><td class="n">${l.notas}</td><td class="n">${num(l.bruto)}</td><td class="n">${num(l.iss)}</td><td class="n">${num(l.pis)}</td><td class="n">${num(l.cofins)}</td><td class="n"><strong>${num(l.liquido)}</strong></td></tr>`).join('') || '<tr><td colspan="7" class="vazio">Nenhum serviço importado.</td></tr>'}</tbody>
        <tfoot><tr><td>Total</td><td class="n">${s.notas}</td><td class="n">${num(s.bruto)}</td><td class="n">${num(s.iss)}</td><td class="n">${num(s.pis)}</td><td class="n">${num(s.cofins)}</td><td class="n">${num(s.liquido)}</td></tr></tfoot>
      </table>
    </div>
  </section>`;
}

function detalheCanal(canal, d) {
  const linhas = d.base.filter((l) => l.canal === canal && l.valida && l.origem !== 'servico');
  const porCfop = new Map();
  const porProduto = new Map();
  for (const l of linhas) {
    const a = porCfop.get(l.cfop) ?? { cfop: l.cfop, linhas: 0, valor: 0 };
    a.linhas += 1;
    a.valor += l.valorTotal - l.troca;
    porCfop.set(l.cfop, a);
    if (l.origem === 'saida' && l.valorTotal > 0) {
      const p = porProduto.get(l.produto) ?? { produto: l.produto, descricao: l.descricao, qtd: 0, valor: 0 };
      p.qtd += l.qtdVendas;
      p.valor += l.valorTotal;
      porProduto.set(l.produto, p);
    }
  }
  const top = [...porProduto.values()].sort((a, b) => b.valor - a.valor).slice(0, 5);
  return `
    <tr class="detalhe-canal"><td colspan="9">
      <div class="detalhe-grade">
        <div>
          <h3>CFOPs no canal</h3>
          <table><tbody>${[...porCfop.values()].sort((a, b) => b.valor - a.valor).map((x) => `<tr><td class="mono">${esc(x.cfop)}</td><td class="mudo">${x.linhas} lanç.</td><td class="n">${contabil(x.valor)}</td></tr>`).join('')}</tbody></table>
        </div>
        <div>
          <h3>Produtos que mais venderam</h3>
          <table><tbody>${top.map((x) => `<tr><td class="mono">${esc(x.produto)}</td><td class="descricao">${esc(x.descricao)}</td><td class="mudo">${fmtInt.format(x.qtd)} un.</td><td class="n">${num(x.valor)}</td></tr>`).join('') || '<tr><td class="mudo">Sem vendas no canal.</td></tr>'}</tbody></table>
        </div>
      </div>
      <p style="margin:12px 0 0"><button class="btn-link" type="button" data-acao="filtrar-canal" data-canal="${esc(canal)}">Abrir os ${linhas.length} lançamentos do canal na base analítica</button></p>
    </td></tr>`;
}

// ---------------------------------------------------------------------------
// Tela: Livro de saída
// ---------------------------------------------------------------------------

function filtrarSaidas(d) {
  const termo = normalizar(estado.busca.saida);
  const canalPorId = new Map(d.base.map((b) => [b.id, b.canal]));
  return d.dados.saidas.filter((l) => {
    const canal = canalPorId.get(l.id);
    if (estado.filtro.canal && canal !== estado.filtro.canal) return false;
    if (estado.filtro.cfop && String(l.cfop) !== estado.filtro.cfop) return false;
    if (estado.filtro.trocas && !l.troca) return false;
    if (termo && !normalizar([l.nota, l.produto, l.descricao, l.empresa, l.serie, l.cfop, l.chave].join(' ')).includes(termo)) return false;
    return true;
  });
}

function paginacao(chave, total) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const atual = Math.min(estado.pagina[chave], paginas - 1);
  estado.pagina[chave] = atual;
  return {
    inicio: atual * POR_PAGINA,
    html: `<div class="paginas">
      <button class="btn" type="button" data-acao="pagina" data-chave="${chave}" data-ir="${atual - 1}" ${atual === 0 ? 'disabled' : ''}>Anterior</button>
      <span class="mono">${atual + 1} / ${paginas}</span>
      <button class="btn" type="button" data-acao="pagina" data-chave="${chave}" data-ir="${atual + 1}" ${atual >= paginas - 1 ? 'disabled' : ''}>Próxima</button>
    </div>`,
  };
}

function telaSaida(d) {
  const lista = filtrarSaidas(d);
  const canais = [...new Set(d.base.filter((b) => b.origem === 'saida').map((b) => b.canal))].sort();
  const cfops = [...new Set(d.dados.saidas.map((l) => String(l.cfop)))].sort();
  const pag = paginacao('saida', lista.length);
  const soma = lista.reduce((s, l) => s + valorVenda(l), 0);
  const canalDe = new Map(d.base.map((b) => [b.id, b]));

  return `
  <div class="cabecalho-pagina">
    <div><h1>Livro de saída</h1><p>Itens de nota fiscal de venda. Clique numa linha para ver por que ela caiu naquele canal e para corrigir valores.</p></div>
  </div>
  <section class="folha">
    <div class="filtros">
      <input type="search" placeholder="Nota, produto, chave, série..." value="${esc(estado.busca.saida)}" data-campo="busca-saida" aria-label="Buscar no livro de saída">
      <select data-campo="filtro-canal" aria-label="Canal"><option value="">Todos os canais</option>${canais.map((c) => `<option ${estado.filtro.canal === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select data-campo="filtro-cfop" aria-label="CFOP"><option value="">Todos os CFOPs</option>${cfops.map((c) => `<option ${estado.filtro.cfop === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <label class="check"><input type="checkbox" data-campo="filtro-trocas" ${estado.filtro.trocas ? 'checked' : ''}> Só trocas</label>
      <div class="direita"><button class="btn" type="button" data-acao="exportar-saida">Exportar</button></div>
    </div>
    <div class="rolagem">
      <table class="tabela-densa">
        <thead><tr><th>Emissão</th><th>Nota</th><th>Série</th><th>Empresa</th><th>CFOP</th><th>Produto</th><th class="n">Qtd</th><th class="n">Vlr produto</th><th class="n">Desconto</th><th class="n">ICMS</th><th class="n">PIS</th><th class="n">COFINS</th><th class="n">DIFAL</th><th>Canal</th></tr></thead>
        <tbody>
          ${lista.slice(pag.inicio, pag.inicio + POR_PAGINA).map((l) => {
            const b = canalDe.get(l.id);
            return `<tr class="clicavel" data-acao="abrir-ficha" data-id="${esc(l.id)}">
              <td class="mono">${data(l.emissao)}</td><td class="mono">${esc(l.nota)}</td><td class="mono">${esc(l.serie)}</td><td>${esc(l.empresa)}</td>
              <td class="mono">${esc(l.cfop)} ${b && !b.valida ? '<span class="etiqueta fora">fora</span>' : ''}</td>
              <td class="descricao"><span class="mono">${esc(l.produto)}</span> ${esc(l.descricao)} ${l.troca ? '<span class="etiqueta troca">troca</span>' : ''}</td>
              <td class="n">${fmtInt.format(l.qtd)}</td><td class="n">${num(l.vlrProduto)}</td><td class="n">${l.desconto ? contabil(-l.desconto) : '-'}</td>
              <td class="n">${num(l.icms)}</td><td class="n">${num(l.pis)}</td><td class="n">${num(l.cofins)}</td><td class="n">${l.difal ? num(l.difal) : '-'}</td>
              <td><span class="marca-canal ${b?.canal === 'OUTROS' ? 'pega-tudo' : ''}">${esc(b?.canal ?? '')}</span></td>
            </tr>`;
          }).join('') || '<tr><td colspan="14" class="vazio">Nenhum lançamento com esses filtros.</td></tr>'}
        </tbody>
      </table>
    </div>
    <div class="rodape-tabela"><span>${fmtInt.format(lista.length)} lançamento(s) · <span class="soma-linha">${reais(soma)}</span> em valor de venda</span>${pag.html}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tela: Devoluções (agrupadas por nota)
// ---------------------------------------------------------------------------

function telaDevolucoes(d) {
  const grupos = agruparDevolucoes(d.dados.entradas);
  const validos = new Set(estado.cfg.cfopsDevolucao);
  const total = grupos.filter((g) => validos.has(String(g.cfop))).reduce((s, g) => s + g.troca, 0);
  return `
  <div class="cabecalho-pagina">
    <div><h1>Devoluções</h1><p>Vêm do livro de entrada e são agrupadas por nota fiscal. Na apuração entram como troca do canal de origem, nunca como venda negativa.</p></div>
    <button class="btn" type="button" data-acao="exportar-devolucoes">Exportar</button>
  </div>
  <section class="folha">
    <div class="nf-lista">
      ${grupos.map((g) => `
        <details class="nf">
          <summary>
            <span class="mono">NF ${esc(g.nota)}</span>
            <span>${esc(g.empresa)} <span class="mudo some-mobile">· série ${esc(g.serie)}</span></span>
            <span class="mono some-mobile">CFOP ${esc(g.cfop)} ${validos.has(String(g.cfop)) ? '' : '<span class="etiqueta fora">fora</span>'}</span>
            <span class="mono mudo some-mobile">${data(g.emissao)}</span>
            <span class="mudo some-mobile">${g.itens.length} ${g.itens.length > 1 ? 'itens' : 'item'}</span>
            <span class="n mono" style="text-align:right">${contabil(-g.troca)}</span>
          </summary>
          <div class="itens rolagem">
            <table class="tabela-densa">
              <thead><tr><th>Produto</th><th class="n">Qtd</th><th class="n">Vlr produto</th><th class="n">ICMS</th><th class="n">PIS</th><th class="n">COFINS</th><th>Venda de origem</th><th></th></tr></thead>
              <tbody>${g.itens.map((i) => `<tr>
                <td class="descricao"><span class="mono">${esc(i.produto)}</span> ${esc(i.descricao)}</td><td class="n">${fmtInt.format(i.qtd)}</td><td class="n">${num(i.vlrProduto)}</td>
                <td class="n">${num(i.icms)}</td><td class="n">${num(i.pis)}</td><td class="n">${num(i.cofins)}</td>
                <td class="mono">${i.notaOrigem ? `NF ${esc(i.notaOrigem)}` : '<span class="etiqueta troca">não localizada</span>'}</td>
                <td><button class="btn-link" type="button" data-acao="abrir-ficha" data-id="${esc(i.id)}">Abrir</button></td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </details>`).join('') || '<p class="vazio">Nenhuma devolução. Importe o livro de entrada.</p>'}
    </div>
    <div class="rodape-tabela"><span>${grupos.length} nota(s) de devolução</span><span class="soma-linha">Trocas na apuração: ${reais(total)}</span></div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tela: Serviços
// ---------------------------------------------------------------------------

function telaServicos(d) {
  const termo = normalizar(estado.busca.servicos);
  const lista = d.dados.servicos.filter((s) => !termo || normalizar([s.nota, s.cliente, s.servico, s.codigo, s.loja].join(' ')).includes(termo));
  const lojas = [...new Set(lista.map((s) => s.loja))].sort();
  return `
  <div class="cabecalho-pagina">
    <div><h1>Serviços</h1><p>Notas fiscais de serviço por loja. A loja é escolhida na importação, porque o arquivo da prefeitura não diz de qual unidade veio.</p></div>
    <button class="btn" type="button" data-acao="exportar-servicos">Exportar</button>
  </div>
  <section class="folha">
    <div class="filtros"><input type="search" placeholder="Tomador, nota, serviço..." value="${esc(estado.busca.servicos)}" data-campo="busca-servicos" aria-label="Buscar serviços"></div>
    <div class="rolagem">
      <table class="tabela-densa">
        <thead><tr><th>Emissão</th><th>Nota</th><th>Tomador</th><th>CPF/CNPJ</th><th>Item</th><th>Serviço</th><th class="n">Valor</th><th class="n">Alíq. ISS</th><th class="n">ISS</th><th class="n">PIS</th><th class="n">COFINS</th></tr></thead>
        ${lojas.map((loja) => {
          const itens = lista.filter((s) => s.loja === loja).sort((a, b) => String(a.emissao).localeCompare(String(b.emissao)));
          const soma = (k) => itens.reduce((x, s) => x + (Number(s[k]) || 0), 0);
          return `<tbody>
            <tr><th colspan="11" style="position:static;background:var(--folha);color:var(--tinta);font-size:12px">Loja ${esc(loja)} · ${itens.length} notas</th></tr>
            ${itens.map((s) => `<tr>
              <td class="mono">${data(s.emissao)}</td><td class="mono">${esc(s.nota)}</td><td>${esc(s.cliente)}</td><td class="mono">${esc(s.documento)}</td>
              <td class="mono">${esc(s.codigo)}</td><td class="descricao">${esc(s.servico)}</td><td class="n">${num(s.valor)}</td>
              <td class="n">${num(s.aliqIss)}%</td><td class="n">${num(s.iss)}</td><td class="n">${num(s.pis)}</td><td class="n">${num(s.cofins)}</td>
            </tr>`).join('')}
            <tr><td colspan="6" style="font-weight:600">Subtotal ${esc(loja)}</td><td class="n"><strong>${num(soma('valor'))}</strong></td><td></td><td class="n">${num(soma('iss'))}</td><td class="n">${num(soma('pis'))}</td><td class="n">${num(soma('cofins'))}</td></tr>
          </tbody>`;
        }).join('') || '<tbody><tr><td colspan="11" class="vazio">Nenhum serviço.</td></tr></tbody>'}
      </table>
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tela: Base analítica
// ---------------------------------------------------------------------------

function filtroBase(d) {
  const f = estado.filtroConf;
  const termo = normalizar(estado.busca.base);
  return d.base.filter((l) => {
    if (f?.tipo === 'cfop-invalido' && (l.valida || l.origem === 'servico')) return false;
    if (f?.tipo === 'pega-tudo' && (l.canal !== f.canal || !l.valida)) return false;
    if (f?.tipo === 'ids' && !f.ids.includes(l.id)) return false;
    if (f?.tipo === 'canal' && l.canal !== f.canal) return false;
    if (estado.filtro.origem && l.origem !== estado.filtro.origem) return false;
    if (termo && !normalizar([l.nota, l.produto, l.descricao, l.empresa, l.cfop, l.canal, l.chave].join(' ')).includes(termo)) return false;
    return true;
  });
}

const COLUNAS_BASE = [
  { campo: 'emissao', rotulo: 'Emissão' }, { campo: 'origem', rotulo: 'Origem' }, { campo: 'empresa', rotulo: 'Empresa' },
  { campo: 'serie', rotulo: 'Série' }, { campo: 'nota', rotulo: 'Nota' }, { campo: 'chave', rotulo: 'Chave NF-e' },
  { campo: 'cfop', rotulo: 'CFOP' }, { campo: 'produto', rotulo: 'Produto' }, { campo: 'descricao', rotulo: 'Descrição' },
  { campo: 'qtd', rotulo: 'Qtd' }, { campo: 'vlrProduto', rotulo: 'Vlr produto' }, { campo: 'desconto', rotulo: 'Desconto' },
  { campo: 'icms', rotulo: 'ICMS' }, { campo: 'ipi', rotulo: 'IPI' }, { campo: 'pis', rotulo: 'PIS' }, { campo: 'cofins', rotulo: 'COFINS' },
  { campo: 'difal', rotulo: 'DIFAL' }, { campo: 'liquidoNF', rotulo: 'Líquido NF' }, { campo: 'valorTotal', rotulo: 'Valor total' },
  { campo: 'troca', rotulo: 'Troca' }, { campo: 'qtdVendas', rotulo: 'Qtde vendas' }, { campo: 'qtdTrocas', rotulo: 'Qtde trocas' },
  { campo: 'canal', rotulo: 'Canal' },
  { campo: 'situacao', rotulo: 'Situação', valor: (l) => (l.cancelada ? 'Cancelada' : l.valida ? 'Válida' : 'CFOP fora') },
];
const NUMERICAS = new Set(['qtd', 'vlrProduto', 'desconto', 'icms', 'ipi', 'pis', 'cofins', 'difal', 'liquidoNF', 'valorTotal', 'troca', 'qtdVendas', 'qtdTrocas']);
const ORIGEM = { saida: 'Saída', entrada: 'Devolução', servico: 'Serviço' };

function descricaoFiltroConf() {
  const f = estado.filtroConf;
  if (!f) return '';
  if (f.tipo === 'canal') return `Canal ${f.canal}`;
  const c = derivar().checks.find((x) => x.filtro && JSON.stringify(x.filtro) === JSON.stringify(f));
  return c ? c.titulo : 'Seleção da conferência';
}

function telaBase(d) {
  const lista = filtroBase(d);
  const pag = paginacao('base', lista.length);
  const soma = (k) => lista.reduce((s, l) => s + (Number(l[k]) || 0), 0);
  return `
  <div class="cabecalho-pagina">
    <div><h1>Base analítica</h1><p>Uma linha por item de nota, com as colunas calculadas da planilha original (Líquido NF, Valor total, Troca, Qtde). É a base que fecha com a apuração.</p></div>
  </div>
  <section class="folha">
    ${estado.filtroConf ? `<div class="faixa-filtro"><span>Mostrando: <strong>${esc(descricaoFiltroConf())}</strong></span><button class="btn-link" type="button" data-acao="limpar-filtro-conf">Ver tudo</button></div>` : ''}
    <div class="filtros">
      <input type="search" placeholder="Buscar nota, produto, canal, chave..." value="${esc(estado.busca.base)}" data-campo="busca-base" aria-label="Buscar na base">
      <select data-campo="filtro-origem" aria-label="Origem">
        <option value="">Saídas, devoluções e serviços</option>
        ${Object.entries(ORIGEM).map(([k, v]) => `<option value="${k}" ${estado.filtro.origem === k ? 'selected' : ''}>Só ${v.toLowerCase()}${k === 'entrada' ? 'ões' : 's'}</option>`).join('')}
      </select>
      <div class="direita"><button class="btn" type="button" data-acao="exportar-base">Exportar ${fmtInt.format(lista.length)} linhas</button></div>
    </div>
    <div class="rolagem" style="max-height:62vh">
      <table class="tabela-densa">
        <thead><tr>${COLUNAS_BASE.map((c) => `<th class="${NUMERICAS.has(c.campo) ? 'n' : ''}">${c.rotulo}</th>`).join('')}</tr></thead>
        <tbody>
          ${lista.slice(pag.inicio, pag.inicio + POR_PAGINA).map((l) => `<tr class="${l.origem !== 'servico' ? 'clicavel' : ''}" ${l.origem !== 'servico' ? `data-acao="abrir-ficha" data-id="${esc(l.id)}"` : ''}>
            ${COLUNAS_BASE.map((c) => {
              if (c.campo === 'origem') return `<td>${ORIGEM[l.origem]}</td>`;
              if (c.campo === 'situacao') return `<td>${l.cancelada ? '<span class="etiqueta cancelada">cancelada</span>' : l.valida ? 'Válida' : '<span class="etiqueta fora">CFOP fora</span>'}</td>`;
              if (c.campo === 'canal') return `<td><span class="marca-canal">${esc(l.canal)}</span></td>`;
              if (c.campo === 'emissao') return `<td class="mono">${data(l.emissao)}</td>`;
              if (c.campo === 'descricao') return `<td class="descricao">${esc(l.descricao)}</td>`;
              if (['qtd', 'qtdVendas', 'qtdTrocas'].includes(c.campo)) return `<td class="n">${fmtInt.format(l[c.campo])}</td>`;
              if (NUMERICAS.has(c.campo)) return `<td class="n">${l[c.campo] ? num(l[c.campo]) : '-'}</td>`;
              return `<td class="${['nota', 'serie', 'cfop', 'produto', 'chave'].includes(c.campo) ? 'mono' : ''}">${esc(l[c.campo])}</td>`;
            }).join('')}
          </tr>`).join('') || `<tr><td colspan="${COLUNAS_BASE.length}" class="vazio">Nada encontrado.</td></tr>`}
        </tbody>
      </table>
    </div>
    <div class="rodape-tabela">
      <span>${fmtInt.format(lista.length)} linhas · valor total <span class="soma-linha">${num(soma('valorTotal'))}</span> · trocas <span class="soma-linha">${num(soma('troca'))}</span></span>
      ${pag.html}
    </div>
  </section>
  <section class="folha secao">
    <header><div><h2>Notas canceladas</h2><p>Cole chaves de acesso ou números de nota (um por linha). Elas ficam marcadas na base e na exportação.</p></div></header>
    <div style="padding:0 22px 18px"><textarea data-campo="canceladas" placeholder="35261041256780000110550010000182451234567890" aria-label="Notas canceladas">${esc(estado.canceladas)}</textarea></div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tela: Importações
// ---------------------------------------------------------------------------

function telaLotes() {
  const LIVRO = { saida: 'Livro de saída', entrada: 'Livro de entrada', servicos: 'Serviços' };
  const lotes = [...estado.dados.lotes].sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
  return `
  <div class="cabecalho-pagina">
    <div><h1>Importações</h1><p>Cada arquivo importado vira um lote, com o que foi lido, aproveitado e descartado. É o rastro para explicar um número depois.</p></div>
    <button class="btn btn-tinta" type="button" data-acao="abrir-importacao">Importar livro</button>
  </div>
  <section class="folha">
    <ol class="linha-tempo">
      ${lotes.map((l) => `
        <li class="lote">
          <time datetime="${esc(l.quando)}">${dataHora(l.quando)}</time>
          <span class="ponto ${l.status}" aria-hidden="true"></span>
          <div>
            <h3>${esc(l.arquivo)}</h3>
            <p class="numeros"><span>${LIVRO[l.livro] ?? esc(l.livro)}</span><span>${l.lidas} lidas</span><span>${l.validas} aproveitadas</span><span>${l.descartadas} descartadas</span>
              <span>${l.status === 'ok' ? 'Sem ressalvas' : l.status === 'aviso' ? 'Com avisos' : 'Recusado'}</span></p>
            ${l.avisos?.length ? `<ul>${l.avisos.slice(0, 8).map((a) => `<li>${esc(a)}</li>`).join('')}${l.avisos.length > 8 ? `<li>e mais ${l.avisos.length - 8}.</li>` : ''}</ul>` : ''}
          </div>
        </li>`).join('') || '<li class="vazio">Nenhuma importação ainda.</li>'}
    </ol>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tela: Regras
// ---------------------------------------------------------------------------

function telaRegras() {
  const cfg = estado.cfg;
  const regras = [...cfg.regras].sort((a, b) => a.prioridade - b.prioridade);
  const sim = estado.simulador;
  const resultado = regraAplicada(sim, regras);

  const chips = (lista, campo) => `
    <div class="fichas">${lista.map((v) => `<span class="ficha-cfop">${esc(v)}<button type="button" aria-label="Remover ${esc(v)}" data-acao="remover-item" data-lista="${campo}" data-valor="${esc(v)}">×</button></span>`).join('') || '<span class="mudo">Lista vazia.</span>'}</div>
    <form class="linha-adicionar" data-form="adicionar" data-lista="${campo}">
      <input type="text" name="valor" placeholder="${campo === 'rodape' ? 'texto' : 'ex.: 5102'}" aria-label="Novo item">
      <button class="btn" type="submit">Adicionar</button>
    </form>`;

  return `
  <div class="cabecalho-pagina">
    <div><h1>Regras</h1><p>Como cada lançamento ganha um canal. As regras são lidas de cima para baixo e a primeira que bater decide. A última, sem condição nenhuma, pega o que sobrar.</p></div>
  </div>
  <div class="grade-regras">
    <section class="folha">
      <header style="padding:18px 22px 10px"><h2>Regras de canal</h2><p>Condição vazia vale para qualquer valor. CFOPs separados por vírgula.</p></header>
      <ol class="regras">
        ${regras.map((r, i) => `
          <li class="regra ${resultado.regra?.id === r.id ? 'destaque' : ''}" data-regra="${esc(r.id)}">
            <span class="ordem">${String(i + 1).padStart(2, '0')}</span>
            <div class="frase">
              <span>Se a empresa contém</span><input type="text" value="${esc(r.empresa)}" data-regra-campo="empresa" placeholder="qualquer" aria-label="Empresa contém">
              <span>e a série contém</span><input type="text" value="${esc(r.serie)}" data-regra-campo="serie" placeholder="qualquer" aria-label="Série contém">
              <span>e o CFOP é</span><input type="text" class="cfops" value="${esc(r.cfops)}" data-regra-campo="cfops" placeholder="qualquer" aria-label="CFOPs">
              <span class="seta">→</span><input type="text" class="canal" value="${esc(r.canal)}" data-regra-campo="canal" aria-label="Canal">
            </div>
            <div class="acoes">
              <button class="btn" type="button" data-acao="mover-regra" data-dir="-1" aria-label="Subir regra" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn" type="button" data-acao="mover-regra" data-dir="1" aria-label="Descer regra" title="Descer" ${i === regras.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="btn btn-perigo" type="button" data-acao="remover-regra" aria-label="Remover regra" title="Remover">×</button>
            </div>
          </li>`).join('')}
      </ol>
      <div class="rodape-folha"><button class="btn" type="button" data-acao="nova-regra">Nova regra</button></div>
    </section>

    <div class="lateral">
      <section class="folha">
        <div class="bloco">
          <h3>Simulador</h3>
          <p>Digite um lançamento e veja qual regra pega. A regra vencedora fica marcada na lista.</p>
          <form class="simulador" data-form="simulador">
            <label>Empresa<input type="text" name="empresa" value="${esc(sim.empresa)}"></label>
            <label>Série<input type="text" name="serie" value="${esc(sim.serie)}"></label>
            <label>CFOP<input type="text" name="cfop" value="${esc(sim.cfop)}" inputmode="numeric"></label>
          </form>
          <div class="veredito" aria-live="polite">
            <strong>${esc(resultado.regra?.canal ?? 'Sem canal')}</strong>
            <span>${resultado.regra ? `Regra ${String(regras.indexOf(resultado.regra) + 1).padStart(2, '0')}: ${esc(resultado.motivo)}.` : esc(resultado.motivo)}</span>
          </div>
        </div>
      </section>
      <section class="folha">
        <div class="bloco"><h3>CFOPs de venda</h3><p>Saídas com outros CFOPs (remessa, bonificação) ficam fora da apuração.</p>${chips(cfg.cfopsSaida, 'cfopsSaida')}</div>
        <div class="bloco"><h3>CFOPs de devolução</h3><p>Entradas com estes CFOPs viram troca.</p>${chips(cfg.cfopsDevolucao, 'cfopsDevolucao')}</div>
        <div class="bloco">
          <h3>Faixa de ICMS efetivo</h3><p>Lançamento fora da faixa aparece na conferência.</p>
          <form class="linha-adicionar" data-form="faixa"><input type="number" name="min" value="${cfg.faixaIcms.min}" min="0" max="100" step="0.5" aria-label="Mínimo"> <span style="align-self:center">a</span> <input type="number" name="max" value="${cfg.faixaIcms.max}" min="0" max="100" step="0.5" aria-label="Máximo"><button class="btn" type="submit">Aplicar</button></form>
        </div>
      </section>
      <section class="folha">
        <div class="bloco">
          <h3>Nomes de empresa no arquivo</h3><p>O sistema fiscal exporta a razão social; aqui ela vira o nome curto usado nas regras.</p>
          <table class="pares"><thead><tr><th>Como vem no arquivo</th><th>Nome interno</th><th></th></tr></thead><tbody>
            ${cfg.aliases.map((a, i) => `<tr><td><input type="text" value="${esc(a.arquivo)}" data-par="aliases" data-i="${i}" data-k="arquivo" aria-label="Nome no arquivo"></td><td><input type="text" value="${esc(a.interno)}" data-par="aliases" data-i="${i}" data-k="interno" aria-label="Nome interno"></td><td><button class="btn btn-perigo btn-icone" type="button" data-acao="remover-par" data-par="aliases" data-i="${i}" aria-label="Remover">×</button></td></tr>`).join('')}
          </tbody></table>
          <button class="btn-link" type="button" data-acao="novo-par" data-par="aliases">Adicionar nome</button>
        </div>
        <div class="bloco">
          <h3>Empresa e loja</h3><p>Liga a empresa à loja das notas de serviço, para o filtro de empresa valer também em serviços.</p>
          <table class="pares"><thead><tr><th>Empresa</th><th>Loja</th><th></th></tr></thead><tbody>
            ${cfg.lojas.map((a, i) => `<tr><td><input type="text" value="${esc(a.empresa)}" data-par="lojas" data-i="${i}" data-k="empresa" aria-label="Empresa"></td><td><input type="text" value="${esc(a.loja)}" data-par="lojas" data-i="${i}" data-k="loja" aria-label="Loja"></td><td><button class="btn btn-perigo btn-icone" type="button" data-acao="remover-par" data-par="lojas" data-i="${i}" aria-label="Remover">×</button></td></tr>`).join('')}
          </tbody></table>
          <button class="btn-link" type="button" data-acao="novo-par" data-par="lojas">Adicionar loja</button>
        </div>
        <div class="bloco"><h3>Linhas de rodapé ignoradas</h3><p>Linha da planilha que contém um destes textos é descartada na importação.</p>${chips(cfg.rodape, 'rodape')}</div>
      </section>
      <section class="folha">
        <div class="bloco">
          <h3>Dados da demonstração</h3><p>Apaga o que foi importado e editado neste navegador e volta para os dados fictícios do início.</p>
          <button class="btn btn-perigo" type="button" data-acao="restaurar-demo">Restaurar demonstração</button>
        </div>
      </section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Ficha do lançamento (gaveta lateral)
// ---------------------------------------------------------------------------

const gaveta = document.getElementById('gaveta');
const veu = document.getElementById('veu');

function acharLancamento(id) {
  const s = estado.dados.saidas.find((l) => l.id === id);
  if (s) return { lanc: s, livro: 'saidas' };
  const e = estado.dados.entradas.find((l) => l.id === id);
  return e ? { lanc: e, livro: 'entradas' } : null;
}

function abrirFicha(id) {
  const achado = acharLancamento(id);
  if (!achado) return;
  estado.ficha = id;
  const { lanc, livro } = achado;
  const { regra, motivo } = regraAplicada(lanc, estado.cfg.regras);
  const ordenadas = [...estado.cfg.regras].sort((a, b) => a.prioridade - b.prioridade);
  const validos = livro === 'saidas' ? estado.cfg.cfopsSaida : estado.cfg.cfopsDevolucao;
  const aliq = Math.round(aliquotaIcms(lanc) * 1000) / 10;
  const campo = (rotulo, k, tipo = 'text', largo = false) =>
    `<label class="${largo ? 'largo' : ''}">${rotulo}<input type="${tipo}" ${tipo === 'number' ? 'step="0.01"' : ''} name="${k}" value="${esc(lanc[k] ?? '')}"></label>`;

  gaveta.innerHTML = `
    <header>
      <div>
        <p class="sobrescrito">${livro === 'saidas' ? 'Venda' : 'Devolução'} · NF ${esc(lanc.nota)} · série ${esc(lanc.serie)}</p>
        <h2 id="gaveta-titulo">${esc(lanc.descricao || lanc.produto)}</h2>
      </div>
      <button class="btn btn-icone" type="button" data-acao="fechar-ficha" aria-label="Fechar">×</button>
    </header>
    <form class="corpo" data-form="ficha" id="form-ficha">
      <div class="porque">
        <span class="canal">${esc(regra?.canal ?? 'Sem canal')}</span>
        <p>Regra ${regra ? String(ordenadas.indexOf(regra) + 1).padStart(2, '0') : '-'}: ${esc(motivo)}.</p>
        ${validos.includes(String(lanc.cfop)) ? '' : `<p><span class="etiqueta fora">CFOP ${esc(lanc.cfop)} fora da lista</span> Este lançamento não entra na apuração.</p>`}
        ${lanc.icms > 0 ? `<p>ICMS efetivo de <strong class="mono">${num(aliq)}%</strong> sobre o valor do produto${aliq < estado.cfg.faixaIcms.min || aliq > estado.cfg.faixaIcms.max ? ', <strong>fora da faixa esperada</strong>' : ''}.</p>` : ''}
      </div>
      <div class="campos">
        <p class="grupo">Identificação</p>
        ${campo('Empresa', 'empresa')}${campo('Série', 'serie')}${campo('Nota', 'nota')}${campo('Emissão', 'emissao')}
        ${campo('CFOP', 'cfop')}${campo('Produto', 'produto')}${campo('Descrição', 'descricao', 'text', true)}
        <label class="largo">Chave NF-e<input type="text" name="chave" value="${esc(lanc.chave)}" class="mono" readonly></label>
        <p class="grupo">Valores</p>
        ${campo('Quantidade', 'qtd', 'number')}${campo('Valor do produto', 'vlrProduto', 'number')}${campo('Desconto', 'desconto', 'number')}
        ${campo('ICMS', 'icms', 'number')}${campo('IPI', 'ipi', 'number')}${campo('PIS', 'pis', 'number')}${campo('COFINS', 'cofins', 'number')}${campo('DIFAL', 'difal', 'number')}
        ${livro === 'saidas' ? `${campo('Desp. acessórias', 'despAces', 'number')}<label style="flex-direction:row;align-items:center;gap:8px;padding-top:18px"><input type="checkbox" name="troca" ${lanc.troca ? 'checked' : ''}> Lançamento de troca</label>` : ''}
      </div>
    </form>
    <footer>
      <button class="btn btn-perigo" type="button" data-acao="excluir-lancamento">Excluir lançamento</button>
      <span style="display:flex;gap:8px"><button class="btn" type="button" data-acao="fechar-ficha">Cancelar</button><button class="btn btn-tinta" type="submit" form="form-ficha">Salvar</button></span>
    </footer>`;
  gaveta.classList.add('aberta');
  gaveta.setAttribute('aria-hidden', 'false');
  veu.classList.add('aberto');
  gaveta.querySelector('input:not([readonly])')?.focus();
}

function fecharFicha() {
  estado.ficha = null;
  gaveta.classList.remove('aberta');
  gaveta.setAttribute('aria-hidden', 'true');
  veu.classList.remove('aberto');
}

function salvarFicha(form) {
  const achado = acharLancamento(estado.ficha);
  if (!achado) return;
  const dadosForm = new FormData(form);
  const numeros = ['qtd', 'vlrProduto', 'desconto', 'icms', 'ipi', 'pis', 'cofins', 'difal', 'despAces'];
  for (const [k, v] of dadosForm.entries()) {
    if (k === 'chave' || k === 'troca') continue;
    achado.lanc[k] = numeros.includes(k) ? Number(String(v).replace(',', '.')) || 0 : String(v).trim();
  }
  if (achado.livro === 'saidas') achado.lanc.troca = dadosForm.has('troca');
  salvar();
  fecharFicha();
  render();
  avisar('Lançamento atualizado. A apuração já considera a alteração.');
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

const dlg = document.getElementById('dlg-importar');

function abrirImportacao(livro = 'saida') {
  estado.importacao = { livro, loja: estado.cfg.lojas[0]?.loja ?? '', leitura: null, modo: 'somar' };
  desenharImportacao();
  dlg.showModal();
}

function desenharImportacao() {
  const imp = estado.importacao;
  const lojas = [...new Set([...estado.cfg.lojas.map((l) => l.loja), ...estado.dados.servicos.map((s) => s.loja)])].filter(Boolean);
  const LIVROS = [
    ['saida', 'Livro de saída', 'Itens das notas de venda'],
    ['entrada', 'Livro de entrada', 'De onde saem as devoluções'],
    ['servicos', 'Serviços', 'Notas de serviço (NFS-e)'],
  ];
  const l = imp.leitura;
  dlg.innerHTML = `
    <header>
      <div><p class="sobrescrito">Importar planilha</p><h2 id="dlg-titulo">${l ? 'Confira as colunas' : 'Qual livro é este arquivo?'}</h2></div>
      <button class="btn btn-icone" type="button" data-acao="fechar-importacao" aria-label="Fechar">×</button>
    </header>
    <div class="corpo">
      ${l ? mapaImportacao(l) : `
        <div class="escolha-livro" role="radiogroup">
          ${LIVROS.map(([v, t, s]) => `<label><input type="radio" name="livro" value="${v}" ${imp.livro === v ? 'checked' : ''} data-campo="imp-livro"><strong>${t}</strong><span>${s}</span></label>`).join('')}
        </div>
        ${imp.livro === 'servicos' ? `<label class="campo-topo" style="margin-bottom:14px;max-width:260px"><span>Loja das notas</span><select data-campo="imp-loja">${lojas.map((x) => `<option ${x === imp.loja ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>` : ''}
        <label class="soltar" id="area-soltar">
          <input type="file" accept=".xlsx,.xls,.csv,.ods" class="sr" data-campo="imp-arquivo">
          <div><strong>Solte a planilha aqui ou clique para escolher</strong><span>.xlsx, .xls, .ods ou .csv. O arquivo é lido no seu navegador e não sai dele.</span></div>
        </label>
        <p class="mudo" style="font-size:13px;margin:12px 0 0">Sem arquivo à mão? <button class="btn-link" type="button" data-acao="baixar-modelo">Baixe um modelo com dados fictícios</button>, mexa nele e importe de volta.</p>`}
    </div>
    <footer>
      ${l ? `<button class="btn" type="button" data-acao="voltar-importacao">Escolher outro arquivo</button>
        <button class="btn btn-tinta" type="button" data-acao="confirmar-importacao" ${l.cabecalho < 0 ? 'disabled' : ''}>Importar ${l.cabecalho >= 0 ? fmtInt.format(l.linhas.length - l.cabecalho - 1) : ''} linhas</button>`
        : '<span class="mudo" style="font-size:13px">Cada importação vira um lote no histórico.</span>'}
    </footer>`;
}

function mapaImportacao(l) {
  const imp = estado.importacao;
  if (l.cabecalho < 0) {
    return `<p class="resumo-leitura"><strong>Não achei o cabeçalho.</strong> Nenhuma das 40 primeiras linhas de "${esc(l.aba)}" tem nomes de coluna conhecidos (CFOP, Vlr Produto, ICMS...). Confira se escolheu o livro certo ou se a planilha é o relatório analítico.</p>`;
  }
  const cab = l.linhas[l.cabecalho];
  const exemplo = l.linhas[l.cabecalho + 1] ?? [];
  const faltam = CAMPOS[imp.livro].filter((f) => f.obrigatorio && l.mapa[f.campo] < 0);
  return `
    <p class="resumo-leitura">Aba <strong>${esc(l.aba)}</strong> · cabeçalho na linha <strong>${l.cabecalho + 1}</strong> · ${fmtInt.format(l.linhas.length - l.cabecalho - 1)} linhas abaixo dele.
      ${faltam.length ? `<br><strong class="negativo">Falta indicar: ${faltam.map((f) => f.rotulo).join(', ')}.</strong>` : ' Reconheci as colunas abaixo; ajuste o que estiver errado.'}</p>
    <div class="rolagem">
      <table class="mapa">
        <thead><tr><th>Campo do FiscalView</th><th>Coluna da planilha</th><th>Primeira linha</th></tr></thead>
        <tbody>${CAMPOS[imp.livro].map((f) => `
          <tr class="${f.obrigatorio && l.mapa[f.campo] < 0 ? 'falta' : ''}">
            <td>${f.rotulo}${f.obrigatorio ? ' *' : ''}</td>
            <td><select data-campo="imp-mapa" data-k="${f.campo}" aria-label="Coluna para ${f.rotulo}">
              <option value="-1">(não tem)</option>
              ${cab.map((nome, i) => `<option value="${i}" ${l.mapa[f.campo] === i ? 'selected' : ''}>${esc(String(nome) || `Coluna ${i + 1}`)}</option>`).join('')}
            </select></td>
            <td class="exemplo">${l.mapa[f.campo] >= 0 ? esc(exemplo[l.mapa[f.campo]] instanceof Date ? exemplo[l.mapa[f.campo]].toISOString().slice(0, 10) : exemplo[l.mapa[f.campo]]) : ''}</td>
          </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="modo">
      <label><input type="radio" name="modo" value="somar" ${imp.modo === 'somar' ? 'checked' : ''} data-campo="imp-modo"> Somar ao que já existe</label>
      <label><input type="radio" name="modo" value="substituir" ${imp.modo === 'substituir' ? 'checked' : ''} data-campo="imp-modo"> Substituir o ${imp.livro === 'servicos' ? 'livro de serviços desta loja' : 'livro inteiro'}</label>
    </div>`;
}

async function lerParaImportar(arquivo) {
  if (!arquivo) return;
  const imp = estado.importacao;
  try {
    avisar('Lendo a planilha...');
    const { aba, linhas } = await lerArquivo(arquivo);
    const cabecalho = detectarCabecalho(linhas, imp.livro);
    imp.leitura = { arquivo: arquivo.name, aba, linhas, cabecalho, mapa: cabecalho >= 0 ? sugerirMapa(linhas[cabecalho], imp.livro) : {} };
    desenharImportacao();
  } catch (erro) {
    avisar(erro.message || 'Não consegui ler esse arquivo.');
  }
}

function confirmarImportacao() {
  const imp = estado.importacao;
  const l = imp.leitura;
  const faltam = CAMPOS[imp.livro].filter((f) => f.obrigatorio && l.mapa[f.campo] < 0);
  if (faltam.length) {
    avisar(`Indique a coluna de ${faltam.map((f) => f.rotulo).join(' e ')}.`);
    return;
  }
  const { registros, descartes } = montarRegistros({ linhas: l.linhas, cabecalho: l.cabecalho, mapa: l.mapa, livro: imp.livro, cfg: estado.cfg, loja: imp.loja });
  const destino = imp.livro === 'saida' ? 'saidas' : imp.livro === 'entrada' ? 'entradas' : 'servicos';
  if (imp.modo === 'substituir') {
    estado.dados[destino] = imp.livro === 'servicos' ? estado.dados.servicos.filter((s) => s.loja !== imp.loja) : [];
  }
  estado.dados[destino].push(...registros);

  const foraCfop = imp.livro === 'servicos' ? 0 : registros.filter((r) => !(imp.livro === 'saida' ? estado.cfg.cfopsSaida : estado.cfg.cfopsDevolucao).includes(r.cfop)).length;
  const avisos = [...descartes];
  if (foraCfop) avisos.unshift(`${foraCfop} lançamento(s) importado(s) com CFOP fora da lista: ficam visíveis, mas fora da apuração.`);
  estado.dados.lotes.push({
    id: `l${Date.now()}`, quando: new Date().toISOString(), arquivo: l.arquivo, livro: imp.livro,
    lidas: registros.length + descartes.length, validas: registros.length, descartadas: descartes.length,
    status: registros.length === 0 ? 'erro' : avisos.length ? 'aviso' : 'ok', avisos,
  });
  salvar();
  dlg.close();
  estado.importacao = null;
  render();
  avisar(`${fmtInt.format(registros.length)} linha(s) importada(s)${descartes.length ? `, ${descartes.length} descartada(s)` : ''}. Veja o lote em Importações.`);
}

function baixarModelo() {
  const livro = estado.importacao.livro;
  const demo = gerarDemo();
  if (livro === 'servicos') {
    exportar('modelo_servicos_fiscalview.xlsx', [{ nome: 'NFS-e', colunas: COLUNAS_EXPORT.servicos, linhas: demo.servicos.slice(0, 20) }]);
    return;
  }
  const linhas = livro === 'saida' ? demo.saidas.slice(0, 40) : demo.entradas;
  exportar(`modelo_livro_${livro}_fiscalview.xlsx`, [{ nome: livro === 'saida' ? 'Livro de saída' : 'Livro de entrada', colunas: COLUNAS_EXPORT.livro(livro), linhas }]);
}

// ---------------------------------------------------------------------------
// Exportações
// ---------------------------------------------------------------------------

const COLUNAS_EXPORT = {
  livro: (livro) => [
    { rotulo: 'Empresa', campo: 'empresa' }, { rotulo: 'Série', campo: 'serie' }, { rotulo: 'Nro. Docto', campo: 'nota' },
    { rotulo: 'Dt Emissão', campo: 'emissao' }, { rotulo: 'Chave NFe', campo: 'chave' }, { rotulo: 'CFOP', campo: 'cfop' },
    { rotulo: 'Cod Produto', campo: 'produto' }, { rotulo: 'Descrição', campo: 'descricao' }, { rotulo: 'Quantidade', campo: 'qtd' },
    { rotulo: 'Vlr Produto', campo: 'vlrProduto' }, { rotulo: 'Vlr Desconto', campo: 'desconto' }, { rotulo: 'Vlr ICMS', campo: 'icms' },
    { rotulo: 'Vlr IPI', campo: 'ipi' }, { rotulo: 'Vlr PIS', campo: 'pis' }, { rotulo: 'Vlr COFINS', campo: 'cofins' },
    { rotulo: 'DIFAL', campo: 'difal' },
    ...(livro === 'saida' ? [{ rotulo: 'Desp Aces', campo: 'despAces' }, { rotulo: 'Troca', valor: (l) => (l.troca ? 'S' : 'N') }] : []),
  ],
  servicos: [
    { rotulo: 'Numero NFS-e', campo: 'nota' }, { rotulo: 'Emissão', campo: 'emissao' }, { rotulo: 'Tomador', campo: 'cliente' },
    { rotulo: 'CPF/CNPJ', campo: 'documento' }, { rotulo: 'Item lista', campo: 'codigo' }, { rotulo: 'Discriminação', campo: 'servico' },
    { rotulo: 'Valor contábil', campo: 'valor' }, { rotulo: 'Aliquota ISS', campo: 'aliqIss' }, { rotulo: 'Valor ISS', campo: 'iss' },
    { rotulo: 'Valor PIS', campo: 'pis' }, { rotulo: 'Valor COFINS', campo: 'cofins' }, { rotulo: 'Loja', campo: 'loja' },
  ],
};

function nomeArquivo(base) {
  return `${base}_${COMPETENCIA.replace('-', '')}${estado.empresa ? `_${normalizar(estado.empresa).replace(/\s+/g, '-')}` : ''}.xlsx`;
}

async function exportarAcao(tipo) {
  const d = derivar();
  try {
    if (tipo === 'saida') {
      const canalPorId = new Map(d.base.map((b) => [b.id, b.canal]));
      await exportar(nomeArquivo('livro_saida'), [{ nome: 'Livro de saída', colunas: [...COLUNAS_EXPORT.livro('saida'), { rotulo: 'Canal', valor: (l) => canalPorId.get(l.id) }], linhas: filtrarSaidas(d) }]);
    }
    if (tipo === 'devolucoes') await exportar(nomeArquivo('devolucoes'), [{ nome: 'Devoluções', colunas: [...COLUNAS_EXPORT.livro('entrada'), { rotulo: 'NF origem', campo: 'notaOrigem' }], linhas: d.dados.entradas }]);
    if (tipo === 'servicos') await exportar(nomeArquivo('servicos'), [{ nome: 'Serviços', colunas: COLUNAS_EXPORT.servicos, linhas: d.dados.servicos }]);
    if (tipo === 'base') await exportar(nomeArquivo('base_analitica'), [{ nome: 'Base analítica', colunas: COLUNAS_BASE.map((c) => ({ ...c, valor: c.valor ?? (c.campo === 'origem' ? (l) => ORIGEM[l.origem] : undefined) })), linhas: filtroBase(d) }]);
    if (tipo === 'canais') {
      const col = [
        { rotulo: 'Canal', campo: 'canal' }, { rotulo: 'Vendas', campo: 'total' }, { rotulo: 'Trocas', campo: 'trocas' }, { rotulo: 'Descontos', campo: 'descontos' },
        { rotulo: 'Receita líquida', campo: 'liquido' }, ...TRIBUTOS.map((k) => ({ rotulo: NOME_TRIBUTO[k], campo: k })),
        { rotulo: 'Vendas líquidas', campo: 'vendasLiquidas' }, { rotulo: 'Carga tributária', valor: (l) => Math.round(l.carga * 10000) / 100 },
        { rotulo: 'Qtd vendas', campo: 'qtdVendas' }, { rotulo: 'Qtd trocas', campo: 'qtdTrocas' },
      ];
      await exportar(nomeArquivo('apuracao_por_canal'), [
        { nome: 'Por canal', colunas: col, linhas: [...d.consolidado.canais, d.consolidado.total] },
        { nome: 'Serviços por loja', colunas: [{ rotulo: 'Loja', campo: 'loja' }, { rotulo: 'Notas', campo: 'notas' }, { rotulo: 'Bruto', campo: 'bruto' }, { rotulo: 'ISS', campo: 'iss' }, { rotulo: 'PIS', campo: 'pis' }, { rotulo: 'COFINS', campo: 'cofins' }, { rotulo: 'Líquido', campo: 'liquido' }], linhas: d.servicos.lojas },
      ]);
    }
  } catch (erro) {
    avisar(erro.message || 'Não foi possível gerar a planilha.');
  }
}

// ---------------------------------------------------------------------------
// Render e eventos
// ---------------------------------------------------------------------------

const conteudo = document.getElementById('conteudo');
const TELAS = { apuracao: telaApuracao, saida: telaSaida, devolucoes: telaDevolucoes, servicos: telaServicos, base: telaBase, lotes: telaLotes, regras: telaRegras };

function render({ manterFoco = false } = {}) {
  const ativo = document.activeElement;
  const focoCampo = manterFoco && ativo?.dataset?.campo ? { campo: ativo.dataset.campo, pos: ativo.selectionStart } : null;
  const d = derivar();

  document.getElementById('competencia').textContent = competenciaPorExtenso();
  const empresas = [...new Set([...estado.dados.saidas, ...estado.dados.entradas].map((l) => l.empresa))].sort();
  document.getElementById('filtro-empresa').innerHTML = `<option value="">Todas as empresas</option>${empresas.map((e) => `<option ${e === estado.empresa ? 'selected' : ''}>${esc(e)}</option>`).join('')}`;
  document.getElementById('abas').innerHTML = ROTAS.map((r) => `<a href="#${r.id}" ${estado.rota === r.id ? 'aria-current="page"' : ''}>${r.nome}${r.conta ? `<sup>${fmtInt.format(r.conta(d))}</sup>` : ''}</a>`).join('');
  conteudo.innerHTML = TELAS[estado.rota](d);
  conteudo.querySelectorAll('tr.clicavel').forEach((tr) => tr.setAttribute('tabindex', '0'));
  document.title = `${ROTAS.find((r) => r.id === estado.rota).nome} | FiscalView`;

  if (focoCampo) {
    const el = conteudo.querySelector(`[data-campo="${focoCampo.campo}"]`);
    if (el) {
      el.focus();
      try { el.setSelectionRange(focoCampo.pos, focoCampo.pos); } catch { /* campo sem seleção */ }
    }
  }
}

let temporizadorAviso;
function avisar(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.classList.add('visivel');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.classList.remove('visivel'), 4200);
}

function regraDoEvento(alvo) {
  const id = alvo.closest('[data-regra]')?.dataset.regra;
  return estado.cfg.regras.find((r) => r.id === id);
}

const ACOES = {
  'abrir-importacao': () => abrirImportacao(estado.rota === 'servicos' ? 'servicos' : estado.rota === 'devolucoes' ? 'entrada' : 'saida'),
  'fechar-importacao': () => { dlg.close(); estado.importacao = null; },
  'voltar-importacao': () => { estado.importacao.leitura = null; desenharImportacao(); },
  'confirmar-importacao': confirmarImportacao,
  'baixar-modelo': baixarModelo,
  'abrir-ficha': (el) => abrirFicha(el.dataset.id),
  'fechar-ficha': fecharFicha,
  'excluir-lancamento': () => {
    const achado = acharLancamento(estado.ficha);
    if (!achado || !confirm('Excluir este lançamento? Ele sai da apuração e da base.')) return;
    estado.dados[achado.livro] = estado.dados[achado.livro].filter((l) => l.id !== estado.ficha);
    salvar(); fecharFicha(); render(); avisar('Lançamento excluído.');
  },
  'abrir-canal': (el) => { estado.canalAberto = estado.canalAberto === el.dataset.canal ? null : el.dataset.canal; render(); },
  'filtrar-canal': (el) => { estado.filtroConf = { tipo: 'canal', canal: el.dataset.canal }; estado.pagina.base = 0; location.hash = 'base'; },
  'ver-conferencia': (el) => {
    const c = derivar().checks.find((x) => x.id === el.dataset.id);
    estado.filtroConf = c?.filtro ?? null;
    estado.filtro.origem = '';
    estado.busca.base = '';
    estado.pagina.base = 0;
    location.hash = 'base';
  },
  'limpar-filtro-conf': () => { estado.filtroConf = null; render(); },
  pagina: (el) => { estado.pagina[el.dataset.chave] = Math.max(0, Number(el.dataset.ir)); render(); conteudo.scrollIntoView({ block: 'start' }); },
  'exportar-saida': () => exportarAcao('saida'),
  'exportar-devolucoes': () => exportarAcao('devolucoes'),
  'exportar-servicos': () => exportarAcao('servicos'),
  'exportar-base': () => exportarAcao('base'),
  'exportar-canais': () => exportarAcao('canais'),
  'mover-regra': (el) => {
    const lista = [...estado.cfg.regras].sort((a, b) => a.prioridade - b.prioridade);
    const i = lista.indexOf(regraDoEvento(el));
    const j = i + Number(el.dataset.dir);
    if (i < 0 || j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    lista.forEach((r, k) => { r.prioridade = k + 1; });
    estado.cfg.regras = lista;
    salvar(); render();
  },
  'remover-regra': (el) => {
    const r = regraDoEvento(el);
    estado.cfg.regras = estado.cfg.regras.filter((x) => x !== r);
    salvar(); render(); avisar(`Regra "${r?.canal}" removida.`);
  },
  'nova-regra': () => {
    const lista = [...estado.cfg.regras].sort((a, b) => a.prioridade - b.prioridade);
    const ultima = lista[lista.length - 1];
    const pegaTudo = ultima && !ultima.empresa && !ultima.serie && !ultima.cfops;
    const nova = { id: `r${Date.now()}`, prioridade: 0, empresa: '', serie: '', cfops: '', canal: 'NOVO CANAL' };
    if (pegaTudo) lista.splice(lista.length - 1, 0, nova); else lista.push(nova);
    lista.forEach((r, k) => { r.prioridade = k + 1; });
    estado.cfg.regras = lista;
    salvar(); render();
    conteudo.querySelector(`[data-regra="${nova.id}"] input`)?.focus();
  },
  'remover-item': (el) => {
    const lista = el.dataset.lista;
    estado.cfg[lista] = estado.cfg[lista].filter((v) => v !== el.dataset.valor);
    salvar(); render();
  },
  'novo-par': (el) => {
    estado.cfg[el.dataset.par].push(el.dataset.par === 'aliases' ? { arquivo: '', interno: '' } : { empresa: '', loja: '' });
    salvar(); render();
  },
  'remover-par': (el) => {
    estado.cfg[el.dataset.par].splice(Number(el.dataset.i), 1);
    salvar(); render();
  },
  'restaurar-demo': () => {
    if (!confirm('Voltar para os dados fictícios do início? O que foi importado e editado neste navegador será apagado.')) return;
    restaurarDemo();
    estado.empresa = '';
    estado.filtroConf = null;
    render();
    avisar('Demonstração restaurada.');
  },
};

document.addEventListener('click', (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo || alvo.disabled) return;
  const acao = ACOES[alvo.dataset.acao];
  if (!acao) return;
  ev.preventDefault();
  acao(alvo);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && estado.ficha) fecharFicha();
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('tr.clicavel')) {
    ev.preventDefault();
    ev.target.click();
  }
});

veu.addEventListener('click', fecharFicha);

let atrasoBusca;
document.addEventListener('input', (ev) => {
  const el = ev.target;
  const campo = el.dataset.campo;
  if (campo?.startsWith('busca-')) {
    const chave = campo.replace('busca-', '');
    estado.busca[chave] = el.value;
    if (chave in estado.pagina) estado.pagina[chave] = 0;
    clearTimeout(atrasoBusca);
    atrasoBusca = setTimeout(() => render({ manterFoco: true }), 160);
    return;
  }
  if (campo === 'canceladas') {
    estado.canceladas = el.value;
    salvar();
    clearTimeout(atrasoBusca);
    atrasoBusca = setTimeout(() => render({ manterFoco: true }), 400);
    return;
  }
  if (el.dataset.regraCampo) {
    const r = regraDoEvento(el);
    if (r) r[el.dataset.regraCampo] = el.dataset.regraCampo === 'canal' ? el.value.toUpperCase() : el.value;
    salvar();
    return;
  }
  if (el.dataset.par) {
    estado.cfg[el.dataset.par][Number(el.dataset.i)][el.dataset.k] = el.value;
    salvar();
    return;
  }
  const formSim = el.closest('[data-form="simulador"]');
  if (formSim) {
    estado.simulador[el.name] = el.value;
    clearTimeout(atrasoBusca);
    atrasoBusca = setTimeout(() => {
      const pos = el.selectionStart;
      const nome = el.name;
      render();
      const novo = conteudo.querySelector(`[data-form="simulador"] [name="${nome}"]`);
      novo?.focus();
      try { novo?.setSelectionRange(pos, pos); } catch { /* ok */ }
    }, 180);
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  const campo = el.dataset.campo;
  if (el.id === 'filtro-empresa') { estado.empresa = el.value; estado.pagina.saida = 0; estado.pagina.base = 0; render(); return; }
  if (campo === 'filtro-canal') { estado.filtro.canal = el.value; estado.pagina.saida = 0; render(); return; }
  if (campo === 'filtro-cfop') { estado.filtro.cfop = el.value; estado.pagina.saida = 0; render(); return; }
  if (campo === 'filtro-trocas') { estado.filtro.trocas = el.checked; estado.pagina.saida = 0; render(); return; }
  if (campo === 'filtro-origem') { estado.filtro.origem = el.value; estado.pagina.base = 0; render(); return; }
  if (el.dataset.regraCampo) { render(); return; }
  if (campo === 'imp-livro') { estado.importacao.livro = el.value; desenharImportacao(); return; }
  if (campo === 'imp-loja') { estado.importacao.loja = el.value; return; }
  if (campo === 'imp-modo') { estado.importacao.modo = el.value; return; }
  if (campo === 'imp-arquivo') { lerParaImportar(el.files?.[0]); return; }
  if (campo === 'imp-mapa') { estado.importacao.leitura.mapa[el.dataset.k] = Number(el.value); desenharImportacao(); }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target;
  const tipo = form.dataset.form;
  if (!tipo) return;
  ev.preventDefault();
  if (tipo === 'ficha') { salvarFicha(form); return; }
  if (tipo === 'adicionar') {
    const lista = form.dataset.lista;
    const valor = String(new FormData(form).get('valor') || '').trim();
    const itens = lista === 'rodape' ? [valor.toLowerCase()] : listaCfop(valor);
    const novos = itens.filter((v) => v && !estado.cfg[lista].includes(v));
    if (!novos.length) return;
    estado.cfg[lista] = [...estado.cfg[lista], ...novos].sort();
    salvar(); render();
    conteudo.querySelector(`[data-form="adicionar"][data-lista="${lista}"] input`)?.focus();
    return;
  }
  if (tipo === 'faixa') {
    const f = new FormData(form);
    const min = Number(f.get('min'));
    const max = Number(f.get('max'));
    if (!(min >= 0 && max > min)) { avisar('A faixa precisa ter mínimo menor que o máximo.'); return; }
    estado.cfg.faixaIcms = { min, max };
    salvar(); render(); avisar('Faixa de ICMS atualizada. A conferência já usa os novos limites.');
  }
});

// Soltar arquivo na área de importação.
dlg.addEventListener('dragover', (ev) => {
  const area = ev.target.closest('#area-soltar');
  if (!area) return;
  ev.preventDefault();
  area.classList.add('sobre');
});
dlg.addEventListener('dragleave', (ev) => ev.target.closest('#area-soltar')?.classList.remove('sobre'));
dlg.addEventListener('drop', (ev) => {
  const area = ev.target.closest('#area-soltar');
  if (!area) return;
  ev.preventDefault();
  area.classList.remove('sobre');
  lerParaImportar(ev.dataTransfer.files?.[0]);
});

document.getElementById('alternar-tema').addEventListener('click', () => {
  const escuro = document.documentElement.dataset.tema !== 'escuro';
  if (escuro) document.documentElement.dataset.tema = 'escuro';
  else delete document.documentElement.dataset.tema;
  try { localStorage.setItem('fiscalview:tema', escuro ? 'escuro' : 'claro'); } catch { /* ok */ }
});

window.addEventListener('hashchange', () => {
  lerRota();
  fecharFicha();
  render();
  window.scrollTo({ top: 0 });
});

carregar();
lerRota();
render();
