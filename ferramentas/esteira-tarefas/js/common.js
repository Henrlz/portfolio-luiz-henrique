const NIVEIS = [
  { valor: "ASSISTENTE", rotulo: "Assistente" },
  { valor: "ANALISTA_JR", rotulo: "Analista Jr" },
  { valor: "PLENO", rotulo: "Pleno" },
  { valor: "SENIOR", rotulo: "Sênior" },
  { valor: "GERENCIA", rotulo: "Gerência" },
  { valor: "DESENVOLVEDOR", rotulo: "Desenvolvedor" },
];

const ACOES = [
  { valor: "view", rotulo: "Ver" },
  { valor: "create", rotulo: "Criar" },
  { valor: "anexar", rotulo: "Anexar" },
  { valor: "comentar", rotulo: "Comentar" },
  { valor: "checklist", rotulo: "Checklist" },
  { valor: "assumir", rotulo: "Assumir" },
  { valor: "enviar_validacao", rotulo: "Enviar p/ validação" },
  { valor: "validar", rotulo: "Validar" },
  { valor: "reprovar", rotulo: "Reprovar" },
  { valor: "mover", rotulo: "Mover livremente" },
  { valor: "delete", rotulo: "Excluir" },
];

const MATRIZ_DEFAULT = {
  ASSISTENTE: ["view", "assumir", "enviar_validacao", "anexar", "comentar", "checklist"],
  ANALISTA_JR: ["view", "assumir", "enviar_validacao", "anexar", "comentar", "checklist", "create"],
  PLENO: ["view", "assumir", "enviar_validacao", "anexar", "comentar", "checklist", "create", "validar", "reprovar", "mover"],
  SENIOR: ["view", "assumir", "enviar_validacao", "anexar", "comentar", "checklist", "create", "validar", "reprovar", "mover", "delete"],
  GERENCIA: ["view", "assumir", "enviar_validacao", "anexar", "comentar", "checklist", "create", "validar", "reprovar", "mover", "delete"],
};

const COLUNAS = [
  { status: "FALTA_ASSUMIR", titulo: "Falta assumir" },
  { status: "EXECUTANDO", titulo: "Executando" },
  { status: "VALIDAR", titulo: "Validar" },
  { status: "FINALIZADA", titulo: "Finalizada" },
];

const TRANSICOES = {
  FALTA_ASSUMIR: { EXECUTANDO: "assumir" },
  EXECUTANDO: { VALIDAR: "enviar_validacao" },
  VALIDAR: { EXECUTANDO: "reprovar", FINALIZADA: "validar" },
};

const PRIORIDADES = [
  { valor: "BAIXA", label: "Baixa", cor: "#9ca3af" },
  { valor: "MEDIA", label: "Média", cor: "#3b82f6" },
  { valor: "ALTA", label: "Alta", cor: "#dc2626" },
];

const PESO_PRIORIDADE = { ALTA: 0, MEDIA: 1, BAIXA: 2 };

const ROTULO_ACAO_LOG = {
  criada: "criou a tarefa",
  assumida: "assumiu a tarefa",
  enviada_validacao: "enviou para validação",
  validada: "validou (concluiu) a tarefa",
  reprovada: "reprovou a tarefa",
  excluida: "excluiu a tarefa",
  anexo_adicionado: "anexou um arquivo",
  anexo_removido: "removeu um anexo",
  comentario: "comentou",
  checklist_adicionado: "adicionou um item ao checklist",
  checklist_atualizado: "atualizou um item do checklist",
  checklist_removido: "removeu um item do checklist",
  movida_livre: "moveu a tarefa livremente",
  prioridade_alterada: "alterou a prioridade",
  lembrete_prazo: "lembrete de prazo próximo enviado pelo sistema",
  lembrete_atrasada: "aviso de atraso enviado ao criador",
};

