/* Painel da Cedro Decor.

   Demonstração: o catálogo vem de dados.js e as edições ficam no
   localStorage deste navegador. Numa loja de verdade isso iria para um
   banco — a tela seria a mesma, só mudaria de onde vêm os dados.

   O login é simbólico e está no código, como convém a uma demo: serve para
   mostrar a tela de acesso, não para proteger coisa alguma. */
(function () {
  'use strict';

  const USUARIO = 'admin';
  const SENHA = 'cedrodecor2026';
  const K_SESSAO = 'cedro:sessao';
  const K_PECAS = 'cedro:pecas';
  const K_DEPOS = 'cedro:depoimentos';
  const K_VISITAS = 'cedro:visitas';

  const ler = (chave, padrao) => {
    try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; }
    catch (e) { return padrao; }
  };
  const gravar = (chave, valor) => {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) { /* modo privado */ }
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const reais = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const m = (n) => String(Number(n).toFixed(2)).replace('.', ',');

  let pecas = ler(K_PECAS, null) || PECAS.map((p) => ({ ...p }));
  let depos = ler(K_DEPOS, null) || DEPOIMENTOS_PADRAO.map((d) => ({ ...d }));

  /* ---------------- login ---------------- */
  const telaEntrar = document.getElementById('entrar');
  const painel = document.getElementById('painel');
  const formEntrar = document.getElementById('formEntrar');
  const entrarNota = document.getElementById('entrarNota');

  function abrirPainel() {
    telaEntrar.hidden = true;
    painel.hidden = false;
    renderPecas();
    renderDepos();
    renderVisitas();
  }

  if (sessionStorage.getItem(K_SESSAO) === '1') abrirPainel();

  formEntrar.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('usuario').value.trim();
    const s = document.getElementById('senha').value;
    if (u === USUARIO && s === SENHA) {
      try { sessionStorage.setItem(K_SESSAO, '1'); } catch (err) { /* ok */ }
      abrirPainel();
    } else {
      entrarNota.className = 'nota erro-txt';
      entrarNota.textContent = 'Usuário ou senha incorretos.';
    }
  });

  document.getElementById('sair').addEventListener('click', () => {
    try { sessionStorage.removeItem(K_SESSAO); } catch (e) { /* ok */ }
    painel.hidden = true;
    telaEntrar.hidden = false;
    document.getElementById('senha').value = '';
    entrarNota.textContent = '';
  });

  /* ---------------- abas ---------------- */
  document.getElementById('abas').addEventListener('click', (e) => {
    const b = e.target.closest('.aba');
    if (!b) return;
    document.querySelectorAll('.aba').forEach((x) => x.classList.toggle('is-on', x === b));
    ['pecas', 'depoimentos', 'visitas'].forEach((id) => {
      document.getElementById('secao-' + id).hidden = id !== b.dataset.aba;
    });
  });

  /* ---------------- modal ---------------- */
  const modal = document.getElementById('modalAdm');
  const modalCorpo = document.getElementById('modalAdmCorpo');
  document.getElementById('modalAdmX').addEventListener('click', fecharModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) fecharModal(); });

  function abrirModal(html) {
    modalCorpo.innerHTML = html;
    modal.hidden = false;
    const primeiro = modalCorpo.querySelector('input, select, textarea');
    if (primeiro) primeiro.focus();
  }
  function fecharModal() { modal.hidden = true; }

  /* ---------------- peças ---------------- */
  const tbPecas = document.getElementById('tbPecas');

  function renderPecas() {
    tbPecas.innerHTML = '';
    pecas.forEach((p) => {
      const amb = AMBIENTES.find((a) => a.id === p.ambiente);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong>${esc(p.nome)}</strong>
          <span class="celula-sub">${esc(p.sub || '')}</span>
        </td>
        <td>${esc(amb ? amb.nome : p.ambiente)}</td>
        <td class="mono">${m(p.l)} × ${m(p.p)} × ${m(p.a)}</td>
        <td class="mono">${reais(p.preco)}</td>
        <td class="mono ${p.estoque <= ESTOQUE_BAIXO ? 'alerta' : ''}">${p.estoque}</td>
        <td class="acoes">
          <button class="mini" type="button" data-editar="${esc(p.id)}">editar</button>
          <button class="mini mini-perigo" type="button" data-remover="${esc(p.id)}">remover</button>
        </td>`;
      tbPecas.appendChild(tr);
    });
  }

  function formPeca(peca) {
    const novo = !peca;
    const p = peca || { id: '', nome: '', sub: '', ambiente: AMBIENTES[0].id, preco: 0, estoque: 0, l: 1, p: 0.5, a: 0.8, forma: 'mesa', img: '', desc: '', cores: [] };
    abrirModal(`
      <p class="cota-label">${novo ? 'Nova peça' : 'Editar peça'}</p>
      <h3>${novo ? 'Cadastrar' : esc(p.nome)}</h3>
      <form id="formPeca" class="form-adm">
        <div class="campo"><label for="fNome">Nome</label><input id="fNome" value="${esc(p.nome)}" required></div>
        <div class="campo"><label for="fSub">Complemento</label><input id="fSub" value="${esc(p.sub)}" placeholder="3 lugares, 6 portas..."></div>
        <div class="campo"><label for="fAmb">Ambiente</label>
          <select id="fAmb">${AMBIENTES.map((a) => `<option value="${a.id}"${a.id === p.ambiente ? ' selected' : ''}>${esc(a.nome)}</option>`).join('')}</select>
        </div>
        <div class="campo-tres">
          <div class="campo"><label for="fL">Largura (m)</label><input id="fL" type="number" step="0.01" min="0.1" value="${p.l}" required></div>
          <div class="campo"><label for="fP">Profund. (m)</label><input id="fP" type="number" step="0.01" min="0.1" value="${p.p}" required></div>
          <div class="campo"><label for="fA">Altura (m)</label><input id="fA" type="number" step="0.01" min="0.1" value="${p.a}" required></div>
        </div>
        <div class="campo-dupla">
          <div class="campo"><label for="fPreco">Preço</label><input id="fPreco" type="number" step="0.01" min="0" value="${p.preco}" required></div>
          <div class="campo"><label for="fEstoque">Estoque</label><input id="fEstoque" type="number" min="0" value="${p.estoque}" required></div>
        </div>
        <div class="campo"><label for="fImg">Link da foto</label><input id="fImg" value="${esc(p.img)}" placeholder="https://..."></div>
        <div class="campo"><label for="fDesc">Descrição</label><textarea id="fDesc" rows="2">${esc(p.desc)}</textarea></div>
        <p class="dica-form">A largura e a profundidade desenham a peça na planta e alimentam a calculadora “vai caber”.</p>
        <button class="btn btn-solido" type="submit">${novo ? 'Cadastrar' : 'Salvar'}</button>
      </form>`);

    document.getElementById('formPeca').addEventListener('submit', (e) => {
      e.preventDefault();
      const dados = {
        nome: document.getElementById('fNome').value.trim(),
        sub: document.getElementById('fSub').value.trim(),
        ambiente: document.getElementById('fAmb').value,
        l: parseFloat(document.getElementById('fL').value),
        p: parseFloat(document.getElementById('fP').value),
        a: parseFloat(document.getElementById('fA').value),
        preco: parseFloat(document.getElementById('fPreco').value),
        estoque: parseInt(document.getElementById('fEstoque').value, 10),
        img: document.getElementById('fImg').value.trim(),
        desc: document.getElementById('fDesc').value.trim()
      };
      if (!dados.nome || !(dados.l > 0) || !(dados.p > 0)) return;

      if (novo) {
        pecas.push(Object.assign({
          id: 'x' + Date.now().toString(36),
          forma: 'mesa',
          cores: [{ nome: 'Natural', hex: '#c8a983' }]
        }, dados));
      } else {
        Object.assign(pecas.find((x) => x.id === p.id), dados);
      }
      gravar(K_PECAS, pecas);
      renderPecas();
      fecharModal();
    });
  }

  document.getElementById('novaPeca').addEventListener('click', () => formPeca(null));

  tbPecas.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-editar]');
    const rm = e.target.closest('[data-remover]');
    if (ed) formPeca(pecas.find((p) => p.id === ed.dataset.editar));
    if (rm) {
      const p = pecas.find((x) => x.id === rm.dataset.remover);
      if (p && confirm(`Remover "${p.nome}" do catálogo?`)) {
        pecas = pecas.filter((x) => x.id !== p.id);
        gravar(K_PECAS, pecas);
        renderPecas();
      }
    }
  });

  /* ---------------- depoimentos ---------------- */
  const listaDepos = document.getElementById('listaDepos');

  function renderDepos() {
    listaDepos.innerHTML = '';
    depos.forEach((d, i) => {
      const c = document.createElement('div');
      c.className = 'cartao';
      c.innerHTML = `
        <div class="cartao-nota">${'★'.repeat(d.nota)}${'☆'.repeat(5 - d.nota)}</div>
        <p>${esc(d.texto)}</p>
        <p class="cartao-pe"><strong>${esc(d.nome)}</strong> · ${esc(d.cidade)}</p>
        <div class="acoes">
          <button class="mini" type="button" data-ed="${i}">editar</button>
          <button class="mini mini-perigo" type="button" data-rm="${i}">remover</button>
        </div>`;
      listaDepos.appendChild(c);
    });
  }

  function formDepo(indice) {
    const novo = indice == null;
    const d = novo ? { nome: '', cidade: '', nota: 5, texto: '' } : depos[indice];
    abrirModal(`
      <p class="cota-label">${novo ? 'Novo depoimento' : 'Editar depoimento'}</p>
      <h3>Depoimento</h3>
      <form id="formDepo" class="form-adm">
        <div class="campo-dupla">
          <div class="campo"><label for="dNome">Nome</label><input id="dNome" value="${esc(d.nome)}" required></div>
          <div class="campo"><label for="dCidade">Cidade</label><input id="dCidade" value="${esc(d.cidade)}" placeholder="Campinas · SP"></div>
        </div>
        <div class="campo"><label for="dNota">Nota</label>
          <select id="dNota">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}"${n === d.nota ? ' selected' : ''}>${n} estrela${n > 1 ? 's' : ''}</option>`).join('')}</select>
        </div>
        <div class="campo"><label for="dTexto">Depoimento</label><textarea id="dTexto" rows="3" required>${esc(d.texto)}</textarea></div>
        <button class="btn btn-solido" type="submit">${novo ? 'Publicar' : 'Salvar'}</button>
      </form>`);

    document.getElementById('formDepo').addEventListener('submit', (e) => {
      e.preventDefault();
      const novoDepo = {
        nome: document.getElementById('dNome').value.trim(),
        cidade: document.getElementById('dCidade').value.trim(),
        nota: parseInt(document.getElementById('dNota').value, 10),
        texto: document.getElementById('dTexto').value.trim()
      };
      if (!novoDepo.nome || !novoDepo.texto) return;
      if (novo) depos.push(novoDepo); else depos[indice] = novoDepo;
      gravar(K_DEPOS, depos);
      renderDepos();
      fecharModal();
    });
  }

  document.getElementById('novoDepo').addEventListener('click', () => formDepo(null));
  listaDepos.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-ed]');
    const rm = e.target.closest('[data-rm]');
    if (ed) formDepo(Number(ed.dataset.ed));
    if (rm && confirm('Remover este depoimento?')) {
      depos.splice(Number(rm.dataset.rm), 1);
      gravar(K_DEPOS, depos);
      renderDepos();
    }
  });

  /* ---------------- visitas ---------------- */
  const tbVisitas = document.getElementById('tbVisitas');
  const semVisitas = document.getElementById('semVisitas');

  function renderVisitas() {
    const visitas = ler(K_VISITAS, []);
    tbVisitas.innerHTML = '';
    visitas.forEach((v) => {
      const amb = AMBIENTES.find((a) => a.id === v.ambiente);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="mono"><strong>${esc((v.data || '').split('-').reverse().join('/'))}</strong> ${esc(v.hora || '')}</td>
        <td>${esc(v.nome)}</td>
        <td>${esc(amb ? amb.nome : '—')}</td>
        <td class="mono celula-sub">${v.em ? new Date(v.em).toLocaleString('pt-BR') : '—'}</td>`;
      tbVisitas.appendChild(tr);
    });
    semVisitas.hidden = visitas.length > 0;
  }

  document.getElementById('limparVisitas').addEventListener('click', () => {
    if (!confirm('Apagar todas as visitas marcadas?')) return;
    gravar(K_VISITAS, []);
    renderVisitas();
  });
})();
