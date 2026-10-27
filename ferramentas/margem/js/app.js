/* Margem — liga o fichário (entrada, capa, marcações, conferência, referência) à mesa de folhas. */

(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const { textoDe, juntarRuns } = window.Ler;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CHAVE = 'margem:v1';
  const PADRAO = {
    capa: { instituicao: '', curso: '', autores: '', titulo: '', subtitulo: '', natureza: '', orientador: '', cidade: '', ano: String(new Date().getFullYear()) },
    op: { capa: true, rosto: true, sumario: true, novaPagina: true, ordenarRefs: true, fonte: 'times', margens: false },
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
    catch (e) { /* texto grande demais pro storage: segue sem lembrar */ }
  }

  /* ---------- abas ---------- */

  function abrirAba(nome) {
    $$('.aba').forEach((a) => a.setAttribute('aria-selected', String(a.dataset.aba === nome)));
    $$('.divisoria').forEach((d) => { d.hidden = d.dataset.painel !== nome; });
    $('.fichario').dataset.aba = nome;
    if (nome === 'confere') pintarConferencia();
  }
  $$('.aba').forEach((a) => a.addEventListener('click', () => abrirAba(a.dataset.aba)));

  /* ---------- entrada ---------- */

  const aviso = $('#avisoEntrada');
  function avisar(msgs, erro) {
    if (!msgs || !msgs.length) { aviso.hidden = true; return; }
    aviso.hidden = false;
    aviso.className = 'aviso' + (erro ? ' aviso--erro' : '');
    aviso.innerHTML = msgs.map((m) => `<p>${esc(m)}</p>`).join('');
  }

  function receber(res) {
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
    if (temCapa) msgs.push('O arquivo já tinha capa: os dados foram pra ficha da aba Capa. Confere lá.');
    avisar(msgs.concat(res.avisos || []));
    pintarBlocos();
    agendar();
    abrirAba('marcas');
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
  bandeja.addEventListener('drop', (ev) => { ev.preventDefault(); lerArquivo(ev.dataTransfer.files[0]); });
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
    receber(window.Ler.texto(window.EXEMPLO.texto));
    avisar(['Exemplo carregado: autora, instituição e a obra de Moraes são fictícias. Dá uma olhada na aba Conferência.']);
  });

  /* ---------- capa e opções ---------- */

  function preencherFicha() {
    $$('[data-capa]').forEach((el) => { el.value = estado.capa[el.dataset.capa] || ''; });
    $$('[data-op]').forEach((el) => { el.checked = !!estado.op[el.dataset.op]; });
    $$('input[name="fonte"]').forEach((el) => { el.checked = el.value === estado.op.fonte; });
    $('#verMargens').checked = !!estado.op.margens;
  }
  $$('[data-capa]').forEach((el) => el.addEventListener('input', () => { estado.capa[el.dataset.capa] = el.value; agendar(); }));
  $$('[data-op]').forEach((el) => el.addEventListener('change', () => { estado.op[el.dataset.op] = el.checked; agendar(); }));
  $$('input[name="fonte"]').forEach((el) => el.addEventListener('change', () => { estado.op.fonte = el.value; agendar(); }));
  $('#verMargens').addEventListener('change', (ev) => {
    estado.op.margens = ev.target.checked;
    $('#paginas').classList.toggle('com-margens', estado.op.margens);
    salvar();
  });

  /* ---------- marcações ---------- */

  const TIPOS = [
    ['titulo:1', 'Título 1'], ['titulo:2', 'Título 2'], ['titulo:3', 'Título 3'], ['titulo:4', 'Título 4'], ['titulo:5', 'Título 5'],
    ['secao', 'Seção sem número'], ['p', 'Parágrafo'], ['cit', 'Citação longa'], ['li', 'Alínea'],
    ['ref', 'Referência'], ['chave', 'Palavras-chave'], ['capa', 'Título do trabalho'], ['fora', 'Fora do trabalho']
  ];
  const valorTipo = (b) => (b.tipo === 'titulo' ? 'titulo:' + (b.nivel || 1) : b.tipo === 'subtitulo' ? 'capa' : b.tipo);

  function pintarBlocos() {
    const ol = $('#blocos');
    $('#semBlocos').hidden = estado.blocos.length > 0;
    $('#nMarcas').textContent = estado.blocos.length ? estado.blocos.length : '';
    const opts = TIPOS.map(([v, r]) => `<option value="${v}">${r}</option>`).join('');
    ol.innerHTML = estado.blocos.map((b, i) => {
      const t = textoDe(b.runs);
      const curto = t.length > 220 ? t.slice(0, 220) + '…' : t;
      const tipo = b.tipo === 'titulo' ? 'titulo' : b.tipo === 'subtitulo' ? 'capa' : b.tipo;
      const marca = tipo === 'fora' ? `<s class="mk mk--fora">${esc(curto)}</s>` : tipo === 'p' ? esc(curto) : `<mark class="mk mk--${tipo}">${esc(curto)}</mark>`;
      return `<li class="bl bl--${tipo}${b.tipo === 'titulo' ? ' bl--n' + b.nivel : ''}" data-id="${b.id}">
        <button type="button" class="bl__txt" data-ir="${b.id}">${marca}${b.motivo ? `<em class="bl__motivo">${esc(b.motivo)}</em>` : ''}</button>
        <div class="bl__ctl">
          <select aria-label="Tipo do trecho ${i + 1}" data-tipo="${b.id}">${opts}</select>
          ${i ? `<button type="button" class="bl__juntar" data-juntar="${b.id}" title="Juntar com o trecho de cima (quando um parágrafo veio partido)">juntar ↑</button>` : ''}
        </div>
      </li>`;
    }).join('');
    estado.blocos.forEach((b) => { const s = ol.querySelector(`[data-tipo="${b.id}"]`); if (s) s.value = valorTipo(b); });
  }

  $('#blocos').addEventListener('change', (ev) => {
    const id = ev.target.dataset.tipo;
    if (!id) return;
    const b = estado.blocos.find((x) => x.id === id);
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

  $('#blocos').addEventListener('click', (ev) => {
    const j = ev.target.closest('[data-juntar]');
    if (j) {
      const i = estado.blocos.findIndex((x) => x.id === j.dataset.juntar);
      const ant = estado.blocos[i - 1], cur = estado.blocos[i];
      const t = textoDe(ant.runs);
      const cola = /-$/.test(t) && /^[a-zà-ÿ]/.test(textoDe(cur.runs)) ? [] : [{ t: ' ' }];
      if (cola.length === 0) ant.runs[ant.runs.length - 1].t = ant.runs[ant.runs.length - 1].t.replace(/-$/, '');
      ant.runs = juntarRuns(ant.runs.concat(cola, cur.runs));
      estado.blocos.splice(i, 1);
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

  function contarProblemas() {
    if (!estado.blocos.length) return 0;
    const c = window.Conferir.cruzar(estado.blocos);
    return c.semRef.length + c.naoCitadas.length + window.Conferir.sigilo(estado.blocos).length;
  }

  function pintarConferencia() {
    const box = $('#conferencia');
    if (!estado.blocos.length) { box.innerHTML = '<p class="vazio">Nenhum texto ainda.</p>'; return; }
    const c = window.Conferir.cruzar(estado.blocos);
    const sig = window.Conferir.sigilo(estado.blocos);

    const itemCit = (x) => `<li><button type="button" class="nota" data-ir="${x.bloco}"><span class="nota__alvo">${esc(x.texto)}</span><span class="nota__mao">cadê a referência?</span></button></li>`;
    const itemRef = (x) => `<li><button type="button" class="nota" data-ir="${x.bloco}"><span class="nota__alvo">${esc(x.texto.length > 110 ? x.texto.slice(0, 110) + '…' : x.texto)}</span><span class="nota__mao">não aparece no texto</span></button></li>`;
    const itemSig = (x, k) => {
      const trecho = esc(x.trecho).split(esc(x.alvo)).join(`<mark>${esc(x.alvo)}</mark>`);
      const acao = x.tipo === 'nome' ? `trocar por ${estado.codigos[x.alvo] || String.fromCharCode(65 + Object.keys(estado.codigos).length % 26)}` : 'omitir';
      return `<li class="sig"><p class="sig__rot">${esc(x.rotulo)}</p><p class="sig__trecho">${trecho}</p>
        <div class="linha-botoes"><button type="button" class="btn-mini btn-mini--forte" data-anon="${k}">${acao}</button><button type="button" class="btn-mini" data-ir="${x.bloco}">ver na folha</button></div></li>`;
    };

    box.innerHTML = `
      <div class="placar">
        <div><b>${c.totalCitacoes}</b><span>citações no texto</span></div>
        <div><b>${c.totalRefs}</b><span>referências na lista</span></div>
        <div class="${sig.length ? 'placar--alerta' : ''}"><b>${sig.length}</b><span>possíveis dados sensíveis</span></div>
      </div>

      <h3 class="sub">Sigilo</h3>
      ${sig.length
        ? `<p class="explica">O Código de Ética do psicólogo (art. 9º) pede sigilo sobre quem é atendido. Estes trechos podem identificar alguém:</p><ol class="lista-sig">${sig.map(itemSig).join('')}</ol>`
        : '<p class="ok">Nenhum nome de paciente, CPF, telefone, e-mail ou endereço encontrado.</p>'}
      <p class="miudo">A busca é automática e não pega tudo: idade + bairro + profissão também identificam. A leitura final é sua.</p>

      <h3 class="sub">Citado, mas sem referência</h3>
      ${c.semRef.length ? `<ol class="notas">${c.semRef.map(itemCit).join('')}</ol>` : '<p class="ok">Toda citação encontrou a sua referência.</p>'}

      <h3 class="sub">Na lista, mas nunca citado</h3>
      ${c.naoCitadas.length ? `<ol class="notas">${c.naoCitadas.map(itemRef).join('')}</ol>` : '<p class="ok">Toda referência foi citada no texto.</p>'}
      <p class="miudo">Pega citações no formato (SOBRENOME, ano) e Sobrenome (ano), inclusive ano duplo como Freud (1912/2010).</p>`;

    box._sig = sig;
  }

  $('#conferencia').addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-anon]');
    if (a) {
      const achado = $('#conferencia')._sig[+a.dataset.anon];
      window.Conferir.anonimizar(estado.blocos, achado, estado.codigos);
      pintarBlocos();
      agendar();
      pintarConferencia();
      return;
    }
    const ir = ev.target.closest('[data-ir]');
    if (ir) irPara(ir.dataset.ir);
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

  function atualizarRef() {
    const r = window.Referencia.montar(ref.tipo, ref.c);
    $('#saidaRef').innerHTML = r.runs.map((x) => (x.b ? `<b>${esc(x.t)}</b>` : esc(x.t))).join('');
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
    const html = r.runs.map((x) => (x.b ? `<b>${esc(x.t)}</b>` : esc(x.t))).join('');
    try {
      if (window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([r.texto], { type: 'text/plain' }) })]);
      } else await navigator.clipboard.writeText(r.texto);
      $('#notaRef').textContent = 'Copiado, com o negrito junto.';
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

  function desenhar() {
    const pag = $('#paginas');
    pag.classList.toggle('f-arial', estado.op.fonte === 'arial');
    pag.classList.toggle('com-margens', !!estado.op.margens);

    if (!estado.blocos.length) {
      pag.innerHTML = `<div class="moldura"><article class="folha folha--vazia"><div class="folha__corpo">
        <p class="vazia__grande">As folhas aparecem aqui.</p>
        <p class="vazia__peq">Manda um arquivo, cola o texto ou abre o exemplo na aba Texto.</p></div></article></div>`;
      $('#conta').textContent = 'Nenhuma folha ainda';
      $('#baixarDocx').disabled = $('#imprimir').disabled = true;
      ultimo = null;
      return;
    }

    const modelo = window.Marcar.montar(estado.blocos, estado.op);
    const res = window.Folhas.render(pag, modelo, estado.capa, estado.op);
    ultimo = { modelo, res };

    const palavras = estado.blocos.filter((b) => !['fora', 'capa', 'subtitulo'].includes(b.tipo))
      .reduce((n, b) => n + (textoDe(b.runs).match(/\S+/g) || []).length, 0);
    $('#conta').innerHTML = `<b>${res.folhas}</b> folha${res.folhas > 1 ? 's' : ''} · ${palavras.toLocaleString('pt-BR')} palavras`;
    $('#baixarDocx').disabled = $('#imprimir').disabled = false;

    const prob = contarProblemas();
    $('#nConfere').textContent = prob || '';
    if ($('.fichario').dataset.aba === 'confere') pintarConferencia();
  }

  const nomeArquivo = () => {
    const base = (estado.capa.titulo || 'trabalho').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    return (base || 'trabalho') + '-abnt';
  };

  $('#baixarDocx').addEventListener('click', async () => {
    if (!ultimo) return;
    const btn = $('#baixarDocx');
    btn.disabled = true;
    try {
      const blob = await window.Docx.gerar(ultimo.modelo, estado.capa, estado.op, ultimo.res.paginaDe);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nomeArquivo() + '.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) {
      avisar([e.message || 'Não deu pra gerar o .docx.'], true);
      abrirAba('texto');
    } finally {
      btn.disabled = false;
    }
  });

  $('#imprimir').addEventListener('click', () => {
    const antigo = document.title;
    document.title = nomeArquivo();
    window.print();
    document.title = antigo;
  });

  window.addEventListener('resize', escala);

  /* ---------- começo ---------- */

  pintarTipos();
  pintarCampos();
  preencherFicha();
  pintarBlocos();
  escala();
  desenhar();
  if (estado.blocos.length) abrirAba('marcas');
  // a fonte da folha muda a quebra de linha: redesenha quando ela termina de carregar
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { escala(); desenhar(); });
})();
