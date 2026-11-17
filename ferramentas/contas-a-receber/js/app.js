// Contas a Receber: monta o borderô de títulos, importa a planilha de receita,
// valida cadastro e gera o arquivo de importação do ERP. Estado único, telas
// como funções que devolvem HTML e eventos por delegação (data-acao).

import {
  EMISSORA, EMISSORA_CNPJ, dadosIniciais, receitaExemplo, cnpjValido, formatarCnpj,
  somenteDigitos, hojeIso, somarDias,
} from './dados.js';

const CHAVE = 'receber:v2';
const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const estado = {
  dados: null,
  rota: 'bordero',
  editando: null,
  form: null,
  importacao: null,
  edDest: null,
  edConta: null,
  busca: '',
};

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (salvo?.destinatarios && salvo?.contas) {
      estado.dados = salvo;
      return;
    }
  } catch { /* sem armazenamento: segue com a demo */ }
  estado.dados = dadosIniciais();
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado.dados)); } catch { /* ok */ }
}

function formVazio() {
  const hoje = hojeIso();
  return { destinatario: '', conta: '', projeto: '', especificacao: '', observacao: '', emissao: hoje, vencimento: somarDias(hoje, estado.dados.padraoVencimento), valor: '', parcelas: 1 };
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const fmtMoeda = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moeda = (v) => fmtMoeda.format(Number(v) || 0);
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const dataBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const diaDaSemana = (iso) => new Date(`${iso}T12:00:00`).getDay();

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function normalizar(t) {
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "1.234,56", "R$ 1234,5", 1234.56 viram número. */
function numero(v) {
  if (typeof v === 'number') return v;
  let t = String(v ?? '').trim().replace(/[^\d,.-]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

const icone = {
  editar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  copiar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  remover: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
};

// ---------------------------------------------------------------------------
// Regras de negócio
// ---------------------------------------------------------------------------

const destinatario = (id) => estado.dados.destinatarios.find((d) => d.id === id);
const conta = (id) => estado.dados.contas.find((c) => c.id === id);
/** Conta do título: a escolhida no título ou, na falta, a padrão do destinatário. */
const contaDoTitulo = (t) => conta(t.conta) ?? conta(destinatario(t.destinatario)?.conta);

/**
 * Confere um título. Erro impede emitir; aviso só chama atenção.
 */
function conferirTitulo(t, todos) {
  const erros = [];
  const avisos = [];
  const d = destinatario(t.destinatario);
  if (!d) erros.push('Sem destinatário');
  if (d && !d.exterior && !cnpjValido(d.cnpj)) erros.push(d.cnpj ? 'CNPJ do destinatário inválido' : 'Destinatário sem CNPJ');
  if (!contaDoTitulo(t)) erros.push('Sem conta contábil');
  if (!(Number(t.valor) > 0)) erros.push('Valor zerado');
  if (t.vencimento < t.emissao) erros.push('Vence antes da emissão');
  else if (t.vencimento < hojeIso()) avisos.push('Vencimento já passou');
  const dia = diaDaSemana(t.vencimento);
  if (dia === 0 || dia === 6) avisos.push(`Vence num ${SEMANA[dia]}`);
  const gemeo = todos.find((o) => o !== t && o.destinatario === t.destinatario && Number(o.valor) === Number(t.valor) && o.projeto === t.projeto && o.parcela === t.parcela);
  if (gemeo) avisos.push('Mesmo cliente, projeto e valor repetidos no borderô');
  // Mensalidade repete valor todo mês; duplicidade é o mesmo título com
  // vencimento próximo de um que já foi emitido.
  const perto = (a, b) => Math.abs(new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) <= 15 * 864e5;
  const jaEmitido = estado.dados.arquivo.find((b) => b.titulos.some((o) => t.projeto && o.destinatario === t.destinatario && Number(o.valor) === Number(t.valor) && o.projeto === t.projeto && perto(o.vencimento, t.vencimento)));
  if (jaEmitido) avisos.push(`Parece já emitido no borderô ${String(jaEmitido.numero).padStart(3, '0')}`);
  return { erros, avisos };
}

/** Divide um valor em parcelas mensais; a última absorve os centavos. */
function parcelar(base, parcelas) {
  const total = Math.round(numero(base.valor) * 100);
  const n = Math.max(1, Math.min(24, Number(parcelas) || 1));
  const cada = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => {
    const venc = new Date(`${base.vencimento}T12:00:00`);
    venc.setMonth(venc.getMonth() + i);
    const iso = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, '0')}-${String(venc.getDate()).padStart(2, '0')}`;
    return {
      ...base,
      id: `t${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 5)}`,
      valor: (i === n - 1 ? total - cada * (n - 1) : cada) / 100,
      vencimento: iso,
      parcela: n > 1 ? i + 1 : 1,
      totalParcelas: n,
    };
  });
}

/** Retrato do título com os dados de cadastro do momento da emissão. */
function retrato(t) {
  const d = destinatario(t.destinatario);
  const c = contaDoTitulo(t);
  return { ...t, razao: d?.razao ?? '', cnpj: d?.cnpj ?? '', codigo: d?.codigo ?? '', centro: d?.centro ?? '', contaCodigo: c?.codigo ?? '', contaDescricao: c?.descricao ?? '' };
}

function linhasErp(titulos) {
  return titulos.map((t) => ({
    CD_FILIAL: EMISSORA.filial,
    CD_CONTRAPARTE: t.codigo,
    NM_RAZAO: t.razao,
    CNPJ: somenteDigitos(t.cnpj),
    CD_CONTA_CONTABIL: t.contaCodigo,
    CD_CENTRO_CUSTO: t.centro,
    CD_NOTA_FISCAL: '',
    NUM_PARCELA: t.parcela || 1,
    DT_EMISSAO: dataBr(t.emissao),
    DT_VENCIMENTO: dataBr(t.vencimento),
    VL_TOTAL: Number(t.valor),
    DS_DESCRICAO: [t.especificacao, t.projeto && `Projeto ${t.projeto}`, t.observacao].filter(Boolean).join(' | ').slice(0, 240),
    CD_COBRANCA: 'BOLETO',
  }));
}

// ---------------------------------------------------------------------------
// Planilhas
// ---------------------------------------------------------------------------

let carregandoXlsx = null;
function sheetjs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  carregandoXlsx ??= new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = SHEETJS;
    s.onload = () => ok(window.XLSX);
    s.onerror = () => { carregandoXlsx = null; falha(new Error('Não consegui carregar o leitor de planilhas. Verifique a conexão.')); };
    document.head.appendChild(s);
  });
  return carregandoXlsx;
}

async function baixarErp(numero, titulos) {
  const X = await sheetjs();
  const wb = X.utils.book_new();
  const ws = X.utils.json_to_sheet(linhasErp(titulos));
  ws['!cols'] = [6, 14, 38, 16, 18, 14, 14, 12, 12, 14, 14, 48, 12].map((wch) => ({ wch }));
  X.utils.book_append_sheet(wb, ws, 'Tabela');
  X.writeFile(wb, `contas_receber_bordero_${String(numero).padStart(3, '0')}.xlsx`);
}

async function baixarExemploReceita() {
  const X = await sheetjs();
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(receitaExemplo()), 'Revenue');
  X.writeFile(wb, 'receita_exemplo.xlsx');
}

const COLUNAS_RECEITA = {
  cliente: ['CLIENT', 'CLIENTE', 'CUSTOMER'],
  projeto: ['PROJECT NO', 'PROJECT', 'PROJETO', 'PROJECT ID'],
  especificacao: ['SPECIFICATION', 'ESPECIFICACAO', 'DESCRICAO', 'DESCRIPTION'],
  valor: ['INV AMOUNT', 'VALOR NF', 'AMOUNT', 'VALOR'],
  observacao: ['OBSERVACAO', 'OBS', 'NOTES'],
};

/** Procura a melhor chave do cadastro para o nome de cliente da planilha. */
function casarCliente(nome) {
  const n = normalizar(nome);
  if (!n) return null;
  for (const d of estado.dados.destinatarios) {
    if (d.chaves.some((k) => normalizar(k) === n)) return d.id;
  }
  for (const d of estado.dados.destinatarios) {
    if (d.chaves.some((k) => n.includes(normalizar(k)) || normalizar(k).includes(n))) return d.id;
    if (normalizar(d.razao).includes(n)) return d.id;
  }
  return null;
}

async function lerReceita(arquivo) {
  try {
    const X = await sheetjs();
    const wb = X.read(await arquivo.arrayBuffer(), { type: 'array' });
    const linhas = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false });
    const indiceCab = linhas.slice(0, 30).findIndex((l) => {
      const nomes = l.map(normalizar);
      return nomes.some((x) => COLUNAS_RECEITA.cliente.includes(x)) && nomes.some((x) => COLUNAS_RECEITA.valor.some((k) => x.includes(k)));
    });
    if (indiceCab < 0) {
      avisar('Não achei as colunas de cliente e valor (Client / Inv. Amount). Confira a planilha.');
      return;
    }
    const cab = linhas[indiceCab].map(normalizar);
    const col = {};
    for (const [campo, nomes] of Object.entries(COLUNAS_RECEITA)) {
      col[campo] = cab.findIndex((x) => nomes.includes(x));
      if (col[campo] < 0) col[campo] = cab.findIndex((x) => nomes.some((k) => x.includes(k)));
    }
    const itens = linhas.slice(indiceCab + 1).map((l, i) => {
      const cliente = String(l[col.cliente] ?? '').trim();
      const valor = numero(l[col.valor]);
      let motivo = '';
      if (!cliente) motivo = 'linha sem cliente';
      else if (/^total/i.test(normalizar(cliente))) motivo = 'linha de total';
      else if (!(valor > 0)) motivo = 'valor zerado';
      const dest = motivo ? null : casarCliente(cliente);
      return {
        linha: indiceCab + i + 2, cliente, valor, motivo,
        projeto: col.projeto >= 0 ? String(l[col.projeto] ?? '').trim() : '',
        especificacao: col.especificacao >= 0 ? String(l[col.especificacao] ?? '').trim() : '',
        observacao: col.observacao >= 0 ? String(l[col.observacao] ?? '').trim() : '',
        destinatario: dest ?? '', automatico: Boolean(dest), lembrar: true,
      };
    }).filter((x) => x.cliente || x.valor);
    estado.importacao = { arquivo: arquivo.name, itens, emissao: hojeIso(), regra: 'dias', dias: estado.dados.padraoVencimento, dataFixa: somarDias(hojeIso(), estado.dados.padraoVencimento) };
    render();
  } catch (e) {
    avisar(e.message || 'Não consegui ler esse arquivo.');
  }
}

// ---------------------------------------------------------------------------
// Telas
// ---------------------------------------------------------------------------

const ROTAS = [
  { id: 'bordero', nome: 'Borderô', conta: () => estado.dados.rascunho.length },
  { id: 'importar', nome: 'Importar receita' },
  { id: 'destinatarios', nome: 'Destinatários', conta: () => estado.dados.destinatarios.length },
  { id: 'contas', nome: 'Contas contábeis', conta: () => estado.dados.contas.length },
  { id: 'arquivo', nome: 'Arquivo', conta: () => estado.dados.arquivo.length },
];

function opcoesDestinatario(selecionado, vazio = 'Escolha o destinatário') {
  return `<option value="">${vazio}</option>${[...estado.dados.destinatarios].sort((a, b) => a.razao.localeCompare(b.razao)).map((d) => `<option value="${d.id}" ${d.id === selecionado ? 'selected' : ''}>${esc(d.codigo)} · ${esc(d.razao)}</option>`).join('')}`;
}

function telaBordero() {
  const f = estado.form;
  const d = destinatario(f.destinatario);
  const padrao = conta(d?.conta);
  const lista = [...estado.dados.rascunho].sort((a, b) => a.vencimento.localeCompare(b.vencimento) || a.id.localeCompare(b.id));
  const total = lista.reduce((s, t) => s + Number(t.valor || 0), 0);
  const conferencias = new Map(lista.map((t) => [t.id, conferirTitulo(t, lista)]));
  const comErro = lista.filter((t) => conferencias.get(t.id).erros.length).length;
  const numero = String(estado.dados.proximoNumero).padStart(3, '0');
  const vencs = lista.map((t) => t.vencimento);
  const primeiro = vencs[0];
  const ultimo = vencs[vencs.length - 1];

  return `
  <div class="grade-bordero">
    <aside class="boleta" aria-labelledby="titulo-boleta">
      <h2 id="titulo-boleta">${estado.editando ? 'Editar título' : 'Novo título'} <small>${estado.editando ? '' : `vai para o nº ${numero}`}</small></h2>
      <form data-form="titulo" novalidate>
        <label class="campo"><span>Destinatário</span>
          <select name="destinatario" required>${opcoesDestinatario(f.destinatario)}</select>
        </label>
        ${d ? `<div class="ficha-destinatario">
          <b>${esc(d.razao)}</b><br>
          ${d.exterior ? 'Cliente no exterior, sem CNPJ' : `<span class="mono">${esc(d.cnpj || 'sem CNPJ')}</span> ${cnpjValido(d.cnpj) ? '<span class="selo ok">CNPJ válido</span>' : '<span class="selo erro">CNPJ inválido</span>'}`}<br>
          Conta padrão: ${padrao ? `<span class="mono">${esc(padrao.codigo)}</span>` : '<b style="color:var(--erro)">não definida</b>'} · centro ${esc(d.centro || '-')}
        </div>` : ''}
        <label class="campo"><span>Conta contábil</span>
          <select name="conta">
            <option value="">${padrao ? `Padrão do destinatário (${esc(padrao.codigo)})` : 'Escolha a conta'}</option>
            ${estado.dados.contas.map((c) => `<option value="${c.id}" ${c.id === f.conta ? 'selected' : ''}>${esc(c.codigo)} · ${esc(c.descricao)}</option>`).join('')}
          </select>
        </label>
        <div class="grade-campos">
          <label class="campo"><span>Projeto</span><input type="text" name="projeto" value="${esc(f.projeto)}" placeholder="PJ-2026-000"></label>
          <label class="campo"><span>Parcelas</span><input type="number" name="parcelas" min="1" max="24" value="${esc(f.parcelas)}" ${estado.editando ? 'disabled' : ''}></label>
          <label class="campo largo"><span>Especificação</span><input type="text" name="especificacao" value="${esc(f.especificacao)}" placeholder="O que está sendo cobrado"></label>
          <label class="campo"><span>Emissão</span><input type="date" name="emissao" value="${esc(f.emissao)}"></label>
          <label class="campo"><span>Vencimento</span><input type="date" name="vencimento" value="${esc(f.vencimento)}" class="${f.vencimento < f.emissao ? 'invalido' : ''}"></label>
        </div>
        <div class="atalhos-venc" aria-label="Atalhos de vencimento">
          ${[10, 15, 20, 30, 45].map((n) => `<button type="button" data-acao="atalho-venc" data-dias="${n}">+${n} dias</button>`).join('')}
          <button type="button" data-acao="atalho-venc" data-dia10="1">dia 10 do mês seguinte</button>
        </div>
        <label class="campo valor-grande"><span>Valor ${Number(f.parcelas) > 1 && !estado.editando ? `total (${f.parcelas} parcelas mensais)` : ''}</span><input type="text" name="valor" inputmode="decimal" value="${esc(f.valor)}" placeholder="0,00"></label>
        <label class="campo"><span>Observação</span><textarea name="observacao" placeholder="Opcional, vai para a descrição no ERP">${esc(f.observacao)}</textarea></label>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          ${estado.editando ? '<button class="btn" type="button" data-acao="cancelar-edicao">Cancelar</button>' : ''}
          <button class="btn btn-azul" type="submit">${estado.editando ? 'Salvar título' : 'Pôr no borderô'}</button>
        </div>
      </form>
    </aside>

    <section aria-labelledby="titulo-bordero">
      <div class="cabeca-bordero">
        <div>
          <span class="rotulo">Rascunho</span>
          <h2 id="titulo-bordero">Borderô nº ${numero}</h2>
        </div>
        <span class="numero">${lista.length} título${lista.length === 1 ? '' : 's'}${primeiro ? ` · vencimentos de ${dataBr(primeiro).slice(0, 5)} a ${dataBr(ultimo).slice(0, 5)}` : ''}</span>
      </div>
      ${lista.length ? calendario(lista) : ''}
      ${lista.length ? `<ol class="titulos">${lista.map((t) => cartaoTitulo(t, conferencias.get(t.id))).join('')}</ol>` : '<p class="vazio">Borderô vazio. Preencha um título ao lado ou <a href="#importar">importe a planilha de receita</a>.</p>'}
      <div class="rodape-bordero">
        <div><div class="total">R$ ${moeda(total)}</div><div class="resumo">${comErro ? `${comErro} título${comErro > 1 ? 's' : ''} com erro impede${comErro > 1 ? 'm' : ''} a emissão` : lista.length ? 'Tudo certo para emitir' : 'Nada para emitir ainda'}</div></div>
        <div class="direita">
          <button class="btn" type="button" data-acao="imprimir-rascunho" ${lista.length ? '' : 'disabled'}>Imprimir</button>
          <button class="btn" type="button" data-acao="limpar-rascunho" ${lista.length ? '' : 'disabled'}>Limpar</button>
          <button class="btn btn-emitir" type="button" data-acao="emitir" ${lista.length ? '' : 'disabled'}>Emitir borderô</button>
        </div>
      </div>
    </section>
  </div>`;
}

function calendario(lista) {
  const hoje = hojeIso();
  const inicio = [hoje, ...lista.map((t) => t.vencimento)].sort()[0];
  const fimMin = somarDias(inicio, 34);
  const fim = [fimMin, ...lista.map((t) => t.vencimento)].sort().pop();
  const dias = [];
  for (let d = inicio; d <= fim && dias.length < 90; d = somarDias(d, 1)) dias.push(d);
  const porDia = new Map();
  for (const t of lista) porDia.set(t.vencimento, (porDia.get(t.vencimento) ?? 0) + Number(t.valor || 0));
  const maior = Math.max(...porDia.values(), 1);
  const concentrado = [...porDia.entries()].sort((a, b) => b[1] - a[1])[0];
  const total = lista.reduce((s, t) => s + Number(t.valor || 0), 0);
  return `
    <div class="calendario" aria-label="Vencimentos por dia">
      <div class="dias">
        ${dias.map((d) => {
          const v = porDia.get(d) ?? 0;
          const fds = [0, 6].includes(diaDaSemana(d));
          return `<div class="dia ${v ? 'tem' : ''} ${fds ? 'fds' : ''} ${d === hoje ? 'hoje' : ''}" title="${dataBr(d)}${v ? `: R$ ${moeda(v)}` : ''}"><b style="height:${v ? Math.max(8, (v / maior) * 100) : 4}%"></b></div>`;
        }).join('')}
      </div>
      <div class="meses">${dias.map((d) => `<span>${d.slice(8) === '01' || d === dias[0] ? MES[Number(d.slice(5, 7)) - 1] : ''}</span>`).join('')}</div>
      <div class="legenda-cal">
        <span><i style="background:var(--azul)"></i>vence em dia útil</span>
        <span><i style="background:var(--ambar)"></i>vence no fim de semana</span>
        <span><i style="background:var(--carimbo);width:2px"></i>hoje</span>
        ${concentrado ? `<span>Maior concentração: <b class="mono">${dataBr(concentrado[0])}</b>, ${Math.round((concentrado[1] / total) * 100)}% do borderô</span>` : ''}
      </div>
    </div>`;
}

function cartaoTitulo(t, conf) {
  const d = destinatario(t.destinatario);
  const c = contaDoTitulo(t);
  const venc = t.vencimento;
  return `
    <li class="titulo ${conf.erros.length ? 'com-erro' : ''} ${estado.editando === t.id ? 'editando' : ''}">
      <div class="canhoto" aria-label="Vencimento ${dataBr(venc)}">
        <span class="dia-num">${venc.slice(8, 10)}</span>
        <span class="mes">${MES[Number(venc.slice(5, 7)) - 1]} ${venc.slice(2, 4)}</span>
        <span class="semana">${SEMANA[diaDaSemana(venc)].slice(0, 3)}</span>
      </div>
      <div class="corpo-titulo">
        <div class="quem">${esc(d?.razao ?? 'Destinatário removido')}</div>
        <div class="doc">${d ? `${esc(d.codigo)} · ${d.exterior ? 'exterior' : esc(d.cnpj || 'sem CNPJ')}` : ''}</div>
        <div class="linhas-info">
          <span><b>Conta</b><span class="mono">${esc(c?.codigo ?? '-')}</span></span>
          ${t.projeto ? `<span><b>Projeto</b>${esc(t.projeto)}</span>` : ''}
          ${t.totalParcelas > 1 ? `<span><b>Parcela</b>${t.parcela} de ${t.totalParcelas}</span>` : ''}
          <span><b>Emissão</b>${dataBr(t.emissao)}</span>
          ${t.especificacao ? `<span style="flex-basis:100%">${esc(t.especificacao)}</span>` : ''}
        </div>
        ${conf.erros.length || conf.avisos.length ? `<div class="alertas">${conf.erros.map((e) => `<span class="alerta erro">${esc(e)}</span>`).join('')}${conf.avisos.map((a) => `<span class="alerta aviso">${esc(a)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="lado-valor">
        <span class="origem">${t.origem === 'planilha' ? 'da planilha' : 'manual'}</span>
        <span class="valor">${moeda(t.valor)}</span>
        <span class="acoes">
          <button type="button" data-acao="editar-titulo" data-id="${t.id}" aria-label="Editar título" title="Editar">${icone.editar}</button>
          <button type="button" data-acao="duplicar-titulo" data-id="${t.id}" aria-label="Duplicar título" title="Duplicar">${icone.copiar}</button>
          <button type="button" class="remover" data-acao="remover-titulo" data-id="${t.id}" aria-label="Tirar do borderô" title="Tirar do borderô">${icone.remover}</button>
        </span>
      </div>
    </li>`;
}

function telaImportar() {
  const imp = estado.importacao;
  if (!imp) {
    return `
    <div class="titulo-tela"><div><h1>Importar receita</h1><p>A planilha de receita chega todo mês com o nome do cliente do jeito que o time lá fora escreve. O sistema casa cada nome com um destinatário cadastrado e vira título no borderô.</p></div></div>
    <label class="soltar" id="area-soltar">
      <input type="file" class="sr" accept=".xlsx,.xls,.csv,.ods" data-campo="arquivo-receita">
      <strong>Solte a planilha de receita aqui</strong>
      <span>Ou clique para escolher. Precisa ter as colunas Client e Inv. Amount (ou Cliente e Valor).</span>
    </label>
    <p class="mudo" style="margin-top:12px">Sem planilha? <button class="btn-link" type="button" data-acao="baixar-exemplo">Baixe a de exemplo</button>: tem um cliente novo e um valor zerado para você ver o que acontece.</p>
    <ol class="passos">
      <li>Lê a planilha no navegador, acha o cabeçalho mesmo com título e período em cima e ignora linha de total.</li>
      <li>Casa o nome do cliente com as chaves de cada destinatário. O que não casar fica amarelo para você escolher.</li>
      <li>Quando você escolhe, ele lembra a chave. No mês seguinte aquele nome já casa sozinho.</li>
    </ol>`;
  }
  const validos = imp.itens.filter((i) => !i.motivo);
  const prontos = validos.filter((i) => i.destinatario);
  const total = prontos.reduce((s, i) => s + i.valor, 0);
  return `
    <div class="titulo-tela"><div><h1>Importar receita</h1><p><span class="mono">${esc(imp.arquivo)}</span>: ${validos.length} linha(s) com valor, ${imp.itens.length - validos.length} ignorada(s).</p></div>
      <button class="btn" type="button" data-acao="descartar-importacao">Escolher outra planilha</button></div>
    <div class="barra-import">
      <label class="campo"><span>Emissão</span><input type="date" value="${imp.emissao}" data-campo="imp-emissao"></label>
      <label class="campo"><span>Vencimento</span><select data-campo="imp-regra"><option value="dias" ${imp.regra === 'dias' ? 'selected' : ''}>Dias após a emissão</option><option value="fixa" ${imp.regra === 'fixa' ? 'selected' : ''}>Mesma data para todos</option></select></label>
      ${imp.regra === 'dias'
        ? `<label class="campo" style="min-width:110px"><span>Dias</span><input type="number" min="0" max="180" value="${imp.dias}" data-campo="imp-dias"></label>`
        : `<label class="campo"><span>Data</span><input type="date" value="${imp.dataFixa}" data-campo="imp-data"></label>`}
      <div class="direita"><button class="btn btn-azul" type="button" data-acao="levar-importacao" ${prontos.length ? '' : 'disabled'}>Levar ${prontos.length} título${prontos.length === 1 ? '' : 's'} (R$ ${moeda(total)}) ao borderô</button></div>
    </div>
    <div class="rolagem">
      <table>
        <thead><tr><th>Linha</th><th>Cliente na planilha</th><th>Destinatário</th><th>Projeto</th><th>Especificação</th><th class="n">Valor</th><th>Situação</th></tr></thead>
        <tbody>${imp.itens.map((i, k) => `
          <tr class="${i.motivo ? 'ignorada' : !i.destinatario ? 'sem-par' : ''}">
            <td class="mono">${i.linha}</td>
            <td><b>${esc(i.cliente)}</b></td>
            <td>${i.motivo ? '-' : `<select data-campo="imp-dest" data-k="${k}" aria-label="Destinatário para ${esc(i.cliente)}">${opcoesDestinatario(i.destinatario, 'Escolha para casar')}</select>
              ${!i.automatico && i.destinatario ? `<label class="check" style="margin-top:4px"><input type="checkbox" data-campo="imp-lembrar" data-k="${k}" ${i.lembrar ? 'checked' : ''}> lembrar "${esc(i.cliente)}"</label>` : ''}`}</td>
            <td class="mono">${esc(i.projeto)}</td>
            <td class="quebra">${esc(i.especificacao)}${i.observacao ? `<br><span class="mudo">${esc(i.observacao)}</span>` : ''}</td>
            <td class="n">${moeda(i.valor)}</td>
            <td>${i.motivo ? `<span class="selo aviso">Ignorada: ${esc(i.motivo)}</span>` : i.destinatario ? `<span class="selo ok">${i.automatico ? 'Casou sozinho' : 'Casado à mão'}</span>` : '<span class="selo erro">Sem destinatário</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="mudo" style="font-size:13px">Cliente que não existe no cadastro? <a href="#destinatarios">Cadastre o destinatário</a> e volte: a planilha continua aqui.</p>`;
}

function telaDestinatarios() {
  const termo = normalizar(estado.busca);
  const lista = estado.dados.destinatarios
    .filter((d) => !termo || normalizar([d.codigo, d.razao, d.cnpj, ...d.chaves].join(' ')).includes(termo))
    .sort((a, b) => a.razao.localeCompare(b.razao));
  const ed = estado.edDest === 'novo' ? { id: 'novo', codigo: '', razao: '', cnpj: '', chaves: [], conta: '', centro: '', exterior: false } : destinatario(estado.edDest);
  const usos = (id) => estado.dados.arquivo.reduce((s, b) => s + b.titulos.filter((t) => t.destinatario === id).length, 0);
  return `
    <div class="titulo-tela"><div><h1>Destinatários</h1><p>Quem recebe a cobrança. As chaves são os nomes como aparecem na planilha de receita; é por elas que a importação casa os clientes.</p></div>
      <button class="btn btn-azul" type="button" data-acao="novo-destinatario">Novo destinatário</button></div>
    <div class="grade-cadastro">
      <div>
        <div class="filtro-lista"><input type="search" placeholder="Buscar por código, razão, CNPJ ou chave" value="${esc(estado.busca)}" data-campo="busca" aria-label="Buscar destinatário"></div>
        <div class="rolagem"><table>
          <thead><tr><th>Código</th><th>Razão social</th><th>CNPJ</th><th>Chaves da planilha</th><th>Conta padrão</th><th class="n">Emitidos</th><th></th></tr></thead>
          <tbody>${lista.map((d) => `
            <tr>
              <td class="mono">${esc(d.codigo)}</td>
              <td class="quebra"><b>${esc(d.razao)}</b></td>
              <td>${d.exterior ? '<span class="selo ok">Exterior</span>' : `<span class="mono">${esc(d.cnpj || '-')}</span><br>${cnpjValido(d.cnpj) ? '<span class="selo ok">válido</span>' : '<span class="selo erro">inválido</span>'}`}</td>
              <td><div class="chaves">${d.chaves.map((k) => `<span class="chave">${esc(k)}</span>`).join('')}</div></td>
              <td class="mono">${esc(conta(d.conta)?.codigo ?? '')}${conta(d.conta) ? '' : '<span class="selo erro">sem conta</span>'}</td>
              <td class="n">${usos(d.id)}</td>
              <td><button class="btn btn-mini" type="button" data-acao="editar-destinatario" data-id="${d.id}">Editar</button></td>
            </tr>`).join('') || '<tr><td colspan="7" class="mudo">Nenhum destinatário encontrado.</td></tr>'}
          </tbody>
        </table></div>
      </div>
      <aside class="painel-form">
        ${ed ? formDestinatario(ed) : '<h2>Cadastro</h2><p class="mudo">Escolha um destinatário para editar ou crie um novo. O CNPJ é conferido pelo dígito verificador enquanto você digita.</p>'}
      </aside>
    </div>`;
}

function formDestinatario(d) {
  const valido = cnpjValido(d.cnpj);
  return `
    <h2>${d.id === 'novo' ? 'Novo destinatário' : esc(d.razao)}</h2>
    <form data-form="destinatario" data-id="${d.id}">
      <div class="grade-campos">
        <label class="campo"><span>Código no ERP</span><input type="text" name="codigo" value="${esc(d.codigo)}" required></label>
        <label class="campo"><span>Centro de custo</span><input type="text" name="centro" value="${esc(d.centro)}"></label>
      </div>
      <label class="campo"><span>Razão social</span><input type="text" name="razao" value="${esc(d.razao)}" required></label>
      <label class="check"><input type="checkbox" name="exterior" ${d.exterior ? 'checked' : ''} data-campo="exterior"> Cliente no exterior (sem CNPJ)</label>
      <label class="campo"><span>CNPJ</span><input type="text" name="cnpj" value="${esc(d.cnpj)}" inputmode="numeric" data-campo="cnpj" class="${d.cnpj && !valido && !d.exterior ? 'invalido' : ''}" ${d.exterior ? 'disabled' : ''}>
        <small class="${d.exterior ? '' : valido ? 'bom' : d.cnpj ? 'ruim' : ''}" id="msg-cnpj">${d.exterior ? 'Não exigido para cliente no exterior.' : valido ? 'Dígitos verificadores conferem.' : d.cnpj ? 'Dígito verificador não confere.' : 'Só números ou com pontuação, tanto faz.'}</small></label>
      <label class="campo"><span>Chaves da planilha de receita</span>
        <div class="entrada-chaves" data-chaves>
          ${d.chaves.map((k) => `<span class="chave">${esc(k)}<button type="button" data-acao="remover-chave" data-valor="${esc(k)}" aria-label="Remover chave ${esc(k)}">×</button><input type="hidden" name="chaves" value="${esc(k)}"></span>`).join('')}
          <input type="text" placeholder="digite e tecle Enter" data-campo="nova-chave" aria-label="Nova chave">
        </div>
        <small>Como o nome aparece na coluna Client. Maiúsculas e acentos não importam.</small>
      </label>
      <label class="campo"><span>Conta contábil padrão</span>
        <select name="conta"><option value="">Sem conta padrão</option>${estado.dados.contas.map((c) => `<option value="${c.id}" ${c.id === d.conta ? 'selected' : ''}>${esc(c.codigo)} · ${esc(c.descricao)}</option>`).join('')}</select>
      </label>
      <div class="botoes">
        ${d.id !== 'novo' ? '<button class="btn btn-perigo" type="button" data-acao="excluir-destinatario" style="margin-right:auto">Excluir</button>' : ''}
        <button class="btn" type="button" data-acao="fechar-cadastro">Cancelar</button>
        <button class="btn btn-azul" type="submit">Salvar</button>
      </div>
    </form>`;
}

function telaContas() {
  const ed = estado.edConta === 'novo' ? { id: 'novo', codigo: '', descricao: '', natureza: 'Ativo' } : conta(estado.edConta);
  const usadas = (id) => estado.dados.destinatarios.filter((d) => d.conta === id).length;
  return `
    <div class="titulo-tela"><div><h1>Contas contábeis</h1><p>Contas de clientes do plano de contas. Cada destinatário aponta para uma conta padrão, e o título pode trocar por outra.</p></div>
      <button class="btn btn-azul" type="button" data-acao="nova-conta">Nova conta</button></div>
    <div class="grade-cadastro">
      <div class="rolagem"><table>
        <thead><tr><th>Código</th><th>Descrição</th><th>Natureza</th><th class="n">Destinatários</th><th></th></tr></thead>
        <tbody>${[...estado.dados.contas].sort((a, b) => a.codigo.localeCompare(b.codigo)).map((c) => `
          <tr><td class="mono">${esc(c.codigo)}</td><td class="quebra">${esc(c.descricao)}</td><td>${esc(c.natureza)}</td><td class="n">${usadas(c.id)}</td>
          <td><button class="btn btn-mini" type="button" data-acao="editar-conta" data-id="${c.id}">Editar</button></td></tr>`).join('')}
        </tbody>
      </table></div>
      <aside class="painel-form">
        ${ed ? `
          <h2>${ed.id === 'novo' ? 'Nova conta' : esc(ed.codigo)}</h2>
          <form data-form="conta" data-id="${ed.id}">
            <label class="campo"><span>Código</span><input type="text" name="codigo" value="${esc(ed.codigo)}" placeholder="1.1.2.01.0001" required></label>
            <label class="campo"><span>Descrição</span><input type="text" name="descricao" value="${esc(ed.descricao)}" required></label>
            <label class="campo"><span>Natureza</span><select name="natureza">${['Ativo', 'Passivo', 'Resultado'].map((n) => `<option ${n === ed.natureza ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            <div class="botoes">
              ${ed.id !== 'novo' ? `<button class="btn btn-perigo" type="button" data-acao="excluir-conta" style="margin-right:auto" ${usadas(ed.id) ? `disabled title="Em uso por ${usadas(ed.id)} destinatário(s)"` : ''}>Excluir</button>` : ''}
              <button class="btn" type="button" data-acao="fechar-cadastro">Cancelar</button>
              <button class="btn btn-azul" type="submit">Salvar</button>
            </div>
          </form>` : '<h2>Cadastro</h2><p class="mudo">Escolha uma conta para editar. Conta usada por algum destinatário não pode ser excluída.</p>'}
      </aside>
    </div>`;
}

function telaArquivo() {
  const lista = [...estado.dados.arquivo].sort((a, b) => b.numero - a.numero);
  return `
    <div class="titulo-tela"><div><h1>Arquivo</h1><p>Borderôs já emitidos. Cada um guarda o retrato do cadastro no dia da emissão: mudar um destinatário hoje não altera o que já foi para o ERP.</p></div></div>
    <div class="lista-arquivo">
      ${lista.map((b) => {
        const total = b.titulos.reduce((s, t) => s + Number(t.valor), 0);
        const quando = new Date(b.emitidoEm);
        return `
        <details class="bordero-emitido">
          <summary>
            <span class="num"><small>Borderô</small>${String(b.numero).padStart(3, '0')}</span>
            <span class="meio"><b>${b.titulos.length} títulos · ${[...new Set(b.titulos.map((t) => t.razao || destinatario(t.destinatario)?.razao))].length} clientes</b>
              <span>Emitido em ${dataBr(b.emitidoEm.slice(0, 10))} às ${String(quando.getHours()).padStart(2, '0')}:${String(quando.getMinutes()).padStart(2, '0')}</span></span>
            <span class="soma">R$ ${moeda(total)}</span>
            <span class="carimbo" aria-hidden="true">EMITIDO<small>${dataBr(b.emitidoEm.slice(0, 10))}</small></span>
          </summary>
          <div class="detalhe">
            <div class="botoes">
              <button class="btn btn-mini" type="button" data-acao="baixar-erp" data-id="${b.id}">Baixar arquivo do ERP</button>
              <button class="btn btn-mini" type="button" data-acao="imprimir-emitido" data-id="${b.id}">Imprimir</button>
              <button class="btn btn-mini" type="button" data-acao="copiar-emitido" data-id="${b.id}">Copiar para um novo borderô</button>
            </div>
            <div class="rolagem"><table>
              <thead><tr><th>Vencimento</th><th>Destinatário</th><th>CNPJ</th><th>Conta</th><th>Projeto</th><th class="n">Valor</th></tr></thead>
              <tbody>${[...b.titulos].sort((x, y) => x.vencimento.localeCompare(y.vencimento)).map((t) => {
                const r = t.razao ? t : retrato(t);
                return `<tr><td class="mono">${dataBr(t.vencimento)}</td><td class="quebra">${esc(r.razao)}</td><td class="mono">${esc(r.cnpj || 'exterior')}</td><td class="mono">${esc(r.contaCodigo)}</td><td class="mono">${esc(t.projeto)}</td><td class="n">${moeda(t.valor)}</td></tr>`;
              }).join('')}</tbody>
            </table></div>
          </div>
        </details>`;
      }).join('') || '<p class="vazio">Nenhum borderô emitido ainda.</p>'}
    </div>`;
}

// ---------------------------------------------------------------------------
// Render, recado e impressão
// ---------------------------------------------------------------------------

const conteudo = document.getElementById('conteudo');
const TELAS = { bordero: telaBordero, importar: telaImportar, destinatarios: telaDestinatarios, contas: telaContas, arquivo: telaArquivo };

function render() {
  document.getElementById('emissora').innerHTML = `Emitente: <b>${esc(EMISSORA.nome)}</b><br><span class="mono">${esc(EMISSORA_CNPJ)}</span> · filial ${EMISSORA.filial} · dados fictícios`;
  document.getElementById('abas').innerHTML = ROTAS.map((r) => `<a href="#${r.id}" ${estado.rota === r.id ? 'aria-current="page"' : ''}>${r.nome}${r.conta ? `<span class="conta">${r.conta()}</span>` : ''}</a>`).join('');
  conteudo.innerHTML = TELAS[estado.rota]();
  document.title = `${ROTAS.find((r) => r.id === estado.rota).nome} | Contas a Receber`;
}

let tempoRecado;
function avisar(texto) {
  const el = document.getElementById('recado');
  el.textContent = texto;
  el.classList.add('visivel');
  clearTimeout(tempoRecado);
  tempoRecado = setTimeout(() => el.classList.remove('visivel'), 4200);
}

function imprimir(numero, titulos, situacao) {
  const total = titulos.reduce((s, t) => s + Number(t.valor), 0);
  document.getElementById('impressao').innerHTML = `
    <h1>Borderô de títulos nº ${String(numero).padStart(3, '0')} (${situacao})</h1>
    <p>${esc(EMISSORA.nome)} · CNPJ ${esc(EMISSORA_CNPJ)} · impresso em ${dataBr(hojeIso())}</p>
    <table><thead><tr><th>Vencimento</th><th>Código</th><th>Destinatário</th><th>CNPJ</th><th>Conta</th><th>Projeto</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>${[...titulos].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).map((t) => {
      const r = t.razao ? t : retrato(t);
      return `<tr><td>${dataBr(t.vencimento)}</td><td>${esc(r.codigo)}</td><td>${esc(r.razao)}</td><td>${esc(r.cnpj || 'exterior')}</td><td>${esc(r.contaCodigo)}</td><td>${esc(t.projeto)}</td><td style="text-align:right">${moeda(t.valor)}</td></tr>`;
    }).join('')}</tbody>
    <tfoot><tr><td colspan="6"><b>Total (${titulos.length} títulos)</b></td><td style="text-align:right"><b>${moeda(total)}</b></td></tr></tfoot></table>
    <div class="assinaturas"><div>Elaborado por</div><div>Conferido por</div></div>`;
  window.print();
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

function lerFormTitulo(form) {
  const f = Object.fromEntries(new FormData(form).entries());
  return { ...estado.form, ...f, parcelas: f.parcelas ?? estado.form.parcelas };
}

function salvarTitulo(form) {
  const f = lerFormTitulo(form);
  estado.form = f;
  if (!f.destinatario) { avisar('Escolha o destinatário.'); form.destinatario.focus(); return; }
  if (!(numero(f.valor) > 0)) { avisar('Informe um valor maior que zero.'); form.valor.focus(); return; }
  if (!f.vencimento) { avisar('Informe o vencimento.'); return; }
  const base = { destinatario: f.destinatario, conta: f.conta, projeto: f.projeto.trim(), especificacao: f.especificacao.trim(), observacao: f.observacao.trim(), emissao: f.emissao, vencimento: f.vencimento, valor: numero(f.valor), origem: 'manual', parcela: 1 };
  if (estado.editando) {
    const t = estado.dados.rascunho.find((x) => x.id === estado.editando);
    Object.assign(t, { ...base, origem: t.origem, parcela: t.parcela, totalParcelas: t.totalParcelas });
    estado.editando = null;
    avisar('Título atualizado.');
  } else {
    const novos = parcelar(base, f.parcelas);
    estado.dados.rascunho.push(...novos);
    avisar(novos.length > 1 ? `${novos.length} parcelas mensais postas no borderô.` : 'Título posto no borderô.');
  }
  estado.form = { ...formVazio(), emissao: f.emissao };
  salvar();
  render();
}

function emitir() {
  const lista = estado.dados.rascunho;
  const comErro = lista.filter((t) => conferirTitulo(t, lista).erros.length);
  if (comErro.length) {
    avisar(`Corrija ${comErro.length} título(s) marcado(s) em vermelho antes de emitir.`);
    conteudo.querySelector('.titulo.com-erro')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const numeroBordero = estado.dados.proximoNumero;
  const titulos = lista.map(retrato);
  estado.dados.arquivo.push({ id: `b${numeroBordero}-${Date.now().toString(36)}`, numero: numeroBordero, emitidoEm: new Date().toISOString().slice(0, 19), titulos });
  estado.dados.rascunho = [];
  estado.dados.proximoNumero += 1;
  salvar();
  render();
  baixarErp(numeroBordero, titulos).catch((e) => avisar(e.message));
  const total = titulos.reduce((s, t) => s + Number(t.valor), 0);
  const dlg = document.getElementById('dlg-emitido');
  dlg.innerHTML = `
    <div class="emitido-ok">
      <span class="carimbo">EMITIDO<small>${dataBr(hojeIso())}</small></span>
      <h2>Borderô nº ${String(numeroBordero).padStart(3, '0')} emitido</h2>
      <p>${titulos.length} títulos, R$ ${moeda(total)}. O arquivo <span class="mono">contas_receber_bordero_${String(numeroBordero).padStart(3, '0')}.xlsx</span> foi baixado no layout de importação do ERP (aba Tabela).</p>
      <div class="botoes">
        <button class="btn" type="button" data-acao="ir-arquivo">Ver no arquivo</button>
        <button class="btn btn-azul" type="button" data-acao="fechar-dialogo">Novo borderô</button>
      </div>
    </div>`;
  dlg.showModal();
}

const ACOES = {
  'atalho-venc': (el) => {
    const form = conteudo.querySelector('[data-form="titulo"]');
    estado.form = lerFormTitulo(form);
    if (el.dataset.dia10) {
      const d = new Date(`${estado.form.emissao}T12:00:00`);
      d.setMonth(d.getMonth() + 1, 10);
      estado.form.vencimento = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-10`;
    } else {
      estado.form.vencimento = somarDias(estado.form.emissao || hojeIso(), Number(el.dataset.dias));
    }
    render();
  },
  'editar-titulo': (el) => {
    const t = estado.dados.rascunho.find((x) => x.id === el.dataset.id);
    estado.editando = t.id;
    estado.form = { ...t, valor: moeda(t.valor), parcelas: 1 };
    render();
    conteudo.querySelector('.boleta select')?.focus();
  },
  'cancelar-edicao': () => { estado.editando = null; estado.form = formVazio(); render(); },
  'duplicar-titulo': (el) => {
    const t = estado.dados.rascunho.find((x) => x.id === el.dataset.id);
    estado.dados.rascunho.push({ ...t, id: `t${Date.now().toString(36)}` });
    salvar(); render(); avisar('Título duplicado. Ajuste o que mudar.');
  },
  'remover-titulo': (el) => {
    estado.dados.rascunho = estado.dados.rascunho.filter((x) => x.id !== el.dataset.id);
    if (estado.editando === el.dataset.id) { estado.editando = null; estado.form = formVazio(); }
    salvar(); render();
  },
  'limpar-rascunho': () => {
    if (!confirm('Tirar todos os títulos do borderô?')) return;
    estado.dados.rascunho = []; estado.editando = null;
    salvar(); render();
  },
  emitir,
  'imprimir-rascunho': () => imprimir(estado.dados.proximoNumero, estado.dados.rascunho, 'rascunho'),
  'ir-arquivo': () => { document.getElementById('dlg-emitido').close(); location.hash = 'arquivo'; },
  'fechar-dialogo': () => document.getElementById('dlg-emitido').close(),
  'baixar-exemplo': () => baixarExemploReceita().catch((e) => avisar(e.message)),
  'descartar-importacao': () => { estado.importacao = null; render(); },
  'levar-importacao': () => {
    const imp = estado.importacao;
    const prontos = imp.itens.filter((i) => !i.motivo && i.destinatario);
    for (const i of prontos) {
      if (!i.automatico && i.lembrar) {
        const d = destinatario(i.destinatario);
        if (!d.chaves.some((k) => normalizar(k) === normalizar(i.cliente))) d.chaves.push(i.cliente.toUpperCase());
      }
    }
    const venc = imp.regra === 'dias' ? somarDias(imp.emissao, Number(imp.dias) || 0) : imp.dataFixa;
    estado.dados.rascunho.push(...prontos.map((i, k) => ({
      id: `t${Date.now().toString(36)}${k}`, destinatario: i.destinatario, conta: '', projeto: i.projeto, especificacao: i.especificacao,
      observacao: i.observacao, emissao: imp.emissao, vencimento: venc, valor: i.valor, parcela: 1, origem: 'planilha',
    })));
    const lembradas = prontos.filter((i) => !i.automatico && i.lembrar).length;
    estado.importacao = null;
    salvar();
    location.hash = 'bordero';
    avisar(`${prontos.length} título(s) no borderô.${lembradas ? ` ${lembradas} chave(s) nova(s) aprendida(s).` : ''}`);
  },
  'novo-destinatario': () => { estado.edDest = 'novo'; render(); conteudo.querySelector('.painel-form input')?.focus(); },
  'editar-destinatario': (el) => { estado.edDest = el.dataset.id; render(); },
  'fechar-cadastro': () => { estado.edDest = null; estado.edConta = null; render(); },
  'remover-chave': (el) => el.closest('.chave').remove(),
  'excluir-destinatario': () => {
    const id = estado.edDest;
    if (estado.dados.rascunho.some((t) => t.destinatario === id)) { avisar('Há títulos deste destinatário no borderô. Tire-os antes de excluir.'); return; }
    if (!confirm('Excluir este destinatário? Os borderôs já emitidos continuam com o retrato dele.')) return;
    estado.dados.destinatarios = estado.dados.destinatarios.filter((d) => d.id !== id);
    estado.edDest = null; salvar(); render();
  },
  'nova-conta': () => { estado.edConta = 'novo'; render(); conteudo.querySelector('.painel-form input')?.focus(); },
  'editar-conta': (el) => { estado.edConta = el.dataset.id; render(); },
  'excluir-conta': () => {
    estado.dados.contas = estado.dados.contas.filter((c) => c.id !== estado.edConta);
    estado.edConta = null; salvar(); render();
  },
  'baixar-erp': (el) => {
    const b = estado.dados.arquivo.find((x) => x.id === el.dataset.id);
    baixarErp(b.numero, b.titulos.map((t) => (t.razao ? t : retrato(t)))).catch((e) => avisar(e.message));
  },
  'imprimir-emitido': (el) => {
    const b = estado.dados.arquivo.find((x) => x.id === el.dataset.id);
    imprimir(b.numero, b.titulos, 'emitido');
  },
  'copiar-emitido': (el) => {
    const b = estado.dados.arquivo.find((x) => x.id === el.dataset.id);
    const hoje = hojeIso();
    const desloc = (iso) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${b.emitidoEm.slice(0, 10)}T12:00:00`)) / 864e5);
    estado.dados.rascunho.push(...b.titulos.filter((t) => destinatario(t.destinatario)).map((t, k) => ({
      id: `t${Date.now().toString(36)}${k}`, destinatario: t.destinatario, conta: t.conta, projeto: t.projeto, especificacao: t.especificacao,
      observacao: t.observacao, emissao: hoje, vencimento: somarDias(hoje, desloc(t.vencimento)), valor: t.valor, parcela: t.parcela, totalParcelas: t.totalParcelas, origem: 'manual',
    })));
    salvar();
    location.hash = 'bordero';
    avisar(`Títulos do borderô ${String(b.numero).padStart(3, '0')} copiados com as datas trazidas para hoje.`);
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

document.addEventListener('submit', (ev) => {
  const form = ev.target;
  const tipo = form.dataset.form;
  if (!tipo) return;
  ev.preventDefault();
  if (tipo === 'titulo') { salvarTitulo(form); return; }
  const f = new FormData(form);
  if (tipo === 'destinatario') {
    const exterior = f.has('exterior');
    const doc = exterior ? '' : formatarCnpj(f.get('cnpj'));
    if (!exterior && doc && !cnpjValido(doc) && !confirm('O CNPJ não confere pelo dígito verificador. Salvar assim mesmo? O título vai ficar travado até corrigir.')) return;
    const dados = {
      codigo: String(f.get('codigo')).trim(), razao: String(f.get('razao')).trim(), cnpj: doc, exterior,
      centro: String(f.get('centro')).trim(), conta: String(f.get('conta')), chaves: f.getAll('chaves').map(String),
    };
    if (form.dataset.id === 'novo') estado.dados.destinatarios.push({ id: `d${Date.now().toString(36)}`, ...dados });
    else Object.assign(destinatario(form.dataset.id), dados);
    estado.edDest = null; salvar(); render(); avisar('Destinatário salvo.');
    return;
  }
  if (tipo === 'conta') {
    const dados = { codigo: String(f.get('codigo')).trim(), descricao: String(f.get('descricao')).trim(), natureza: String(f.get('natureza')) };
    if (form.dataset.id === 'novo') estado.dados.contas.push({ id: `c${Date.now().toString(36)}`, ...dados });
    else Object.assign(conta(form.dataset.id), dados);
    estado.edConta = null; salvar(); render(); avisar('Conta salva.');
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  const campo = el.dataset.campo;
  const formTitulo = el.closest('[data-form="titulo"]');
  if (formTitulo && ['destinatario', 'emissao', 'vencimento', 'parcelas'].includes(el.name)) {
    estado.form = lerFormTitulo(formTitulo);
    render();
    conteudo.querySelector(`[data-form="titulo"] [name="${el.name}"]`)?.focus();
    return;
  }
  const imp = estado.importacao;
  if (campo === 'arquivo-receita') { lerReceita(el.files?.[0]); return; }
  if (campo === 'imp-emissao') { imp.emissao = el.value; return; }
  if (campo === 'imp-regra') { imp.regra = el.value; render(); return; }
  if (campo === 'imp-dias') { imp.dias = Number(el.value) || 0; return; }
  if (campo === 'imp-data') { imp.dataFixa = el.value; return; }
  if (campo === 'imp-dest') { const i = imp.itens[Number(el.dataset.k)]; i.destinatario = el.value; i.automatico = false; render(); return; }
  if (campo === 'imp-lembrar') { imp.itens[Number(el.dataset.k)].lembrar = el.checked; return; }
  if (campo === 'exterior') {
    const cnpj = el.form.querySelector('[name="cnpj"]');
    cnpj.disabled = el.checked;
    document.getElementById('msg-cnpj').textContent = el.checked ? 'Não exigido para cliente no exterior.' : '';
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.campo === 'busca') {
    estado.busca = el.value;
    const pos = el.selectionStart;
    render();
    const novo = conteudo.querySelector('[data-campo="busca"]');
    novo.focus();
    novo.setSelectionRange(pos, pos);
    return;
  }
  if (el.dataset.campo === 'cnpj') {
    const msg = document.getElementById('msg-cnpj');
    const ok = cnpjValido(el.value);
    el.classList.toggle('invalido', somenteDigitos(el.value).length >= 14 && !ok);
    msg.className = ok ? 'bom' : somenteDigitos(el.value).length >= 14 ? 'ruim' : '';
    msg.textContent = ok ? 'Dígitos verificadores conferem.' : somenteDigitos(el.value).length >= 14 ? 'Dígito verificador não confere.' : `${somenteDigitos(el.value).length} de 14 dígitos.`;
  }
});

document.addEventListener('keydown', (ev) => {
  const el = ev.target;
  if (el.dataset?.campo === 'nova-chave' && ev.key === 'Enter') {
    ev.preventDefault();
    const valor = el.value.trim().toUpperCase();
    if (!valor) return;
    el.insertAdjacentHTML('beforebegin', `<span class="chave">${esc(valor)}<button type="button" data-acao="remover-chave" aria-label="Remover chave ${esc(valor)}">×</button><input type="hidden" name="chaves" value="${esc(valor)}"></span>`);
    el.value = '';
  }
});

// Soltar a planilha de receita.
conteudo.addEventListener('dragover', (ev) => {
  const area = ev.target.closest('#area-soltar');
  if (!area) return;
  ev.preventDefault();
  area.classList.add('sobre');
});
conteudo.addEventListener('dragleave', (ev) => ev.target.closest('#area-soltar')?.classList.remove('sobre'));
conteudo.addEventListener('drop', (ev) => {
  const area = ev.target.closest('#area-soltar');
  if (!area) return;
  ev.preventDefault();
  lerReceita(ev.dataTransfer.files?.[0]);
});

document.getElementById('alternar-tema').addEventListener('click', () => {
  const escuro = document.documentElement.dataset.tema !== 'escuro';
  if (escuro) document.documentElement.dataset.tema = 'escuro';
  else delete document.documentElement.dataset.tema;
  try { localStorage.setItem('receber:tema', escuro ? 'escuro' : 'claro'); } catch { /* ok */ }
});

function lerRota() {
  const id = location.hash.replace('#', '');
  estado.rota = ROTAS.some((r) => r.id === id) ? id : 'bordero';
}

window.addEventListener('hashchange', () => { lerRota(); render(); window.scrollTo({ top: 0 }); });

carregar();
estado.form = formVazio();
lerRota();
render();