const REPRESENTANTE_POR_NIVEL = {
  ASSISTENTE: "Bruna Ramos",
  ANALISTA_JR: "Diego Martins",
  PLENO: "Carla Nogueira",
  SENIOR: "Rafael Souza",
  GERENCIA: "Patrícia Lima",
  DESENVOLVEDOR: "Ana Beatriz Costa",
};

const CHAVES = {
  tarefas: "ett:tarefas",
  excluidas: "ett:excluidas",
  usuarios: "ett:usuarios",
  matriz: "ett:matriz",
  nivel: "ett:nivelAtual",
  emails: "ett:emails",
  seeded: "ett:seeded",
};

// Recriação fiel dos templates de e-mail do backend (_layout_resultado /
// _campo / _caixa_destaque): tabelas aninhadas, que é o que sobrevive à
// maioria dos clientes de e-mail.
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function emailCampo(icone, rotulo, valor) {
  return `
    <tr>
      <td style="padding:9px 0; border-bottom:1px solid #f3f4f6; vertical-align:top; width:28px;">${icone}</td>
      <td style="padding:9px 0 9px 4px; border-bottom:1px solid #f3f4f6; vertical-align:top;">
        <div style="color:#9ca3af; font-size:11px; text-transform:uppercase; letter-spacing:.04em;">${rotulo}</div>
        <div style="color:#111827; font-size:14px; margin-top:2px;">${valor}</div>
      </td>
    </tr>`;
}

function emailCaixaDestaque(cor, corFundo, rotulo, texto) {
  return `
    <div style="margin-top:16px; padding:12px 14px; background:${corFundo}; border-left:3px solid ${cor}; border-radius:6px;">
      <div style="color:${cor}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em;">${rotulo}</div>
      <div style="color:#374151; font-size:14px; margin-top:4px;">${texto}</div>
    </div>`;
}

