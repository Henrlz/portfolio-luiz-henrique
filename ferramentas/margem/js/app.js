/* Margem — liga o fichário (entrada, capa, marcações, conferência, referência) à mesa de folhas. */

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const { textoDe, juntarRuns } = window.Ler;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const hoje = () => new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const CHAVE = 'margem:v1';
  const PADRAO = {
    capa: {
      instituicao: '', curso: '', autores: '', titulo: '', subtitulo: '', natureza: '', orientador: '', cidade: '',
      ano: String(new Date().getFullYear()), disciplina: '', data: hoje(), banca: '', dedicatoria: '', epigrafe: '', epigrafeAutor: ''
    },
    op: { norma: 'abnt', capa: true, rosto: true, aprovacao: false, listas: true, siglas: true, sumario: true, novaPagina: true, ordenarRefs: true, fonte: 'times', margens: false },
    blocos: [],
    codigos: {}
  };

  const estado = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(CHAVE));
      if (s) return { ...PADRAO, ...s, capa: { ...PADRAO.capa, ...s.capa }, op: { ...PADRAO.op, ...s.op }, codigos: s.codigos || {} };
    } catch (e) { /* segue com o padrão */ }
    return JSON.parse(JSON.stringify(PADRAO));
  })();

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); }
    catch (e) { /* texto grande demais pro storage (imagens, por exemplo): segue sem lembrar */ }
  }

  const apa = () => estado.op.norma === 'apa';

  /* ---------- abas ---------- */

  function abrirAba(nome) {
    $$('.aba').forEach((a) => a.setAttribute('aria-selected', String(a.dataset.aba === nome)));
    $$('.divisoria').forEach((d) => { d.hidden = d.dataset.painel !== nome; });
    $('.fichario').dataset.aba = nome;
    if (nome === 'confere') pintarConferencia();
  }
  $$('.aba').forEach((a) => a.addEventListener('click', () => abrirAba(a.dataset.aba)));

  /* ---------- o que falta na capa ---------- */

  const ROTULOS = {
    instituicao: 'instituição', autores: 'autor(es)', titulo: 'título', natureza: 'natureza do trabalho', cidade: 'cidade',
    ano: 'ano', disciplina: 'disciplina', orientador: 'professor(a)', data: 'data de entrega', curso: 'curso'
  };

  function faltando(op = estado.op) {
    const c = estado.capa;
    let campos;
    if (op.norma === 'apa') campos = ['titulo', 'autores', 'curso', 'instituicao', 'disciplina', 'orientador', 'data'];
    else {
      campos = [];
      if (op.capa) campos.push('instituicao', 'autores', 'titulo', 'cidade', 'ano');
      if (op.rosto || op.aprovacao) campos.push('autores', 'titulo', 'natureza', 'cidade', 'ano');
      if (!op.capa && !op.rosto && !op.aprovacao) campos.push('titulo');
    }
    return [...new Set(campos)].filter((k) => !(c[k] || '').trim());
  }

  function marcarFaltas() {
    const f = new Set(estado.blocos.length ? faltando() : []);
    $$('[data-capa]').forEach((el) => el.closest('.ficha__l, .campo-opc').classList.toggle('ficha__l--falta', f.has(el.dataset.capa)));
  }

  /* ---------- entrada ---------- */

  const aviso = $('#avisoEntrada');
  function avisar(msgs, erro, acoes) {
    if (!msgs || !msgs.length) { aviso.hidden = true; return; }
    aviso.hidden = false;
    aviso.className = 'aviso' + (erro ? ' aviso--erro' : '');
    aviso.innerHTML = msgs.map((m) => `<p>${esc(m)}</p>`).join('') +
      (acoes && acoes.length ? `<div class="linha-botoes">${acoes.map((a, k) => `<button type="button" class="btn ${k ? 'btn--linha' : 'btn--cheio'}" data-acao="${a.acao}">${esc(a.rotulo)}</button>`).join('')}</div>` : '');
  }
  // depois de ler o arquivo, o caminho curto: baixar já, ou completar só o que falta
  function acoesProntas() {
    const f = faltando();
    if (f.length) return [{ acao: 'preencher', rotulo: `Completar a capa (${f.length} campo${f.length > 1 ? 's' : ''})` }, { acao: 'docx', rotulo: 'Baixar mesmo assim' }];
    return [{ acao: 'docx', rotulo: 'Baixar .docx agora' }, { acao: 'pdf', rotulo: 'Salvar PDF' }];
  }
  aviso.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'preencher') irPreencher();
    if (b.dataset.acao === 'docx') baixar(estado.op);
    if (b.dataset.acao === 'pdf') imprimir(estado.op);
  });

  function receber(res, extra) {
    const { blocos, capa, temCapa } = window.Marcar.marcar(res.paras);
    if (!blocos.length) { avisar(['Não achei texto nenhum aí.'], true); return; }
    estado.blocos = blocos;
    estado.codigos = {};
    // arquivo novo, título novo: o subtítulo do trabalho anterior não pode sobrar
    if (capa.titulo) estado.capa.subtitulo = '';
    Object.keys(capa).forEach((k) => { if (capa[k]) estado.capa[k] = capa[k]; });
    preencherFicha();
    const n = blocos.filter((b) => b.tipo !== 'fora').length;
    const fora = blocos.filter((b) => b.tipo === 'fora').length;
    const msgs = [`${n} trechos marcados${fora ? `, ${fora} deixados de fora (capa, cabeçalho ou sumário antigo)` : ''}.`];
    if (temCapa) msgs.push('O arquivo já tinha capa: os dados foram pra ficha da aba Capa.');
    if (extra) msgs.push(extra);
    pintarBlocos();
    desenhar();
    salvar();
    avisar(msgs.concat(res.avisos || []), false, acoesProntas());
  }

  async function lerArquivo(file) {
    if (!file) return;
    $('#carregando').hidden = false;
    try {
      receber(await window.Ler.arquivo(file));
    } catch (e) {
      avisar([e.message || 'Não deu pra ler esse arquivo.'], true);
    } finally {
      $('#carregando').hidden = true;
    }
  }

  $('#arquivo').addEventListener('change', (ev) => { lerArquivo(ev.target.files[0]); ev.target.value = ''; });
  const bandeja = $('#bandeja');
  ['dragenter', 'dragover'].forEach((t) => bandeja.addEventListener(t, (ev) => { ev.preventDefault(); bandeja.classList.add('bandeja--sobre'); }));
  ['dragleave', 'drop'].forEach((t) => bandeja.addEventListener(t, () => bandeja.classList.remove('bandeja--sobre')));
  bandeja.addEventListener('drop', (ev) => { ev.preventDefault(); ev.stopPropagation(); lerArquivo(ev.dataTransfer.files[0]); });
  // soltar o arquivo fora da bandeja não deve abrir o arquivo no navegador
  window.addEventListener('dragover', (ev) => ev.preventDefault());
  window.addEventListener('drop', (ev) => { ev.preventDefault(); if (ev.dataTransfer.files[0]) lerArquivo(ev.dataTransfer.files[0]); });

  $('#usarColado').addEventListener('click', () => {
    const t = $('#colado').value;
    if (!t.trim()) { avisar(['A caixa está vazia.'], true); return; }
    receber(window.Ler.texto(t));
  });

  $('#exemplo').addEventListener('click', () => {
    Object.assign(estado.capa, window.EXEMPLO.capa);
    $('#colado').value = window.EXEMPLO.texto;
    receber(window.Ler.texto(window.EXEMPLO.texto), 'Exemplo fictício (autora, instituição, Moraes e os dados da tabela). Olha a aba Conferência: ela acha o que está fora da norma.');
  });

  /* ---------- capa, opções e norma ---------- */

  function preencherFicha() {
    $$('[data-capa]').forEach((el) => { el.value = estado.capa[el.dataset.capa] || ''; });
    $$('[data-op]').forEach((el) => { el.checked = !!estado.op[el.dataset.op]; });
    $$('input[name="fonte"]').forEach((el) => { el.checked = el.value === estado.op.fonte; });
    $('#verMargens').checked = !!estado.op.margens;
    pintarNorma();
    marcarFaltas();
  }

  function pintarNorma() {
    $('.fichario').dataset.norma = estado.op.norma;
    $$('.norma__b').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.norma === estado.op.norma)));
    $('#campoBanca').hidden = !estado.op.aprovacao;
  }

  $$('[data-capa]').forEach((el) => el.addEventListener('input', () => { estado.capa[el.dataset.capa] = el.value; marcarFaltas(); agendar(); }));
  $$('[data-op]').forEach((el) => el.addEventListener('change', () => { estado.op[el.dataset.op] = el.checked; pintarNorma(); marcarFaltas(); agendar(); }));
  $$('input[name="fonte"]').forEach((el) => el.addEventListener('change', () => { estado.op.fonte = el.value; agendar(); }));
  $$('.norma__b').forEach((b) => b.addEventListener('click', () => {
    estado.op.norma = b.dataset.norma;
    pintarNorma();
    marcarFaltas();
    atualizarRef();
    agendar();
  }));
  $('#verMargens').addEventListener('change', (ev) => {
    estado.op.margens = ev.target.checked;
    $('#paginas').classList.toggle('com-margens', estado.op.margens);
    salvar();
  });

  function irPreencher() {
    $('#faltaPainel').hidden = true;
    abrirAba('capa');
    const k = faltando()[0];
    const el = k && $(`[data-capa="${k}"]`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
  }

  /* ---------- padrões salvos ---------- */

  const CHAVE_PADROES = 'margem:padroes';
  const CAMPOS_PADRAO = ['instituicao', 'curso', 'natureza', 'orientador', 'cidade', 'disciplina', 'banca'];
  const OPS_PADRAO = ['norma', 'capa', 'rosto', 'aprovacao', 'listas', 'siglas', 'sumario', 'novaPagina', 'ordenarRefs', 'fonte'];
  const lerPadroes = () => { try { return JSON.parse(localStorage.getItem(CHAVE_PADROES)) || {}; } catch (e) { return {}; } };
  const gravarPadroes = (p) => { try { localStorage.setItem(CHAVE_PADROES, JSON.stringify(p)); return true; } catch (e) { return false; } };
  const notaPadrao = (t) => { $('#padraoNota').textContent = t; };

  function pintarPadroes(escolhido) {
    const p = lerPadroes();
    $('#padraoSel').innerHTML = '<option value="">— nenhum —</option>' + Object.keys(p).sort().map((n) => `<option>${esc(n)}</option>`).join('');
    if (escolhido) $('#padraoSel').value = escolhido;
  }
  function aplicarPadrao(pd) {
    CAMPOS_PADRAO.forEach((k) => { if (pd.capa && pd.capa[k] !== undefined) estado.capa[k] = pd.capa[k]; });
    OPS_PADRAO.forEach((k) => { if (pd.op && pd.op[k] !== undefined) estado.op[k] = pd.op[k]; });
    preencherFicha();
    atualizarRef();
    agendar();
  }
  $('#padraoSalvar').addEventListener('click', () => {
    const nome = $('#padraoNome').value.trim();
    if (!nome) { notaPadrao('Dá um nome pro padrão primeiro.'); $('#padraoNome').focus(); return; }
    const p = lerPadroes();
    p[nome] = {
      capa: Object.fromEntries(CAMPOS_PADRAO.map((k) => [k, estado.capa[k] || ''])),
      op: Object.fromEntries(OPS_PADRAO.map((k) => [k, estado.op[k]]))
    };
    notaPadrao(gravarPadroes(p) ? `“${nome}” salvo.` : 'O navegador não deixou salvar.');
    $('#padraoNome').value = '';
    pintarPadroes(nome);
  });
  $('#padraoAplicar').addEventListener('click', () => {
    const nome = $('#padraoSel').value;
    const pd = lerPadroes()[nome];
    if (!pd) { notaPadrao('Escolhe um padrão na lista.'); return; }
    aplicarPadrao(pd);
    notaPadrao(`“${nome}” aplicado.`);
  });
  $('#padraoApagar').addEventListener('click', () => {
    const nome = $('#padraoSel').value;
    const p = lerPadroes();
    if (!p[nome]) return;
    delete p[nome];
    gravarPadroes(p);
    pintarPadroes();
    notaPadrao(`“${nome}” apagado.`);
  });
  $('#padraoExportar').addEventListener('click', () => {
    const p = lerPadroes();
    if (!Object.keys(p).length) { notaPadrao('Ainda não tem padrão salvo pra exportar.'); return; }
    baixarArquivo(new Blob([JSON.stringify({ margem: 1, padroes: p }, null, 2)], { type: 'application/json' }), 'padroes-margem.json');
  });
  $('#padraoImportar').addEventListener('change', async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    try {
      const dados = JSON.parse(await f.text());
      const novos = dados && dados.padroes;
      if (!novos || typeof novos !== 'object') throw new Error();
      const p = lerPadroes();
      let n = 0;
      // só os campos conhecidos entram: o arquivo vem de outra pessoa
      Object.entries(novos).forEach(([nome, pd]) => {
        if (!pd || typeof pd !== 'object') return;
        p[String(nome).slice(0, 60)] = {
          capa: Object.fromEntries(CAMPOS_PADRAO.map((k) => [k, String((pd.capa || {})[k] || '').slice(0, 600)])),
          op: Object.fromEntries(OPS_PADRAO.filter((k) => pd.op && pd.op[k] !== undefined).map((k) => [k, k === 'norma' ? (pd.op[k] === 'apa' ? 'apa' : 'abnt') : k === 'fonte' ? (pd.op[k] === 'arial' ? 'arial' : 'times') : !!pd.op[k]]))
        };
        n++;
      });
      gravarPadroes(p);
      pintarPadroes();
      notaPadrao(`${n} padrão${n === 1 ? '' : 'ões'} importado${n === 1 ? '' : 's'}.`);
    } catch (e) {
      notaPadrao('Esse arquivo não é um padrão exportado pelo Margem.');
    }
  });

  /* ---------- marcações ---------- */

  const TIPOS = [
    ['titulo:1', 'Título 1'], ['titulo:2', 'Título 2'], ['titulo:3', 'Título 3'], ['titulo:4', 'Título 4'], ['titulo:5', 'Título 5'],
    ['secao', 'Seção sem número'], ['p', 'Parágrafo'], ['cit', 'Citação longa'], ['li', 'Alínea'],
    ['ref', 'Referência'], ['chave', 'Palavras-chave'], ['capa', 'Título do trabalho'], ['fora', 'Fora do trabalho']
  ];
  const ROT_TABELA = ['Tabela', 'Quadro'];
  const ROT_FIGURA = ['Figura', 'Gráfico', 'Fotografia', 'Mapa', 'Esquema', 'Diagrama', 'Fluxograma'];
  const valorTipo = (b) => (b.tipo === 'titulo' ? 'titulo:' + (b.nivel || 1) : b.tipo === 'subtitulo' ? 'capa' : b.tipo);

  function linhaIlu(b, i) {
    const rots = b.tipo === 'tabela' ? ROT_TABELA : ROT_FIGURA;
    const amostra = b.tipo === 'tabela'
      ? `<span class="bl__tab">${esc((b.linhas || []).length)} linhas × ${esc(((b.linhas || [])[0] || []).length)} colunas · ${esc(((b.linhas || [])[0] || []).join(' | ').slice(0, 60))}</span>`
      : `<img class="bl__img" src="${b.src}" alt="">`;
    return `<li class="bl bl--ilu${b.fora ? ' bl--fora' : ''}" data-id="${b.id}">
      <button type="button" class="bl__txt" data-ir="${b.id}"><mark class="mk mk--ilu">${esc(b.rotulo || '')}</mark> ${amostra}</button>
      <div class="bl__ctl">
        <select aria-label="Tipo da ilustração ${i + 1}" data-rotulo="${b.id}">${rots.map((r) => `<option${r === b.rotulo ? ' selected' : ''}>${r}</option>`).join('')}<option value="__fora">Tirar do trabalho</option></select>
        ${i ? `<button type="button" class="bl__juntar" data-subir="${b.id}" title="Trocar de lugar com o trecho de cima">subir ↑</button>` : ''}
      </div>
      <label class="bl__campo"><span>Título</span><input data-legenda="${b.id}" value="${esc(b.legenda || '')}" placeholder="O que a ${esc((b.rotulo || '').toLowerCase())} mostra"></label>
      <label class="bl__campo"><span>Fonte</span><input data-fonte="${b.id}" value="${esc(b.fonte || '')}" placeholder="${apa() ? '(opcional na APA)' : 'Vazio = elaborado pelo autor (ano)'}"></label>
    </li>`;
  }

  function pintarBlocos() {
    const ol = $('#blocos');
    $('#semBlocos').hidden = estado.blocos.length > 0;
    $('#nMarcas').textContent = estado.blocos.length ? estado.blocos.length : '';
    const opts = TIPOS.map(([v, r]) => `<option value="${v}">${r}</option>`).join('');
    ol.innerHTML = estado.blocos.map((b, i) => {
      if (b.tipo === 'tabela' || b.tipo === 'figura') return linhaIlu(b, i);
      const t = textoDe(b.runs);
      const curto = t.length > 220 ? t.slice(0, 220) + '…' : t;
      const tipo = b.tipo === 'titulo' ? 'titulo' : b.tipo === 'subtitulo' ? 'capa' : b.tipo;
      const marca = tipo === 'fora' ? `<s class="mk mk--fora">${esc(curto)}</s>` : tipo === 'p' ? esc(curto) : `<mark class="mk mk--${tipo}">${esc(curto)}</mark>`;
      const nNotas = b.runs.filter((r) => r.nota).length;
      return `<li class="bl bl--${tipo}${b.tipo === 'titulo' ? ' bl--n' + b.nivel : ''}" data-id="${b.id}">
        <button type="button" class="bl__txt" data-ir="${b.id}">${marca}${nNotas ? `<em class="bl__motivo">${nNotas} nota${nNotas > 1 ? 's' : ''} de rodapé</em>` : ''}${b.motivo ? `<em class="bl__motivo">${esc(b.motivo)}</em>` : ''}</button>
        <div class="bl__ctl">
          <select aria-label="Tipo do trecho ${i + 1}" data-tipo="${b.id}">${opts}</select>
          ${i ? `<button type="button" class="bl__juntar" data-juntar="${b.id}" title="Juntar com o trecho de cima (quando um parágrafo veio partido)">juntar ↑</button>` : ''}
        </div>
      </li>`;
    }).join('');
    estado.blocos.forEach((b) => { const s = ol.querySelector(`[data-tipo="${b.id}"]`); if (s) s.value = valorTipo(b); });
  }

  const acharBloco = (id) => estado.blocos.find((x) => x.id === id);

  $('#blocos').addEventListener('change', (ev) => {
    const r = ev.target.dataset.rotulo;
    if (r) {
      const b = acharBloco(r);
      if (ev.target.value === '__fora') {
        estado.blocos.splice(estado.blocos.indexOf(b), 1);
        pintarBlocos();
      } else b.rotulo = ev.target.value;
      agendar();
      return;
    }
    const id = ev.target.dataset.tipo;
    if (!id) return;
    const b = acharBloco(id);
    const [tipo, nivel] = ev.target.value.split(':');
    b.tipo = tipo;
    delete b.motivo;
    if (tipo === 'titulo') b.nivel = +nivel;
    if (tipo === 'secao') {
      b.papel = window.Marcar.papelManual(b.runs);
      b.runs = [{ t: textoDe(b.runs).toLocaleUpperCase('pt-BR'), b: false, i: false }];
    }
    if (tipo === 'capa') {
      estado.capa.titulo = textoDe(b.runs);
      preencherFicha();
    }
    pintarBlocos();
    agendar();
  });

  $('#blocos').addEventListener('input', (ev) => {
    const l = ev.target.dataset.legenda, f = ev.target.dataset.fonte;
    if (l) acharBloco(l).legenda = ev.target.value;
    if (f) acharBloco(f).fonte = ev.target.value;
    if (l || f) agendar();
  });

  $('#blocos').addEventListener('click', (ev) => {
    const j = ev.target.closest('[data-juntar]');
    if (j) {
      const i = estado.blocos.findIndex((x) => x.id === j.dataset.juntar);
      const ant = estado.blocos[i - 1], cur = estado.blocos[i];
      if (!ant.runs || !ant.runs.length) return;
      const t = textoDe(ant.runs);
      const cola = /-$/.test(t) && /^[a-zà-ÿ]/.test(textoDe(cur.runs)) ? [] : [{ t: ' ' }];
      if (cola.length === 0) ant.runs[ant.runs.length - 1].t = ant.runs[ant.runs.length - 1].t.replace(/-$/, '');
      ant.runs = juntarRuns(ant.runs.concat(cola, cur.runs));
      estado.blocos.splice(i, 1);
      pintarBlocos();
      agendar();
      return;
    }
    const s = ev.target.closest('[data-subir]');
    if (s) {
      const i = estado.blocos.findIndex((x) => x.id === s.dataset.subir);
      [estado.blocos[i - 1], estado.blocos[i]] = [estado.blocos[i], estado.blocos[i - 1]];
      pintarBlocos();
      agendar();
      return;
    }
    const ir = ev.target.closest('[data-ir]');
    if (ir) irPara(ir.dataset.ir);
  });

  function irPara(id) {
    const alvo = $(`#paginas [data-id="${id}"]`);
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alvo.classList.remove('piscando');
    void alvo.offsetWidth;
    alvo.classList.add('piscando');
  }

  // clicar num trecho da folha leva à marcação dele
  $('#paginas').addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-id]');
    if (!el || !estado.blocos.length) return;
    abrirAba('marcas');
    const li = $(`#blocos [data-id="${el.dataset.id}"]`);
    if (li) {
      li.scrollIntoView({ behavior: 'smooth', block: 'center' });
      li.classList.remove('piscando');
      void li.offsetWidth;
      li.classList.add('piscando');
    }
  });

  /* ---------- conferência ---------- */

  let achadosAtuais = [];

  // referências que ainda estão em ABNT quando o trabalho sai em APA
  function refsParaApa() {
    if (!apa()) return [];
    return estado.blocos.filter((b) => b.tipo === 'ref').map((b) => {
      const t = textoDe(b.runs);
      if (!/^[A-ZÀ-Ý' -]{2,}[,.]/.test(t)) return null;   // já começa como APA (Sobrenome, I.)
      return { bloco: b.id, texto: t, apa: window.Referencia.abntParaApa(t) };
    }).filter(Boolean);
  }

  function pintarConferencia() {
    const box = $('#conferencia');
    if (!estado.blocos.length) { box.innerHTML = '<p class="vazio">Nenhum texto ainda.</p>'; return; }
    const r = window.Conferir.tudo(estado.blocos, estado.op.norma);
    const conv = refsParaApa();
    achadosAtuais = r.outros;

    const nota = (texto, mao, id) => `<li><button type="button" class="nota" data-ir="${id}"><span class="nota__alvo">${esc(texto)}</span><span class="nota__mao">${mao}</span></button></li>`;
    const itemSig = (x, k) => {
      const trecho = esc(x.trecho).split(esc(x.alvo)).join(`<mark>${esc(x.alvo)}</mark>`);
      let acao = 'omitir';
      if (x.tipo === 'nome') acao = `trocar por ${estado.codigos[x.alvo] || String.fromCharCode(65 + Object.keys(estado.codigos).length % 26)}`;
      if (x.tipo === 'combo') acao = 'trocar a idade por faixa';
      return `<li class="sig"><p class="sig__rot">${esc(x.rotulo)}${x.detalhe ? ' · ' + esc(x.detalhe) : ''}</p><p class="sig__trecho">${trecho}</p>
        <div class="linha-botoes"><button type="button" class="btn-mini btn-mini--forte" data-anon="${k}">${acao}</button><button type="button" class="btn-mini" data-ir="${x.bloco}">ver na folha</button></div></li>`;
    };
    const achado = (x) => `<li class="sig sig--leve"><p class="sig__rot">${esc(x.rotulo)}</p>${x.trecho ? `<p class="sig__trecho">${esc(x.trecho)}</p>` : ''}<p class="sig__msg">${esc(x.msg)}</p>
      <div class="linha-botoes">${x.conserto ? `<button type="button" class="btn-mini btn-mini--forte" data-conserto="${achadosAtuais.indexOf(x)}">${esc(x.conserto.rotulo)}</button>` : ''}<button type="button" class="btn-mini" data-ir="${x.bloco}">ver na folha</button></div></li>`;
    const grupo = (g) => r.outros.filter((x) => x.grupo === g);
    const secao = (titulo, itens, vazio) => `<h3 class="sub">${titulo}</h3>` + (itens.length ? `<ol class="lista-sig">${itens.map(achado).join('')}</ol>` : `<p class="ok">${vazio}</p>`);

    box.innerHTML = `
      <div class="placar">
        <div><b>${r.cruz.totalCitacoes}</b><span>citações no texto</span></div>
        <div><b>${r.cruz.totalRefs}</b><span>referências na lista</span></div>
        <div class="${r.total ? 'placar--alerta' : ''}"><b>${r.total + conv.length}</b><span>pontos pra olhar</span></div>
      </div>

      <h3 class="sub">Sigilo</h3>
      ${r.sigilo.length
        ? `<p class="explica">O Código de Ética do psicólogo (art. 9º) pede sigilo sobre quem é atendido. Estes trechos podem identificar alguém:</p><ol class="lista-sig">${r.sigilo.map(itemSig).join('')}</ol>`
        : '<p class="ok">Nenhum nome de paciente, documento, contato ou combinação de idade com profissão ou cidade.</p>'}
      <p class="miudo">A busca é automática e não pega tudo. A leitura final é sua.</p>

      ${secao('Resumo e palavras-chave', grupo('resumo'), 'Resumo e palavras-chave dentro da norma (ou o trabalho não tem resumo).')}
      ${secao('Citações diretas', grupo('diretas'), 'Toda citação direta tem autor, ano e página.')}
      ${grupo('diretas').length ? '<p class="miudo">Fala de paciente entre aspas também aparece aqui: nesse caso, pode ignorar.</p>' : ''}

      <h3 class="sub">Citado, mas sem referência</h3>
      ${r.cruz.semRef.length ? `<ol class="notas">${r.cruz.semRef.map((x) => nota(x.texto, 'cadê a referência?', x.bloco)).join('')}</ol>` : '<p class="ok">Toda citação encontrou a sua referência.</p>'}

      <h3 class="sub">Na lista, mas nunca citado</h3>
      ${r.cruz.naoCitadas.length ? `<ol class="notas">${r.cruz.naoCitadas.map((x) => nota(x.texto.length > 110 ? x.texto.slice(0, 110) + '…' : x.texto, 'não aparece no texto', x.bloco)).join('')}</ol>` : '<p class="ok">Toda referência foi citada no texto.</p>'}

      ${apa()
        ? `<h3 class="sub">Referências em ABNT → APA</h3>${conv.length
          ? `<p class="explica">A lista ainda está no formato ABNT. Confere cada conversão antes de trocar.</p>${conv.some((c) => c.apa) ? '<div class="linha-botoes"><button type="button" class="btn-mini btn-mini--forte" data-converter="todas">converter todas as reconhecidas</button></div>' : ''}<ol class="lista-sig">${conv.map((c, k) => `<li class="sig sig--leve"><p class="sig__trecho">${esc(c.texto)}</p>${c.apa
            ? `<p class="sig__msg">→ ${c.apa.runs.map((x) => (x.i ? `<i>${esc(x.t)}</i>` : esc(x.t))).join('')}</p>${c.apa.aviso ? `<p class="miudo">${esc(c.apa.aviso)}</p>` : ''}<div class="linha-botoes"><button type="button" class="btn-mini btn-mini--forte" data-converter="${k}">trocar</button></div>`
            : '<p class="sig__msg">Não reconheci o formato desta: refaz no montador da aba Referência.</p>'}</li>`).join('')}</ol>`
          : '<p class="ok">As referências já estão no formato APA.</p>'}`
        : secao('Formato das referências', grupo('refs'), 'Nenhum erro comum de formato nas referências.')}

      ${secao('Tabelas e ilustrações', grupo('ilu'), 'Toda tabela e ilustração tem título e fonte.')}
      <p class="miudo">Pega citações no formato (SOBRENOME, ano) e Sobrenome (ano), inclusive ano duplo como Freud (1912/2010).</p>`;

    box._sig = r.sigilo;
    box._conv = conv;
  }

  $('#conferencia').addEventListener('click', (ev) => {
    const box = $('#conferencia');
    const a = ev.target.closest('[data-anon]');
    const c = ev.target.closest('[data-conserto]');
    const cv = ev.target.closest('[data-converter]');
    if (a) window.Conferir.anonimizar(estado.blocos, box._sig[+a.dataset.anon], estado.codigos);
    else if (c) window.Conferir.corrigir(estado.blocos, achadosAtuais[+c.dataset.conserto].conserto);
    else if (cv) {
      const lista = cv.dataset.converter === 'todas' ? box._conv : [box._conv[+cv.dataset.converter]];
      lista.forEach((x) => { if (x && x.apa) acharBloco(x.bloco).runs = x.apa.runs; });
    } else {
      const ir = ev.target.closest('[data-ir]');
      if (ir) irPara(ir.dataset.ir);
      return;
    }
    pintarBlocos();
    desenhar();
    salvar();
    pintarConferencia();
  });

  /* ---------- montador de referência ---------- */

  const CAMPOS = {
    livro: [['autores', 'Autor(es)', 'area', 'Nome completo, um por linha'], ['titulo', 'Título'], ['subtitulo', 'Subtítulo'], ['edicao', 'Edição', '', '2 (deixa vazio se for a 1ª)'], ['local', 'Cidade'], ['editora', 'Editora'], ['ano', 'Ano']],
    capitulo: [['autores', 'Autor(es) do capítulo', 'area', 'Um por linha'], ['titulo', 'Título do capítulo'], ['organizadores', 'Organizador(es) do livro', 'area', 'Um por linha'], ['livro', 'Título do livro'], ['edicao', 'Edição'], ['local', 'Cidade'], ['editora', 'Editora'], ['ano', 'Ano'], ['paginas', 'Páginas', '', '45-67']],
    artigo: [['autores', 'Autor(es)', 'area', 'Um por linha'], ['titulo', 'Título do artigo'], ['subtitulo', 'Subtítulo'], ['revista', 'Revista'], ['local', 'Cidade da revista'], ['volume', 'Volume'], ['numero', 'Número'], ['paginas', 'Páginas', '', '12-30'], ['ano', 'Ano'], ['doi', 'DOI'], ['url', 'Link'], ['acesso', 'Acessado em', 'date']],
    site: [['autores', 'Autor(es)', 'area', 'Pessoa ou instituição'], ['titulo', 'Título da página'], ['subtitulo', 'Subtítulo'], ['local', 'Cidade'], ['ano', 'Ano'], ['url', 'Link'], ['acesso', 'Acessado em', 'date']],
    norma: [['autores', 'Órgão', 'area', 'Conselho Federal de Psicologia'], ['titulo', 'Documento', '', 'Resolução nº 6, de 29 de março de 2019'], ['ementa', 'Ementa', 'area', 'O que a norma faz'], ['local', 'Cidade'], ['editora', 'Publicado por'], ['ano', 'Ano'], ['url', 'Link'], ['acesso', 'Acessado em', 'date']]
  };
  const NOMES_TIPO = { livro: 'Livro', capitulo: 'Capítulo', artigo: 'Artigo', site: 'Site', norma: 'Resolução' };
  const ref = { tipo: 'livro', c: { entidade: false } };

  function pintarTipos() {
    $('#tiposRef').innerHTML = Object.keys(CAMPOS).map((t) =>
      `<button type="button" role="radio" aria-checked="${t === ref.tipo}" class="tipo${t === ref.tipo ? ' tipo--on' : ''}" data-t="${t}">${NOMES_TIPO[t]}</button>`).join('');
  }

  function pintarCampos() {
    const f = $('#camposRef');
    f.innerHTML = CAMPOS[ref.tipo].map(([k, rot, tipo, ph]) => {
      const v = esc(ref.c[k] || '');
      const campo = tipo === 'area'
        ? `<textarea data-k="${k}" rows="2" placeholder="${esc(ph || '')}">${v}</textarea>`
        : `<input data-k="${k}" type="${tipo === 'date' ? 'date' : 'text'}" value="${v}" placeholder="${esc(ph || '')}">`;
      const extra = k === 'autores' && ref.tipo !== 'norma'
        ? `<label class="chave chave--mini"><input type="checkbox" data-k="entidade" ${ref.c.entidade ? 'checked' : ''}><span>é uma instituição</span></label>` : '';
      return `<label class="cr"><span>${rot}</span>${campo}${extra}</label>`;
    }).join('');
    atualizarRef();
  }

  const htmlRef = (runs) => runs.map((x) => (x.b ? `<b>${esc(x.t)}</b>` : x.i ? `<i>${esc(x.t)}</i>` : esc(x.t))).join('');
  function atualizarRef() {
    const r = window.Referencia.montar(ref.tipo, ref.c, estado.op.norma);
    $('#saidaRef').innerHTML = htmlRef(r.runs);
    $('#saidaRef').dataset.norma = apa() ? 'APA 7' : 'NBR 6023';
    ref.saida = r;
  }

  $('#tiposRef').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-t]');
    if (!b) return;
    ref.tipo = b.dataset.t;
    // trocar de tipo depois de um atalho é começar outra obra: o DSM não pode vazar pro artigo
    if (ref.pronta) { ref.c = { entidade: false }; ref.pronta = false; $('#notaRef').textContent = ''; }
    pintarTipos();
    pintarCampos();
  });
  $('#camposRef').addEventListener('input', (ev) => {
    const k = ev.target.dataset.k;
    if (!k) return;
    ref.c[k] = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    ref.pronta = false;
    atualizarRef();
  });
  $$('[data-pronta]').forEach((b) => b.addEventListener('click', () => {
    const p = window.Referencia.PRONTAS[b.dataset.pronta];
    ref.tipo = p.tipo;
    ref.c = { ...p.campos };
    ref.pronta = true;
    pintarTipos();
    pintarCampos();
    $('#notaRef').textContent = 'Confere com a edição que você leu: ano e editora mudam entre impressões.';
  }));

  $('#limparRef').addEventListener('click', () => {
    ref.c = { entidade: false };
    ref.pronta = false;
    $('#notaRef').textContent = '';
    pintarCampos();
  });

  $('#copiarRef').addEventListener('click', async () => {
    const r = ref.saida;
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([htmlRef(r.runs)], { type: 'text/html' }), 'text/plain': new Blob([r.texto], { type: 'text/plain' }) })]);
      } else await navigator.clipboard.writeText(r.texto);
      $('#notaRef').textContent = apa() ? 'Copiado, com o itálico junto.' : 'Copiado, com o negrito junto.';
    } catch (e) {
      $('#notaRef').textContent = 'O navegador não deixou copiar. Seleciona o texto acima e copia na mão.';
    }
  });

  $('#porRef').addEventListener('click', () => {
    const r = ref.saida;
    const novo = { id: window.Marcar.novoId(), tipo: 'ref', runs: r.runs };
    const iSec = estado.blocos.findIndex((b) => b.tipo === 'secao' && b.papel === 'refs');
    if (iSec < 0) {
      estado.blocos.push({ id: window.Marcar.novoId(), tipo: 'secao', papel: 'refs', runs: [{ t: 'REFERÊNCIAS', b: false, i: false }] }, novo);
    } else {
      let j = iSec + 1;
      while (j < estado.blocos.length && estado.blocos[j].tipo === 'ref') j++;
      estado.blocos.splice(j, 0, novo);
    }
    pintarBlocos();
    agendar();
    $('#notaRef').textContent = 'Foi pra lista de referências. Já aparece na folha.';
  });

  /* ---------- mesa ---------- */

  let ultimo = null;
  let timer = null;
  function agendar() {
    clearTimeout(timer);
    timer = setTimeout(desenhar, 180);
    salvar();
  }

  function escala() {
    const base = $('#base');
    const disponivel = base.clientWidth - 40;
    const s = Math.min(1, Math.max(0.3, disponivel / 794));
    base.style.setProperty('--s', s.toFixed(4));
  }

  function desenhar(op = estado.op) {
    const pag = $('#paginas');
    pag.classList.toggle('f-arial', op.fonte === 'arial');
    pag.classList.toggle('com-margens', !!op.margens);

    if (!estado.blocos.length) {
      pag.classList.remove('apa');
      pag.innerHTML = `<div class="moldura"><article class="folha folha--vazia"><div class="folha__corpo">
        <p class="vazia__grande">As folhas aparecem aqui.</p>
        <p class="vazia__peq">Manda um arquivo, cola o texto ou abre o exemplo na aba Texto.</p></div></article></div>`;
      $('#conta').textContent = 'Nenhuma folha ainda';
      $('#baixarDocx').disabled = $('#imprimir').disabled = true;
      $('#nConfere').textContent = '';
      ultimo = null;
      return;
    }

    const modelo = window.Marcar.montar(estado.blocos, op);
    const res = window.Folhas.render(pag, modelo, estado.capa, op);
    $$('.notas', pag).forEach((n) => n.classList.add('notas--pe'));
    ultimo = { modelo, res, op };

    const palavras = estado.blocos.filter((b) => !['fora', 'capa', 'subtitulo'].includes(b.tipo))
      .reduce((n, b) => n + (textoDe(b.runs || []).match(/\S+/g) || []).length, 0);
    $('#conta').innerHTML = `<b>${res.folhas}</b> folha${res.folhas > 1 ? 's' : ''} · ${palavras.toLocaleString('pt-BR')} palavras`;
    $('#baixarDocx').disabled = $('#imprimir').disabled = false;

    const conf = window.Conferir.tudo(estado.blocos, op.norma);
    const prob = conf.total + refsParaApa().length;
    $('#nConfere').textContent = prob || '';
    marcarFaltas();
    if ($('.fichario').dataset.aba === 'confere') pintarConferencia();
  }

  const nomeArquivo = (op) => {
    const base = (estado.capa.titulo || 'trabalho').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    return (base || 'trabalho') + (op.norma === 'apa' ? '-apa' : '-abnt');
  };

  function baixarArquivo(blob, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // antes de sair, o que falta na capa: nunca vai "[instituição]" para o professor
  let pendente = null;
  function conferirAntes(acao) {
    const f = faltando();
    if (!f.length) return true;
    pendente = acao;
    $('#faltaMsg').textContent = `Falta na ${apa() ? 'folha de rosto' : 'capa'}: ${f.map((k) => ROTULOS[k] || k).join(', ')}.`;
    $('#faltaSemCapa').hidden = apa() || (!estado.op.capa && !estado.op.rosto && !estado.op.aprovacao);
    $('#faltaPainel').hidden = false;
    return false;
  }
  $('#faltaPreencher').addEventListener('click', irPreencher);
  $('#faltaCancelar').addEventListener('click', () => { $('#faltaPainel').hidden = true; pendente = null; });
  $('#faltaSemCapa').addEventListener('click', () => {
    $('#faltaPainel').hidden = true;
    const op = { ...estado.op, capa: false, rosto: false, aprovacao: false };
    if (pendente === 'pdf') imprimir(op, true);
    else baixar(op, true);
    pendente = null;
  });

  async function baixar(op = estado.op, semConferir) {
    if (!semConferir && !conferirAntes('docx')) return;
    const btn = $('#baixarDocx');
    btn.disabled = true;
    try {
      const modelo = window.Marcar.montar(estado.blocos, op);
      // a paginação do sumário vem da prévia com as mesmas opções
      const res = op === estado.op && ultimo ? ultimo.res : (() => {
        const r = window.Folhas.render($('#paginas'), modelo, estado.capa, op);
        desenhar();
        return r;
      })();
      const blob = await window.Docx.gerar(modelo, estado.capa, op, res.paginaDe);
      baixarArquivo(blob, nomeArquivo(op) + '.docx');
    } catch (e) {
      avisar([e.message || 'Não deu pra gerar o .docx.'], true);
      abrirAba('texto');
    } finally {
      btn.disabled = false;
    }
  }

  function imprimir(op = estado.op, semConferir) {
    if (!semConferir && !conferirAntes('pdf')) return;
    const antigo = document.title;
    document.title = nomeArquivo(op);
    if (op !== estado.op) desenhar(op);
    window.print();
    document.title = antigo;
    if (op !== estado.op) desenhar();
  }

  $('#baixarDocx').addEventListener('click', () => baixar());
  $('#imprimir').addEventListener('click', () => imprimir());

  window.addEventListener('resize', escala);

  /* ---------- começo ---------- */

  pintarTipos();
  pintarCampos();
  pintarPadroes();
  preencherFicha();
  pintarBlocos();
  escala();
  desenhar();
  if (estado.blocos.length) abrirAba('marcas');
  // a fonte da folha muda a quebra de linha: redesenha quando ela termina de carregar
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { escala(); desenhar(); });
})();
