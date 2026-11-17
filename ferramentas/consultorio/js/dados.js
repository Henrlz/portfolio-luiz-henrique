// Dados fictícios do consultório: uma psicóloga com agenda semanal fixa.
// As sessões são geradas a partir do horário de cada paciente, oito semanas
// para trás e três para frente a partir de hoje, então a demo sempre parece
// "viva". Nomes, notas e números são inventados.

export const PROFISSIONAL = {
  nome: 'Helena Prado',
  titulo: 'Psicóloga clínica',
  crp: 'CRP 00/00000 (fictício)',
  cidade: 'São Paulo',
  duracao: 50,
};

export const CORES = ['#5f7f6a', '#b0702c', '#4f6d8a', '#9a4f5c', '#3f7f7c', '#7a6a3a', '#6d5a86', '#a35a3a', '#56707a', '#8a6d52', '#4d7d55', '#8c5470', '#5a6b3e', '#3e5f86'];

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function deIso(s) {
  return new Date(`${s}T12:00:00`);
}

export function somarDias(s, n) {
  const d = deIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Segunda-feira da semana de uma data. */
export function segundaDe(s) {
  const d = deIso(s);
  const dia = d.getDay();
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return iso(d);
}

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

const NOTAS = [
  'Trouxe o conflito com a chefia de novo. Conseguiu nomear a raiva sem se culpar.',
  'Sessão mais silenciosa. Falou do pai pela primeira vez sem desviar o assunto.',
  'Relatou duas noites bem dormidas. Manter o registro de sono.',
  'Retomamos a lista de situações evitadas; escolheu a menos difícil para a semana.',
  'Chorou ao falar da mudança de cidade. Combinamos voltar ao tema com calma.',
  'Chegou atrasado e irritado com o trânsito; usamos isso como material.',
  'Percebeu o padrão de pedir desculpas antes de discordar. Bom insight.',
  'Ansiedade alta por causa da prova. Treinamos respiração e preparamos o dia.',
  'Contou da conversa difícil com a irmã. Saiu aliviada.',
  'Sessão de revisão do processo: o que mudou desde o início.',
  'Pouca energia hoje. Acolhimento; sem forçar conteúdo.',
  'Trouxe um sonho recorrente. Anotou para trazer os detalhes na próxima.',
];

export function dadosIniciais(hojeStr) {
  const rand = semente(1987);
  const escolher = (l) => l[Math.floor(rand() * l.length)];

  const base = [
    ['Mariana Teixeira', 1, '08:00', 'semanal', 220, 'presencial', 2, '1991-03-14', 120],
    ['Rafael Nogueira', 1, '09:00', 'semanal', 200, 'online', 1, '1988-07-02', 410],
    ['Beatriz Lacerda', 1, '14:00', 'quinzenal', 220, 'presencial', 1, '1979-11-23', 60],
    ['Otávio Rezende', 2, '10:00', 'semanal', 240, 'presencial', 3, '1995-01-30', 300],
    ['Luísa Andrade', 2, '15:00', 'semanal', 180, 'online', 2, '2002-05-18', 45],
    ['Caio Martins', 2, '18:00', 'semanal', 220, 'presencial', 2, '1985-09-09', 520],
    ['Helena Duarte', 3, '09:00', 'semanal', 220, 'presencial', 1, '1970-02-11', 200],
    ['Pedro Assis', 3, '16:00', 'quinzenal', 200, 'online', 2, '1998-12-01', 90],
    ['Camila Freitas', 3, '19:00', 'semanal', 220, 'presencial', 3, '1993-06-27', 260],
    ['Renata Moura', 4, '08:00', 'semanal', 220, 'online', 2, '1982-04-05', 180],
    ['Thiago Barros', 4, '11:00', 'semanal', 200, 'presencial', 1, '1990-10-16', 30],
    ['Júlia Campos', 4, '17:00', 'semanal', 220, 'presencial', 2, '2000-08-21', 150],
    ['Sérgio Lima', 5, '10:00', 'quinzenal', 240, 'presencial', 1, '1964-03-03', 700],
    ['Ana Clara Souza', 5, '14:00', 'semanal', 180, 'online', 2, '2004-01-12', 20],
  ];

  const pacientes = base.map(([nome, dia, hora, frequencia, valor, modalidade, complexidade, nascimento, desdeDias], i) => ({
    id: `p${i + 1}`,
    nome, dia, hora, frequencia, valor, modalidade, complexidade, nascimento,
    inicio: somarDias(hojeStr, -desdeDias),
    telefone: `(11) 9${String(8000 + i * 137).slice(0, 4)}-${String(1000 + i * 611).slice(-4)}`,
    contatoEmergencia: '',
    cor: CORES[i % CORES.length],
    ativo: true,
    observacoes: '',
  }));
  pacientes[4].observacoes = 'Prefere ser chamada de Lu. Sessões online por câmera desligada nos primeiros minutos.';
  pacientes[8].observacoes = 'Encaminhada pela psiquiatra. Combinar contato em caso de crise.';
  pacientes[8].contatoEmergencia = 'Mãe, (11) 9000-0000';

  const sessoes = [];
  const pagamentos = [];
  const segundaAtual = segundaDe(hojeStr);
  let id = 0;

  for (const p of pacientes) {
    for (let semana = -26; semana <= 3; semana++) {
      if (p.frequencia === 'quinzenal' && Math.abs(semana) % 2 === 1) continue;
      const data = somarDias(segundaAtual, semana * 7 + (p.dia - 1));
      if (data < p.inicio) continue;
      const passada = data < hojeStr || (data === hojeStr && p.hora < '12:00');
      let status = 'agendada';
      let cobrar = true;
      let nota = '';
      if (passada) {
        const r = rand();
        if (r < 0.07) { status = 'falta'; cobrar = rand() < 0.6; }
        else if (r < 0.13) { status = 'desmarcada'; cobrar = false; }
        else { status = 'realizada'; nota = rand() < 0.75 ? escolher(NOTAS) : ''; }
      }
      sessoes.push({ id: `s${++id}`, pacienteId: p.id, data, hora: p.hora, duracao: PROFISSIONAL.duracao, status, cobrar, valor: p.valor, nota, modalidade: p.modalidade });
    }
  }

  // Uma sessão extra (encaixe) e uma remarcada nesta semana, para a agenda
  // não parecer gerada por fórmula.
  sessoes.push({ id: `s${++id}`, pacienteId: 'p6', data: somarDias(segundaAtual, 3), hora: '20:00', duracao: 50, status: 'agendada', cobrar: true, valor: 220, nota: '', modalidade: 'online', encaixe: true });

  // Pagamentos: a maioria paga no começo do mês o mês anterior; dois pacientes devem.
  const devedores = new Set(['p6', 'p9']);
  const meses = [...new Set(sessoes.filter((s) => s.data < hojeStr).map((s) => s.data.slice(0, 7)))].sort();
  for (const p of pacientes) {
    for (const mes of meses) {
      const devidas = sessoes.filter((s) => s.pacienteId === p.id && s.data.slice(0, 7) === mes && (s.status === 'realizada' || (s.status === 'falta' && s.cobrar)) && s.data < hojeStr);
      if (!devidas.length) continue;
      const total = devidas.reduce((t, s) => t + s.valor, 0);
      const ultimoMes = mes === meses[meses.length - 1];
      const penultimo = mes === meses[meses.length - 2];
      if (ultimoMes) continue; // mês corrente: paga no começo do mês que vem
      if (devedores.has(p.id) && penultimo) continue; // atrasou o mês passado
      const [ano, m] = mes.split('-').map(Number);
      const proximo = new Date(ano, m, 3 + Math.floor(rand() * 8), 12);
      const data = iso(proximo) > hojeStr ? hojeStr : iso(proximo);
      pagamentos.push({ id: `g${++id}`, pacienteId: p.id, data, valor: total, metodo: escolher(['pix', 'pix', 'pix', 'transferencia', 'cartao']), referente: mes });
    }
  }

  return {
    profissional: { ...PROFISSIONAL },
    politica: { horasAviso: 24 },
    pacientes,
    sessoes,
    pagamentos,
  };
}
