/* A fita: tudo o que é dito na live, impresso como a fita de papel de uma estenotipia.
   O que tem a ver com a palavra-chave ganha marca-texto e um recado na margem; quando a
   palavra sai, a fita leva um carimbo. Usa as regras do núcleo (detectar, parecidas). */

(function (raiz) {
  'use strict';

  // vocabulário de quem está prestes a passar a palavra (destaque leve)
  const PERTO = /\b(palavra|palavras|chave|codigo|certificado|presenca|frequencia|senha|anot(?:a|am|e|em|ar|ando)|guardem|escrevam|copiem)\b/;
  const limpar = (w) => w.replace(/^[^\p{L}\d]+|[^\p{L}\d-]+$/gu, '');

  // Lê uma linha da fita. "forte": anunciou, avisou, falou da palavra-chave ou disse a palavra
  // já anotada; "perto": só o vocabulário. "chaves"/"pertos": posições das palavras a marcar
  function classificar(N, texto, chaves = []) {
    const ws = String(texto).split(' ');
    const marcas = new Set(), pertos = new Set();
    ws.forEach((w, i) => {
      const l = limpar(w);
      if (l.length >= 3 && chaves.some((c) => N.parecidas(l, c))) marcas.add(i);
      else if (PERTO.test(N.normal(l))) pertos.add(i);
    });
    const d = N.detectar(texto);
    let tipo = '', recado = '';
    if (d.achados.length) { tipo = 'anuncio'; recado = 'anunciou: ' + d.achados.map((a) => a.palavra).join(', '); }
    else if (marcas.size) { tipo = 'chave'; recado = 'disse a palavra'; }
    else if (d.aviso) { tipo = 'aviso'; recado = 'vai passar a palavra'; }
    else if (d.mencao) { tipo = 'mencao'; recado = 'falou da palavra-chave'; }
    else if (pertos.size) tipo = 'perto';
    return { tipo, recado, forte: !!tipo && tipo !== 'perto', marcas, pertos };
  }

  const LINHA_MAX = 16;      // palavras por linha da fita
  const SILENCIO = 7000;     // pausa que começa linha nova
  const GUARDAR_MAX = 30000; // palavras guardadas no navegador

  class Fita {
    constructor(el, o) {
      this.N = o.nucleo;
      this.hora = o.hora || (() => new Date().toLocaleTimeString('pt-BR'));
      this.agora = o.agora || (() => Date.now());
      this.aoMudar = o.aoMudar || (() => {});
      this.itens = [];
      this.chavesLista = [];
      this.el = el;
      el.classList.add('fita');
      this.regua = this.criar('div', 'fita__regua');
      this.regua.setAttribute('aria-hidden', 'true');
      this.rolo = this.criar('div', 'fita__rolo');
      this.rolo.tabIndex = 0;
      this.rolo.setAttribute('role', 'log');
      this.rolo.setAttribute('aria-label', 'Transcrição da live');
      this.papel = this.criar('div', 'fita__papel');
      this.parcialEl = this.criar('p', 'fita__parcial');
      this.fimBtn = this.criar('button', 'fita__fim');
      this.fimBtn.type = 'button';
      this.fimBtn.textContent = '↓ voltar ao que está sendo dito';
      this.fimBtn.hidden = true;
      this.rolo.append(this.papel, this.parcialEl);
      el.append(this.regua, this.rolo, this.fimBtn);
      this.seguindo = true;
      this.rolo.addEventListener('scroll', () => {
        this.seguindo = this.rolo.scrollTop + this.rolo.clientHeight >= this.rolo.scrollHeight - 48;
        if (this.seguindo) this.fimBtn.hidden = true;
      }, { passive: true });
      this.fimBtn.addEventListener('click', () => { this.seguindo = true; this.rolar(); });
      this.vazio();
    }
    criar(tag, classe) { const e = document.createElement(tag); e.className = classe; return e; }

    vazio() {
      if (this.itens.length) return;
      const p = this.criar('p', 'fita__vazio');
      p.textContent = 'Tudo o que for dito na live sai impresso aqui. O que tiver a ver com a palavra-chave ganha marca-texto.';
      this.papel.replaceChildren(p);
    }

    // palavras novas de uma fonte; "removidas": a legenda corrigiu as últimas palavras
    receber(fonte, palavras, removidas = 0) {
      if (!palavras.length && !removidas) return;
      const sujas = new Set();
      while (removidas > 0) {
        const u = this.ultimaLinha();
        if (!u || u.fonte !== fonte) break;
        const tira = Math.min(removidas, u.palavras.length);
        u.palavras.splice(u.palavras.length - tira, tira);
        removidas -= tira;
        if (!u.palavras.length) { this.itens.pop(); u.el && u.el.remove(); } else sujas.add(u);
      }
      if (!this.itens.length && palavras.length) this.papel.replaceChildren();
      const agora = this.agora();
      palavras.forEach((w) => {
        let u = this.ultimaLinha();
        const ultimaW = u && u.palavras[u.palavras.length - 1];
        if (!u || this.itens[this.itens.length - 1] !== u || u.fonte !== fonte || u.palavras.length >= LINHA_MAX ||
            (u.palavras.length >= 6 && /[.?!…]$/.test(ultimaW || '')) || agora - u.ultimo > SILENCIO) {
          u = { fonte, palavras: [], hora: this.hora(), quando: agora, ultimo: agora };
          this.itens.push(u);
        }
        u.palavras.push(w);
        u.ultimo = agora;
        sujas.add(u);
      });
      sujas.forEach((u) => this.pintar(u));
      this.depois();
    }
    ultimaLinha() {
      for (let i = this.itens.length - 1; i >= 0; i--) if (!this.itens[i].carimbo) return this.itens[i];
      return null;
    }

    // a voz ainda decidindo o que ouviu
    parcial(texto) { this.parcialEl.textContent = texto ? texto + '…' : ''; if (texto) this.rolar(true); }

    // palavras já anotadas: toda vez que aparecem na fita, ficam marcadas
    chaves(lista) {
      const nova = [...new Set(lista.filter(Boolean))];
      if (nova.join('|') === this.chavesLista.join('|')) return;
      this.chavesLista = nova;
      this.itens.forEach((it) => { if (!it.carimbo) this.pintar(it); });
      this.depois(false);
    }

    // a palavra saiu: carimbo na fita, no ponto em que foi dita (a mesma nota só atualiza)
    carimbar(nota) {
      let c = this.itens.find((it) => it.carimbo && it.quando === nota.quando);
      if (!c) {
        if (!this.itens.length) this.papel.replaceChildren();
        c = { carimbo: true, quando: nota.quando, hora: nota.hora };
        this.itens.push(c);
      }
      c.palavra = nota.palavra;
      c.fontes = (nota.fontes || []).slice();
      this.pintarCarimbo(c);
      this.chaves(this.chavesLista.concat(nota.palavra));
      this.depois();
    }

    pintar(u) {
      const c = classificar(this.N, u.palavras.join(' '), this.chavesLista);
      u.tipo = c.tipo; u.recado = c.recado; u.forte = c.forte;
      const div = u.el || this.criar('div', '');
      div.className = 'fita__linha' + (c.forte ? ' fita__linha--forte fita__linha--' + c.tipo : c.tipo ? ' fita__linha--perto' : '') + (u.fonte === 'voz' ? ' fita__linha--voz' : '');
      const t = this.criar('time', 'fita__hora');
      t.textContent = u.hora;
      // o marca-texto vai num span corrido: quebra junto com a linha, como o de verdade
      const p = this.criar('p', 'fita__texto');
      const tinta = this.criar('span', 'fita__tinta');
      u.palavras.forEach((w, i) => {
        if (i) tinta.append(' ');
        if (c.marcas.has(i)) { const m = this.criar('mark', 'fita__chave'); m.textContent = w; tinta.append(m); }
        else if (c.pertos.has(i)) { const s = this.criar('span', 'fita__perto'); s.textContent = w; tinta.append(s); }
        else tinta.append(w);
      });
      p.append(tinta);
      div.replaceChildren(t, p);
      if (c.recado) { const r = this.criar('span', 'fita__recado'); r.textContent = c.recado; div.append(r); }
      if (!u.el) { u.el = div; div.classList.add('fita__nova'); this.papel.append(div); }
    }
    pintarCarimbo(c) {
      const div = c.el || this.criar('div', 'fita__carimbo');
      const rot = this.criar('span', 'fita__carimbo-rot');
      const n = this.itens.filter((it) => it.carimbo).indexOf(c) + 1;
      rot.textContent = 'palavra-chave ' + (n > 0 ? n + 'ª' : '') + ' · ' + c.hora;
      const pal = this.criar('strong', 'fita__carimbo-pal');
      pal.textContent = c.palavra;
      div.replaceChildren(rot, pal);
      if (!c.el) { c.el = div; this.papel.append(div); }
    }

    depois(rolar = true) {
      this.pintarRegua();
      if (rolar) this.rolar(true);
      this.aoMudar();
    }
    rolar(soSeSeguindo) {
      if (soSeSeguindo && !this.seguindo) { this.fimBtn.hidden = false; return; }
      this.rolo.scrollTop = this.rolo.scrollHeight;
      this.fimBtn.hidden = true;
    }

    // régua ao lado da fita: um risco para cada destaque, clicável, para achar na live inteira
    pintarRegua() {
      const total = this.itens.length;
      const fortes = this.itens.map((it, i) => [it, i]).filter(([it]) => it.forte || it.carimbo);
      this.regua.replaceChildren(...fortes.map(([it, i]) => {
        const r = this.criar('button', 'fita__risco' + (it.carimbo ? ' fita__risco--carimbo' : ''));
        r.type = 'button';
        r.tabIndex = -1;
        r.style.top = (total > 1 ? (i / (total - 1)) * 100 : 0) + '%';
        r.title = it.carimbo ? it.palavra : it.hora + ' · ' + it.recado;
        r.addEventListener('click', () => this.mostrar(it));
        return r;
      }));
    }
    mostrar(it) {
      if (!it.el) return;
      this.seguindo = false;
      it.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      it.el.classList.remove('fita__piscar');
      void it.el.offsetWidth;
      it.el.classList.add('fita__piscar');
    }

    soDestaques(sim) { this.el.classList.toggle('fita--destaques', !!sim); this.rolar(true); }

    limpar() {
      this.itens = [];
      this.chavesLista = [];
      this.parcialEl.textContent = '';
      this.vazio();
      this.pintarRegua();
      this.aoMudar();
    }

    // texto para baixar: as palavras-chave em cima, a transcrição inteira embaixo
    texto() {
      const linhas = [];
      this.itens.forEach((it) => {
        if (it.carimbo) { linhas.push(`[${it.hora}] ★★★ PALAVRA-CHAVE: ${it.palavra} ★★★`); return; }
        const marca = it.forte ? '>> ' : '   ';
        linhas.push(`[${it.hora}] ${marca}${it.palavras.join(' ')}${it.recado ? '   <-- ' + it.recado : ''}`);
      });
      return linhas;
    }

    dados() {
      let soma = 0;
      const guardar = [];
      for (let i = this.itens.length - 1; i >= 0 && soma < GUARDAR_MAX; i--) {
        const it = this.itens[i];
        soma += it.carimbo ? 1 : it.palavras.length;
        guardar.unshift(it.carimbo ? { carimbo: true, palavra: it.palavra, hora: it.hora, quando: it.quando, fontes: it.fontes }
          : { fonte: it.fonte, palavras: it.palavras, hora: it.hora, quando: it.quando, ultimo: it.ultimo });
      }
      return { itens: guardar, chaves: this.chavesLista };
    }
    restaurar(d) {
      this.itens = [];
      this.papel.replaceChildren();
      this.chavesLista = (d && d.chaves) || [];
      ((d && d.itens) || []).forEach((it) => {
        const novo = { ...it };
        this.itens.push(novo);
        if (novo.carimbo) this.pintarCarimbo(novo); else this.pintar(novo);
      });
      // o que já estava guardado não é "impresso" de novo
      this.papel.querySelectorAll('.fita__nova').forEach((e) => e.classList.remove('fita__nova'));
      this.vazio();
      this.seguindo = true;
      this.pintarRegua();
      this.rolar();
    }
  }

  const API = { Fita, classificar };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else raiz.TaquigrafoFita = API;
})(typeof window !== 'undefined' ? window : globalThis);
