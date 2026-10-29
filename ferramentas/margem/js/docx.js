/* Escreve o .docx na mão (WordprocessingML + JSZip).
   ABNT: três seções — capa (não conta), pré-textuais (contam a partir de 1, sem número
   à vista) e textuais (número no canto superior direito, continuando a contagem).
   APA 7: uma seção só, número em todas as folhas a partir da folha de rosto. */

(function () {
  'use strict';

  const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';

  // medidas em twips (1 cm = 567)
  const CM = 567;

  function run(t, { b, i, caps, sz } = {}) {
    let rpr = '';
    if (b) rpr += '<w:b/>';
    if (i) rpr += '<w:i/>';
    if (caps) rpr += '<w:caps/>';
    if (sz) rpr += `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
    return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  }

  // parágrafo com as propriedades na ordem que o esquema do Word exige
  function P(estilo, conteudo, o = {}) {
    const ppr = (estilo ? `<w:pStyle w:val="${estilo}"/>` : '') +
      (o.keepNext ? '<w:keepNext/>' : '') +
      (o.quebra ? '<w:pageBreakBefore/>' : '') +
      (o.tabs || '') +
      (o.antes !== undefined ? `<w:spacing w:before="${Math.max(0, Math.round(o.antes))}"/>` : (o.spacing || '')) +
      (o.jc ? `<w:jc w:val="${o.jc}"/>` : '') +
      (o.sect || '');
    return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${conteudo}</w:p>`;
  }

  function sectPr(header, inicio, apa) {
    const m = apa
      ? '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>'
      : `<w:pgMar w:top="${3 * CM}" w:right="${2 * CM}" w:bottom="${2 * CM}" w:left="${3 * CM}" w:header="${2 * CM}" w:footer="709" w:gutter="0"/>`;
    return `<w:sectPr><w:headerReference w:type="default" r:id="${header}"/><w:footnotePr><w:numFmt w:val="decimal"/></w:footnotePr>` +
      `<w:pgSz w:w="11906" w:h="16838"/>${m}` + (inicio ? `<w:pgNumType w:start="${inicio}"/>` : '') + '</w:sectPr>';
  }

  const fecharSecao = (xml, header, inicio) => xml + P(null, '', { spacing: '<w:spacing w:line="240" w:lineRule="auto"/>', sect: sectPr(header, inicio) });
  const linhasEstimadas = (s, porLinha) => Math.max(1, Math.ceil(String(s).length / porLinha));
  const lista = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);

  function gerarXml(modelo, capa, op, paginaDe) {
    const apa = op.norma === 'apa';
    const LINHA = apa ? 480 : 360;
    const LARG = apa ? 9026 : Math.round(16 * CM);
    const ALT = Math.round(24.7 * CM);
    const notas = [];
    const imagens = [];

    const runs = (rs) => rs.map((r) => {
      if (r.nota) {
        notas.push(r.nota);
        return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${notas.length}"/></w:r>`;
      }
      return run(r.t, r);
    }).join('');

    const autores = lista(capa.autores);
    const titulo = (capa.titulo || '').trim();
    const tituloRuns = (caps) => run(titulo || '[título do trabalho]', { b: true, caps }) + (capa.subtitulo ? run(': ' + capa.subtitulo) : '');

    /* ---------- ilustrações ---------- */

    function tabelaXml(it) {
      const [cab, ...corpo] = it.linhas && it.linhas.length ? it.linhas : [['']];
      const n = Math.max(1, cab.length);
      const col = Math.floor(LARG / n);
      const quadro = it.rotulo === 'Quadro';
      const fio = (lado, sz = 6) => `<w:${lado} w:val="single" w:sz="${sz}" w:space="0" w:color="000000"/>`;
      const bordas = quadro
        ? `<w:tblBorders>${fio('top')}${fio('left')}${fio('bottom')}${fio('right')}${fio('insideH')}${fio('insideV')}</w:tblBorders>`
        // Tabela (IBGE): aberta nas laterais, fio em cima, embaixo e sob o cabeçalho
        : `<w:tblBorders>${fio('top', 8)}<w:left w:val="nil"/>${fio('bottom', 8)}<w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>`;
      const celula = (t, cabecalho) =>
        `<w:tc><w:tcPr><w:tcW w:w="${col}" w:type="dxa"/>${cabecalho && !quadro ? `<w:tcBorders>${fio('bottom')}</w:tcBorders>` : ''}</w:tcPr>` +
        P('CelulaTabela', run(t, { b: cabecalho && apa })) + '</w:tc>';
      const tr = (l, cabecalho) => `<w:tr>${cabecalho ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${l.concat(Array(Math.max(0, n - l.length)).fill('')).slice(0, n).map((c) => celula(c, cabecalho)).join('')}</w:tr>`;
      return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/>${bordas}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0"/></w:tblPr>` +
        `<w:tblGrid>${Array(n).fill(`<w:gridCol w:w="${col}"/>`).join('')}</w:tblGrid>` +
        tr(cab, true) + corpo.map((l) => tr(l, false)).join('') + '</w:tbl>';
    }

    function figuraXml(it) {
      const m = /^data:(image\/(png|jpe?g|gif));base64,(.+)$/.exec(it.src || '');
      if (!m) return P('Figura', run('[imagem]'));
      const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
      const k = imagens.length + 1;
      imagens.push({ nome: `imagem${k}.${ext}`, dados: m[3], id: 'rIdImg' + k });
      const t = window.Folhas ? window.Folhas.tamanhoFigura(it, apa ? 165.1 : 160) : { w: 120, h: 90 };
      const cx = Math.round(t.w * 36000), cy = Math.round(t.h * 36000);
      return P('Figura', `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${k}" name="${x(it.rotulo)} ${it.num}" descr="${x(it.legenda || '')}"/>` +
        `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${k}" name="imagem${k}.${ext}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="rIdImg${k}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`, { keepNext: true });
    }

    function iluXml(it) {
      const legenda = it.legenda || `[título da ${it.rotulo.toLowerCase()}]`;
      const centro = it.kind === 'figura';
      let s;
      if (apa) {
        s = P('IluNumeroAPA', run(`${it.rotulo} ${it.num}`, { b: true }), { keepNext: true }) +
          P('IluTituloAPA', run(legenda, { i: true }), { keepNext: true });
      } else {
        s = P('Legenda', run(`${it.rotulo} ${it.num} – ${legenda}`), { keepNext: true, jc: centro ? 'center' : null });
      }
      s += it.kind === 'tabela' ? tabelaXml(it) : figuraXml(it);
      if (apa) {
        if (it.fonte) s += P('FonteIlu', run('Nota. ', { i: true }) + run(it.fonte));
      } else {
        s += P('FonteIlu', run('Fonte: ' + (it.fonte || `elaborado pelo autor (${capa.ano || new Date().getFullYear()}).`)), { jc: centro ? 'center' : null });
      }
      return s;
    }

    /* ---------- itens do texto ---------- */

    function itemXml(it) {
      switch (it.kind) {
        case 'titulo':
          return P('Heading' + it.nivel, (it.num ? run(it.num + ' ') : '') + runs(it.runs), { quebra: !apa && it.nivel === 1 && op.novaPagina });
        case 'secao': return P(apa ? 'TituloSecaoAPA' : 'TituloSecao', runs(it.runs), { quebra: true });
        case 'cit': return P('Citacao', runs(it.runs));
        case 'li': return P('Lista', runs(it.runs));
        case 'ref': return P('Referencia', runs(it.runs));
        case 'chave': return P('Chave', runs(apa ? it.runs.map((r) => (r.b ? { ...r, b: false, i: true } : r)) : it.runs));
        case 'tabela': case 'figura': return iluXml(it);
        default: return P(it.pre ? 'Resumo' : null, runs(it.runs));
      }
    }
    // o primeiro item de uma seção já abre página pela quebra de seção: não leva outra
    const semQuebra = (xml) => xml.replace('<w:pageBreakBefore/>', '');

    /* ---------- APA ---------- */

    if (apa) {
      let corpo = P('Centro', tituloRuns(false), { antes: 4 * LINHA, keepNext: true }) + P('Centro', '');
      (autores.length ? autores : ['[autor]']).forEach((a) => { corpo += P('Centro', run(a)); });
      corpo += P('Centro', run([capa.curso, capa.instituicao].filter(Boolean).join(', ') || '[curso e instituição]'));
      corpo += P('Centro', run(capa.disciplina || '[disciplina]'));
      corpo += P('Centro', run(capa.orientador || '[professor(a)]'));
      corpo += P('Centro', run(capa.data || '[data de entrega]'));
      corpo += modelo.pre.map(itemXml).join('');
      corpo += P('TituloTextoAPA', tituloRuns(false), { quebra: true });
      corpo += modelo.texto.map(itemXml).join('');
      corpo += sectPr('rIdNum', 1, true);
      return { documento: corpo, notas, imagens };
    }

    /* ---------- ABNT ---------- */

    function capaXml() {
      const tituloLinhas = linhasEstimadas(titulo + (capa.subtitulo || ''), 48);
      let usado = (linhasEstimadas(capa.instituicao || '', 52) + (capa.curso ? 1 : 0)) * LINHA;
      let s = P('Capa', run(capa.instituicao || '[instituição]', { b: true, caps: true }));
      if (capa.curso) s += P('Capa', run(capa.curso, { caps: true }));
      (autores.length ? autores : ['[autor]']).forEach((a, k) => { s += P('Capa', run(a, { caps: true }), k === 0 ? { antes: 2 * CM } : {}); });
      usado += 2 * CM + Math.max(1, autores.length) * LINHA;
      const antesTitulo = Math.max(LINHA, ALT / 2 - usado - (tituloLinhas * LINHA) / 2);
      s += P('Capa', tituloRuns(true), { antes: antesTitulo });
      usado += antesTitulo + tituloLinhas * LINHA;
      s += P('Capa', run(capa.cidade || '[cidade]'), { antes: Math.max(LINHA, ALT - usado - 2 * LINHA - 120) });
      s += P('Capa', run(capa.ano || '[ano]'));
      return s;
    }

    const natureza = capa.natureza || '[natureza do trabalho]';
    function rostoXml(quebra) {
      const tituloLinhas = linhasEstimadas(titulo + (capa.subtitulo || ''), 48);
      const natLinhas = linhasEstimadas(natureza, 42) + (capa.orientador ? 2 : 0);
      let s = '';
      (autores.length ? autores : ['[autor]']).forEach((a, k) => { s += P('Capa', run(a, { caps: true }), { quebra: quebra && k === 0 }); });
      let usado = Math.max(1, autores.length) * LINHA;
      const antesTitulo = ALT * 0.36 - usado;
      s += P('Capa', tituloRuns(true), { antes: antesTitulo });
      usado += antesTitulo + tituloLinhas * LINHA;
      s += P('Natureza', run(natureza), { antes: 2 * LINHA });
      if (capa.orientador) s += P('Natureza', run('Orientador(a): ' + capa.orientador), { antes: 240 });
      usado += 2 * LINHA + natLinhas * 240 + 240;
      s += P('Capa', run(capa.cidade || '[cidade]'), { antes: Math.max(LINHA, ALT - usado - 2 * LINHA - 120) });
      s += P('Capa', run(capa.ano || '[ano]'));
      return s;
    }

    function aprovacaoXml(quebra) {
      let s = '';
      (autores.length ? autores : ['[autor]']).forEach((a, k) => { s += P('Capa', run(a, { caps: true }), { quebra: quebra && k === 0 }); });
      s += P('Capa', tituloRuns(true), { antes: 2 * LINHA });
      s += P('Natureza', run(natureza), { antes: 2 * LINHA });
      s += P('Capa', run('Aprovado em: ____ de ______________ de ______.'), { antes: 2 * LINHA, jc: 'left' });
      s += P('Capa', run('BANCA EXAMINADORA', { b: true }), { antes: 2 * LINHA });
      const banca = lista(capa.banca);
      (banca.length ? banca : [capa.orientador ? capa.orientador + ' (orientador)' : '', '', '']).forEach((m) => {
        const [nome, inst] = m.split(/\s+[–—-]\s+/);
        s += P('Capa', run('_______________________________________'), { antes: 3 * LINHA });
        s += P('Assinatura', run(nome || ''));
        if (inst) s += P('Assinatura', run(inst));
      });
      return s;
    }

    // dedicatória e epígrafe: no pé da folha, da metade para a direita
    function peDaFolha(textos, autor, quebra) {
      const ls = lista(textos);
      const altura = ls.reduce((n, l) => n + linhasEstimadas(l, 42), 0) * 240 + (autor ? 480 : 0);
      let s = ls.map((l, k) => P('Dedicatoria', run(l), k === 0 ? { quebra, antes: ALT - altura - 300 } : {})).join('');
      if (autor) s += P('Dedicatoria', run(autor), { antes: 240, jc: 'right' });
      return s;
    }

    const tab = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${LARG}"/></w:tabs>`;
    function listaXml(titulo, linhas) {
      return P('TituloSecao', run(titulo), { quebra: true }) +
        linhas.map((l) => P('ListaIlu', run(l.texto) + '<w:r><w:tab/></w:r>' + run(String(paginaDe[l.id] || '')), { tabs: tab })).join('');
    }

    function sumarioXml() {
      let s = P('TituloSecao', run('SUMÁRIO'), { quebra: true });
      s += modelo.sumario.map((it, k) => {
        const inicio = k === 0
          ? '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-5" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>'
          : '';
        const num = it.kind === 'titulo' ? run(it.num + ' ') : '';
        const texto = it.runs.filter((r) => !r.nota);
        return P('TOC' + (it.kind === 'secao' ? 1 : it.nivel), inicio + num + texto.map((r) => run(r.t, r)).join('') + '<w:r><w:tab/></w:r>' + run(String(paginaDe[it.id] || '')));
      }).join('');
      return s + '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    }

    let corpo = '';
    if (op.capa) corpo = fecharSecao(capaXml(), 'rIdVazio');

    // cada elemento pré-textual abre folha nova; o primeiro da seção não precisa (a seção já abre)
    const pre = [];
    const comQuebra = (xml, q) => (q ? xml : semQuebra(xml));
    if (op.rosto) pre.push((q) => rostoXml(q));
    if (op.aprovacao) pre.push((q) => aprovacaoXml(q));
    if (capa.dedicatoria && capa.dedicatoria.trim()) pre.push((q) => peDaFolha(capa.dedicatoria, '', q));
    if (modelo.agrad.length) pre.push((q) => comQuebra(modelo.agrad.map(itemXml).join(''), q));
    if (capa.epigrafe && capa.epigrafe.trim()) pre.push((q) => peDaFolha(capa.epigrafe, capa.epigrafeAutor, q));
    if (modelo.resumo.length) pre.push((q) => comQuebra(modelo.resumo.map(itemXml).join(''), q));
    modelo.listas.forEach((l) => pre.push((q) => comQuebra(listaXml(l.titulo, l.itens.map((it) => ({ texto: `${it.rotulo} ${it.num} – ${it.legenda || '(sem título)'}`, id: it.id }))), q)));
    if (modelo.siglas.length) {
      pre.push((q) => comQuebra(P('TituloSecao', run('LISTA DE ABREVIATURAS E SIGLAS'), { quebra: true }) +
        modelo.siglas.map((s) => P('Sigla', run(s.sigla) + '<w:r><w:tab/></w:r>' + run(s.nome))).join(''), q));
    }
    if (op.sumario && modelo.sumario.length) pre.push((q) => comQuebra(sumarioXml(), q));

    if (pre.length) corpo += fecharSecao(pre.map((fn, k) => fn(k > 0)).join(''), 'rIdVazio', 1);

    const texto = modelo.texto.map((it, k) => (k === 0 ? semQuebra(itemXml(it)) : itemXml(it))).join('');
    corpo += texto + sectPr('rIdNum', pre.length ? null : 1);
    return { documento: corpo, notas, imagens };
  }

  /* ---------- estilos ---------- */

  function estilos(op) {
    const apa = op.norma === 'apa';
    const fonte = op.fonte === 'arial' ? 'Arial' : 'Times New Roman';
    const LINHA = apa ? 480 : 360;
    const LARG = apa ? 9026 : Math.round(16 * CM);
    const estilo = (id, nome, pPr, rPr, interno = false) =>
      `<w:style w:type="paragraph"${interno ? '' : ' w:customStyle="1"'} w:styleId="${id}"><w:name w:val="${nome}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr>${pPr}</w:pPr><w:rPr>${rPr}</w:rPr></w:style>`;
    const semRecuo = '<w:ind w:firstLine="0"/>';
    const sp = (antes, depois, linha) => `<w:spacing w:before="${antes}" w:after="${depois}" w:line="${linha}" w:lineRule="auto"/>`;
    const simples = (depois = 0, antes = 0) => sp(antes, depois, 240);
    const tab = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${LARG}"/></w:tabs>`;

    let s = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}>` +
      `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${fonte}" w:hAnsi="${fonte}" w:cs="${fonte}" w:eastAsia="${fonte}"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>` +
      `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${LINHA}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr>${sp(0, 0, LINHA)}<w:ind w:firstLine="${apa ? 720 : Math.round(1.25 * CM)}"/><w:jc w:val="${apa ? 'left' : 'both'}"/></w:pPr></w:style>` +
      '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style>' +
      '<w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>';

    if (apa) {
      // APA 7: 1 centralizado negrito; 2 à esquerda negrito; 3 negrito itálico; 4 e 5 recuados
      const niv = [
        ['<w:jc w:val="center"/>', '<w:b/>'], ['<w:jc w:val="left"/>', '<w:b/>'], ['<w:jc w:val="left"/>', '<w:b/><w:i/>'],
        ['<w:ind w:firstLine="720"/><w:jc w:val="left"/>', '<w:b/>'], ['<w:ind w:firstLine="720"/><w:jc w:val="left"/>', '<w:b/><w:i/>']];
      niv.forEach(([ppr, rpr], k) => {
        s += `<w:style w:type="paragraph" w:styleId="Heading${k + 1}"><w:name w:val="heading ${k + 1}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/>${sp(0, 0, LINHA)}${k < 3 ? semRecuo : ''}${ppr}<w:outlineLvl w:val="${k}"/></w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
      });
      s += estilo('TituloSecaoAPA', 'Título de seção (APA)', `<w:keepNext/>${semRecuo}<w:jc w:val="center"/><w:outlineLvl w:val="0"/>`, '<w:b/>');
      s += estilo('TituloTextoAPA', 'Título do trabalho (APA)', `<w:keepNext/>${semRecuo}<w:jc w:val="center"/>`, '<w:b/>');
      s += estilo('Centro', 'Folha de rosto (APA)', `${semRecuo}<w:jc w:val="center"/>`, '');
      s += estilo('Citacao', 'Citação em bloco', '<w:ind w:left="720" w:firstLine="0"/>', '');
      s += estilo('Lista', 'Lista', '<w:ind w:left="720" w:firstLine="0"/>', '');
      s += estilo('Referencia', 'Referência (APA)', '<w:ind w:left="720" w:hanging="720"/><w:jc w:val="left"/>', '');
      s += estilo('Resumo', 'Resumo (APA)', `${semRecuo}<w:jc w:val="left"/>`, '');
      s += estilo('Chave', 'Palavras-chave (APA)', '<w:ind w:firstLine="720"/><w:jc w:val="left"/>', '');
      s += estilo('IluNumeroAPA', 'Número da ilustração', `<w:keepNext/>${semRecuo}<w:jc w:val="left"/>`, '<w:b/>');
      s += estilo('IluTituloAPA', 'Título da ilustração', `<w:keepNext/>${semRecuo}<w:jc w:val="left"/>`, '<w:i/>');
      s += estilo('FonteIlu', 'Nota da ilustração', `${semRecuo}<w:jc w:val="left"/>`, '');
    } else {
      const tituloP = (nivel) => `<w:keepNext/><w:keepLines/>${sp(LINHA, LINHA, LINHA)}${semRecuo}<w:jc w:val="left"/><w:outlineLvl w:val="${nivel - 1}"/>`;
      const tituloR = ['<w:b/><w:caps/>', '<w:caps/>', '<w:b/>', '', '<w:i/>'];
      for (let n = 1; n <= 5; n++) {
        s += `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>${tituloP(n)}</w:pPr><w:rPr>${tituloR[n - 1]}</w:rPr></w:style>`;
      }
      s += estilo('TituloSecao', 'Título sem indicativo', `<w:keepNext/>${sp(0, LINHA, LINHA)}${semRecuo}<w:jc w:val="center"/><w:outlineLvl w:val="0"/>`, '<w:b/><w:caps/>');
      s += estilo('Citacao', 'Citação longa', `${simples(LINHA, LINHA)}<w:ind w:left="${4 * CM}" w:firstLine="0"/><w:jc w:val="both"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>');
      s += estilo('Lista', 'Alínea', `<w:ind w:left="${Math.round(1.25 * CM)}" w:firstLine="0"/><w:jc w:val="both"/>`, '');
      s += estilo('Referencia', 'Referência', `${simples(240)}${semRecuo}<w:jc w:val="left"/>`, '');
      s += estilo('Resumo', 'Resumo', `${simples(0)}${semRecuo}<w:jc w:val="both"/>`, '');
      s += estilo('Chave', 'Palavras-chave', `${simples(0, LINHA)}${semRecuo}<w:jc w:val="both"/>`, '');
      s += estilo('Capa', 'Capa', `${semRecuo}<w:jc w:val="center"/>`, '');
      s += estilo('Assinatura', 'Assinatura da banca', `${simples(0)}${semRecuo}<w:jc w:val="center"/>`, '');
      s += estilo('Natureza', 'Natureza do trabalho', `${simples(0)}<w:ind w:left="${8 * CM}" w:firstLine="0"/><w:jc w:val="both"/>`, '');
      s += estilo('Dedicatoria', 'Dedicatória e epígrafe', `${simples(0)}<w:ind w:left="${8 * CM}" w:firstLine="0"/><w:jc w:val="both"/>`, '');
      s += estilo('ListaIlu', 'Lista de ilustrações', `${tab}${semRecuo}<w:jc w:val="left"/>`, '');
      s += estilo('Sigla', 'Lista de siglas', `<w:tabs><w:tab w:val="left" w:pos="${Math.round(2.5 * CM)}"/></w:tabs><w:ind w:left="${Math.round(2.5 * CM)}" w:hanging="${Math.round(2.5 * CM)}"/><w:jc w:val="left"/>`, '');
      s += estilo('Legenda', 'Título da ilustração', `<w:keepNext/>${simples(0, 240)}${semRecuo}<w:jc w:val="left"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>');
      s += estilo('FonteIlu', 'Fonte da ilustração', `${simples(240)}${semRecuo}<w:jc w:val="left"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>');
      [['<w:b/><w:caps/>'], ['<w:caps/>'], ['<w:b/>'], [''], ['<w:i/>']].forEach(([r], k) => {
        s += estilo('TOC' + (k + 1), 'toc ' + (k + 1), `${tab}${semRecuo}<w:jc w:val="left"/>`, r, true);
      });
    }
    s += estilo('Figura', 'Imagem', `<w:keepNext/>${simples(0)}${semRecuo}<w:jc w:val="center"/>`, '');
    s += estilo('CelulaTabela', 'Texto da tabela', `${simples(0)}${semRecuo}<w:jc w:val="left"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>');
    s += estilo('FootnoteText', 'footnote text', `${simples(0)}${semRecuo}<w:jc w:val="both"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>', true);
    s += estilo('Header', 'header', `${simples(0)}${semRecuo}<w:jc w:val="right"/>`, apa ? '' : '<w:sz w:val="20"/><w:szCs w:val="20"/>', true);
    return s + '</w:styles>';
  }

  const cabecalho = (comNumero) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${W}><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr>` +
    (comNumero
      ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
      : '') +
    '</w:p></w:hdr>';

  function rodapes(notas) {
    const sep = (tipo, id, el) => `<w:footnote w:type="${tipo}" w:id="${id}"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:${el}/></w:r></w:p></w:footnote>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes ${W}>` +
      sep('separator', -1, 'separator') + sep('continuationSeparator', 0, 'continuationSeparator') +
      notas.map((n, k) => `<w:footnote w:id="${k + 1}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r>${run(' ' + n)}</w:p></w:footnote>`).join('') +
      '</w:footnotes>';
  }

  async function gerar(modelo, capa, op, paginaDe) {
    if (!window.JSZip) throw new Error('O gerador de .docx não carregou. Confere a internet e tenta de novo.');
    const { documento, notas, imagens } = gerarXml(modelo, capa, op, paginaDe || {});
    const z = new window.JSZip();
    // sem entradas de pasta no zip: só os arquivos, como o próprio Word grava
    const add = (n, d, o = {}) => z.file(n, d, { createFolders: false, ...o });

    add('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>');
    add('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>');
    add('docProps/core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      `<dc:title>${x(capa.titulo || '')}</dc:title><dc:creator>${x((capa.autores || '').split('\n')[0] || '')}</dc:creator><dc:language>pt-BR</dc:language></cp:coreProperties>`);
    add('word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdAjustes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '<Relationship Id="rIdVazio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>' +
      '<Relationship Id="rIdNotas" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>' +
      imagens.map((im) => `<Relationship Id="${im.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.nome}"/>`).join('') +
      '</Relationships>');
    add('word/settings.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${W}>` +
      (op.norma !== 'apa' && op.sumario ? '<w:updateFields w:val="true"/>' : '') +
      '<w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/>' +
      '<w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr></w:settings>');
    add('word/header1.xml', cabecalho(false));
    add('word/header2.xml', cabecalho(true));
    add('word/footnotes.xml', rodapes(notas));
    add('word/styles.xml', estilos(op));
    add('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${documento}</w:body></w:document>`);
    imagens.forEach((im) => add('word/media/' + im.nome, im.dados, { base64: true }));
    return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  window.Docx = { gerar };
})();