function emailLayout(cor, corFundo, selo, titulo, camposHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:#f3f4f6; padding:32px 16px; font-family: Arial, Helvetica, sans-serif;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:520px; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
          <tr><td style="background:${corFundo}; padding:20px 28px;">
            <span style="display:inline-block; background:${cor}; color:#fff; font-size:11px; font-weight:700;
                         letter-spacing:.05em; padding:4px 12px; border-radius:999px; text-transform:uppercase;">${selo}</span>
            <h1 style="margin:12px 0 0; font-size:20px; color:#111827;">${titulo}</h1>
          </td></tr>
          <tr><td style="padding:24px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">${camposHtml}</table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
              <tr><td style="border-radius:10px; background:${cor};">
                <span style="display:inline-block; padding:13px 26px; color:#fff; font-size:14px; font-weight:700;">Abrir a tarefa →</span>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:16px 28px; border-top:1px solid #f3f4f6;">
            <p style="margin:0; color:#9ca3af; font-size:11px;">Esteira de Tarefas · Task Management</p>
          </td></tr>
        </table>
      </td></tr>
    </table>`;
}

function getEmails() { return loadJSON(CHAVES.emails, []); }
function setEmails(v) { saveJSON(CHAVES.emails, v); }

function registrarEmail({ assunto, destinatarios, corpoHtml }) {
  const caixa = getEmails();
  caixa.unshift({
    id: uid("mail"),
    assunto,
    destinatarios: destinatarios.filter(Boolean),
    corpo_html: corpoHtml,
    enviado_em: new Date().toISOString(),
  });
  setEmails(caixa.slice(0, 50));
}

function loadJSON(chave, padrao) {
  try {
    const raw = localStorage.getItem(chave);
    return raw ? JSON.parse(raw) : padrao;
  } catch (e) {
    return padrao;
  }
}

function saveJSON(chave, valor) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

function uid(prefixo) {
  return `${prefixo || "id"}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizar(texto) {
  return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function formatarData(iso) {
  if (!iso) return "sem prazo";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(iso) {
  return new Date(iso).toLocaleString("pt-BR");
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function diaISOAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function diaISOemDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function corPrioridade(p) {
  return (PRIORIDADES.find((x) => x.valor === p) || {}).cor || "#9ca3af";
}

function rotuloPrioridade(p) {
  return (PRIORIDADES.find((x) => x.valor === p) || {}).label || p;
}

function usuario(nome) {
  return nome ? { nome } : null;
}

// `url: null` = anexo de exemplo sem conteúdo real (não foi enviado nesta
// sessão); os que o visitante anexa viram data URL e baixam de verdade.
function anexoSeed(nome, autor, diasAtrasN) {
  return {
    idmaster: uid("an"), nome_original: nome, url: null,
    criado_por: usuario(autor), created_at: diasAtras(diasAtrasN),
  };
}

function seedUsuarios() {
  return [
    { id: 1, nome: "Bruna Ramos", email: "bruna.ramos@empresa-demo.com.br", nivel: "ASSISTENTE", notificar_criacao_email: false },
    { id: 2, nome: "Thiago Alves", email: "thiago.alves@empresa-demo.com.br", nivel: "ASSISTENTE", notificar_criacao_email: false },
    { id: 3, nome: "Diego Martins", email: "diego.martins@empresa-demo.com.br", nivel: "ANALISTA_JR", notificar_criacao_email: true },
    { id: 4, nome: "Carla Nogueira", email: "carla.nogueira@empresa-demo.com.br", nivel: "PLENO", notificar_criacao_email: false },
    { id: 5, nome: "Rafael Souza", email: "rafael.souza@empresa-demo.com.br", nivel: "SENIOR", notificar_criacao_email: true },
    { id: 6, nome: "Patrícia Lima", email: "patricia.lima@empresa-demo.com.br", nivel: "GERENCIA", notificar_criacao_email: true },
    { id: 7, nome: "Ana Beatriz Costa", email: "ana.costa@empresa-demo.com.br", nivel: "DESENVOLVEDOR", notificar_criacao_email: false },
  ];
}

function seedTarefas() {
  const t = [];
  t.push({
    idmaster: uid("t"), titulo: "Aprovação de reembolso — viagem a cliente", descricao: "Conferir notas fiscais e liberar o reembolso da visita técnica.",
    observacoes: "Colaborador solicitou antecipação do pagamento.", prazo: diaISOAtras(1), status: "FALTA_ASSUMIR", prioridade: "ALTA",
    cliente: { nome: "Cedro Decor Ltda" }, criado_por: usuario("Patrícia Lima"), responsavel_atual: null, responsavel_sugerido: usuario("Bruna Ramos"),
    anexos: [], comentarios: [], checklist: [], created_at: diasAtras(2), updated_at: diasAtras(2),
    log: [{ acao: "criada", detalhes: "", usuario: usuario("Patrícia Lima"), created_at: diasAtras(2) }],
  });
  t.push({
    idmaster: uid("t"), titulo: "Cadastro de novo fornecedor — insumos de embalagem", descricao: "Validar documentação fiscal e cadastrar no sistema.",
    observacoes: "", prazo: diaISOemDias(3), status: "FALTA_ASSUMIR", prioridade: "MEDIA",
    cliente: { nome: "Toque Gourmet Especial" }, criado_por: usuario("Diego Martins"), responsavel_atual: null, responsavel_sugerido: null,
    anexos: [anexoSeed("ficha-cadastral.pdf", "Diego Martins", 1)], comentarios: [], checklist: [
      { idmaster: uid("c"), texto: "Confirmar CNAE compatível", concluido: false, criado_por: usuario("Diego Martins"), created_at: diasAtras(1) },
    ],
    created_at: diasAtras(1), updated_at: diasAtras(1),
    log: [{ acao: "criada", detalhes: "", usuario: usuario("Diego Martins"), created_at: diasAtras(1) }],
  });
  t.push({
    idmaster: uid("t"), titulo: "Divergência no relatório de estoque", descricao: "Recontar itens do almoxarifado após inventário aleatório.",
    observacoes: "", prazo: diaISOemDias(5), status: "FALTA_ASSUMIR", prioridade: "BAIXA",
    cliente: null, criado_por: usuario("Rafael Souza"), responsavel_atual: null, responsavel_sugerido: null,
    anexos: [], comentarios: [], checklist: [], created_at: diasAtras(4), updated_at: diasAtras(4),
    log: [{ acao: "criada", detalhes: "", usuario: usuario("Rafael Souza"), created_at: diasAtras(4) }],
  });
  t.push({
    idmaster: uid("t"), titulo: "Renovação de certificado digital — filial", descricao: "Programar a renovação antes do vencimento e avisar a contabilidade.",
    observacoes: "Confirmar com a gerência antes de enviar o aviso.", prazo: diaISOemDias(10), status: "EXECUTANDO", prioridade: "MEDIA",
    cliente: { nome: "Cedro Decor Ltda" }, criado_por: usuario("Patrícia Lima"), responsavel_atual: usuario("Bruna Ramos"), responsavel_sugerido: usuario("Bruna Ramos"),
    anexos: [], comentarios: [
      { idmaster: uid("cm"), texto: "Já separei a lista de sistemas que dependem do certificado.", imagem_url: null, criado_por: usuario("Bruna Ramos"), created_at: diasAtras(1) },
    ],
    checklist: [
      { idmaster: uid("c"), texto: "Levantar sistemas que usam o certificado", concluido: true, criado_por: usuario("Patrícia Lima"), created_at: diasAtras(3) },
      { idmaster: uid("c"), texto: "Agendar renovação com o cartório", concluido: false, criado_por: usuario("Patrícia Lima"), created_at: diasAtras(3) },
    ],
    created_at: diasAtras(3), updated_at: diasAtras(1),
    log: [
      { acao: "criada", detalhes: "", usuario: usuario("Patrícia Lima"), created_at: diasAtras(3) },
      { acao: "assumida", detalhes: "FALTA_ASSUMIR → EXECUTANDO", usuario: usuario("Bruna Ramos"), created_at: diasAtras(2) },
      { acao: "comentario", detalhes: "Já separei a lista de sistemas que dependem do certificado.", usuario: usuario("Bruna Ramos"), created_at: diasAtras(1) },
    ],
  });
  t.push({
    idmaster: uid("t"), titulo: "Revisão de contrato — prestação de serviço", descricao: "Conferir cláusulas e agendar assinatura.",
    observacoes: "", prazo: diaISOAtras(2), status: "EXECUTANDO", prioridade: "ALTA",
    cliente: { nome: "Estúdio Iris" }, criado_por: usuario("Carla Nogueira"), responsavel_atual: usuario("Diego Martins"), responsavel_sugerido: null,
    anexos: [anexoSeed("minuta-contrato.docx", "Carla Nogueira", 6)], comentarios: [], checklist: [], created_at: diasAtras(6), updated_at: diasAtras(2),
    log: [
      { acao: "criada", detalhes: "", usuario: usuario("Carla Nogueira"), created_at: diasAtras(6) },
      { acao: "assumida", detalhes: "FALTA_ASSUMIR → EXECUTANDO", usuario: usuario("Diego Martins"), created_at: diasAtras(5) },
    ],
  });
  t.push({
    idmaster: uid("t"), titulo: "Ajuste de escala — plantão de fim de semana", descricao: "Ajustar a escala depois de duas trocas de plantão.",
    observacoes: "", prazo: null, status: "EXECUTANDO", prioridade: "BAIXA",
    cliente: null, criado_por: usuario("Bruna Ramos"), responsavel_atual: usuario("Bruna Ramos"), responsavel_sugerido: null,
    anexos: [], comentarios: [], checklist: [], created_at: diasAtras(2), updated_at: diasAtras(2),
    log: [
      { acao: "criada", detalhes: "", usuario: usuario("Bruna Ramos"), created_at: diasAtras(2) },
      { acao: "assumida", detalhes: "FALTA_ASSUMIR → EXECUTANDO", usuario: usuario("Bruna Ramos"), created_at: diasAtras(2) },
    ],
  });
  t.push({
    idmaster: uid("t"), titulo: "Conferência de nota fiscal — divergência de valor", descricao: "Validar se o valor da nota bateu com o pedido de compra.",
    observacoes: "Segunda vez que essa conferência vem para validação.", prazo: diaISOemDias(1), status: "VALIDAR", prioridade: "ALTA",
    cliente: { nome: "Toque Gourmet Especial" }, criado_por: usuario("Diego Martins"), responsavel_atual: usuario("Diego Martins"), responsavel_sugerido: null,
    anexos: [], comentarios: [
      { idmaster: uid("cm"), texto: "Reenviei com a planilha atualizada, print em anexo.", imagem_url: null, criado_por: usuario("Diego Martins"), created_at: diasAtras(1) },
    ],
    checklist: [], created_at: diasAtras(5), updated_at: diasAtras(1),
    log: [
      { acao: "criada", detalhes: "", usuario: usuario("Diego Martins"), created_at: diasAtras(5) },
      { acao: "assumida", detalhes: "FALTA_ASSUMIR → EXECUTANDO", usuario: usuario("Diego Martins"), created_at: diasAtras(5) },
      { acao: "reprovada", detalhes: "VALIDAR → EXECUTANDO — Motivo: Faltou considerar o desconto negociado.", usuario: usuario("Rafael Souza"), created_at: diasAtras(2) },
      { acao: "enviada_validacao", detalhes: "EXECUTANDO → VALIDAR", usuario: usuario("Diego Martins"), created_at: diasAtras(1) },
      { acao: "comentario", detalhes: "Reenviei com a planilha atualizada, print em anexo.", usuario: usuario("Diego Martins"), created_at: diasAtras(1) },
    ],
  });
  t.push({
    idmaster: uid("t"), titulo: "Solicitação de acesso ao sistema — novo colaborador", descricao: "Liberar os acessos de acordo com o cargo.",
    observacoes: "", prazo: diaISOemDias(2), status: "VALIDAR", prioridade: "MEDIA",
    cliente: { nome: "Cedro Decor Ltda" }, criado_por: usuario("Bruna Ramos"), responsavel_atual: usuario("Bruna Ramos"), responsavel_sugerido: null,
    anexos: [], comentarios: [], checklist: [
      { idmaster: uid("c"), texto: "Registrar solicitação no sistema", concluido: true, criado_por: usuario("Bruna Ramos"), created_at: diasAtras(3) },
    ],
    created_at: diasAtras(4), updated_at: diasAtras(1),
    log: [
      { acao: "criada", detalhes: "", usuario: usuario("Bruna Ramos"), created_at: diasAtras(4) },
      { acao: "assumida", detalhes: "FALTA_ASSUMIR → EXECUTANDO", usuario: usuario("Bruna Ramos"), created_at: diasAtras(4) },
      { acao: "enviada_validacao", detalhes: "EXECUTANDO → VALIDAR", usuario: usuario("Bruna Ramos"), created_at: diasAtras(1) },
    ],
  });
  t.push({
    idmaster: uid("t"), titulo: "Fechamento mensal de despesas administrativas", descricao: "Fechamento mensal das despesas de todos os setores.",
    observacoes: "", prazo: diaISOAtras(10), status: "FINALIZADA", prioridade: "MEDIA",
    cliente: null, criado_por: usuario("Rafael Souza"), responsavel_atual: usuario("Carla Nogueira"), responsavel_sugerido: null,
    anexos: [anexoSeed("fechamento-outubro.xlsx", "Carla Nogueira", 18)], comentarios: [], checklist: [], created_at: diasAtras(20), updated_at: diasAtras(9),
    log: [
      { acao: "criada", detalhes: "", usuario: usuario("Rafael Souza"), created_at: diasAtras(20) },
      { acao: "assumida", detalhes: "FALTA_ASSUMIR → EXECUTANDO", usuario: usuario("Carla Nogueira"), created_at: diasAtras(18) },
      { acao: "enviada_validacao", detalhes: "EXECUTANDO → VALIDAR", usuario: usuario("Carla Nogueira"), created_at: diasAtras(10) },
      { acao: "validada", detalhes: "VALIDAR → FINALIZADA", usuario: usuario("Patrícia Lima"), created_at: diasAtras(9) },
    ],
  });
  t.push({
    idmaster: uid("t"), titulo: "Onboarding — novo estagiário de marketing", descricao: "Configurar ferramentas de trabalho e acessos do estágio.",
    observacoes: "", prazo: diaISOAtras(15), status: "FINALIZADA", prioridade: "BAIXA",
    cliente: { nome: "Toque Gourmet Especial" }, criado_por: usuario("Diego Martins"), responsavel_atual: usuario("Thiago Alves"), responsavel_sugerido: usuario("Thiago Alves"),
    anexos: [], comentarios: [], checklist: [], created_at: diasAtras(25), updated_at: diasAtras(14),
    log: [
      { acao: "criada", detalhes: "", usuario: usuario("Diego Martins"), created_at: diasAtras(25) },
      { acao: "assumida", detalhes: "FALTA_ASSUMIR → EXECUTANDO", usuario: usuario("Thiago Alves"), created_at: diasAtras(23) },
      { acao: "enviada_validacao", detalhes: "EXECUTANDO → VALIDAR", usuario: usuario("Thiago Alves"), created_at: diasAtras(16) },
      { acao: "validada", detalhes: "VALIDAR → FINALIZADA", usuario: usuario("Carla Nogueira"), created_at: diasAtras(14) },
    ],
  });
  return t;
}

function seedExcluidas() {
  return [
    { tarefa_id: uid("del"), tarefa_titulo: "Correção de lançamento contábil duplicado", excluido_por: usuario("Rafael Souza"), excluido_em: diasAtras(6) },
    { tarefa_id: uid("del"), tarefa_titulo: "Solicitação de material de escritório duplicada", excluido_por: usuario("Carla Nogueira"), excluido_em: diasAtras(12) },
  ];
}

function labelStatus(status) {
  return (COLUNAS.find((c) => c.status === status) || {}).titulo || status;
}

function camposTarefa(t, extras) {
  let campos =
    emailCampo("📋", "Tarefa", `<b>${escapeHtml(t.titulo)}</b>`) +
    emailCampo("🏢", "Cliente", t.cliente ? escapeHtml(t.cliente.nome) : "—");
  (extras || []).forEach((c) => { campos += c; });
  campos += emailCampo("📅", "Prazo", t.prazo ? formatarData(t.prazo) : "sem prazo definido");
  return campos;
}

// Espelha notificar_criacao_tarefa_task: e-mail para a lista marcada em
// Permissões (notificar_criacao_email).
function notificarCriacao(t) {
  const destinatarios = getUsuarios().filter((u) => u.notificar_criacao_email).map((u) => u.email);
  if (!destinatarios.length) return;
  let campos =
    emailCampo("📋", "Tarefa", `<b>${escapeHtml(t.titulo)}</b>`) +
    emailCampo("🏢", "Cliente", t.cliente ? escapeHtml(t.cliente.nome) : "—") +
    emailCampo("🙋", "Criada por", escapeHtml(t.criado_por ? t.criado_por.nome : "—")) +
    emailCampo("📅", "Prazo", t.prazo ? formatarData(t.prazo) : "sem prazo definido");
  if (t.responsavel_sugerido) {
    campos += emailCampo("💡", "Sugestão de responsável", escapeHtml(t.responsavel_sugerido.nome));
  }
  registrarEmail({
    assunto: `Nova tarefa: ${t.titulo}`,
    destinatarios,
    corpoHtml: emailLayout("#2563eb", "#eff6ff", "Nova tarefa", t.titulo, campos),
  });
}

// Espelha notificar_resultado_tarefa_task: vai para o responsável e para
// quem validou/reprovou; na reprovação inclui o motivo.
function notificarResultado(t, acao, motivo, ator) {
  const aprovada = acao === "validada";
  const destinatarios = Array.from(new Set([
    t.responsavel_atual ? emailDe(t.responsavel_atual.nome) : null,
    ator ? emailDe(ator.nome) : null,
  ].filter(Boolean)));
  if (!destinatarios.length) return;

  const cor = aprovada ? "#16a34a" : "#dc2626";
  const corFundo = aprovada ? "#f0fdf4" : "#fef2f2";
  const titulo = aprovada ? "Tarefa validada e concluída" : "Tarefa reprovada";

  let campos = camposTarefa(t, [
    emailCampo("👤", "Responsável", escapeHtml(t.responsavel_atual ? t.responsavel_atual.nome : "—")),
  ]);
  campos += emailCampo(
    aprovada ? "✅" : "↩️",
    aprovada ? "Validada por" : "Reprovada por",
    escapeHtml(ator ? ator.nome : "—"),
  );
  let extras = "";
  if (t.descricao) {
    extras += emailCaixaDestaque("#6b7280", "#f9fafb", "Descrição da tarefa", escapeHtml(t.descricao).replace(/\n/g, "<br>"));
  }
  if (!aprovada) {
    extras += emailCaixaDestaque(cor, corFundo, "Motivo da reprovação", escapeHtml(motivo));
  }
  if (extras) campos += `<tr><td colspan="2">${extras}</td></tr>`;

  registrarEmail({
    assunto: `${titulo}: ${t.titulo}`,
    destinatarios,
    corpoHtml: emailLayout(cor, corFundo, aprovada ? "Validada" : "Reprovada", titulo, campos),
  });
}

function emailDe(nome) {
  const u = getUsuarios().find((x) => x.nome === nome);
  return u ? u.email : null;
}

// Espelha verificar_prazos_tarefas_trabalhistas_task: D-1 e atraso, cada um
// enviado só uma vez por tarefa — a idempotência vem de uma checagem no
// próprio log, então reprocessar o dia não duplica e-mail.
function rodarRotinaPrazos() {
  const tarefas = getTarefas();
  const hoje = hojeISO();
  const amanha = diaISOemDias(1);
  let enviados = 0;

  const camposDaTarefa = (t) => camposTarefa(t, [
    emailCampo("📌", "Status atual", escapeHtml(labelStatus(t.status))),
    emailCampo("👤", "Responsável", escapeHtml(t.responsavel_atual ? t.responsavel_atual.nome : "ainda não foi assumida")),
  ]);
  const jaAvisado = (t, acao) => t.log.some((l) => l.acao === acao);

  tarefas.forEach((t) => {
    if (t.status === "FINALIZADA" || !t.prazo) return;

    if (t.prazo === amanha && !jaAvisado(t, "lembrete_prazo")) {
      const destinatario = t.responsavel_atual || t.criado_por;
      if (destinatario) {
        registrarEmail({
          assunto: `Prazo vence amanhã: ${t.titulo}`,
          destinatarios: [emailDe(destinatario.nome)],
          corpoHtml: emailLayout("#d97706", "#fffbeb", "Prazo amanhã", "O prazo desta tarefa vence amanhã", camposDaTarefa(t)),
        });
        t.log.push({ acao: "lembrete_prazo", detalhes: "Lembrete D-1 enviado", usuario: null, created_at: new Date().toISOString() });
        enviados++;
      }
    }

    if (t.prazo < hoje && !jaAvisado(t, "lembrete_atrasada") && t.criado_por) {
      registrarEmail({
        assunto: `Tarefa atrasada: ${t.titulo}`,
        destinatarios: [emailDe(t.criado_por.nome)],
        corpoHtml: emailLayout("#dc2626", "#fef2f2", "Atrasada", "Uma tarefa que você criou está atrasada", camposDaTarefa(t)),
      });
      t.log.push({ acao: "lembrete_atrasada", detalhes: "Aviso de atraso enviado", usuario: null, created_at: new Date().toISOString() });
      enviados++;
    }
  });

  setTarefas(tarefas);
  return enviados;
}

function ensureSeeded() {
  if (localStorage.getItem(CHAVES.seeded)) return;
  saveJSON(CHAVES.tarefas, seedTarefas());
  saveJSON(CHAVES.excluidas, seedExcluidas());
  saveJSON(CHAVES.usuarios, seedUsuarios());
  saveJSON(CHAVES.matriz, MATRIZ_DEFAULT);
  saveJSON(CHAVES.emails, []);
  localStorage.setItem(CHAVES.nivel, "DESENVOLVEDOR");
  localStorage.setItem(CHAVES.seeded, "1");
}

function resetDemo() {
  Object.values(CHAVES).forEach((k) => localStorage.removeItem(k));
  ensureSeeded();
  location.reload();
}

function getTarefas() { return loadJSON(CHAVES.tarefas, []); }
function setTarefas(v) { saveJSON(CHAVES.tarefas, v); }
function getExcluidas() { return loadJSON(CHAVES.excluidas, []); }
function setExcluidas(v) { saveJSON(CHAVES.excluidas, v); }
function getUsuarios() { return loadJSON(CHAVES.usuarios, []); }
function setUsuarios(v) { saveJSON(CHAVES.usuarios, v); }
function getMatriz() { return loadJSON(CHAVES.matriz, MATRIZ_DEFAULT); }
function setMatriz(v) { saveJSON(CHAVES.matriz, v); }
function getNivelAtual() { return localStorage.getItem(CHAVES.nivel) || "DESENVOLVEDOR"; }
function setNivelAtual(v) { localStorage.setItem(CHAVES.nivel, v); }

function ehDesenvolvedor(nivel) {
  return nivel === "DESENVOLVEDOR";
}

function acoesDoNivel(nivel) {
  if (ehDesenvolvedor(nivel)) return ACOES.map((a) => a.valor);
  return getMatriz()[nivel] || [];
}

function usuarioAtual() {
  return usuario(REPRESENTANTE_POR_NIVEL[getNivelAtual()]);
}

function montarSeletorNivel(select, aoTrocar) {
  select.innerHTML = "";
  NIVEIS.forEach((n) => {
    const opt = document.createElement("option");
    opt.value = n.valor;
    opt.textContent = n.rotulo;
    select.appendChild(opt);
  });
  select.value = getNivelAtual();
  select.addEventListener("change", () => {
    setNivelAtual(select.value);
    aoTrocar(select.value);
  });
}

let toastContainer = null;
function toast(tipo, titulo, detalhe) {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-stack";
    document.body.appendChild(toastContainer);
  }
  const el = document.createElement("div");
  el.className = `toast ${tipo === "error" ? "error" : ""}`;
  el.innerHTML = `<strong></strong><span></span>`;
  el.querySelector("strong").textContent = titulo;
  el.querySelector("span").textContent = detalhe || "";
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function showSuccess(titulo, detalhe) { toast("success", titulo, detalhe); }
function showError(titulo, detalhe) { toast("error", titulo, detalhe); }

function el(tag, props, children) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? "" : v);
  });
  (children || []).forEach((c) => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  });
  return node;
}

ensureSeeded();
