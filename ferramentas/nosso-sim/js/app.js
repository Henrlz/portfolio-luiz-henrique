// Nosso Sim: caderno do casamento organizado pelos meses que faltam.
// Estado único, telas como funções que devolvem HTML, eventos delegados.

import { dadosIniciais, iso, deIso } from './dados.js';

const CHAVE = 'nossosim:v2';
const hoje = iso(new Date());
const app = document.getElementById('app');

const estado = { dados: null, aberto: false, rota: 'caminho', filtroRsvp: 'todos' };

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (salvo?.config) estado.dados = salvo;
    estado.aberto = sessionStorage.getItem('nossosim:aberto') === '1';
  } catch { /* sem armazenamento */ }
  if (!estado.dados) estado.dados = dadosIniciais(hoje);
}
function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado.dados)); } catch { /* ok */ }
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const reais = (v) => fmt.format(Math.round(Number(v) || 0));
const dataExtenso = (s) => `${Number(s.slice(8))} de ${MESES[Number(s.slice(5, 7)) - 1]} de ${s.slice(0, 4)}`;
const dataCurta = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function diasAte(s) {
  return Math.ceil((deIso(s) - deIso(hoje)) / 864e5);
}
function mesesEntre(a, b) {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
}
const pessoas = (c) => 1 + (Number(c.acompanhantes) || 0) + (Number(c.criancas) || 0);
const quemClasse = (q) => (q === 'Marina' ? 'marina' : q === 'Rafael' ? 'rafael' : '');

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

function financeiro() {
  const d = estado.dados;
  const contratados = d.fornecedores.filter((f) => f.status === 'contratado');
  const porCategoria = d.orcamento.map((o) => {
    const fs = contratados.filter((f) => f.categoria === o.categoria);
    return {
      ...o,
      contratado: fs.reduce((t, f) => t + Number(f.valor), 0),
      pago: fs.reduce((t, f) => t + f.parcelas.filter((p) => p.pago).reduce((s, p) => s + p.valor, 0), 0),
    };
  });
  const contratado = porCategoria.reduce((t, c) => t + c.contratado, 0);
  const pago = porCategoria.reduce((t, c) => t + c.pago, 0);
  const meses = Math.max(1, mesesEntre(hoje, d.config.data));
  const falta = Math.max(0, d.config.orcamentoTotal - d.config.juntado);
  const porMes = falta / meses;
  const projetado = d.config.juntado + d.config.aporteMensal * meses;
  return { porCategoria, contratado, pago, meses, falta, porMes, projetado };
}

