// Dados fictícios de demonstração: uma loja de casa e decoração com matriz
// e filial, um mês de movimento. Gerado por semente fixa, então todo mundo
// que abre a demo vê os mesmos números. Algumas anomalias são plantadas de
// propósito para a conferência ter o que apontar.

export const COMPETENCIA = '2026-10';

export const CONFIG_PADRAO = {
  cfopsSaida: ['5102', '5405', '6102', '6108'],
  cfopsDevolucao: ['1202', '2202', '1411', '2411'],
  faixaIcms: { min: 7, max: 19 },
  regras: [
    { id: 'r1', prioridade: 1, empresa: '', serie: 'EVT', cfops: '', canal: 'EVENTOS' },
    { id: 'r2', prioridade: 2, empresa: '', serie: 'POP', cfops: '', canal: 'POP-UP' },
    { id: 'r3', prioridade: 3, empresa: '', serie: 'ATC', cfops: '', canal: 'ATACADO' },
    { id: 'r4', prioridade: 4, empresa: 'MATRIZ', serie: '', cfops: '6102, 6108, 2202', canal: 'E-COMMERCE' },
    { id: 'r5', prioridade: 5, empresa: 'PINHEIROS', serie: '', cfops: '', canal: 'LOJA PINHEIROS' },
    { id: 'r6', prioridade: 6, empresa: 'MATRIZ', serie: '1', cfops: '5102, 5405, 1202', canal: 'LOJA MATRIZ' },
    { id: 'r9', prioridade: 99, empresa: '', serie: '', cfops: '', canal: 'OUTROS' },
  ],
  aliases: [
    { arquivo: 'CASA AURORA COMERCIO LTDA', interno: 'AURORA MATRIZ' },
    { arquivo: 'CASA AURORA FILIAL 02', interno: 'AURORA PINHEIROS' },
  ],
  lojas: [
    { empresa: 'AURORA MATRIZ', loja: 'MATRIZ' },
    { empresa: 'AURORA PINHEIROS', loja: 'PINHEIROS' },
  ],
  rodape: ['total geral', 'total da situação', 'subtotal', 'sistema licenciado', 'resumo'],
};

const PRODUTOS = [
  ['AU-1001', 'Vela aromática de soja 200 g', 69.9],
  ['AU-1002', 'Difusor de varetas 250 ml', 119.0],
  ['AU-1003', 'Manta de tricô 1,30 x 1,70', 289.0],
  ['AU-1004', 'Jogo americano de linho (4 un.)', 159.0],
  ['AU-1005', 'Caneca de cerâmica esmaltada', 54.9],
  ['AU-1006', 'Almofada de veludo 45 x 45', 129.0],
  ['AU-1007', 'Toalha de banho fio penteado', 99.9],
  ['AU-1008', 'Porta-retrato de madeira 15 x 21', 74.5],
  ['AU-1009', 'Cesto de fibra natural', 139.0],
  ['AU-1010', 'Luminária de mesa em latão', 449.0],
  ['AU-1011', 'Travessa de porcelana oval', 189.0],
  ['AU-1012', 'Kit taças de cristal (2 un.)', 239.0],
  ['AU-1013', 'Sabonete líquido 300 ml', 44.9],
  ['AU-1014', 'Tapete de algodão 60 x 90', 179.0],
  ['AU-1015', 'Quadro decorativo 40 x 60', 329.0],
  ['AU-1016', 'Bandeja espelhada', 209.0],
];

