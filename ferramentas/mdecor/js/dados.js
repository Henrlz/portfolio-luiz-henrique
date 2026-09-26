/* Catálogo da Cedro Decor.

   Cada peça guarda largura e profundidade em METROS (l, p). É com esses dois
   números que a planta desenha o móvel em escala — tanto a miniatura do card
   quanto a peça dentro do ambiente. Mudou a medida aqui, mudou o desenho.

   As fotos são do Pexels (licença livre) e servem para simular o catálogo.
   Se alguma não carregar, o card cai no desenho técnico da peça, que é
   gerado por código e nunca falha. */

const foto = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=900`;

const AMBIENTES = [
  {
    id: 'sala',
    nome: 'Sala de estar',
    curto: 'Sala',
    desc: 'O ambiente que todo mundo vê primeiro. Sofás, poltronas e o painel da TV.',
    // retângulo do cômodo na planta, em metros
    l: 6.4, p: 5.0
  },
  {
    id: 'jantar',
    nome: 'Sala de jantar',
    curto: 'Jantar',
    desc: 'Mesas que cabem na sua casa de verdade — confira a medida antes de se apaixonar.',
    l: 5.0, p: 4.2
  },
  {
    id: 'quarto',
    nome: 'Quarto',
    curto: 'Quarto',
    desc: 'Camas, guarda-roupa e o que mais faz você dormir bem.',
    l: 5.0, p: 4.6
  },
  {
    id: 'escritorio',
    nome: 'Home office',
    curto: 'Escritório',
    desc: 'Para quem trabalha em casa e cansou de improvisar na mesa da cozinha.',
    l: 3.8, p: 3.4
  }
];

const PECAS = [
  // ---------- sala ----------
  {
    id: 'p01', ambiente: 'sala', nome: 'Sofá Retrátil Bellagio', sub: '3 lugares',
    preco: 3299.90, de: 3899.90, estoque: 8, selo: 'mais vendido',
    l: 2.10, p: 0.95, a: 0.90, forma: 'sofa',
    img: foto(1239298),
    desc: 'Retrátil e reclinável em suede, estrutura de eucalipto tratado e espuma D33. O sofá de sentar e não levantar mais.',
    cores: [
      { nome: 'Cinza grafite', hex: '#4b4b4d' },
      { nome: 'Bege areia', hex: '#d8c9ab' },
      { nome: 'Verde musgo', hex: '#5b6b52' }
    ]
  },
  {
    id: 'p02', ambiente: 'sala', nome: 'Sofá Chaise Roma', sub: 'com chaise à direita',
    preco: 4199.00, estoque: 6,
    l: 2.60, p: 1.70, a: 0.88, forma: 'chaise',
    img: foto(1866149),
    desc: 'Chaise longa de verdade, das que cabem a perna inteira. Tecido linho com tratamento antimanchas.',
    cores: [
      { nome: 'Terracota', hex: '#b5603f' },
      { nome: 'Cinza claro', hex: '#b9b7b2' }
    ]
  },
  {
    id: 'p10', ambiente: 'sala', nome: 'Poltrona Reclinável Oslo', sub: 'com apoio de pés',
    preco: 1699.00, estoque: 3,
    l: 0.80, p: 0.95, a: 1.05, forma: 'poltrona',
    img: foto(586798),
    desc: 'Reclina em três estágios e trava onde você parar. O lugar favorito da casa, sem discussão.',
    cores: [
      { nome: 'Caramelo', hex: '#9c6236' },
      { nome: 'Chumbo', hex: '#565b5e' }
    ]
  },
  {
    id: 'p11', ambiente: 'sala', nome: 'Poltrona Charlotte', sub: 'decorativa',
    preco: 1099.00, estoque: 9,
    l: 0.68, p: 0.75, a: 0.85, forma: 'poltrona',
    img: foto(1918291),
    desc: 'Pé palito em madeira maciça e encosto curvo. Ocupa pouco e resolve o canto vazio.',
    cores: [
      { nome: 'Mostarda', hex: '#c8a14a' },
      { nome: 'Azul petróleo', hex: '#2f5560' }
    ]
  },
  {
    id: 'p04', ambiente: 'sala', nome: 'Mesa de Centro Milano', sub: 'tampo em vidro',
    preco: 899.00, estoque: 14,
    l: 1.10, p: 0.60, a: 0.40, forma: 'mesa',
    img: foto(1866149),
    desc: 'Tampo de vidro temperado sobre base metálica. Leve de olhar, pesada de qualidade.',
    cores: [
      { nome: 'Preto', hex: '#1f1f21' },
      { nome: 'Dourado', hex: '#b08d57' }
    ]
  },
  {
    id: 'p08', ambiente: 'sala', nome: 'Painel para TV Oslo', sub: 'até 65 polegadas',
    preco: 1349.00, estoque: 4, selo: 'novidade',
    l: 1.80, p: 0.35, a: 0.45, forma: 'rack',
    img: foto(1571460),
    desc: 'Painel com nichos e passagem de fios escondida. Cabe TV de 65" com folga.',
    cores: [
      { nome: 'Off white', hex: '#efe9df' },
      { nome: 'Nogueira', hex: '#6b4530' }
    ]
  },
  {
    id: 'p09', ambiente: 'sala', nome: 'Rack Baixo Copenhague', sub: '2 gavetas',
    preco: 799.00, estoque: 11,
    l: 1.50, p: 0.38, a: 0.42, forma: 'rack',
    img: foto(276583),
    desc: 'Linha reta, pés de madeira e duas gavetas com corrediça metálica.',
    cores: [
      { nome: 'Natural', hex: '#c8a983' },
      { nome: 'Preto fosco', hex: '#26262a' }
    ]
  },

  // ---------- jantar ----------
  {
    id: 'p03', ambiente: 'jantar', nome: 'Mesa de Jantar Toscana', sub: '6 lugares',
    preco: 2199.00, de: 2699.00, estoque: 3, selo: 'novidade',
    l: 1.80, p: 0.90, a: 0.76, forma: 'mesa',
    img: foto(1395967),
    desc: 'Tampo em madeira maciça com acabamento fosco. Seis lugares sem apertar ninguém.',
    cores: [
      { nome: 'Imbuia', hex: '#5c3a22' },
      { nome: 'Natural', hex: '#c9a880' }
    ]
  },
  {
    id: 'p12', ambiente: 'jantar', nome: 'Mesa Nordic Compacta', sub: '4 lugares',
    preco: 1399.00, estoque: 13,
    l: 1.20, p: 0.80, a: 0.75, forma: 'mesa',
    img: foto(1080721),
    desc: 'Para apartamento: quatro lugares em 1,20 m. Pés cônicos inclinados.',
    cores: [
      { nome: 'Branco', hex: '#f2f0ec' },
      { nome: 'Carvalho', hex: '#b58b5a' }
    ]
  },
  {
    id: 'p13', ambiente: 'jantar', nome: 'Buffet Copenhague', sub: '4 portas',
    preco: 1899.00, estoque: 5,
    l: 1.60, p: 0.45, a: 0.80, forma: 'rack',
    img: foto(1350789),
    desc: 'Guarda a louça toda e ainda sobra tampo para servir.',
    cores: [
      { nome: 'Nogueira', hex: '#6b4530' },
      { nome: 'Off white', hex: '#efe9df' }
    ]
  },
  {
    id: 'p14', ambiente: 'jantar', nome: 'Cadeira Estofada Lisboa', sub: 'jogo com 2',
    preco: 749.00, estoque: 22,
    l: 0.45, p: 0.52, a: 0.92, forma: 'cadeira',
    img: foto(1395964),
    desc: 'Assento estofado e estrutura de madeira maciça. Vendida em jogo com duas.',
    cores: [
      { nome: 'Bege', hex: '#d9cbb3' },
      { nome: 'Verde oliva', hex: '#5f6b4a' }
    ]
  },

  // ---------- quarto ----------
  {
    id: 'p05', ambiente: 'quarto', nome: 'Cama Box Casal Verona', sub: 'com baú',
    preco: 2599.00, estoque: 2, selo: 'mais vendido',
    l: 1.58, p: 1.98, a: 1.20, forma: 'cama',
    img: foto(1743229),
    desc: 'Base com baú a gás e cabeceira estofada de 1,20 m. Colchão de molas ensacadas.',
    cores: [
      { nome: 'Cinza', hex: '#77777a' },
      { nome: 'Rosé', hex: '#c69b94' }
    ]
  },
  {
    id: 'p06', ambiente: 'quarto', nome: 'Cama Box Solteiro Bristol', sub: 'com auxiliar',
    preco: 1499.00, estoque: 16,
    l: 0.88, p: 1.88, a: 1.00, forma: 'cama',
    img: foto(164595),
    desc: 'Cama de solteiro com cama auxiliar embaixo — resolve a noite do amigo que dormiu.',
    cores: [
      { nome: 'Bege', hex: '#ddd0bb' },
      { nome: 'Cinza claro', hex: '#b9b7b2' }
    ]
  },
  {
    id: 'p15', ambiente: 'quarto', nome: 'Guarda-Roupa Madrid', sub: '6 portas',
    preco: 3190.00, estoque: 4,
    l: 2.70, p: 0.60, a: 2.30, forma: 'armario',
    img: foto(1454806),
    desc: 'Seis portas, dois cabideiros e espelho na porta central. Fundo reforçado.',
    cores: [
      { nome: 'Branco', hex: '#f2f0ec' },
      { nome: 'Amêndoa', hex: '#cbb79c' }
    ]
  },
  {
    id: 'p16', ambiente: 'quarto', nome: 'Criado-Mudo Nórdico', sub: '2 gavetas',
    preco: 429.00, estoque: 18,
    l: 0.48, p: 0.40, a: 0.55, forma: 'rack',
    img: foto(1034584),
    desc: 'Pequeno, de pé palito, com duas gavetas. Cabe ao lado de qualquer cama.',
    cores: [
      { nome: 'Natural', hex: '#c8a983' },
      { nome: 'Branco', hex: '#f2f0ec' }
    ]
  },

  // ---------- escritório ----------
  {
    id: 'p07', ambiente: 'escritorio', nome: 'Estante Multiuso Berlim', sub: '5 prateleiras',
    preco: 1099.00, estoque: 10,
    l: 0.90, p: 0.30, a: 1.80, forma: 'armario',
    img: foto(667838),
    desc: 'Cinco prateleiras reguláveis. Serve de estante, divisória ou as duas coisas.',
    cores: [
      { nome: 'Nogueira', hex: '#6b4530' },
      { nome: 'Preto', hex: '#26262a' }
    ]
  },
  {
    id: 'p17', ambiente: 'escritorio', nome: 'Escrivaninha Turim', sub: 'com gaveteiro',
    preco: 1249.00, estoque: 7, selo: 'novidade',
    l: 1.35, p: 0.60, a: 0.75, forma: 'mesa',
    img: foto(667839),
    desc: 'Tampo de 1,35 m com passagem de fios e gaveteiro de três gavetas.',
    cores: [
      { nome: 'Carvalho', hex: '#b58b5a' },
      { nome: 'Off white', hex: '#efe9df' }
    ]
  },
  {
    id: 'p18', ambiente: 'escritorio', nome: 'Cadeira Ergonômica Porto', sub: 'encosto em tela',
    preco: 1090.00, estoque: 6,
    l: 0.62, p: 0.62, a: 1.15, forma: 'cadeira',
    img: foto(1957478),
    desc: 'Encosto em tela, apoio lombar regulável e braços 3D. Feita para oito horas sentado.',
    cores: [
      { nome: 'Preto', hex: '#26262a' },
      { nome: 'Cinza', hex: '#77777a' }
    ]
  }
];

const ESTOQUE_BAIXO = 5;

const DEPOIMENTOS_PADRAO = [
  { nome: 'Marina Prado', cidade: 'Campinas · SP', nota: 5, texto: 'Fui até a loja com a planta do meu apartamento na mão e saí com o sofá certo. Ninguém me empurrou nada.' },
  { nome: 'Ricardo Alencar', cidade: 'Hortolândia · SP', nota: 5, texto: 'A mesa chegou no prazo e montada. O montador ainda ajustou o nível do piso torto da minha sala.' },
  { nome: 'Juliana Neves', cidade: 'Sumaré · SP', nota: 4, texto: 'Adorei o guarda-roupa. Tirei uma estrela só porque a entrega atrasou um dia, mas avisaram antes.' }
];
