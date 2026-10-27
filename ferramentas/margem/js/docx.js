/* Escreve o .docx na mão (WordprocessingML + JSZip). Três seções:
   capa (não conta), pré-textuais (contam a partir de 1, sem número à vista)
   e textuais (número no canto superior direito, continuando a contagem). */

(function () {
  'use strict';

  const x = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  // medidas em twips (1 cm = 567)
  const CM = 567;
  const LARG_TEXTO = Math.round(16 * CM);     // 21 - 3 - 2
  const ALT_TEXTO = Math.round(24.7 * CM);    // 29,7 - 3 - 2
  const LINHA = 360;                          // 1,5 em 12 pt

  function run(t, { b, i, caps } = {}) {
    let rpr = '';
    if (b) rpr += '<w:b/>';
    if (i) rpr += '<w:i/>';
    if (caps) rpr += '<w:caps/>';
    return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
  }
  const runs = (rs) => rs.map((r) => run(r.t, r)).join('');

  function p(estilo, conteudo, extra = '') {
    return `<w:p><w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}${extra}</w:pPr>${conteudo}</w:p>`;
  }
  const quebraAntes = '<w:pageBreakBefore/>';
  const antes = (tw) => `<w:spacing w:before="${Math.max(0, Math.round(tw))}"/>`;

  function sectPr(header, inicio) {
    return `<w:sectPr><w:headerReference w:type="default" r:id="${header}"/>` +
      `<w:pgSz w:w="11906" w:h="16838"/>` +
      `<w:pgMar w:top="${3 * CM}" w:right="${2 * CM}" w:bottom="${2 * CM}" w:left="${3 * CM}" w:header="${2 * CM}" w:footer="709" w:gutter="0"/>` +
      (inicio ? `<w:pgNumType w:start="${inicio}"/>` : '') + '</w:sectPr>';
  }

  // última linha de uma seção carrega o sectPr dentro do pPr
  function fecharSecao(xml, header, inicio) {
    return xml + `<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/>${sectPr(header, inicio)}</w:pPr></w:p>`;
  }

  const linhasEstimadas = (s, porLinha) => Math.max(1, Math.ceil(s.length / porLinha));

  function capaXml(capa) {
    const autores = (capa.autores || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const titulo = (capa.titulo || 'Título do trabalho').trim();
    const tituloRuns = run(titulo, { b: true, caps: true }) + (capa.subtitulo ? run(': ' + capa.subtitulo) : '');
    const tituloLinhas = linhasEstimadas(titulo + (capa.subtitulo || ''), 48);
    const instLinhas = linhasEstimadas(capa.instituicao || '', 52) + (capa.curso ? 1 : 0);

    let usado = instLinhas * LINHA;
    let s = p('Capa', run(capa.instituicao || 'Instituição', { b: true, caps: true }));
    if (capa.curso) s += p('Capa', run(capa.curso, { caps: true }));

    const antesAutor = 2 * CM;
    autores.forEach((a, k) => { s += p('Capa', run(a, { caps: true }), k === 0 ? antes(antesAutor) : ''); });
    usado += antesAutor + Math.max(1, autores.length) * LINHA;

    const antesTitulo = ALT_TEXTO / 2 - usado - (tituloLinhas * LINHA) / 2;
    s += p('Capa', tituloRuns, antes(Math.max(LINHA, antesTitulo)));
    usado += Math.max(LINHA, antesTitulo) + tituloLinhas * LINHA;

    const antesCidade = ALT_TEXTO - usado - 2 * LINHA - 120;
    s += p('Capa', run(capa.cidade || 'Cidade'), antes(Math.max(LINHA, antesCidade)));
    s += p('Capa', run(capa.ano || ''));
    return s;
  }

  function rostoXml(capa) {
    const autores = (capa.autores || '').split('\n').map((s) => s.trim()).filter(Boolean);
    const titulo = (capa.titulo || 'Título do trabalho').trim();
    const tituloRuns = run(titulo, { b: true, caps: true }) + (capa.subtitulo ? run(': ' + capa.subtitulo) : '');
    const tituloLinhas = linhasEstimadas(titulo + (capa.subtitulo || ''), 48);
    const natureza = capa.natureza || 'Trabalho apresentado ao curso de ..., como requisito parcial para ...';
    const natLinhas = linhasEstimadas(natureza, 42) + (capa.orientador ? 2 : 0);

    let s = '';
    autores.forEach((a) => { s += p('Capa', run(a, { caps: true })); });
    let usado = Math.max(1, autores.length) * LINHA;
    const antesTitulo = ALT_TEXTO * 0.36 - usado;
    s += p('Capa', tituloRuns, antes(antesTitulo));
    usado += antesTitulo + tituloLinhas * LINHA;

    s += p('Natureza', run(natureza), antes(2 * LINHA));
    if (capa.orientador) s += p('Natureza', run('Orientador(a): ' + capa.orientador), antes(240));
    usado += 2 * LINHA + natLinhas * 240 + 240;

    s += p('Capa', run(capa.cidade || 'Cidade'), antes(Math.max(LINHA, ALT_TEXTO - usado - 2 * LINHA - 120)));
    s += p('Capa', run(capa.ano || ''));
    return s;
  }

  function itemXml(it, op) {
    switch (it.kind) {
      case 'titulo': {
        const quebra = it.nivel === 1 && op.novaPagina ? quebraAntes : '';
        return p('Heading' + it.nivel, run(it.num + ' ') + runs(it.runs), quebra);
      }
      case 'secao': return p('TituloSecao', runs(it.runs), quebraAntes);
      case 'cit': return p('Citacao', runs(it.runs));
      case 'li': return p('Lista', runs(it.runs));
      case 'ref': return p('Referencia', runs(it.runs));
      case 'chave': return p('Chave', runs(it.runs));
      default: return p(it.pre ? 'Resumo' : null, runs(it.runs));
    }
  }

  function sumarioXml(modelo, paginaDe) {
    let s = p('TituloSecao', run('SUMÁRIO'), quebraAntes);
    const linhas = modelo.sumario.map((it, k) => {
      const nivel = it.kind === 'secao' ? 1 : it.nivel;
      const estilo = 'TOC' + nivel;
      const inicio = k === 0
        ? '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-5" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        : '';
      const num = it.kind === 'titulo' ? run(it.num + ' ') : '';
      return p(estilo, inicio + num + runs(it.runs) + '<w:r><w:tab/></w:r>' + run(String(paginaDe[it.id] || '')));
    });
    s += linhas.join('');
    s += '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    return s;
  }

  function documento(modelo, capa, op, paginaDe) {
    let corpo = '';
    const temCapa = op.capa;
    const temPre = op.rosto || modelo.pre.length || (op.sumario && modelo.sumario.length);

    if (temCapa) corpo = fecharSecao(capaXml(capa), 'rIdVazio');

    if (temPre) {
      let s = '';
      if (op.rosto) s += rostoXml(capa);
      modelo.pre.forEach((it, k) => {
        let xml = itemXml(it, op);
        if (k === 0 && !op.rosto) xml = xml.replace(quebraAntes, '');
        s += xml;
      });
      if (op.sumario && modelo.sumario.length) {
        let sum = sumarioXml(modelo, paginaDe);
        if (!op.rosto && !modelo.pre.length) sum = sum.replace(quebraAntes, '');
        s += sum;
      }
      corpo += fecharSecao(s, 'rIdVazio', 1);
    }

    // o primeiro item já abre página pela quebra de seção; não precisa de outra
    const texto = modelo.texto.map((it, k) => {
      const xml = itemXml(it, op);
      return k === 0 ? xml.replace(quebraAntes, '') : xml;
    }).join('');
    corpo += texto + sectPr('rIdNum', temPre ? null : 1);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${corpo}</w:body></w:document>`;
  }

  function estilos(op) {
    const fonte = op.fonte === 'arial' ? 'Arial' : 'Times New Roman';
    // estilos com nome interno do Word (heading, toc, header) não levam customStyle
    const estilo = (id, nome, pPr, rPr, interno = false) =>
      `<w:style w:type="paragraph"${interno ? '' : ' w:customStyle="1"'} w:styleId="${id}"><w:name w:val="${nome}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr>${pPr}</w:pPr><w:rPr>${rPr}</w:rPr></w:style>`;
    const semRecuo = '<w:ind w:firstLine="0"/>';
    const simples = (depois = 0, antesTw = 0) => `<w:spacing w:before="${antesTw}" w:after="${depois}" w:line="240" w:lineRule="auto"/>`;
    const tituloP = (nivel) => `<w:keepNext/><w:keepLines/><w:spacing w:before="${LINHA}" w:after="${LINHA}" w:line="${LINHA}" w:lineRule="auto"/>${semRecuo}<w:jc w:val="left"/><w:outlineLvl w:val="${nivel - 1}"/>`;
    const tituloR = ['<w:b/><w:caps/>', '<w:caps/>', '<w:b/>', '', '<w:i/>'];
    const tab = `<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${LARG_TEXTO}"/></w:tabs>`;

    let s = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${W}>` +
      `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${fonte}" w:hAnsi="${fonte}" w:cs="${fonte}" w:eastAsia="${fonte}"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="pt-BR"/></w:rPr></w:rPrDefault>` +
      `<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="${LINHA}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
      `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="0" w:line="${LINHA}" w:lineRule="auto"/><w:ind w:firstLine="${Math.round(1.25 * CM)}"/><w:jc w:val="both"/></w:pPr></w:style>`;

    for (let n = 1; n <= 5; n++) {
      s += `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>${tituloP(n)}</w:pPr><w:rPr>${tituloR[n - 1]}</w:rPr></w:style>`;
    }
    s += estilo('TituloSecao', 'Título sem indicativo', `<w:keepNext/><w:spacing w:before="0" w:after="${LINHA}"/>${semRecuo}<w:jc w:val="center"/><w:outlineLvl w:val="0"/>`, '<w:b/><w:caps/>');
    s += estilo('Citacao', 'Citação longa', `${simples(LINHA, LINHA)}<w:ind w:left="${4 * CM}" w:firstLine="0"/><w:jc w:val="both"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>');
    s += estilo('Lista', 'Alínea', `<w:ind w:left="${Math.round(1.25 * CM)}" w:hanging="0" w:firstLine="0"/><w:jc w:val="both"/>`, '');
    s += estilo('Referencia', 'Referência', `${simples(240)}${semRecuo}<w:jc w:val="left"/>`, '');
    s += estilo('Resumo', 'Resumo', `${simples(0)}${semRecuo}<w:jc w:val="both"/>`, '');
    s += estilo('Chave', 'Palavras-chave', `${simples(0, LINHA)}${semRecuo}<w:jc w:val="both"/>`, '');
    s += estilo('Capa', 'Capa', `${semRecuo}<w:jc w:val="center"/>`, '');
    s += estilo('Natureza', 'Natureza do trabalho', `${simples(0)}<w:ind w:left="${8 * CM}" w:firstLine="0"/><w:jc w:val="both"/>`, '');
    [['<w:b/><w:caps/>'], ['<w:caps/>'], ['<w:b/>'], [''], ['<w:i/>']].forEach(([r], k) => {
      s += estilo('TOC' + (k + 1), 'toc ' + (k + 1), `${tab}${semRecuo}<w:jc w:val="left"/>`, r, true);
    });
    s += estilo('Header', 'header', `${simples(0)}${semRecuo}<w:jc w:val="right"/>`, '<w:sz w:val="20"/><w:szCs w:val="20"/>', true);
    return s + '</w:styles>';
  }

  const cabecalho = (comNumero) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr ${W}><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr>` +
    (comNumero
      ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
      : '') +
    '</w:p></w:hdr>';

  async function gerar(modelo, capa, op, paginaDe) {
    if (!window.JSZip) throw new Error('O gerador de .docx não carregou. Confere a internet e tenta de novo.');
    const z = new window.JSZip();
    // sem entradas de pasta no zip: só os arquivos, como o próprio Word grava
    const zip = { file: (n, d) => z.file(n, d, { createFolders: false }) };
    zip.file('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>');
    zip.file('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>');
    zip.file('docProps/core.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      `<dc:title>${x(capa.titulo || '')}</dc:title><dc:creator>${x((capa.autores || '').split('\n')[0] || '')}</dc:creator><dc:language>pt-BR</dc:language></cp:coreProperties>`);
    zip.file('word/_rels/document.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rIdEstilos" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rIdAjustes" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '<Relationship Id="rIdVazio" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>' +
      '</Relationships>');
    zip.file('word/settings.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${W}><w:updateFields w:val="true"/><w:defaultTabStop w:val="709"/><w:characterSpacingControl w:val="doNotCompress"/></w:settings>`);
    zip.file('word/header1.xml', cabecalho(false));
    zip.file('word/header2.xml', cabecalho(true));
    zip.file('word/styles.xml', estilos(op));
    zip.file('word/document.xml', documento(modelo, capa, op, paginaDe));
    return z.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  window.Docx = { gerar };
})();