function parcelasAbertas() {
  return estado.dados.fornecedores.flatMap((f) => f.parcelas.map((p, i) => ({ ...p, i, f }))).filter((p) => !p.pago).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

// ---------------------------------------------------------------------------
// Cadeado
// ---------------------------------------------------------------------------

function telaCadeado() {
  const [a, b] = estado.dados.config.nomes;
  return `
  <main class="cadeado">
    <div class="caixa">
      <h1 class="nomes">${esc(a)} <span>&amp;</span><br>${esc(b)}</h1>
      <p>Caderno do casamento. Para abrir, o dia e o mês do primeiro sim.</p>
      <form data-form="cadeado" autocomplete="off">
        <div class="digitos" id="digitos">
          <input inputmode="numeric" maxlength="1" aria-label="Dia, primeiro dígito" data-d="0">
          <input inputmode="numeric" maxlength="1" aria-label="Dia, segundo dígito" data-d="1">
          <span class="separador">/</span>
          <input inputmode="numeric" maxlength="1" aria-label="Mês, primeiro dígito" data-d="2">
          <input inputmode="numeric" maxlength="1" aria-label="Mês, segundo dígito" data-d="3">
        </div>
      </form>
      <p class="dica" id="dica" aria-live="polite"></p>
      <p class="demo">Demonstração com um casal fictício. Código de acesso: 0809.</p>
    </div>
  </main>`;
}

function conferirCodigo() {
  const inputs = [...app.querySelectorAll('[data-d]')];
  const codigo = inputs.map((i) => i.value).join('');
  if (codigo.length < 4) return;
  if (codigo === estado.dados.config.codigo) {
    estado.aberto = true;
    try { sessionStorage.setItem('nossosim:aberto', '1'); } catch { /* ok */ }
    render();
    return;
  }
  const caixa = document.getElementById('digitos');
  caixa.classList.remove('erro');
  void caixa.offsetWidth;
  caixa.classList.add('erro');
  const dica = document.getElementById('dica');
  dica.className = 'dica erro';
  dica.textContent = 'Não é essa data. Dica: um banco de praça, depois do cinema.';
  inputs.forEach((i) => { i.value = ''; });
  inputs[0].focus();
}

// ---------------------------------------------------------------------------
// Topo e navegação
// ---------------------------------------------------------------------------

const ROTAS = [
  ['caminho', 'O caminho'], ['convidados', 'Convidados'], ['dinheiro', 'Dinheiro'],
  ['fornecedores', 'Fornecedores'], ['dia', 'O dia'], ['nos', 'Nós dois'],
];

function topo() {
  const c = estado.dados.config;
  const dias = diasAte(c.data);
  return `
  <header class="topo">
    <div class="contagem">
      <b>${dias > 0 ? dias : dias === 0 ? 'Hoje' : 'Casados'}</b>
      <span>${dias > 0 ? `<strong>${dias === 1 ? 'dia' : 'dias'} para o sim</strong>` : ''}${DIAS[deIso(c.data).getDay()]}, ${dataExtenso(c.data)}, ${c.hora}</span>
    </div>
    <div class="direita">
      <button class="btn btn-mini" type="button" data-acao="tema" aria-label="Alternar tema claro e escuro">Tema</button>
      <button class="btn btn-mini" type="button" data-acao="trancar">Trancar</button>
    </div>
  </header>
  <nav class="abas" aria-label="Seções">${ROTAS.map(([id, nome]) => `<a href="#${id}" ${estado.rota === id ? 'aria-current="page"' : ''}>${nome}</a>`).join('')}</nav>`;
}

// ---------------------------------------------------------------------------
// Tela: O caminho
// ---------------------------------------------------------------------------

function itemTarefa(t) {
  return `<li class="tarefa ${t.feita ? 'feita' : ''}">
    <input type="checkbox" ${t.feita ? 'checked' : ''} data-campo="tarefa" data-id="${t.id}" aria-label="${esc(t.titulo)}">
    <span class="t">${esc(t.titulo)}${t.prazo < hoje && !t.feita ? ` <small class="mudo">(era até ${dataCurta(t.prazo)})</small>` : ''}</span>
    <span class="quem ${quemClasse(t.quem)}">${esc(t.quem)}</span>
  </li>`;
}

function telaCaminho() {
  const d = estado.dados;
  const c = d.config;
  const fin = financeiro();
  const atrasadas = d.tarefas.filter((t) => !t.feita && t.prazo < hoje).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const feitasAntes = d.tarefas.filter((t) => t.feita && t.prazo < `${hoje.slice(0, 7)}-01`);
  const feitas = d.tarefas.filter((t) => t.feita).length;
  const confirmados = d.convidados.filter((x) => x.rsvp === 'vai').reduce((t, x) => t + pessoas(x), 0);
  const convidadosTotal = d.convidados.filter((x) => x.rsvp !== 'não vai').reduce((t, x) => t + pessoas(x), 0);
  const categoriasFechadas = new Set(d.fornecedores.filter((f) => f.status === 'contratado').map((f) => f.categoria)).size;

  const meses = [];
  for (let m = hoje.slice(0, 7); m <= c.data.slice(0, 7); ) {
    meses.push(m);
    const dt = deIso(`${m}-01`);
    dt.setMonth(dt.getMonth() + 1);
    m = iso(dt).slice(0, 7);
  }
  const parcelas = estado.dados.fornecedores.flatMap((f) => f.parcelas.map((p) => ({ ...p, f })));

  return `
  <div class="grade-caminho">
    <section aria-label="O caminho mês a mês">
      <p class="frase">Faltam <b>${fin.meses} meses</b>. Já fizemos <b>${feitas} de ${d.tarefas.length}</b> tarefas e fechamos ${categoriasFechadas} de ${d.orcamento.length} categorias de fornecedor.
        Para chegar ao orçamento sem aperto, o ideal é guardar <b>${reais(fin.porMes)} por mês</b>${fin.porMes <= c.aporteMensal ? ', e o ritmo de hoje dá conta' : `, um pouco mais que os ${reais(c.aporteMensal)} de hoje`}.</p>
      ${atrasadas.length ? `<div class="atrasadas"><h2>Ficou para trás</h2><ul class="tarefas">${atrasadas.map(itemTarefa).join('')}</ul></div>` : ''}
      ${feitasAntes.length ? `<details style="margin-bottom:18px"><summary class="btn-link" style="list-style:none;display:inline">O que já foi feito (${feitasAntes.length})</summary><ul class="tarefas" style="margin-top:8px">${feitasAntes.map(itemTarefa).join('')}</ul></details>` : ''}
      <ol class="meses">
        ${meses.map((m, i) => {
          const final = m === c.data.slice(0, 7);
          const tarefas = d.tarefas.filter((t) => t.prazo.slice(0, 7) === m && !(t.prazo < hoje && !t.feita)).sort((a, b) => a.prazo.localeCompare(b.prazo));
          const pags = parcelas.filter((p) => p.vencimento.slice(0, 7) === m);
          const rotulo = `<div class="rotulo"><b>${MESES[Number(m.slice(5)) - 1].slice(0, 3)} ${m.slice(2, 4)}</b><small>${i === 0 ? 'agora' : final ? 'o mês' : `faltam ${meses.length - 1 - i}`}</small></div>`;
          if (final) {
            return `<li class="mes final">${rotulo}<div class="conteudo"><h2 style="font-size:22px">${dataExtenso(c.data)}, ${c.hora}</h2><p style="margin:4px 0 0">${esc(d.dia.cerimonia.local)}. ${tarefas.length ? `Antes: ${tarefas.map((t) => esc(t.titulo.toLowerCase())).join('; ')}.` : ''}</p></div></li>`;
          }
          if (!tarefas.length && !pags.length) return `<li class="mes vazio">${rotulo}<div class="conteudo">Mês sem prazo. Guardar ${reais(c.aporteMensal)} e descansar.</div></li>`;
          return `<li class="mes ${i === 0 ? 'atual' : ''}">${rotulo}<div class="conteudo">
            ${tarefas.length ? `<ul class="tarefas">${tarefas.map(itemTarefa).join('')}</ul>` : ''}
            ${pags.length ? `<div class="pagar"><div class="linha-pg ${pags.every((p) => p.pago) ? 'pago' : ''}">
              <span>${pags.length === 1 ? `Parcela de ${esc(pags[0].f.nome)}` : `${pags.length} parcelas (${pags.map((p) => esc(p.f.nome.split(' (')[0].split(' ').slice(0, 3).join(' '))).join(', ')})`}, dia ${Number(pags[0].vencimento.slice(8))}</span>
              <span>${reais(pags.reduce((t, p) => t + p.valor, 0))}</span></div></div>` : ''}
          </div></li>`;
        }).join('')}
      </ol>
    </section>
    <aside class="lado">
      <section class="folha">
        <h2>Dinheiro</h2>
        <div class="barra" aria-label="Guardado em relação ao orçamento"><i style="width:${Math.min(100, (c.juntado / c.orcamentoTotal) * 100)}%;background:var(--oliva)"></i></div>
        <div class="numeros"><div><b>${reais(c.juntado)}</b>guardado</div><div><b>${reais(c.orcamentoTotal)}</b>orçamento</div><div><b>${reais(fin.contratado)}</b>já contratado</div><div><b>${reais(fin.pago)}</b>já pago</div></div>
      </section>
      <section class="folha">
        <h2>Convidados</h2>
        <div class="barra"><i style="width:${(confirmados / c.limite) * 100}%;background:var(--oliva)"></i><i style="width:${Math.max(0, ((convidadosTotal - confirmados) / c.limite) * 100)}%;background:var(--mostarda)"></i></div>
        <div class="numeros"><div><b>${confirmados}</b>confirmados</div><div><b>${convidadosTotal - confirmados}</b>sem resposta</div></div>
        <p class="mudo" style="margin:10px 0 0;font-size:13.5px">O salão cabe ${c.limite} pessoas${convidadosTotal > c.limite ? `: a lista passou ${convidadosTotal - c.limite}` : `; sobram ${c.limite - convidadosTotal} lugares`}.</p>
      </section>
      <section class="folha">
        <h2>Nova tarefa</h2>
        <form class="nova-tarefa" data-form="tarefa">
          <input type="text" name="titulo" placeholder="O que precisa ser feito" required aria-label="Tarefa">
          <input type="date" name="prazo" value="${iso(new Date(Date.now() + 30 * 864e5))}" aria-label="Prazo">
          <div class="linha2"><select name="quem" aria-label="Quem"><option>Os dois</option><option>${esc(c.nomes[0])}</option><option>${esc(c.nomes[1])}</option></select><button class="btn btn-oliva" type="submit">Pôr no caminho</button></div>
        </form>
      </section>
    </aside>
  </div>`;
}

// ---------------------------------------------------------------------------
// Tela: Convidados
// ---------------------------------------------------------------------------

function telaConvidados() {
  const d = estado.dados;
  const c = d.config;
  const vao = d.convidados.filter((x) => x.rsvp === 'vai').reduce((t, x) => t + pessoas(x), 0);
  const aguardam = d.convidados.filter((x) => x.rsvp === 'sem resposta').reduce((t, x) => t + pessoas(x), 0);
  const naoVao = d.convidados.filter((x) => x.rsvp === 'não vai').reduce((t, x) => t + pessoas(x), 0);
  const total = vao + aguardam;
  const base = Math.max(c.limite, total);
  const filtro = estado.filtroRsvp;
  const visiveis = d.convidados.filter((x) => filtro === 'todos' || x.rsvp === filtro);
  const coluna = (lado, titulo) => {
    const lista = visiveis.filter((x) => x.lado === lado);
    return `<section class="coluna"><h2>${titulo}<small>${lista.reduce((t, x) => t + pessoas(x), 0)} pessoas</small></h2>
      ${lista.map((x) => `<div class="convidado">
        <b>${esc(x.nome)}</b>
        <div class="rsvp" role="group" aria-label="Resposta de ${esc(x.nome)}">
          <button type="button" class="vai" aria-pressed="${x.rsvp === 'vai'}" data-acao="rsvp" data-id="${x.id}" data-v="vai">vai</button>
          <button type="button" class="talvez" aria-pressed="${x.rsvp === 'sem resposta'}" data-acao="rsvp" data-id="${x.id}" data-v="sem resposta">?</button>
          <button type="button" class="nao" aria-pressed="${x.rsvp === 'não vai'}" data-acao="rsvp" data-id="${x.id}" data-v="não vai">não</button>
          <button type="button" class="btn-x" data-acao="remover-convidado" data-id="${x.id}" aria-label="Tirar ${esc(x.nome)} da lista">×</button>
        </div>
        <small>${esc(x.grupo)}${x.acompanhantes ? ` · +${x.acompanhantes}` : ''}${x.criancas ? ` · ${x.criancas} ${x.criancas > 1 ? 'crianças' : 'criança'}` : ''}</small>
      </div>`).join('') || '<p class="mudo">Ninguém aqui com esse filtro.</p>'}
    </section>`;
  };
  return `
  <div class="cabeca"><div><h1>Convidados</h1><p>Conta pessoas, não convites: acompanhantes e crianças entram no total que o salão comporta.</p></div></div>
  <div class="capacidade">
    <div class="barra" role="img" aria-label="${vao} confirmados e ${aguardam} sem resposta, de ${c.limite} lugares">
      <i style="width:${(vao / base) * 100}%;background:var(--oliva)"></i>
      <i style="width:${(aguardam / base) * 100}%;background:var(--mostarda)"></i>
    </div>
    <div class="legenda">
      <span><i style="background:var(--oliva)"></i>${vao} confirmados</span>
      <span><i style="background:var(--mostarda)"></i>${aguardam} sem resposta</span>
      <span>${naoVao} não vão</span>
      <span>${total > c.limite ? `<b style="color:var(--vermelho)">${total - c.limite} acima do limite de ${c.limite}</b>` : `${c.limite - total} lugares livres de ${c.limite}`}</span>
    </div>
  </div>
  <div class="filtros" role="group" aria-label="Filtrar por resposta">
    ${[['todos', 'Todos'], ['sem resposta', 'Sem resposta'], ['vai', 'Vão'], ['não vai', 'Não vão']].map(([v, t]) => `<button type="button" class="pilula" aria-pressed="${filtro === v}" data-acao="filtro-rsvp" data-v="${v}">${t}</button>`).join('')}
  </div>
  <div class="grade-convidados">
    ${coluna(c.nomes[0], `Lado da ${esc(c.nomes[0])}`)}
    ${coluna(c.nomes[1], `Lado do ${esc(c.nomes[1])}`)}
    ${coluna('Os dois', 'Dos dois')}
  </div>
  <section class="folha colar">
    <h2 style="font-size:19px;margin-bottom:4px">Adicionar de uma vez</h2>
    <p class="mudo" style="margin:0 0 10px;font-size:14px">Um nome por linha. Escreva "+1" no fim para acompanhante e "+c" para criança, como em "Tia Rosa +1".</p>
    <form data-form="convidados">
      <div class="linha-form">
        <textarea name="nomes" placeholder="Fernanda Lopes +1&#10;Primo Caio&#10;Gabi e Davi +1 +c" aria-label="Nomes" required></textarea>
        <label class="campo"><span>Lado</span><select name="lado"><option>${esc(c.nomes[0])}</option><option>${esc(c.nomes[1])}</option><option>Os dois</option></select></label>
        <label class="campo"><span>Grupo</span><select name="grupo"><option>família</option><option>amigos</option><option>trabalho</option></select></label>
        <button class="btn btn-oliva" type="submit">Adicionar</button>
      </div>
    </form>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tela: Dinheiro
// ---------------------------------------------------------------------------

function telaDinheiro() {
  const c = estado.dados.config;
  const fin = financeiro();
  const abertas = parcelasAbertas();
  const sobra = fin.projetado - c.orcamentoTotal;
  return `
  <div class="cabeca"><div><h1>Dinheiro</h1><p>O traço vertical em cada barra é o que tinha sido previsto. Verde escuro é o que já foi pago; verde claro, o que está contratado e falta pagar.</p></div></div>
  <div class="grade-dinheiro">
    <section class="folha">
      <header><h2>Por categoria</h2><p>${reais(fin.contratado)} contratados de ${reais(estado.dados.orcamento.reduce((t, o) => t + o.previsto, 0))} previstos.</p></header>
      <div class="dentro">
        ${fin.porCategoria.map((cat, i) => {
          const escala = Math.max(cat.previsto, cat.contratado, 1) * 1.1;
          return `<div class="categoria">
            <div class="topo-cat"><b>${esc(cat.categoria)}</b>
              <span>${cat.contratado ? `${reais(cat.contratado)} contratado${cat.contratado > cat.previsto ? ` <span class="estouro">(${reais(cat.contratado - cat.previsto)} acima)</span>` : ''}` : 'nada contratado'} · previsto
                <input type="number" value="${cat.previsto}" step="500" min="0" data-campo="previsto" data-i="${i}" aria-label="Previsto para ${esc(cat.categoria)}" style="width:100px;min-height:28px;padding:2px 6px;display:inline-block"></span></div>
            <div class="barra">
              <i style="width:${(cat.pago / escala) * 100}%;background:var(--oliva)"></i>
              <i style="width:${((cat.contratado - cat.pago) / escala) * 100}%;background:color-mix(in srgb, var(--oliva) 38%, transparent)"></i>
              <span class="previsto" style="left:${(cat.previsto / escala) * 100}%"></span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </section>
    <div style="display:grid;gap:22px">
      <section class="folha cofre">
        <header><h2>O que já guardamos</h2></header>
        <div class="dentro">
          <div class="grande">${reais(c.juntado)}</div>
          <div class="barra"><i style="width:${Math.min(100, (c.juntado / c.orcamentoTotal) * 100)}%;background:var(--oliva)"></i></div>
          <p>Faltam ${reais(fin.falta)} em ${fin.meses} meses. Guardando ${reais(c.aporteMensal)} por mês, chegamos a ${reais(fin.projetado)}: ${sobra >= 0 ? `sobram ${reais(sobra)} para a lua de mel` : `faltariam ${reais(-sobra)}, perto de ${reais(-sobra / fin.meses)} a mais por mês`}.</p>
          <form data-form="cofre">
            <label class="campo"><span>Guardamos agora</span><input type="number" name="deposito" min="0" step="100" placeholder="0"></label>
            <label class="campo"><span>Por mês</span><input type="number" name="aporte" min="0" step="100" value="${c.aporteMensal}"></label>
            <label class="campo"><span>Orçamento total</span><input type="number" name="total" min="0" step="1000" value="${c.orcamentoTotal}"></label>
            <button class="btn btn-oliva" type="submit" style="align-self:end">Atualizar</button>
          </form>
        </div>
      </section>
      <section class="folha">
        <header><h2>Próximas parcelas</h2><p>Marque quando pagar.</p></header>
        <div class="dentro">
          <table><tbody>${abertas.slice(0, 7).map((p) => `<tr>
            <td><input type="checkbox" data-campo="parcela" data-f="${p.f.id}" data-i="${p.i}" aria-label="Paga" style="width:18px;height:18px;accent-color:var(--oliva)"></td>
            <td>${dataCurta(p.vencimento)}${p.vencimento < hoje ? ' <b style="color:var(--vermelho)">vencida</b>' : ''}</td><td>${esc(p.f.nome)}</td><td class="n">${reais(p.valor)}</td></tr>`).join('') || '<tr><td class="mudo">Nenhuma parcela em aberto.</td></tr>'}</tbody></table>
        </div>
      </section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Tela: Fornecedores
// ---------------------------------------------------------------------------

const ETAPAS = [['pesquisando', 'Pesquisando'], ['negociando', 'Negociando'], ['contratado', 'Contratado'], ['descartado', 'Descartado']];

function telaFornecedores() {
  const d = estado.dados;
  return `
  <div class="cabeca"><div><h1>Fornecedores</h1><p>Do primeiro orçamento ao contrato. Ao mover para "Contratado", o valor entra no dinheiro e vira parcela.</p></div></div>
  <div class="quadro">
    ${ETAPAS.map(([etapa, titulo], k) => {
      const lista = d.fornecedores.filter((f) => f.status === etapa);
      return `<section class="coluna ${etapa}"><h2>${titulo}<small>${lista.length}</small></h2>
        ${lista.map((f) => `<article class="cartao-forn">
          <span class="cat">${esc(f.categoria)}</span>
          <b>${esc(f.nome)}</b>
          <span class="valor">${reais(f.valor)}</span>
          ${f.contato ? `<p>${esc(f.contato)}</p>` : ''}
          ${f.obs ? `<p>${esc(f.obs)}</p>` : ''}
          ${f.parcelas.length ? `<p>${f.parcelas.filter((p) => p.pago).length} de ${f.parcelas.length} parcelas pagas</p>` : ''}
          <div class="acoes">
            ${k > 0 ? `<button class="btn btn-mini" type="button" data-acao="mover-forn" data-id="${f.id}" data-para="${ETAPAS[k - 1][0]}" aria-label="Voltar para ${ETAPAS[k - 1][1]}">←</button>` : ''}
            ${k < ETAPAS.length - 1 ? `<button class="btn btn-mini" type="button" data-acao="mover-forn" data-id="${f.id}" data-para="${ETAPAS[k + 1][0]}">${ETAPAS[k + 1][1]} →</button>` : ''}
          </div>
        </article>`).join('') || '<p class="mudo" style="font-size:14px">Vazio.</p>'}
      </section>`;
    }).join('')}
  </div>
  <section class="folha colar">
    <h2 style="font-size:19px;margin-bottom:10px">Novo orçamento</h2>
    <form data-form="fornecedor">
      <div class="linha-form" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) auto">
        <label class="campo"><span>Nome</span><input type="text" name="nome" required></label>
        <label class="campo"><span>Categoria</span><select name="categoria">${d.orcamento.map((o) => `<option>${esc(o.categoria)}</option>`).join('')}</select></label>
        <label class="campo"><span>Valor</span><input type="number" name="valor" min="0" step="100" required></label>
        <button class="btn btn-oliva" type="submit">Adicionar</button>
      </div>
    </form>
  </section>`;
}

// ---------------------------------------------------------------------------
// Tela: O dia
// ---------------------------------------------------------------------------

function telaDia() {
  const dia = estado.dados.dia;
  const local = (titulo, l) => `<section class="folha local"><span class="hora">${esc(l.hora)}</span><h2>${titulo}</h2><p><b>${esc(l.local)}</b></p><p>${esc(l.endereco)}</p></section>`;
  return `
  <div class="cabeca"><div><h1>O dia</h1><p>${DIAS[deIso(estado.dados.config.data).getDay()]}, ${dataExtenso(estado.dados.config.data)}. Tudo o que precisa estar à mão no dia.</p></div></div>
  <div class="grade-dia">
    <div style="display:grid;gap:18px">
      ${local('Cerimônia', dia.cerimonia)}
      ${local('Festa', dia.festa)}
      <section class="folha local"><h2>Traje</h2><p>${esc(dia.dressCode)}</p></section>
      <section class="folha local"><h2>Se der problema</h2>
        <ul class="lista-simples">${dia.contatos.map((x) => `<li><span><b>${esc(x.nome)}</b> <small>${esc(x.papel)}</small></span><span>${esc(x.telefone)}</span></li>`).join('')}</ul>
      </section>
    </div>
    <section class="folha local">
      <h2>Roteiro</h2>
      <ol class="roteiro">${[...dia.roteiro].sort((a, b) => a.hora.localeCompare(b.hora)).map((r) => `<li><time>${esc(r.hora)}</time><span>${esc(r.oque)}</span><button class="btn-x" type="button" data-acao="remover-roteiro" data-hora="${esc(r.hora)}" data-oque="${esc(r.oque)}" aria-label="Remover">×</button></li>`).join('')}</ol>
      <form data-form="roteiro" style="display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:8px;margin-top:12px">
        <input type="time" name="hora" required aria-label="Horário">
        <input type="text" name="oque" required placeholder="O que acontece" aria-label="O que acontece">
        <button class="btn btn-oliva" type="submit">Pôr</button>
      </form>
    </section>
  </div>`;
}

// ---------------------------------------------------------------------------
// Tela: Nós dois
// ---------------------------------------------------------------------------

function telaNos() {
  const nos = estado.dados.nos;
  return `
  <div class="cabeca"><div><h1>Nós dois</h1><p>A parte que não entra em planilha.</p></div></div>
  <div class="grade-nos">
    <section class="folha local">
      <h2>Como chegamos aqui</h2>
      <ol class="historia">${nos.historia.map((h) => `<li><time>${MESES[Number(h.quando.slice(5)) - 1].slice(0, 3)} ${h.quando.slice(0, 4)}</time><div><h3>${esc(h.titulo)}</h3><p>${esc(h.texto)}</p></div></li>`).join('')}</ol>
    </section>
    <div style="display:grid;gap:18px">
      <section class="folha local"><h2>Músicas</h2>
        <ul class="lista-simples">${nos.musicas.map((m) => `<li><span>${esc(m.titulo)}</span><small>${esc(m.momento)}</small></li>`).join('')}</ul>
      </section>
      <section class="folha local"><h2>Depois do sim</h2>
        <ul class="lista-simples">${nos.sonhos.map((s, i) => `<li><span>${esc(s)}</span><button class="btn-x" type="button" data-acao="remover-sonho" data-i="${i}" aria-label="Remover">×</button></li>`).join('')}</ul>
        <form data-form="sonho" style="display:flex;gap:8px;margin-top:10px"><input type="text" name="sonho" placeholder="Mais um plano" required aria-label="Novo plano"><button class="btn btn-oliva" type="submit">Pôr</button></form>
      </section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Render e eventos
// ---------------------------------------------------------------------------

const TELAS = { caminho: telaCaminho, convidados: telaConvidados, dinheiro: telaDinheiro, fornecedores: telaFornecedores, dia: telaDia, nos: telaNos };

function render() {
  if (!estado.aberto) {
    app.innerHTML = telaCadeado();
    document.title = 'Nosso Sim';
    app.querySelector('[data-d="0"]')?.focus();
    return;
  }
  app.innerHTML = `${topo()}<main id="conteudo">${TELAS[estado.rota]()}</main>`;
  document.title = `${ROTAS.find(([id]) => id === estado.rota)[1]} | Nosso Sim`;
}

let tempoRecado;
function avisar(texto) {
  const el = document.getElementById('recado');
  el.textContent = texto;
  el.classList.add('visivel');
  clearTimeout(tempoRecado);
  tempoRecado = setTimeout(() => el.classList.remove('visivel'), 3600);
}

function manterRolagem(fn) {
  const y = window.scrollY;
  fn();
  window.scrollTo({ top: y });
}

const ACOES = {
  tema: () => {
    const escuro = document.documentElement.dataset.tema !== 'escuro';
    if (escuro) document.documentElement.dataset.tema = 'escuro'; else delete document.documentElement.dataset.tema;
    try { localStorage.setItem('nossosim:tema', escuro ? 'escuro' : 'claro'); } catch { /* ok */ }
  },
  trancar: () => {
    estado.aberto = false;
    try { sessionStorage.removeItem('nossosim:aberto'); } catch { /* ok */ }
    render();
  },
  rsvp: (el) => { estado.dados.convidados.find((x) => x.id === el.dataset.id).rsvp = el.dataset.v; salvar(); manterRolagem(render); },
  'remover-convidado': (el) => {
    const c = estado.dados.convidados.find((x) => x.id === el.dataset.id);
    if (!confirm(`Tirar ${c.nome} da lista?`)) return;
    estado.dados.convidados = estado.dados.convidados.filter((x) => x !== c);
    salvar(); manterRolagem(render);
  },
  'filtro-rsvp': (el) => { estado.filtroRsvp = el.dataset.v; manterRolagem(render); },
  'mover-forn': (el) => {
    const f = estado.dados.fornecedores.find((x) => x.id === el.dataset.id);
    f.status = el.dataset.para;
    if (f.status === 'contratado' && !f.parcelas.length) {
      const d = deIso(hoje);
      d.setMonth(d.getMonth() + 1, 5);
      f.parcelas = [{ vencimento: iso(d), valor: Number(f.valor), pago: false }];
    }
    salvar(); manterRolagem(render);
    if (f.status === 'contratado') avisar(`${f.nome} contratado. A parcela já aparece no caminho e no dinheiro.`);
  },
  'remover-roteiro': (el) => {
    estado.dados.dia.roteiro = estado.dados.dia.roteiro.filter((r) => !(r.hora === el.dataset.hora && r.oque === el.dataset.oque));
    salvar(); manterRolagem(render);
  },
  'remover-sonho': (el) => { estado.dados.nos.sonhos.splice(Number(el.dataset.i), 1); salvar(); manterRolagem(render); },
};

document.addEventListener('click', (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo) return;
  const acao = ACOES[alvo.dataset.acao];
  if (!acao) return;
  ev.preventDefault();
  acao(alvo);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.d !== undefined) {
    el.value = el.value.replace(/\D/g, '').slice(-1);
    const prox = app.querySelector(`[data-d="${Number(el.dataset.d) + 1}"]`);
    if (el.value && prox) prox.focus();
    conferirCodigo();
  }
});

document.addEventListener('keydown', (ev) => {
  const el = ev.target;
  if (el.dataset?.d !== undefined && ev.key === 'Backspace' && !el.value) {
    app.querySelector(`[data-d="${Number(el.dataset.d) - 1}"]`)?.focus();
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  const campo = el.dataset.campo;
  if (campo === 'tarefa') {
    const t = estado.dados.tarefas.find((x) => x.id === el.dataset.id);
    t.feita = el.checked;
    salvar();
    manterRolagem(render);
    if (t.feita) avisar(`Feito: ${t.titulo.toLowerCase()}.`);
    return;
  }
  if (campo === 'parcela') {
    const f = estado.dados.fornecedores.find((x) => x.id === el.dataset.f);
    f.parcelas[Number(el.dataset.i)].pago = el.checked;
    salvar(); manterRolagem(render);
    return;
  }
  if (campo === 'previsto') {
    estado.dados.orcamento[Number(el.dataset.i)].previsto = Number(el.value) || 0;
    salvar(); manterRolagem(render);
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target;
  const tipo = form.dataset.form;
  if (!tipo) return;
  ev.preventDefault();
  const f = new FormData(form);
  const d = estado.dados;
  if (tipo === 'cadeado') { conferirCodigo(); return; }
  if (tipo === 'tarefa') {
    d.tarefas.push({ id: `t${Date.now().toString(36)}`, titulo: String(f.get('titulo')).trim(), prazo: f.get('prazo') || hoje, quem: f.get('quem'), categoria: 'Geral', feita: false });
    salvar(); manterRolagem(render); avisar('Tarefa posta no mês do prazo.');
  }
  if (tipo === 'convidados') {
    const linhas = String(f.get('nomes')).split('\n').map((l) => l.trim()).filter(Boolean);
    for (const linha of linhas) {
      const acompanhantes = (linha.match(/\+1/g) || []).length;
      const criancas = (linha.match(/\+c\b/gi) || []).length;
      const nome = linha.replace(/\+1|\+c\b/gi, '').replace(/\s+/g, ' ').trim();
      if (nome) d.convidados.push({ id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, nome, lado: f.get('lado'), grupo: f.get('grupo'), acompanhantes, criancas, rsvp: 'sem resposta', mesa: '' });
    }
    salvar(); manterRolagem(render); avisar(`${linhas.length} convite(s) na lista.`);
  }
  if (tipo === 'cofre') {
    d.config.juntado += Number(f.get('deposito')) || 0;
    d.config.aporteMensal = Number(f.get('aporte')) || 0;
    d.config.orcamentoTotal = Number(f.get('total')) || d.config.orcamentoTotal;
    salvar(); manterRolagem(render); avisar('Números atualizados.');
  }
  if (tipo === 'fornecedor') {
    d.fornecedores.push({ id: `f${Date.now().toString(36)}`, categoria: f.get('categoria'), nome: String(f.get('nome')).trim(), status: 'pesquisando', valor: Number(f.get('valor')) || 0, contato: '', obs: '', parcelas: [] });
    salvar(); manterRolagem(render);
  }
  if (tipo === 'roteiro') {
    d.dia.roteiro.push({ hora: f.get('hora'), oque: String(f.get('oque')).trim() });
    salvar(); manterRolagem(render);
  }
  if (tipo === 'sonho') {
    d.nos.sonhos.push(String(f.get('sonho')).trim());
    salvar(); manterRolagem(render);
  }
});

function lerRota() {
  const id = location.hash.replace('#', '');
  estado.rota = TELAS[id] ? id : 'caminho';
}
window.addEventListener('hashchange', () => { lerRota(); render(); window.scrollTo({ top: 0 }); });

carregar();
lerRota();
render();
