/* Agendamento de visita + a calculadora "vai caber?".

   O assistente antigo era um chatbot de perguntas soltas. Este faz uma coisa
   só e faz de verdade: pega a medida do cômodo da pessoa, compara com a
   medida real da peça e responde com a folga que sobra — que é a dúvida que
   trava a compra de móvel. */
(function () {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const metros = (n) => String(n.toFixed(2)).replace('.', ',') + ' m';

  /* ---------- ficha de visita ---------- */
  const ficha = document.getElementById('ficha');
  const nota = document.getElementById('vNota');
  const selAmb = document.getElementById('vAmbiente');
  const campoData = document.getElementById('vData');

  if (selAmb) {
    selAmb.innerHTML = '<option value="">qualquer um</option>';
    AMBIENTES.forEach((a) => {
      const o = document.createElement('option');
      o.value = a.id;
      o.textContent = a.nome;
      selAmb.appendChild(o);
    });
  }

  // não deixa marcar para ontem
  if (campoData) {
    const hoje = new Date();
    campoData.min = hoje.toISOString().slice(0, 10);
  }

  const CHAVE_VISITAS = 'cedro:visitas';

  function salvarVisita(v) {
    try {
      const todas = JSON.parse(localStorage.getItem(CHAVE_VISITAS) || '[]');
      todas.unshift(v);
      localStorage.setItem(CHAVE_VISITAS, JSON.stringify(todas.slice(0, 50)));
    } catch (e) { /* modo privado: segue sem guardar */ }
  }

  if (ficha) {
    ficha.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = document.getElementById('vNome');
      const data = document.getElementById('vData');
      const hora = document.getElementById('vHora');

      const faltando = [nome, data, hora].filter((c) => !c.value.trim());
      [nome, data, hora].forEach((c) => c.closest('.campo').classList.toggle('erro', !c.value.trim()));

      if (faltando.length) {
        nota.className = 'nota erro-txt';
        nota.textContent = 'Preencha nome, dia e horário.';
        faltando[0].focus();
        return;
      }

      const amb = AMBIENTES.find((a) => a.id === selAmb.value);
      const quando = data.value.split('-').reverse().join('/');
      salvarVisita({ nome: nome.value.trim(), data: data.value, hora: hora.value, ambiente: selAmb.value, em: new Date().toISOString() });

      nota.className = 'nota ok-txt';
      nota.innerHTML = `Visita anotada para <strong>${esc(quando)}</strong> às <strong>${esc(hora.value)}</strong>` +
        (amb ? `, com foco em <strong>${esc(amb.nome.toLowerCase())}</strong>.` : '.') +
        ' Numa loja de verdade, isso cairia na agenda da equipe.';
      ficha.reset();
    });

    ficha.querySelectorAll('input, select').forEach((c) => {
      c.addEventListener('input', () => c.closest('.campo').classList.remove('erro'));
    });
  }

  /* ---------- calculadora "vai caber?" ---------- */
  const btn = document.getElementById('ajudanteBtn');
  const painel = document.getElementById('ajudante');
  const msgs = document.getElementById('ajudanteMsgs');
  const pe = document.getElementById('ajudantePe');
  if (!btn || !painel) return;

  const estado = { etapa: 'inicio', comodo: null, peca: null };

  function fala(quem, html) {
    const d = document.createElement('div');
    d.className = 'msg msg-' + quem;
    d.innerHTML = html;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function opcoes(lista) {
    pe.innerHTML = '';
    lista.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opcao';
      b.textContent = o.txt;
      b.addEventListener('click', o.acao);
      pe.appendChild(b);
    });
  }

  function formMedidas() {
    pe.innerHTML = '';
    const f = document.createElement('form');
    f.className = 'medida-form';
    f.innerHTML = `
      <label>Largura <input type="number" step="0.1" min="0.5" max="30" id="cl" placeholder="3,5"></label>
      <label>Profund. <input type="number" step="0.1" min="0.5" max="30" id="cp" placeholder="4,0"></label>
      <button class="btn btn-solido btn-min" type="submit">Calcular</button>`;
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const l = parseFloat(document.getElementById('cl').value);
      const p = parseFloat(document.getElementById('cp').value);
      if (!(l > 0) || !(p > 0)) {
        fala('bot', 'Preciso dos dois números para calcular. Pode medir por cima do rodapé mesmo.');
        return;
      }
      estado.comodo = { l, p };
      fala('voce', `${metros(l)} × ${metros(p)}`);
      escolherPeca();
    });
    pe.appendChild(f);
  }

  function escolherPeca() {
    fala('bot', 'Agora escolha a peça que você está namorando.');
    pe.innerHTML = '';
    const sel = document.createElement('select');
    sel.className = 'sel-peca';
    sel.innerHTML = '<option value="">escolha uma peça</option>' +
      AMBIENTES.map((a) => `<optgroup label="${esc(a.nome)}">` +
        PECAS.filter((p) => p.ambiente === a.id)
          .map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('') +
        '</optgroup>').join('');
    sel.addEventListener('change', () => {
      const peca = PECAS.find((p) => p.id === sel.value);
      if (!peca) return;
      estado.peca = peca;
      fala('voce', peca.nome);
      responder(peca);
    });
    pe.appendChild(sel);
  }

  function responder(peca) {
    const { l, p } = estado.comodo;
    // testa nas duas orientações: de frente e girada 90°
    const cabeDireto = peca.l <= l && peca.p <= p;
    const cabeGirado = peca.p <= l && peca.l <= p;

    if (!cabeDireto && !cabeGirado) {
      const faltaL = Math.max(0, peca.l - Math.max(l, p));
      fala('bot', `<strong>Não cabe.</strong> A peça tem ${metros(peca.l)} de largura e seu cômodo tem ${metros(Math.max(l, p))} no maior lado.` +
        (faltaL > 0 ? ` Faltam ${metros(faltaL)}.` : '') +
        ' Posso sugerir algo menor do mesmo ambiente.');
      const menores = PECAS.filter((x) => x.ambiente === peca.ambiente && x.id !== peca.id && (x.l <= l || x.l <= p))
        .sort((a, b) => a.l - b.l).slice(0, 3);
      opcoes(menores.length
        ? menores.map((x) => ({ txt: `${x.nome} (${metros(x.l)})`, acao: () => { fala('voce', x.nome); responder(x); } }))
        : [{ txt: 'Medir outro cômodo', acao: reiniciar }]);
      return;
    }

    const folgaL = (cabeDireto ? l - peca.l : p - peca.l);
    const folgaP = (cabeDireto ? p - peca.p : l - peca.p);
    const ocupa = ((peca.l * peca.p) / (l * p)) * 100;
    const apertado = folgaL < 0.6 || folgaP < 0.6;

    fala('bot',
      `<strong>Cabe${cabeDireto ? '' : ', virando a peça'}.</strong> ` +
      `Sobram ${metros(folgaL)} na largura e ${metros(folgaP)} na profundidade. ` +
      `Ela ocupa ${ocupa.toFixed(0)}% do piso.` +
      (apertado
        ? ' Só que fica justo: o ideal é deixar uns 60 cm livres para passar.'
        : ' Folga boa para circular em volta.'));

    opcoes([
      { txt: 'Testar outra peça', acao: () => escolherPeca() },
      { txt: 'Medir outro cômodo', acao: reiniciar },
      { txt: 'Agendar visita', acao: () => {
          fecharAjudante();
          document.getElementById('visita').scrollIntoView({ behavior: 'smooth' });
        } }
    ]);
  }

  function reiniciar() {
    estado.comodo = null;
    estado.peca = null;
    fala('bot', 'Beleza. Quanto mede o cômodo? (largura e profundidade, em metros)');
    formMedidas();
  }

  function abrirAjudante() {
    painel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    if (!msgs.childElementCount) {
      fala('bot', 'Oi! Eu respondo a pergunta que trava toda compra de móvel: <strong>vai caber?</strong>');
      fala('bot', 'Me diz quanto mede o cômodo — largura e profundidade, em metros.');
      formMedidas();
    }
  }

  function fecharAjudante() {
    painel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', () => (painel.hidden ? abrirAjudante() : fecharAjudante()));
  document.getElementById('ajudanteX').addEventListener('click', fecharAjudante);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !painel.hidden) fecharAjudante();
  });
})();
