// Catálogo de produtos da Cedro Decor.
// Para adicionar/editar produtos, basta alterar este array.
// "colors" define as opções de cor: name (nome exibido) e hex (usado no swatch e no preview).
//
// As fotos abaixo são do banco de imagens Pexels (uso livre, sem necessidade de
// atribuição) — servem para simular o catálogo nesta apresentação. Antes de
// publicar o site de verdade, troque pelas fotos reais dos produtos da loja
// (veja README.md, seção "Trocar as fotos pelas fotos reais da loja").
const pexels = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=800`;

const PRODUCTS = [
  {
    id: 'p01',
    name: 'Sofá Retrátil Bellagio 3 Lugares',
    category: 'sofas',
    price: 3299.90,
    oldPrice: 3899.90,
    image: pexels(1239298),
    stock: 8,
    description: 'Sofá retrátil e reclinável em tecido suede, estrutura em madeira de eucalipto tratada e espuma D33 de alta densidade. Conforto para o dia a dia com acabamento premium.',
    dimensions: '2,10m (L) x 0,95m (P) x 0,90m (A)',
    colors: [
      { name: 'Cinza Grafite', hex: '#4b4b4d' },
      { name: 'Bege Areia', hex: '#d8c9ab' },
      { name: 'Verde Musgo', hex: '#5b6b52' },
    ],
    badge: 'Mais vendido',
  },
  {
    id: 'p02',
    name: 'Sofá Chaise Long Roma',
    category: 'sofas',
    price: 4199.00,
    image: pexels(6580416),
    stock: 6,
    description: 'Sofá com chaise long, ideal para salas amplas. Tecido impermeável e almofadas soltas no encosto para maior conforto.',
    dimensions: '2,60m (L) x 1,70m (P) x 0,88m (A)',
    colors: [
      { name: 'Terracota', hex: '#b5654a' },
      { name: 'Cinza Claro', hex: '#c9c9c7' },
      { name: 'Azul Petróleo', hex: '#2f4858' },
    ],
  },
  {
    id: 'p03',
    name: 'Mesa de Jantar Toscana 6 Lugares',
    category: 'mesas',
    price: 2199.00,
    image: pexels(276746),
    stock: 3,
    description: 'Mesa de jantar em madeira maciça com pés torneados, tampo com verniz fosco resistente a manchas.',
    dimensions: '1,80m (L) x 0,90m (P) x 0,76m (A)',
    colors: [
      { name: 'Imbuia', hex: '#5a3825' },
      { name: 'Natural', hex: '#c8a374' },
      { name: 'Preto Fosco', hex: '#1c1c1c' },
    ],
    badge: 'Novidade',
  },
  {
    id: 'p04',
    name: 'Mesa de Centro Milano',
    category: 'mesas',
    price: 899.00,
    image: pexels(6903157),
    stock: 14,
    description: 'Mesa de centro com tampo de vidro temperado e base em metal, design contemporâneo.',
    dimensions: '1,10m (L) x 0,60m (P) x 0,40m (A)',
    colors: [
      { name: 'Preto', hex: '#111111' },
      { name: 'Dourado', hex: '#b08d57' },
    ],
  },
  {
    id: 'p05',
    name: 'Cama Box Casal Verona',
    category: 'camas',
    price: 2599.00,
    oldPrice: 2999.00,
    image: pexels(8135505),
    stock: 2,
    description: 'Cama box casal com cabeceira estofada botonê, tecido suede impermeável e estrutura reforçada.',
    dimensions: '1,58m (L) x 1,98m (C) x 1,20m (A cabeceira)',
    colors: [
      { name: 'Cinza', hex: '#8b8b8d' },
      { name: 'Rosé', hex: '#c9a3a0' },
      { name: 'Bege', hex: '#dcd0ba' },
    ],
    badge: 'Mais vendido',
  },
  {
    id: 'p06',
    name: 'Cama Box Solteiro Bristol',
    category: 'camas',
    price: 1499.00,
    image: pexels(4993094),
    stock: 16,
    description: 'Cama box solteiro com cabeceira reta estofada, ótimo custo-benefício para quartos de jovens e casas de campo.',
    dimensions: '0,88m (L) x 1,88m (C) x 1,00m (A cabeceira)',
    colors: [
      { name: 'Azul Marinho', hex: '#1f2d4a' },
      { name: 'Cinza Claro', hex: '#c9c9c7' },
    ],
  },
  {
    id: 'p07',
    name: 'Estante Multiuso Berlim',
    category: 'estantes',
    price: 1099.00,
    image: pexels(1565245),
    stock: 10,
    description: 'Estante em MDF com 5 prateleiras, ideal para livros, decoração e home office.',
    dimensions: '0,90m (L) x 0,30m (P) x 1,80m (A)',
    colors: [
      { name: 'Branco', hex: '#f4f2ee' },
      { name: 'Imbuia', hex: '#5a3825' },
      { name: 'Preto', hex: '#1c1c1c' },
    ],
  },
  {
    id: 'p08',
    name: 'Painel para TV Oslo 180cm',
    category: 'racks',
    price: 1349.00,
    image: pexels(3151392),
    stock: 4,
    description: 'Painel suspenso com rack integrado, nichos para decoração e passagem de fios embutida.',
    dimensions: '1,80m (L) x 0,35m (P) x 0,45m (A)',
    colors: [
      { name: 'Branco Fosco', hex: '#f4f2ee' },
      { name: 'Preto', hex: '#1c1c1c' },
      { name: 'Natural', hex: '#c8a374' },
    ],
    badge: 'Novidade',
  },
  {
    id: 'p09',
    name: 'Rack Baixo Copenhague',
    category: 'racks',
    price: 799.00,
    image: pexels(1571458),
    stock: 11,
    description: 'Rack baixo com portas de correr e nicho aberto, acabamento em laca fosca.',
    dimensions: '1,50m (L) x 0,38m (P) x 0,42m (A)',
    colors: [
      { name: 'Cinza', hex: '#8b8b8d' },
      { name: 'Branco', hex: '#f4f2ee' },
    ],
  },
  {
    id: 'p10',
    name: 'Poltrona Reclinável Oslo',
    category: 'poltronas',
    price: 1699.00,
    image: pexels(7195580),
    stock: 3,
    description: 'Poltrona do papai reclinável com sistema manual, apoio de pés e encosto ajustável.',
    dimensions: '0,80m (L) x 0,95m (P) x 1,05m (A)',
    colors: [
      { name: 'Marrom Café', hex: '#4a3327' },
      { name: 'Cinza Grafite', hex: '#4b4b4d' },
    ],
  },
  {
    id: 'p11',
    name: 'Poltrona Decorativa Charlotte',
    category: 'poltronas',
    price: 1099.00,
    image: pexels(18258470),
    stock: 9,
    description: 'Poltrona decorativa com base palito em madeira e tecido linho, perfeita para cantos de leitura.',
    dimensions: '0,68m (L) x 0,75m (P) x 0,85m (A)',
    colors: [
      { name: 'Mostarda', hex: '#c99a3a' },
      { name: 'Verde Musgo', hex: '#5b6b52' },
      { name: 'Bege', hex: '#dcd0ba' },
    ],
  },
  {
    id: 'p12',
    name: 'Mesa de Jantar Compacta Nordic 4 Lugares',
    category: 'mesas',
    price: 1399.00,
    image: pexels(8186477),
    stock: 13,
    description: 'Mesa compacta ideal para apartamentos, pés em madeira maciça e tampo em MDF laminado.',
    dimensions: '1,20m (L) x 0,80m (P) x 0,75m (A)',
    colors: [
      { name: 'Natural', hex: '#c8a374' },
      { name: 'Branco', hex: '#f4f2ee' },
    ],
  },
];

const CATEGORY_LABELS = {
  todos: 'Todos',
  sofas: 'Sofás',
  mesas: 'Mesas',
  camas: 'Camas',
  estantes: 'Estantes',
  racks: 'Racks & Painéis',
  poltronas: 'Poltronas',
};

// Quando o estoque de um produto for igual ou menor que este número,
// o site mostra automaticamente um aviso de "últimas unidades" para
// chamar atenção do cliente. Para mudar esse número, edite aqui.
const LOW_STOCK_THRESHOLD = 4;