function semente(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dinheiro = (v) => Math.round(v * 100) / 100;

function chaveNfe(rand, nota, cnpjBase) {
  let k = `3526${10}${cnpjBase}55`;
  k += String(nota).padStart(9, '0');
  while (k.length < 44) k += Math.floor(rand() * 10);
  return k.slice(0, 44);
}

export function gerarDemo() {
  const rand = semente(20261031);
  const escolher = (lista) => lista[Math.floor(rand() * lista.length)];
  const dia = () => `${COMPETENCIA}-${String(1 + Math.floor(rand() * 31)).padStart(2, '0')}`;

  const perfis = [
    { empresa: 'AURORA MATRIZ', serie: '1', cfop: '5102', peso: 34, cnpj: '41256780000110' },
    { empresa: 'AURORA MATRIZ', serie: '2', cfop: '6108', peso: 16, cnpj: '41256780000110' },
    { empresa: 'AURORA MATRIZ', serie: '2', cfop: '6102', peso: 4, cnpj: '41256780000110' },
    { empresa: 'AURORA PINHEIROS', serie: '1', cfop: '5102', peso: 22, cnpj: '41256780000201' },
    { empresa: 'AURORA MATRIZ', serie: 'EVT', cfop: '5102', peso: 7, cnpj: '41256780000110' },
    { empresa: 'AURORA PINHEIROS', serie: 'POP', cfop: '5102', peso: 6, cnpj: '41256780000201' },
    { empresa: 'AURORA MATRIZ', serie: 'ATC', cfop: '5102', peso: 5, cnpj: '41256780000110' },
    { empresa: 'AURORA MATRIZ', serie: '1', cfop: '5405', peso: 3, cnpj: '41256780000110' },
    { empresa: 'AURORA MATRIZ', serie: '3', cfop: '5102', peso: 2, cnpj: '41256780000110' },
  ];
  const somaPesos = perfis.reduce((s, p) => s + p.peso, 0);
  const sortearPerfil = () => {
    let x = rand() * somaPesos;
    for (const p of perfis) {
      x -= p.peso;
      if (x <= 0) return p;
    }
    return perfis[0];
  };

  const saidas = [];
  let nota = 18240;
  let id = 0;
  const totalNotas = 128;

  for (let n = 0; n < totalNotas; n++) {
    const p = sortearPerfil();
    nota += 1 + Math.floor(rand() * 3);
    const emissao = dia();
    const chave = chaveNfe(rand, nota, p.cnpj.slice(0, 8));
    const itens = 1 + Math.floor(rand() * (p.serie === 'ATC' ? 5 : 3));
    const ehTroca = p.cfop === '5102' && rand() < 0.05;

    for (let i = 0; i < itens; i++) {
      const [codigo, descricao, preco] = escolher(PRODUTOS);
      const qtd = p.serie === 'ATC' ? 6 + Math.floor(rand() * 18) : 1 + Math.floor(rand() * 3);
      const precoUnit = p.serie === 'ATC' ? preco * 0.62 : preco;
      const vlrProduto = dinheiro(precoUnit * qtd);
      const desconto = rand() < 0.22 ? dinheiro(vlrProduto * (0.05 + rand() * 0.1)) : 0;
      const base = vlrProduto - desconto;

      let icms = 0;
      let difal = 0;
      if (p.cfop === '5102') icms = dinheiro(base * 0.18);
      if (p.cfop === '6102') icms = dinheiro(base * 0.12);
      if (p.cfop === '6108') {
        icms = dinheiro(base * 0.07);
        difal = dinheiro(base * 0.11);
      }
      const despAces = p.cfop.startsWith('6') && i === 0 ? dinheiro(18 + rand() * 22) : 0;

      saidas.push({
        id: `s${++id}`, empresa: p.empresa, serie: p.serie, nota: String(nota), emissao, chave, cfop: p.cfop,
        produto: codigo, descricao, qtd, vlrProduto, desconto, icms, ipi: 0,
        pis: dinheiro(base * 0.0165), cofins: dinheiro(base * 0.076), difal, despAces, troca: ehTroca,
      });
    }
  }

  // Anomalias plantadas para a conferência.
  const alvo = saidas.find((l) => l.cfop === '5102' && l.serie === '1' && l.vlrProduto > 150);
  if (alvo) alvo.icms = dinheiro(alvo.vlrProduto * 0.27);
  const alvo2 = saidas.find((l) => l.cfop === '5102' && l.empresa === 'AURORA PINHEIROS' && l.vlrProduto > 100);
  if (alvo2) alvo2.icms = dinheiro(alvo2.vlrProduto * 0.04);

  for (const [cfop, descricao, valor] of [
    ['5949', 'Remessa para conserto', 449.0],
    ['5910', 'Bonificação a cliente', 69.9],
    ['5910', 'Bonificação a cliente', 54.9],
  ]) {
    nota += 2;
    saidas.push({
      id: `s${++id}`, empresa: 'AURORA MATRIZ', serie: '1', nota: String(nota), emissao: dia(),
      chave: chaveNfe(rand, nota, '41256780'), cfop, produto: cfop === '5949' ? 'AU-1010' : 'AU-1001', descricao,
      qtd: 1, vlrProduto: valor, desconto: 0, icms: 0, ipi: 0, pis: 0, cofins: 0, difal: 0, despAces: 0, troca: false,
    });
  }

  // Devoluções (livro de entrada).
  const entradas = [];
  let notaEnt = 5310;
  const vendasParaDevolver = saidas.filter((l) => ['5102', '6108'].includes(l.cfop) && !l.troca);
  for (let n = 0; n < 15; n++) {
    const origem = escolher(vendasParaDevolver);
    notaEnt += 1 + Math.floor(rand() * 2);
    const itens = 1 + Math.floor(rand() * 2);
    const cfop = origem.cfop === '6108' ? '2202' : '1202';
    const emissao = dia();
    const chave = chaveNfe(rand, notaEnt, '41256780');
    for (let i = 0; i < itens; i++) {
      const base = i === 0 ? origem : escolher(vendasParaDevolver.filter((v) => v.empresa === origem.empresa && v.serie === origem.serie));
      const qtd = Math.min(base.qtd, 1 + Math.floor(rand() * 2));
      const unit = base.vlrProduto / base.qtd;
      const vlrProduto = dinheiro(unit * qtd);
      const aliq = cfop === '2202' ? 0.07 : 0.18;
      entradas.push({
        id: `e${++id}`, empresa: base.empresa, serie: base.serie, nota: String(notaEnt), emissao, chave, cfop,
        produto: base.produto, descricao: base.descricao, qtd, vlrProduto, desconto: 0,
        icms: dinheiro(vlrProduto * aliq), ipi: 0, pis: dinheiro(vlrProduto * 0.0165), cofins: dinheiro(vlrProduto * 0.076),
        difal: 0, notaOrigem: base.nota,
      });
    }
  }
  // Devolução de produto sem venda no mês (venda de setembro).
  notaEnt += 3;
  entradas.push({
    id: `e${++id}`, empresa: 'AURORA PINHEIROS', serie: '1', nota: String(notaEnt), emissao: `${COMPETENCIA}-04`,
    chave: chaveNfe(rand, notaEnt, '41256780'), cfop: '1202', produto: 'AU-2040', descricao: 'Espelho redondo 60 cm (coleção anterior)',
    qtd: 1, vlrProduto: 389.0, desconto: 0, icms: 70.02, ipi: 0, pis: 6.42, cofins: 29.56, difal: 0, notaOrigem: '',
  });

  // Serviços prestados (embalagem, personalização, montagem).
  const tiposServico = [
    ['14.13', 'Embalagem para presente', 18, 35, 0.02],
    ['14.06', 'Montagem de cesta personalizada', 45, 160, 0.03],
    ['24.01', 'Personalização com bordado', 30, 90, 0.05],
    ['14.06', 'Instalação de luminária', 120, 260, 0.05],
  ];
  const clientes = [
    ['Mariana Teixeira', '***.418.207-**'],
    ['Escritório Lume Arquitetura', '38.551.204/0001-73'],
    ['Paulo Henrique Moura', '***.902.115-**'],
    ['Bistrô Alecrim Ltda', '29.874.660/0001-05'],
    ['Renata Lacerda', '***.371.668-**'],
    ['Studio Vão Livre', '44.120.987/0001-31'],
  ];
  const servicos = [];
  let notaServ = 902;
  for (let n = 0; n < 34; n++) {
    const [codigo, servico, min, max, aliq] = escolher(tiposServico);
    const [cliente, doc] = escolher(clientes);
    const valor = dinheiro(min + rand() * (max - min));
    servicos.push({
      id: `v${++id}`, loja: rand() < 0.62 ? 'MATRIZ' : 'PINHEIROS', nota: String(++notaServ), emissao: dia(),
      cliente, documento: doc, codigo, servico, valor, aliqIss: aliq * 100,
      iss: dinheiro(valor * aliq), pis: dinheiro(valor * 0.0165), cofins: dinheiro(valor * 0.076),
    });
  }

  const agora = new Date(`${COMPETENCIA}-31T18:40:00`);
  const lotes = [
    { id: 'l1', quando: new Date(agora.getTime() - 3 * 864e5).toISOString(), arquivo: 'livro_saida_out26_matriz_pinheiros.xlsx', livro: 'saida', lidas: saidas.length + 6, validas: saidas.length, descartadas: 6, status: 'aviso', avisos: ['6 linhas de rodapé descartadas ("Total geral", "Subtotal").', '3 lançamentos com CFOP 5910 e 5949 importados, mas fora da apuração.'] },
    { id: 'l2', quando: new Date(agora.getTime() - 3 * 864e5 + 6e5).toISOString(), arquivo: 'livro_entrada_out26.xlsx', livro: 'entrada', lidas: entradas.length + 2, validas: entradas.length, descartadas: 2, status: 'ok', avisos: ['2 linhas de rodapé descartadas.'] },
    { id: 'l3', quando: new Date(agora.getTime() - 2 * 864e5).toISOString(), arquivo: 'nfse_matriz_out26.xls', livro: 'servicos', lidas: servicos.length, validas: servicos.length, descartadas: 0, status: 'ok', avisos: [] },
    { id: 'l0', quando: new Date(agora.getTime() - 4 * 864e5).toISOString(), arquivo: 'livro_saida_out26_v1.xlsx', livro: 'saida', lidas: 41, validas: 0, descartadas: 41, status: 'erro', avisos: ['Cabeçalho não encontrado: a planilha não tem coluna de CFOP. Arquivo exportado no layout errado.'] },
  ];

  return { saidas, entradas, servicos, lotes };
}
