// Dados fictícios do caderno de Marina e Rafael. A data do casamento é
// sempre um 12 de dezembro com pelo menos nove meses de folga, e os prazos
// das tarefas são contados em "meses antes", como em qualquer planejamento
// de casamento. Assim a demo nunca envelhece.

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const deIso = (s) => new Date(`${s}T12:00:00`);

export function mesesAntes(dataIso, meses, dia = null) {
  const d = deIso(dataIso);
  d.setMonth(d.getMonth() - meses);
  if (dia) d.setDate(dia);
  return iso(d);
}

export function dataDoCasamento(hojeIso) {
  const h = deIso(hojeIso);
  const ano = h.getMonth() >= 2 ? h.getFullYear() + 1 : h.getFullYear();
  return `${ano}-12-12`;
}

export function dadosIniciais(hojeIso) {
  const dia = dataDoCasamento(hojeIso);
  const ano = Number(dia.slice(0, 4));
  let n = 0;
  const id = (p) => `${p}${++n}`;

  const tarefa = (titulo, meses, quem, categoria, feita = false) => ({ id: id('t'), titulo, prazo: mesesAntes(dia, meses, 10), quem, categoria, feita });
  const tarefas = [
    tarefa('Definir o orçamento total e quanto guardar por mês', 15, 'Os dois', 'Dinheiro', true),
    tarefa('Escolher a data e o horário', 15, 'Os dois', 'Geral', true),
    tarefa('Visitar três salões na região', 14, 'Os dois', 'Local', true),
    tarefa('Reservar o salão com sinal', 13, 'Rafael', 'Local', true),
    tarefa('Lista de convidados, primeira versão', 13, 'Marina', 'Convidados', true),
    tarefa('Fechar fotografia e filmagem', 12, 'Marina', 'Fornecedores'),
    tarefa('Degustação de buffet (duas empresas)', 12, 'Os dois', 'Fornecedores'),
    tarefa('Conversar com o padre sobre o curso de noivos', 11, 'Rafael', 'Cerimônia'),
    tarefa('Contratar a banda ou o DJ', 10, 'Rafael', 'Fornecedores'),
    tarefa('Primeira prova do vestido', 8, 'Marina', 'Roupas'),
    tarefa('Escolher padrinhos e madrinhas', 8, 'Os dois', 'Cerimônia'),
    tarefa('Site com informações e lista de presentes', 7, 'Rafael', 'Convidados'),
    tarefa('Decoração: paleta, flores e mesa principal', 6, 'Marina', 'Fornecedores'),
    tarefa('Mandar os save the date', 6, 'Os dois', 'Convidados'),
    tarefa('Alugar ou comprar o traje do noivo', 5, 'Rafael', 'Roupas'),
    tarefa('Entregar os convites', 3, 'Os dois', 'Convidados'),
    tarefa('Documentos do cartório (habilitação de casamento)', 3, 'Rafael', 'Cerimônia'),
    tarefa('Escolher as músicas da cerimônia', 2, 'Marina', 'Cerimônia'),
    tarefa('Confirmar a lista final com o buffet', 1, 'Os dois', 'Convidados'),
    tarefa('Mapa de mesas', 1, 'Marina', 'Convidados'),
    tarefa('Prova final do vestido e do traje', 1, 'Os dois', 'Roupas'),
    tarefa('Pagar o saldo dos fornecedores', 0, 'Rafael', 'Dinheiro'),
  ];

  const parcelas = (valor, vezes, mesesAntesInicio) => Array.from({ length: vezes }, (_, i) => ({
    vencimento: mesesAntes(dia, mesesAntesInicio - i, 5),
    valor: Math.round((valor / vezes) * 100) / 100,
    pago: mesesAntes(dia, mesesAntesInicio - i, 5) < hojeIso,
  }));

  const fornecedores = [
    { id: id('f'), categoria: 'Local', nome: 'Espaço Jabuticabeira', status: 'contratado', valor: 18500, contato: '(11) 4000-1201', obs: 'Inclui cerimônia no jardim. Limite de 100 convidados.', parcelas: parcelas(18500, 10, 13) },
    { id: id('f'), categoria: 'Buffet', nome: 'Cozinha da Lúcia', status: 'negociando', valor: 21000, contato: '(11) 4000-3344', obs: 'Degustação marcada. Pedir opção vegetariana.', parcelas: [] },
    { id: id('f'), categoria: 'Buffet', nome: 'Mesa Posta Eventos', status: 'pesquisando', valor: 23800, contato: 'contato@mesaposta.exemplo', obs: 'Orçamento por pessoa, sem bebida.', parcelas: [] },
    { id: id('f'), categoria: 'Fotografia', nome: 'Luz de Domingo Fotografia', status: 'contratado', valor: 7200, contato: '@luzdedomingo', obs: 'Making of + cerimônia + festa, 10 h.', parcelas: parcelas(7200, 6, 11) },
    { id: id('f'), categoria: 'Música', nome: 'Trio Ipê', status: 'negociando', valor: 3800, contato: '(11) 4000-7788', obs: 'Cerimônia. Pedimos "Velha Infância" na entrada.', parcelas: [] },
    { id: id('f'), categoria: 'Música', nome: 'DJ Caju', status: 'pesquisando', valor: 4200, contato: '(11) 4000-9090', obs: '', parcelas: [] },
    { id: id('f'), categoria: 'Roupas', nome: 'Ateliê Alinhavo (vestido)', status: 'contratado', valor: 6400, contato: '(11) 4000-5566', obs: 'Três provas incluídas.', parcelas: parcelas(6400, 4, 9) },
    { id: id('f'), categoria: 'Decoração', nome: 'Flor de Sal Decor', status: 'pesquisando', valor: 8900, contato: '@flordesal', obs: 'Gostamos das mesas com ramos secos.', parcelas: [] },
    { id: id('f'), categoria: 'Convites', nome: 'Papelaria Miúda', status: 'descartado', valor: 1900, contato: '', obs: 'Prazo longo demais.', parcelas: [] },
  ];

  const orcamento = [
    { categoria: 'Local', previsto: 19000 },
    { categoria: 'Buffet', previsto: 22000 },
    { categoria: 'Fotografia', previsto: 7500 },
    { categoria: 'Música', previsto: 7000 },
    { categoria: 'Roupas', previsto: 9000 },
    { categoria: 'Decoração', previsto: 8000 },
    { categoria: 'Convites', previsto: 1500 },
    { categoria: 'Cerimônia', previsto: 2000 },
  ];

  const pessoas = [
    ['Vó Terezinha', 'Marina', 'família', 0, 0, 'vai'], ['Tia Rosa e Tio Beto', 'Marina', 'família', 1, 0, 'vai'], ['Cláudia (mãe)', 'Marina', 'família', 1, 0, 'vai'],
    ['Juliana Prado', 'Marina', 'amigos', 1, 0, 'sem resposta'], ['Bianca Moraes', 'Marina', 'amigos', 1, 1, 'vai'], ['Carolina e Diego', 'Marina', 'amigos', 1, 2, 'sem resposta'],
    ['Patrícia (trabalho)', 'Marina', 'trabalho', 0, 0, 'não vai'], ['Larissa Couto', 'Marina', 'amigos', 0, 0, 'sem resposta'], ['Primos Andrade', 'Marina', 'família', 3, 2, 'vai'],
    ['Vô Antônio e Vó Aparecida', 'Rafael', 'família', 1, 0, 'vai'], ['Seu Jorge e Dona Célia (pais)', 'Rafael', 'família', 1, 0, 'vai'], ['Vinícius (irmão)', 'Rafael', 'família', 1, 0, 'vai'],
    ['Fabrício Lemos', 'Rafael', 'amigos', 1, 0, 'sem resposta'], ['Eduardo e Camila', 'Rafael', 'amigos', 1, 1, 'vai'], ['Turma do futebol', 'Rafael', 'amigos', 5, 0, 'sem resposta'],
    ['Cidinho', 'Rafael', 'amigos', 0, 0, 'vai'], ['Gerente Marcos', 'Rafael', 'trabalho', 1, 0, 'sem resposta'], ['Tia Lurdes', 'Rafael', 'família', 0, 0, 'não vai'],
    ['Daniela e Renan', 'Os dois', 'amigos', 1, 1, 'vai'], ['Cristina (que apresentou a gente)', 'Os dois', 'amigos', 1, 0, 'vai'], ['Vizinhos do 42', 'Os dois', 'amigos', 1, 0, 'sem resposta'],
    ['Amanda e Leo', 'Os dois', 'amigos', 1, 0, 'vai'], ['Pedro Assis', 'Os dois', 'amigos', 0, 0, 'sem resposta'], ['Família Okada', 'Os dois', 'amigos', 2, 1, 'vai'],
  ];
  const convidados = pessoas.map(([nome, lado, grupo, acompanhantes, criancas, rsvp]) => ({ id: id('c'), nome, lado, grupo, acompanhantes, criancas, rsvp, mesa: '' }));

  return {
    config: {
      nomes: ['Marina', 'Rafael'],
      data: dia,
      hora: '16:30',
      codigo: '0809',
      limite: 100,
      orcamentoTotal: 76000,
      juntado: 31400,
      aporteMensal: 2800,
    },
    tarefas,
    fornecedores,
    orcamento,
    convidados,
    dia: {
      cerimonia: { local: 'Jardim do Espaço Jabuticabeira', endereco: 'Estrada da Serrinha, 1200, Atibaia, SP', hora: '16:30' },
      festa: { local: 'Salão do Espaço Jabuticabeira', endereco: 'Mesmo endereço, a 50 m do jardim', hora: '18:00' },
      dressCode: 'Esporte fino. Cerimônia na grama: salto fino afunda, vale avisar.',
      roteiro: [
        { hora: '10:00', oque: 'Cabelo e maquiagem da Marina (casa da mãe)' },
        { hora: '13:30', oque: 'Fotógrafo chega para o making of' },
        { hora: '15:30', oque: 'Saída para Atibaia (uma hora de estrada)' },
        { hora: '16:30', oque: 'Cerimônia no jardim' },
        { hora: '17:15', oque: 'Fotos com as famílias, antes do sol baixar' },
        { hora: '18:00', oque: 'Recepção e jantar' },
        { hora: '20:00', oque: 'Primeira dança: Velha Infância' },
        { hora: '23:30', oque: 'Bolo e despedida' },
      ],
      contatos: [
        { nome: 'Cristina', papel: 'cerimonialista amiga', telefone: '(11) 9000-1111' },
        { nome: 'Vinícius', papel: 'irmão do Rafael, cuida das alianças', telefone: '(11) 9000-2222' },
        { nome: 'Espaço Jabuticabeira', papel: 'coordenação do local', telefone: '(11) 4000-1201' },
      ],
    },
    nos: {
      historia: [
        { quando: `${ano - 5}-03`, titulo: 'A gente se conheceu', texto: 'No aniversário da Cristina. Ele derrubou guaraná no sapato dela e passou a festa pedindo desculpa.' },
        { quando: `${ano - 5}-09`, titulo: 'Primeiro sim', texto: 'Oito de setembro, num banco da praça depois do cinema. Virou o código deste caderno.' },
        { quando: `${ano - 3}-06`, titulo: 'Primeira viagem', texto: 'Paraty, com chuva os quatro dias. Melhor viagem até hoje.' },
        { quando: `${ano - 2}-11`, titulo: 'Moramos juntos', texto: 'Apartamento pequeno, uma planta que não morre e um sofá que veio da avó.' },
        { quando: `${ano - 1}-08`, titulo: 'O pedido', texto: 'Na mesma praça. Ela disse sim antes de ele terminar a frase.' },
      ],
      musicas: [
        { titulo: 'Velha Infância, Tribalistas', momento: 'Primeira dança' },
        { titulo: 'Trem-Bala, Ana Vilela', momento: 'Entrada da noiva' },
        { titulo: 'Sina, Djavan', momento: 'Saída dos noivos' },
        { titulo: 'Anunciação, Alceu Valença', momento: 'Para a pista' },
      ],
      sonhos: ['Lua de mel no Atacama', 'Um cachorro chamado Feijão', 'Quitar o carro antes de 2030', 'Uma casa com quintal para a horta'],
    },
  };
}
