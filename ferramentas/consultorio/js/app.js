// Consultório: agenda semanal, ficha do paciente (prontuário e conta
// corrente) e fechamento financeiro do mês. Estado único, telas como
// funções que devolvem HTML e eventos por delegação (data-acao).

import { dadosIniciais, iso, deIso, somarDias, segundaDe, CORES } from './dados.js';

const CHAVE = 'consultorio:v2';
const HORA_INICIO = 7;
const HORA_FIM = 21;

const hoje = iso(new Date());

const estado = {
  dados: null,
  rota: 'agenda',
  semana: segundaDe(hoje),
  pacienteSel: null,
  abaFicha: 'prontuario',
  busca: '',
  mostrarInativos: false,
  mes: hoje.slice(0, 7),
  discreto: false,
  gaveta: null,
  notaRevelada: false,
};

function carregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (salvo?.pacientes) { estado.dados = salvo; }
    estado.discreto = localStorage.getItem('consultorio:discreto') === '1';
  } catch { /* sem armazenamento */ }
  if (!estado.dados) estado.dados = dadosIniciais(hoje);
  estado.pacienteSel = estado.dados.pacientes[0]?.id ?? null;
}

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado.dados)); } catch { /* ok */ }
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const moeda = (v) => fmtMoeda.format(Number(v) || 0);
const fmtNum = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v) => fmtNum.format(Number(v) || 0);
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataCurta = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const dataLonga = (s) => `${DIAS[deIso(s).getDay()]}, ${Number(s.slice(8, 10))} de ${MESES[Number(s.slice(5, 7)) - 1]}`;
const nomeMes = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
const fimDaSessao = (hora, dur) => {
  const [h, m] = hora.split(':').map(Number);
  const t = h * 60 + m + dur;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Valor por extenso em reais, para o recibo. */
function extenso(valor) {
  const un = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const dez = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const cen = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const ate999 = (n) => {
    if (n === 100) return 'cem';
    const partes = [];
    if (n >= 100) partes.push(cen[Math.floor(n / 100)]);
    const r = n % 100;
    if (r >= 20) partes.push(dez[Math.floor(r / 10)] + (r % 10 ? ` e ${un[r % 10]}` : ''));
    else if (r > 0) partes.push(un[r]);
    return partes.join(' e ');
  };
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  const milhar = Math.floor(inteiro / 1000);
  const resto = inteiro % 1000;
  let texto = '';
  if (milhar) texto += milhar === 1 ? 'mil' : `${ate999(milhar)} mil`;
  if (resto) texto += (texto ? (resto < 100 || resto % 100 === 0 ? ' e ' : ' ') : '') + ate999(resto);
  if (inteiro) texto += inteiro === 1 ? ' real' : ' reais';
  if (centavos) texto += `${inteiro ? ' e ' : ''}${ate999(centavos)} centavo${centavos > 1 ? 's' : ''}`;
  return texto || 'zero real';
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

const paciente = (id) => estado.dados.pacientes.find((p) => p.id === id);
const iniciais = (nome) => nome.split(/\s+/).filter((x) => x.length > 2 || x === nome.split(/\s+/)[0]).map((x) => `${x[0]}.`).join(' ');
const nomeVisivel = (p) => (!p ? 'Paciente removido' : estado.discreto ? iniciais(p.nome) : p.nome);

/** Quanto a sessão gera de cobrança: realizada sempre, falta só se cobrada. */
function devidoDaSessao(s) {
  if (s.status === 'realizada') return Number(s.valor) || 0;
  if ((s.status === 'falta' || s.status === 'desmarcada') && s.cobrar) return Number(s.valor) || 0;
  return 0;
}

function contaCorrente(pid) {
  const mov = [
    ...estado.dados.sessoes.filter((s) => s.pacienteId === pid && devidoDaSessao(s) > 0 && s.data <= hoje)
      .map((s) => ({ data: s.data, descricao: s.status === 'realizada' ? `Sessão de ${dataCurta(s.data)}` : `Falta cobrada (${dataCurta(s.data)})`, debito: devidoDaSessao(s), credito: 0 })),
    ...estado.dados.pagamentos.filter((g) => g.pacienteId === pid)
      .map((g) => ({ data: g.data, descricao: `Pagamento (${METODO[g.metodo] ?? g.metodo})${g.referente ? `, ref. ${MESES[Number(g.referente.slice(5)) - 1]}` : ''}`, debito: 0, credito: Number(g.valor) })),
  ].sort((a, b) => a.data.localeCompare(b.data) || b.debito - a.debito);
  let saldo = 0;
  for (const m of mov) { saldo += m.credito - m.debito; m.saldo = saldo; }
  // Atrasado: o que foi gerado antes deste mês e ainda não entrou. O mês
  // corrente costuma ser pago no começo do mês seguinte, então não conta.
  const inicioMes = `${hoje.slice(0, 7)}-01`;
  const devidoAntes = mov.filter((m) => m.data < inicioMes).reduce((t, m) => t + m.debito, 0);
  const pagoTotal = mov.reduce((t, m) => t + m.credito, 0);
  const atrasado = Math.max(0, devidoAntes - pagoTotal);
  return { mov, saldo, atrasado };
}

/** Rótulo curto da situação financeira do paciente. */
function situacao(pid) {
  const { saldo, atrasado } = contaCorrente(pid);
  if (atrasado > 1) return { classe: 'deve', texto: `atrasado ${moeda(atrasado)}` };
  if (saldo < -1) return { classe: '', texto: `${moeda(-saldo)} do mês` };
  if (saldo > 1) return { classe: 'credito', texto: `crédito ${moeda(saldo)}` };
  return { classe: '', texto: 'em dia' };
}

const METODO = { pix: 'Pix', transferencia: 'transferência', dinheiro: 'dinheiro', cartao: 'cartão' };
const ESTADO = { agendada: 'Agendada', realizada: 'Realizada', falta: 'Faltou', desmarcada: 'Desmarcou' };

function idade(nasc) {
  const n = deIso(nasc);
  const h = deIso(hoje);
  let a = h.getFullYear() - n.getFullYear();
  if (h < new Date(h.getFullYear(), n.getMonth(), n.getDate(), 12)) a -= 1;
  return a;
}

function mesesDesde(data) {
  const d = deIso(data);
  const h = deIso(hoje);
  return (h.getFullYear() - d.getFullYear()) * 12 + h.getMonth() - d.getMonth();
}

// ---------------------------------------------------------------------------
// Ícones
// ---------------------------------------------------------------------------

const ICONE = {
  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  pacientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M15.5 14.4c2.2.2 3.8 1.8 4.5 4.6"/></svg>',
  financeiro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V9M10 19V5M16 19v-7M21 19H3"/></svg>',
};

// ---------------------------------------------------------------------------
// Trilho lateral
// ---------------------------------------------------------------------------

function trilho() {
  const devendo = estado.dados.pacientes.filter((p) => p.ativo && contaCorrente(p.id).atrasado > 1).length;
  const prof = estado.dados.profissional;
  return `
    <div class="quem"><span class="inicial">${esc(prof.nome[0])}</span><span><strong>${esc(prof.nome)}</strong><small>${esc(prof.titulo)} · ${esc(prof.crp)}</small></span></div>
    <a href="#agenda" ${estado.rota === 'agenda' ? 'aria-current="page"' : ''}>${ICONE.agenda}Agenda</a>
    <a href="#pacientes" ${estado.rota === 'pacientes' ? 'aria-current="page"' : ''}>${ICONE.pacientes}Pacientes</a>
    <a href="#financeiro" ${estado.rota === 'financeiro' ? 'aria-current="page"' : ''}>${ICONE.financeiro}Financeiro${devendo ? `<span class="badge" title="Pacientes com saldo em aberto">${devendo}</span>` : ''}</a>
    <div class="rodape">
      <label class="interruptor" title="Troca nomes por iniciais e esconde as notas"><span>Modo discreto</span><input type="checkbox" data-campo="discreto" ${estado.discreto ? 'checked' : ''}></label>
      <label class="interruptor"><span>Tema escuro</span><input type="checkbox" data-campo="tema" ${document.documentElement.dataset.tema === 'escuro' ? 'checked' : ''}></label>
      <p class="aviso-demo">Demonstração com pacientes e notas fictícios. Os dados ficam só neste navegador.</p>
    </div>`;
}

// ---------------------------------------------------------------------------
// Tela: Agenda
// ---------------------------------------------------------------------------

function telaAgenda() {
  const dias = Array.from({ length: 6 }, (_, i) => somarDias(estado.semana, i));
  const sessoes = estado.dados.sessoes.filter((s) => s.data >= dias[0] && s.data <= dias[5]);
  const realizadas = sessoes.filter((s) => s.status === 'realizada').length;
  const previstas = sessoes.filter((s) => s.status !== 'desmarcada');
  const valorPrevisto = previstas.reduce((t, s) => t + (s.status === 'falta' && !s.cobrar ? 0 : Number(s.valor)), 0);
  const horas = Array.from({ length: HORA_FIM - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  const altura = (HORA_FIM - HORA_INICIO) * 56;
  const fim = dias[5];
  const titulo = dias[0].slice(5, 7) === fim.slice(5, 7)
    ? `${Number(dias[0].slice(8))} a ${Number(fim.slice(8))} de ${MESES[Number(fim.slice(5, 7)) - 1]}`
    : `${dataCurta(dias[0])} a ${dataCurta(fim)}`;
  const agora = new Date();
  const minutosAgora = (agora.getHours() - HORA_INICIO) * 60 + agora.getMinutes();

  const bloco = (s, posicionado = true) => {
    const p = paciente(s.pacienteId);
    const [h, m] = s.hora.split(':').map(Number);
    const top = ((h - HORA_INICIO) * 60 + m) * (56 / 60);
    const alt = (s.duracao * 56) / 60 - 3;
    return `<button type="button" class="bloco-sessao ${s.status}" style="--cor:${p?.cor ?? '#888'};${posicionado ? `top:${top}px;height:${alt}px` : ''}" data-acao="abrir-sessao" data-id="${s.id}">
      <b>${esc(nomeVisivel(p))}</b>
      <small>${s.hora}${s.modalidade === 'online' ? ' · online' : ''}${s.status !== 'agendada' ? ` <span class="marca">${ESTADO[s.status]}</span>` : ''}${s.encaixe ? ' <span class="marca">encaixe</span>' : ''}</small>
    </button>`;
  };

  return `
  <div class="cabeca">
    <div><h1>Semana de ${titulo}</h1><p>Hora clínica de ${estado.dados.profissional.duracao} minutos. Clique num horário vazio para agendar.</p></div>
    <div class="acoes">
      <div class="navega-semana">
        <button class="btn btn-mini" type="button" data-acao="semana" data-dir="-1" aria-label="Semana anterior">‹</button>
        <button class="btn btn-mini" type="button" data-acao="semana" data-dir="0">Hoje</button>
        <button class="btn btn-mini" type="button" data-acao="semana" data-dir="1" aria-label="Próxima semana">›</button>
      </div>
      <button class="btn btn-acento" type="button" data-acao="nova-sessao">Nova sessão</button>
    </div>
  </div>
  <p class="resumo-semana"><span><b>${sessoes.length}</b> sessões na semana</span><span><b>${realizadas}</b> já realizadas</span><span><b>${sessoes.filter((s) => s.status === 'falta').length}</b> faltas</span><span>Previsto: <b>${moeda(valorPrevisto)}</b></span></p>

  <div class="cartao semana" role="grid" aria-label="Agenda da semana">
    <div class="canto"></div>
    ${dias.map((d) => `<div class="cab-dia ${d === hoje ? 'hoje' : ''}"><small>${DIAS[deIso(d).getDay()].slice(0, 3)}</small><span>${Number(d.slice(8))}</span><em>${sessoes.filter((s) => s.data === d && s.status !== 'desmarcada').length} sessões</em></div>`).join('')}
    <div class="horas" style="height:${altura}px">${horas.map((h) => `<div>${String(h).padStart(2, '0')}:00</div>`).join('')}</div>
    ${dias.map((d) => `
      <div class="coluna-dia ${d === hoje ? 'hoje' : ''}" style="height:${altura}px">
        ${horas.map((h) => `<button type="button" class="vaga" style="top:${(h - HORA_INICIO) * 56}px" data-acao="vaga" data-data="${d}" data-hora="${String(h).padStart(2, '0')}:00" aria-label="Agendar ${dataLonga(d)} às ${h}h"></button>`).join('')}
        ${sessoes.filter((s) => s.data === d).sort((a, b) => (a.status === 'desmarcada') - (b.status === 'desmarcada')).map((s) => bloco(s)).join('')}
        ${d === hoje && minutosAgora > 0 && minutosAgora < (HORA_FIM - HORA_INICIO) * 60 ? `<div class="agora" style="top:${minutosAgora * (56 / 60)}px"></div>` : ''}
      </div>`).join('')}
  </div>

  <div class="dias-lista">
    ${dias.map((d) => {
      const doDia = sessoes.filter((s) => s.data === d).sort((a, b) => a.hora.localeCompare(b.hora));
      return `<section><h3 class="${d === hoje ? 'hoje' : ''}">${dataLonga(d)}${d === hoje ? ' · hoje' : ''}</h3>
        ${doDia.length ? `<ul>${doDia.map((s) => `<li>${bloco(s, false)}</li>`).join('')}</ul>` : '<p class="mudo" style="margin:0">Sem sessões.</p>'}</section>`;
    }).join('')}
  </div>`;
}

// ---------------------------------------------------------------------------
// Gaveta de sessão
// ---------------------------------------------------------------------------

const gaveta = document.getElementById('gaveta');
const veu = document.getElementById('veu');

function abrirGaveta(conf) {
  estado.gaveta = conf;
  estado.notaRevelada = false;
  desenharGaveta();
  gaveta.classList.add('aberta');
  gaveta.setAttribute('aria-hidden', 'false');
  veu.classList.add('aberto');
  (gaveta.querySelector('input:checked') ?? gaveta.querySelector('select, input'))?.focus();
}

function fecharGaveta() {
  estado.gaveta = null;
  gaveta.classList.remove('aberta');
  gaveta.setAttribute('aria-hidden', 'true');
  veu.classList.remove('aberto');
}

function desenharGaveta() {
  const g = estado.gaveta;
  if (!g) return;
  if (g.tipo === 'nova') { gaveta.innerHTML = gavetaNova(g); return; }
  const s = estado.dados.sessoes.find((x) => x.id === g.id);
  const p = paciente(s.pacienteId);
  const st = g.status ?? s.status;
  const cobrar = g.cobrar ?? s.cobrar;
  const nota = g.nota ?? s.nota;
  const borrada = estado.discreto && !estado.notaRevelada;
  const futura = s.data > hoje;
  gaveta.innerHTML = `
    <header>
      <div><h2>${esc(nomeVisivel(p))}</h2><div class="sub">${dataLonga(s.data)} · ${s.hora} às ${fimDaSessao(s.hora, s.duracao)} · ${s.modalidade}</div></div>
      <button class="fechar" type="button" data-acao="fechar-gaveta" aria-label="Fechar">×</button>
    </header>
    <form class="corpo" id="form-sessao" data-form="sessao">
      <fieldset style="border:0;padding:0;margin:0">
        <legend class="campo"><span>Como foi</span></legend>
        <div class="estados" role="radiogroup">
          ${Object.entries(ESTADO).map(([k, v]) => `<label><input type="radio" name="status" value="${k}" ${st === k ? 'checked' : ''} ${futura && k !== 'agendada' && k !== 'desmarcada' ? 'disabled' : ''} data-campo="g-status"><span>${v}</span></label>`).join('')}
        </div>
      </fieldset>
      ${st === 'falta' ? `<p class="regra-falta">Falta sem aviso de ${estado.dados.politica.horasAviso} horas é cobrada pela política do consultório. Desmarque abaixo se foi um imprevisto que você decidiu abonar.</p>` : ''}
      ${st === 'falta' || st === 'desmarcada' ? `<label class="check"><input type="checkbox" name="cobrar" ${cobrar ? 'checked' : ''} data-campo="g-cobrar"> Cobrar esta sessão</label>` : ''}
      <div class="duas">
        <label class="campo"><span>Valor da sessão</span><input type="number" name="valor" min="0" step="10" value="${esc(s.valor)}"></label>
        <label class="campo"><span>Modalidade</span><select name="modalidade"><option value="presencial" ${s.modalidade === 'presencial' ? 'selected' : ''}>Presencial</option><option value="online" ${s.modalidade === 'online' ? 'selected' : ''}>Online</option></select></label>
      </div>
      ${st === 'realizada' ? `
      <div class="campo nota-privada">
        <span>Nota da sessão (privada)</span>
        <textarea name="nota" class="${borrada ? 'borrada' : ''}" placeholder="O que ficou da sessão, para retomar na próxima." data-campo="g-nota">${esc(nota)}</textarea>
        ${borrada ? '<button type="button" class="revelar" data-acao="revelar-nota">Modo discreto ligado: clique para ver a nota</button>' : ''}
      </div>
      <label class="check"><input type="checkbox" name="pagou" data-campo="g-pagou" ${g.pagou ? 'checked' : ''}> Recebi o pagamento agora</label>
      ${g.pagou ? `<div class="duas">
        <label class="campo"><span>Valor recebido</span><input type="number" name="valorPago" min="0" step="10" value="${esc(s.valor)}"></label>
        <label class="campo"><span>Forma</span><select name="metodo">${Object.entries(METODO).map(([k, v]) => `<option value="${k}">${v[0].toUpperCase()}${v.slice(1)}</option>`).join('')}</select></label>
      </div>` : ''}` : ''}
      <details ${g.remarcar ? 'open' : ''}>
        <summary class="btn-link" style="list-style:none;display:inline">Remarcar para outro dia ou horário</summary>
        <div class="duas" style="margin-top:10px">
          <label class="campo"><span>Data</span><input type="date" name="data" value="${s.data}"></label>
          <label class="campo"><span>Horário</span><input type="time" name="hora" value="${s.hora}" step="600"></label>
        </div>
      </details>
      <p style="margin:0"><button class="btn-link" type="button" data-acao="ver-ficha" data-id="${p?.id}">Abrir a ficha de ${esc(nomeVisivel(p))}</button></p>
    </form>
    <footer>
      <button class="btn btn-perigo" type="button" data-acao="excluir-sessao">Excluir</button>
      <span style="display:flex;gap:8px"><button class="btn" type="button" data-acao="fechar-gaveta">Cancelar</button><button class="btn btn-acento" type="submit" form="form-sessao">Salvar</button></span>
    </footer>`;
}

function gavetaNova(g) {
  const ativos = estado.dados.pacientes.filter((p) => p.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  const p = paciente(g.pacienteId) ?? null;
  return `
    <header>
      <div><h2>Nova sessão</h2><div class="sub">${dataLonga(g.data)} · ${g.hora}</div></div>
      <button class="fechar" type="button" data-acao="fechar-gaveta" aria-label="Fechar">×</button>
    </header>
    <form class="corpo" id="form-nova" data-form="nova">
      <label class="campo"><span>Paciente</span><select name="pacienteId" required data-campo="g-paciente"><option value="">Escolha</option>${ativos.map((x) => `<option value="${x.id}" ${x.id === g.pacienteId ? 'selected' : ''}>${esc(nomeVisivel(x))}</option>`).join('')}</select></label>
      <div class="duas">
        <label class="campo"><span>Data</span><input type="date" name="data" value="${g.data}" required></label>
        <label class="campo"><span>Horário</span><input type="time" name="hora" value="${g.hora}" step="600" required></label>
        <label class="campo"><span>Valor</span><input type="number" name="valor" min="0" step="10" value="${p?.valor ?? ''}"></label>
        <label class="campo"><span>Modalidade</span><select name="modalidade"><option value="presencial" ${p?.modalidade !== 'online' ? 'selected' : ''}>Presencial</option><option value="online" ${p?.modalidade === 'online' ? 'selected' : ''}>Online</option></select></label>
      </div>
      <label class="campo"><span>Repetir</span>
        <select name="repetir">
          <option value="0">Só esta sessão (encaixe)</option>
          <option value="7">Toda semana, nas próximas 8 semanas</option>
          <option value="14">A cada 15 dias, nas próximas 8 semanas</option>
        </select>
      </label>
      ${conflito(g.data, g.hora) ? `<p class="regra-falta">Já existe ${esc(conflito(g.data, g.hora))} neste horário.</p>` : ''}
    </form>
    <footer><span></span><span style="display:flex;gap:8px"><button class="btn" type="button" data-acao="fechar-gaveta">Cancelar</button><button class="btn btn-acento" type="submit" form="form-nova">Agendar</button></span></footer>`;
}

function conflito(data, hora, ignorar = null) {
  const [h, m] = hora.split(':').map(Number);
  const ini = h * 60 + m;
  const s = estado.dados.sessoes.find((x) => {
    if (x.id === ignorar || x.data !== data || x.status === 'desmarcada') return false;
    const [xh, xm] = x.hora.split(':').map(Number);
    const xi = xh * 60 + xm;
    return ini < xi + x.duracao && xi < ini + estado.dados.profissional.duracao;
  });
  return s ? `a sessão de ${nomeVisivel(paciente(s.pacienteId))} às ${s.hora}` : '';
}

function lerGaveta(form) {
  const f = new FormData(form);
  const g = estado.gaveta;
  g.status = f.get('status') ?? g.status;
  if (form.querySelector('[name="cobrar"]')) g.cobrar = f.has('cobrar');
  if (form.querySelector('[name="nota"]')) g.nota = f.get('nota');
  g.pagou = f.has('pagou');
  g.remarcar = form.querySelector('details')?.open;
}

function salvarSessao(form) {
  const f = new FormData(form);
  const s = estado.dados.sessoes.find((x) => x.id === estado.gaveta.id);
  const novoStatus = f.get('status') ?? s.status;
  const novaData = f.get('data') || s.data;
  const novaHora = f.get('hora') || s.hora;
  if ((novaData !== s.data || novaHora !== s.hora)) {
    const c = conflito(novaData, novaHora, s.id);
    if (c && !confirm(`Já existe ${c}. Remarcar mesmo assim?`)) return;
  }
  Object.assign(s, {
    status: novoStatus,
    cobrar: novoStatus === 'realizada' || novoStatus === 'agendada' ? true : f.has('cobrar'),
    valor: Number(f.get('valor')) || 0,
    modalidade: f.get('modalidade'),
    data: novaData,
    hora: novaHora,
  });
  if (f.has('nota')) s.nota = String(f.get('nota')).trim();
  let msg = 'Sessão atualizada.';
  if (f.has('pagou') && Number(f.get('valorPago')) > 0) {
    estado.dados.pagamentos.push({ id: `g${Date.now().toString(36)}`, pacienteId: s.pacienteId, data: hoje, valor: Number(f.get('valorPago')), metodo: f.get('metodo'), referente: s.data.slice(0, 7) });
    msg = `Sessão fechada e pagamento de ${moeda(f.get('valorPago'))} registrado.`;
  }
  salvar();
  fecharGaveta();
  render();
  avisar(msg);
}

function agendar(form) {
  const f = new FormData(form);
  const p = paciente(f.get('pacienteId'));
  if (!p) { avisar('Escolha o paciente.'); return; }
  const passo = Number(f.get('repetir'));
  const quantas = passo ? Math.ceil(56 / passo) : 1;
  const novas = [];
  for (let i = 0; i < quantas; i++) {
    novas.push({
      id: `s${Date.now().toString(36)}${i}`, pacienteId: p.id, data: somarDias(f.get('data'), i * passo), hora: f.get('hora'),
      duracao: estado.dados.profissional.duracao, status: 'agendada', cobrar: true, valor: Number(f.get('valor')) || p.valor, nota: '', modalidade: f.get('modalidade'),
      encaixe: !passo,
    });
  }
  estado.dados.sessoes.push(...novas);
  salvar();
  fecharGaveta();
  render();
  avisar(novas.length > 1 ? `${novas.length} sessões agendadas para ${nomeVisivel(p)}.` : `Sessão agendada para ${nomeVisivel(p)}.`);
}

// ---------------------------------------------------------------------------
// Tela: Pacientes
// ---------------------------------------------------------------------------

function telaPacientes() {
  const termo = estado.busca.trim().toLowerCase();
  const lista = estado.dados.pacientes
    .filter((p) => (estado.mostrarInativos || p.ativo) && (!termo || p.nome.toLowerCase().includes(termo)))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const p = paciente(estado.pacienteSel) ?? lista[0];
  return `
  <div class="cabeca">
    <div><h1>Pacientes</h1><p>${estado.dados.pacientes.filter((x) => x.ativo).length} em acompanhamento. Prontuário e conta corrente de cada um.</p></div>
    <div class="acoes"><button class="btn btn-acento" type="button" data-acao="novo-paciente">Novo paciente</button></div>
  </div>
  <div class="grade-pacientes">
    <section class="cartao lista-pacientes" aria-label="Lista de pacientes">
      <div class="busca"><input type="search" placeholder="Buscar paciente" value="${esc(estado.busca)}" data-campo="busca" aria-label="Buscar paciente">
        <label class="check" style="margin-top:8px;font-size:13px"><input type="checkbox" data-campo="inativos" ${estado.mostrarInativos ? 'checked' : ''}> Mostrar acompanhamentos encerrados</label></div>
      <ul>${lista.map((x) => {
        const sit = situacao(x.id);
        return `<li><button type="button" data-acao="selecionar-paciente" data-id="${x.id}" aria-current="${x.id === p?.id}" style="--cor:${x.cor}">
          <span class="ponto"></span>
          <span><b>${esc(nomeVisivel(x))}</b><small>${DIAS[x.dia].slice(0, 3)} ${x.hora} · ${x.frequencia}${x.ativo ? '' : ' · encerrado'}</small></span>
          <span class="saldo ${sit.classe}">${sit.texto}</span>
        </button></li>`;
      }).join('') || '<li class="mudo" style="padding:10px">Ninguém encontrado.</li>'}</ul>
    </section>
    ${p ? fichaPaciente(p) : '<section class="cartao ficha"><p class="mudo">Cadastre o primeiro paciente.</p></section>'}
  </div>`;
}

function fichaPaciente(p) {
  const { mov, saldo } = contaCorrente(p.id);
  const sessoes = estado.dados.sessoes.filter((s) => s.pacienteId === p.id).sort((a, b) => b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora));
  const futuras = sessoes.filter((s) => s.data >= hoje && s.status === 'agendada').reverse();
  const passadas = sessoes.filter((s) => !(s.data >= hoje && s.status === 'agendada'));
  const realizadas = passadas.filter((s) => s.status === 'realizada').length;
  const presencas = passadas.filter((s) => s.status !== 'desmarcada');
  const taxa = presencas.length ? Math.round((realizadas / presencas.length) * 100) : 100;
  const aba = estado.abaFicha;
  return `
  <section class="cartao ficha ${estado.discreto ? 'borrar' : ''}" style="--cor:${p.cor}" aria-labelledby="nome-paciente">
    <div class="topo-ficha">
      <div>
        <h2 id="nome-paciente"><i></i>${esc(nomeVisivel(p))}</h2>
        <div class="fatos">
          <span>${idade(p.nascimento)} anos</span>
          <span>em acompanhamento há ${mesesDesde(p.inicio) || 'menos de 1'} ${mesesDesde(p.inicio) === 1 ? 'mês' : 'meses'}</span>
          <span>${p.frequencia}, ${DIAS[p.dia]} às ${p.hora}</span>
          <span>${p.modalidade}</span>
          <span>${moeda(p.valor)} a sessão</span>
          <span title="Complexidade do caso">complexidade <span class="complexidade">${[1, 2, 3].map((n) => `<i class="${n <= p.complexidade ? 'on' : ''}"></i>`).join('')}</span></span>
        </div>
        <div class="fatos"><span>${realizadas} sessões realizadas</span><span>presença de ${taxa}%</span><span class="saldo ${situacao(p.id).classe}">${situacao(p.id).texto}</span></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-mini" type="button" data-acao="agendar-paciente" data-id="${p.id}">Agendar</button>
        <button class="btn btn-mini" type="button" data-acao="recibo" data-id="${p.id}" data-mes="${hoje.slice(0, 7)}">Recibo do mês</button>
      </div>
    </div>
    <div class="abas-ficha" role="tablist">
      ${[['prontuario', 'Prontuário'], ['conta', 'Conta corrente'], ['dados', 'Dados']].map(([k, v]) => `<button type="button" role="tab" aria-selected="${aba === k}" data-acao="aba-ficha" data-aba="${k}">${v}</button>`).join('')}
    </div>
    ${aba === 'prontuario' ? `
      ${p.observacoes ? `<p style="margin:0 0 14px;padding:10px 12px;border-radius:8px;background:var(--superficie-2)"><b>Observações:</b> <span class="texto-privado">${esc(p.observacoes)}</span></p>` : ''}
      ${futuras.length ? `<p class="mudo" style="margin:0 0 12px">Próximas: ${futuras.slice(0, 4).map((s) => `<button class="btn-link" type="button" data-acao="abrir-sessao" data-id="${s.id}">${dataCurta(s.data)} ${s.hora}</button>`).join(', ')}</p>` : ''}
      <ol class="linha-do-tempo">
        ${passadas.map((s) => `
          <li class="${s.status}">
            <div class="quando"><b>${dataLonga(s.data)}</b>, ${s.hora}${s.status !== 'realizada' ? `<span class="etiqueta ${s.status}">${ESTADO[s.status]}${s.status === 'falta' ? (s.cobrar ? ', cobrada' : ', abonada') : ''}</span>` : ''}
              <button class="btn-link" type="button" data-acao="abrir-sessao" data-id="${s.id}" style="margin-left:8px;font-size:13px">abrir</button></div>
            ${s.status === 'realizada' ? (s.nota ? `<p class="texto-privado">${esc(s.nota)}</p>` : '<p class="sem-nota">Sem nota registrada.</p>') : ''}
          </li>`).join('') || '<li class="mudo">Nenhuma sessão ainda.</li>'}
      </ol>` : ''}
    ${aba === 'conta' ? `
      <div class="rolagem"><table>
        <thead><tr><th>Data</th><th>Lançamento</th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo</th></tr></thead>
        <tbody>${mov.slice(-24).map((m) => `<tr><td class="num">${dataCurta(m.data)}</td><td>${esc(m.descricao)}</td><td class="n">${m.debito ? moeda(m.debito) : ''}</td><td class="n positivo">${m.credito ? moeda(m.credito) : ''}</td><td class="n mudo">${moeda(m.saldo)}</td></tr>`).join('') || '<tr><td colspan="5" class="mudo">Sem lançamentos.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="4">Saldo atual</td><td class="n ${saldo < -1 ? 'negativo' : ''}">${moeda(saldo)}</td></tr></tfoot>
      </table></div>
      <form data-form="pagamento" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:14px">
        <label class="campo" style="width:140px"><span>Valor</span><input type="number" name="valor" min="0" step="10" value="${saldo < -1 ? -saldo : p.valor}"></label>
        <label class="campo" style="width:150px"><span>Forma</span><select name="metodo">${Object.entries(METODO).map(([k, v]) => `<option value="${k}">${v[0].toUpperCase()}${v.slice(1)}</option>`).join('')}</select></label>
        <label class="campo" style="width:160px"><span>Data</span><input type="date" name="data" value="${hoje}"></label>
        <button class="btn btn-acento" type="submit">Registrar pagamento</button>
      </form>` : ''}
    ${aba === 'dados' ? formPaciente(p) : ''}
  </section>`;
}

function formPaciente(p) {
  const novo = !p.id;
  return `
    <form data-form="paciente" data-id="${p.id ?? ''}" style="display:grid;gap:12px">
      <label class="campo"><span>Nome</span><input type="text" name="nome" value="${esc(p.nome)}" required></label>
      <div class="duas">
        <label class="campo"><span>Nascimento</span><input type="date" name="nascimento" value="${esc(p.nascimento)}" required></label>
        <label class="campo"><span>Telefone</span><input type="tel" name="telefone" value="${esc(p.telefone)}"></label>
        <label class="campo"><span>Dia fixo</span><select name="dia">${[1, 2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${Number(p.dia) === d ? 'selected' : ''}>${DIAS[d]}</option>`).join('')}</select></label>
        <label class="campo"><span>Horário</span><input type="time" name="hora" value="${esc(p.hora)}" step="600"></label>
        <label class="campo"><span>Frequência</span><select name="frequencia"><option ${p.frequencia === 'semanal' ? 'selected' : ''}>semanal</option><option ${p.frequencia === 'quinzenal' ? 'selected' : ''}>quinzenal</option></select></label>
        <label class="campo"><span>Valor da sessão</span><input type="number" name="valor" min="0" step="10" value="${esc(p.valor)}"></label>
        <label class="campo"><span>Modalidade</span><select name="modalidade"><option value="presencial" ${p.modalidade === 'presencial' ? 'selected' : ''}>Presencial</option><option value="online" ${p.modalidade === 'online' ? 'selected' : ''}>Online</option></select></label>
        <label class="campo"><span>Complexidade do caso</span><select name="complexidade">${[[1, 'baixa'], [2, 'média'], [3, 'alta']].map(([n, t]) => `<option value="${n}" ${Number(p.complexidade) === n ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <label class="campo"><span>Contato de emergência</span><input type="text" name="contatoEmergencia" value="${esc(p.contatoEmergencia)}"></label>
      <label class="campo"><span>Observações</span><textarea name="observacoes">${esc(p.observacoes)}</textarea></label>
      <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
        ${novo ? '<span></span>' : `<button class="btn btn-perigo" type="button" data-acao="alternar-ativo" data-id="${p.id}">${p.ativo ? 'Encerrar acompanhamento' : 'Retomar acompanhamento'}</button>`}
        <button class="btn btn-acento" type="submit">${novo ? 'Cadastrar e agendar' : 'Salvar dados'}</button>
      </div>
    </form>`;
}

// ---------------------------------------------------------------------------
// Tela: Financeiro
// ---------------------------------------------------------------------------

function resumoMes(mes) {
  const sessoes = estado.dados.sessoes.filter((s) => s.data.slice(0, 7) === mes && s.data <= hoje);
  const pagos = estado.dados.pagamentos.filter((g) => g.data.slice(0, 7) === mes);
  return {
    sessoes,
    realizadas: sessoes.filter((s) => s.status === 'realizada').length,
    faltas: sessoes.filter((s) => s.status === 'falta'),
    desmarcadas: sessoes.filter((s) => s.status === 'desmarcada').length,
    devido: sessoes.reduce((t, s) => t + devidoDaSessao(s), 0),
    recebido: pagos.reduce((t, g) => t + Number(g.valor), 0),
  };
}

function telaFinanceiro() {
  const mes = estado.mes;
  const r = resumoMes(mes);
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = deIso(`${hoje.slice(0, 7)}-01`);
    d.setMonth(d.getMonth() - (5 - i));
    return iso(d).slice(0, 7);
  });
  const serie = meses.map((m) => ({ m, ...resumoMes(m) }));
  const maior = Math.max(...serie.map((x) => Math.max(x.devido, x.recebido)), 1);
  const linhas = estado.dados.pacientes.map((p) => {
    const ss = r.sessoes.filter((s) => s.pacienteId === p.id);
    return {
      p,
      realizadas: ss.filter((s) => s.status === 'realizada').length,
      faltasCobradas: ss.filter((s) => s.status === 'falta' && s.cobrar).length,
      devido: ss.reduce((t, s) => t + devidoDaSessao(s), 0),
      pago: estado.dados.pagamentos.filter((g) => g.pacienteId === p.id && g.data.slice(0, 7) === mes).reduce((t, g) => t + Number(g.valor), 0),
      saldo: contaCorrente(p.id).saldo,
      atrasado: contaCorrente(p.id).atrasado,
    };
  }).filter((l) => l.devido || l.pago || l.saldo < -1).sort((a, b) => a.saldo - b.saldo);
  const emAberto = linhas.filter((l) => l.atrasado > 1);
  const total = r.realizadas + r.faltas.length + r.desmarcadas;
  const pctPres = (n) => (total ? Math.round((n / total) * 100) : 0);
  const faltasCobradas = r.faltas.filter((s) => s.cobrar).length;

  return `
  <div class="cabeca">
    <div><h1>Financeiro</h1></div>
    <div class="acoes"><label class="campo" style="min-width:200px"><span class="sr">Mês</span><select data-campo="mes">${meses.slice().reverse().map((m) => `<option value="${m}" ${m === mes ? 'selected' : ''}>${nomeMes(m)}</option>`).join('')}</select></label></div>
  </div>
  <p class="frase-mes">Em ${nomeMes(mes)}${mes === hoje.slice(0, 7) ? ' (até hoje)' : ''} foram <b>${r.realizadas} sessões realizadas</b>, <b>${r.faltas.length} faltas</b> (${faltasCobradas} cobradas) e ${r.desmarcadas} desmarcadas.
    O mês gerou <b>${moeda(r.devido)}</b> a receber e entraram <b class="destaque">${moeda(r.recebido)}</b>.
    ${emAberto.length ? `${emAberto.length} paciente${emAberto.length > 1 ? 's estão' : ' está'} com pagamento atrasado de meses anteriores, somando <b>${moeda(emAberto.reduce((t, l) => t + l.atrasado, 0))}</b>.` : 'Ninguém com pagamento atrasado.'}</p>
  <div class="grade-fin">
    <section class="cartao">
      <header><h2>Por paciente</h2><p>Valores em reais. Atrasado é o que ficou de meses anteriores.</p></header>
      <div class="dentro rolagem">
        <table>
          <thead><tr><th>Paciente</th><th class="n">Sessões</th><th class="n">Devido</th><th class="n">Pago</th><th class="n">Atrasado</th><th></th></tr></thead>
          <tbody>${linhas.map((l) => `<tr>
            <td><button class="btn-link" type="button" data-acao="ver-ficha" data-id="${l.p.id}" style="text-decoration:none;color:var(--tinta)">${esc(nomeVisivel(l.p))}</button></td>
            <td class="n">${l.realizadas}${l.faltasCobradas ? ` <small class="mudo">+${l.faltasCobradas} falta</small>` : ''}</td><td class="n">${num(l.devido)}</td><td class="n">${l.pago ? num(l.pago) : ''}</td>
            <td class="n ${l.atrasado > 1 ? 'negativo' : ''}">${l.atrasado > 1 ? num(l.atrasado) : ''}</td>
            <td><button class="btn btn-mini" type="button" data-acao="recibo" data-id="${l.p.id}" data-mes="${mes}" ${l.realizadas ? '' : 'disabled'}>Recibo</button></td>
          </tr>`).join('') || '<tr><td colspan="6" class="mudo">Sem movimento no mês.</td></tr>'}</tbody>
          <tfoot><tr><td>Total</td><td class="n">${r.realizadas}${faltasCobradas ? ` <small class="mudo">+${faltasCobradas}</small>` : ''}</td><td class="n">${num(r.devido)}</td><td class="n">${num(r.recebido)}</td><td class="n negativo">${emAberto.length ? num(emAberto.reduce((t, l) => t + l.atrasado, 0)) : ''}</td><td></td></tr></tfoot>
        </table>
      </div>
    </section>
    <div style="display:grid;gap:20px">
      <section class="cartao">
        <header><h2>Seis meses</h2><p>O que as sessões geraram e o que entrou.</p></header>
        <div class="dentro">
          <div class="barras" role="img" aria-label="Devido e recebido nos últimos seis meses">
            ${serie.map((x) => `<div class="mes"><div class="pilha"><i class="devido" style="height:${(x.devido / maior) * 100}%" title="Devido ${moeda(x.devido)}"></i><i class="pago" style="height:${(x.recebido / maior) * 100}%" title="Recebido ${moeda(x.recebido)}"></i></div><small>${MESES[Number(x.m.slice(5)) - 1].slice(0, 3)}</small></div>`).join('')}
          </div>
          <div class="legenda"><span><i style="background:var(--linha-forte)"></i>gerado pelas sessões</span><span><i style="background:var(--acento)"></i>recebido</span></div>
        </div>
      </section>
      <section class="cartao">
        <header><h2>Presença no mês</h2><p>${total} sessões marcadas até hoje.</p></header>
        <div class="dentro presenca">
          ${[['Realizadas', r.realizadas, 'var(--ok)'], ['Faltas', r.faltas.length, 'var(--erro)'], ['Desmarcadas', r.desmarcadas, 'var(--tinta-3)']].map(([t, n, cor]) => `
            <div class="linha"><span>${t}</span><span class="trilha"><span style="width:${pctPres(n)}%;background:${cor}"></span></span><span class="num" style="text-align:right">${pctPres(n)}%</span></div>`).join('')}
        </div>
      </section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Recibo e diálogo de novo paciente
// ---------------------------------------------------------------------------

function imprimirRecibo(pid, mes) {
  const p = paciente(pid);
  const ss = estado.dados.sessoes.filter((s) => s.pacienteId === pid && s.data.slice(0, 7) === mes && s.status === 'realizada').sort((a, b) => a.data.localeCompare(b.data));
  if (!ss.length) { avisar('Não há sessões realizadas nesse mês para o recibo.'); return; }
  const total = ss.reduce((t, s) => t + Number(s.valor), 0);
  const prof = estado.dados.profissional;
  document.getElementById('recibo').innerHTML = `
    <h1>RECIBO</h1>
    <p class="valor">${moeda(total)}</p>
    <p>Recebi de <b>${esc(p.nome)}</b> a importância de <b>${moeda(total)}</b> (${extenso(total)}), referente a ${ss.length} ${ss.length > 1 ? 'sessões' : 'sessão'} de psicoterapia realizada${ss.length > 1 ? 's' : ''} em ${nomeMes(mes)}, nos dias ${ss.map((s) => Number(s.data.slice(8))).join(', ')}.</p>
    <p>${esc(prof.cidade)}, ${Number(hoje.slice(8))} de ${MESES[Number(hoje.slice(5, 7)) - 1]} de ${hoje.slice(0, 4)}.</p>
    <div class="assina">${esc(prof.nome)}<br>${esc(prof.titulo)} · ${esc(prof.crp)}</div>`;
  window.print();
}

const dlg = document.getElementById('dlg');

function novoPaciente() {
  const vago = { nome: '', nascimento: '1990-01-01', telefone: '', dia: 2, hora: '13:00', frequencia: 'semanal', valor: 220, modalidade: 'presencial', complexidade: 1, contatoEmergencia: '', observacoes: '' };
  dlg.innerHTML = `<div class="corpo"><h2 style="margin:0">Novo paciente</h2><p class="mudo" style="margin:0">As sessões das próximas oito semanas já entram na agenda no horário fixo.</p>${formPaciente(vago)}</div>`;
  dlg.showModal();
  dlg.querySelector('input')?.focus();
}

function salvarPaciente(form) {
  const f = Object.fromEntries(new FormData(form).entries());
  const dados = { ...f, dia: Number(f.dia), valor: Number(f.valor) || 0, complexidade: Number(f.complexidade) };
  if (form.dataset.id) {
    Object.assign(paciente(form.dataset.id), dados);
    salvar(); render(); avisar('Dados salvos.');
    return;
  }
  const id = `p${Date.now().toString(36)}`;
  const usadas = new Set(estado.dados.pacientes.map((p) => p.cor));
  const cor = CORES.find((c) => !usadas.has(c)) ?? CORES[estado.dados.pacientes.length % CORES.length];
  estado.dados.pacientes.push({ id, ...dados, inicio: hoje, cor, ativo: true });
  let data = somarDias(segundaDe(hoje), dados.dia - 1);
  if (data < hoje) data = somarDias(data, 7);
  const passo = dados.frequencia === 'quinzenal' ? 14 : 7;
  for (let d = data, i = 0; i < 8 * 7 / passo; d = somarDias(d, passo), i++) {
    estado.dados.sessoes.push({ id: `s${Date.now().toString(36)}${i}`, pacienteId: id, data: d, hora: dados.hora, duracao: estado.dados.profissional.duracao, status: 'agendada', cobrar: true, valor: dados.valor, nota: '', modalidade: dados.modalidade });
  }
  estado.pacienteSel = id;
  estado.abaFicha = 'prontuario';
  salvar();
  dlg.close();
  render();
  avisar(`${dados.nome} cadastrado com sessões a partir de ${dataCurta(data)}.`);
}

// ---------------------------------------------------------------------------
// Render, eventos
// ---------------------------------------------------------------------------

const conteudo = document.getElementById('conteudo');
const TELAS = { agenda: telaAgenda, pacientes: telaPacientes, financeiro: telaFinanceiro };

function render() {
  document.getElementById('trilho').innerHTML = trilho();
  conteudo.innerHTML = TELAS[estado.rota]();
  document.title = `${{ agenda: 'Agenda', pacientes: 'Pacientes', financeiro: 'Financeiro' }[estado.rota]} | Consultório`;
}

let tempoRecado;
function avisar(texto) {
  const el = document.getElementById('recado');
  el.textContent = texto;
  el.classList.add('visivel');
  clearTimeout(tempoRecado);
  tempoRecado = setTimeout(() => el.classList.remove('visivel'), 4000);
}

const ACOES = {
  semana: (el) => {
    const dir = Number(el.dataset.dir);
    estado.semana = dir === 0 ? segundaDe(hoje) : somarDias(estado.semana, dir * 7);
    render();
  },
  'nova-sessao': () => abrirGaveta({ tipo: 'nova', data: hoje > somarDias(estado.semana, 5) || hoje < estado.semana ? estado.semana : hoje, hora: '13:00' }),
  vaga: (el) => abrirGaveta({ tipo: 'nova', data: el.dataset.data, hora: el.dataset.hora }),
  'abrir-sessao': (el) => abrirGaveta({ tipo: 'sessao', id: el.dataset.id }),
  'fechar-gaveta': fecharGaveta,
  'revelar-nota': () => { estado.notaRevelada = true; desenharGaveta(); gaveta.querySelector('textarea')?.focus(); },
  'excluir-sessao': () => {
    if (!confirm('Excluir esta sessão da agenda? Para registrar que o paciente desmarcou, use "Desmarcou" em vez de excluir.')) return;
    estado.dados.sessoes = estado.dados.sessoes.filter((s) => s.id !== estado.gaveta.id);
    salvar(); fecharGaveta(); render(); avisar('Sessão excluída.');
  },
  'ver-ficha': (el) => {
    estado.pacienteSel = el.dataset.id;
    estado.abaFicha = 'prontuario';
    fecharGaveta();
    if (estado.rota === 'pacientes') render(); else location.hash = 'pacientes';
  },
  'selecionar-paciente': (el) => { estado.pacienteSel = el.dataset.id; render(); },
  'aba-ficha': (el) => { estado.abaFicha = el.dataset.aba; render(); },
  'agendar-paciente': (el) => {
    const p = paciente(el.dataset.id);
    let data = somarDias(segundaDe(hoje), p.dia - 1);
    if (data < hoje) data = somarDias(data, 7);
    abrirGaveta({ tipo: 'nova', data, hora: p.hora, pacienteId: p.id });
  },
  recibo: (el) => imprimirRecibo(el.dataset.id, el.dataset.mes),
  'novo-paciente': novoPaciente,
  'alternar-ativo': (el) => {
    const p = paciente(el.dataset.id);
    if (p.ativo && !confirm(`Encerrar o acompanhamento de ${p.nome}? As sessões futuras saem da agenda; o prontuário fica guardado.`)) return;
    p.ativo = !p.ativo;
    if (!p.ativo) estado.dados.sessoes = estado.dados.sessoes.filter((s) => !(s.pacienteId === p.id && s.data >= hoje && s.status === 'agendada'));
    salvar(); render(); avisar(p.ativo ? 'Acompanhamento retomado.' : 'Acompanhamento encerrado.');
  },
};

document.addEventListener('click', (ev) => {
  const alvo = ev.target.closest('[data-acao]');
  if (!alvo || alvo.disabled) return;
  const acao = ACOES[alvo.dataset.acao];
  if (!acao) return;
  ev.preventDefault();
  acao(alvo);
});

document.addEventListener('submit', (ev) => {
  const form = ev.target;
  const tipo = form.dataset.form;
  if (!tipo) return;
  ev.preventDefault();
  if (tipo === 'sessao') salvarSessao(form);
  if (tipo === 'nova') agendar(form);
  if (tipo === 'paciente') salvarPaciente(form);
  if (tipo === 'pagamento') {
    const f = new FormData(form);
    if (!(Number(f.get('valor')) > 0)) { avisar('Informe o valor.'); return; }
    estado.dados.pagamentos.push({ id: `g${Date.now().toString(36)}`, pacienteId: estado.pacienteSel, data: f.get('data'), valor: Number(f.get('valor')), metodo: f.get('metodo'), referente: String(f.get('data')).slice(0, 7) });
    salvar(); render(); avisar(`Pagamento de ${moeda(f.get('valor'))} registrado.`);
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  const campo = el.dataset.campo;
  if (campo === 'discreto') {
    estado.discreto = el.checked;
    try { localStorage.setItem('consultorio:discreto', el.checked ? '1' : '0'); } catch { /* ok */ }
    render();
    if (estado.gaveta) desenharGaveta();
    return;
  }
  if (campo === 'tema') {
    if (el.checked) document.documentElement.dataset.tema = 'escuro'; else delete document.documentElement.dataset.tema;
    try { localStorage.setItem('consultorio:tema', el.checked ? 'escuro' : 'claro'); } catch { /* ok */ }
    return;
  }
  if (campo === 'inativos') { estado.mostrarInativos = el.checked; render(); return; }
  if (campo === 'mes') { estado.mes = el.value; render(); return; }
  if (campo === 'g-status') {
    const form = el.form;
    lerGaveta(form);
    const g = estado.gaveta;
    if (g.status === 'falta') g.cobrar = true;
    if (g.status === 'desmarcada') g.cobrar = false;
    desenharGaveta();
    return;
  }
  if (campo === 'g-pagou') { lerGaveta(el.form); desenharGaveta(); return; }
  if (campo === 'g-paciente') {
    const form = el.form;
    estado.gaveta = { ...estado.gaveta, pacienteId: el.value, data: form.data.value, hora: form.hora.value };
    desenharGaveta();
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.campo === 'busca') {
    estado.busca = el.value;
    const pos = el.selectionStart;
    render();
    const novo = conteudo.querySelector('[data-campo="busca"]');
    novo?.focus();
    novo?.setSelectionRange(pos, pos);
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && estado.gaveta) fecharGaveta();
});
veu.addEventListener('click', fecharGaveta);

function lerRota() {
  const id = location.hash.replace('#', '');
  estado.rota = TELAS[id] ? id : 'agenda';
}
window.addEventListener('hashchange', () => { lerRota(); render(); window.scrollTo({ top: 0 }); });

carregar();
lerRota();
render();
