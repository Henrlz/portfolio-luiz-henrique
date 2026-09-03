let tarefas = getTarefas();
let historicoAberto = null;
let reprovarTarefaId = null;
let imagemColada = null;
let novosItensChecklistCriacao = [];
let novosAnexosCriacao = [];

const seletorNivel = document.getElementById("seletorNivel");
const btnExcluidas = document.getElementById("btnExcluidas");
const btnPermissoes = document.getElementById("btnPermissoes");
const btnNovaTarefa = document.getElementById("btnNovaTarefa");
const btnResetDemo = document.getElementById("btnResetDemo");

function podeAtual(acao) {
  return acoesDoNivel(getNivelAtual()).includes(acao);
}

function atualizarTopbar() {
  btnPermissoes.hidden = !ehDesenvolvedor(getNivelAtual());
  btnNovaTarefa.hidden = !podeAtual("create");
}

montarSeletorNivel(seletorNivel, () => {
  atualizarTopbar();
  renderTudo();
});
atualizarTopbar();

btnResetDemo.addEventListener("click", () => {
  if (confirm("Isso apaga as alterações feitas nesta demonstração (neste navegador) e recarrega os dados de exemplo. Continuar?")) {
    resetDemo();
  }
});

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => fecharModal(btn.getAttribute("data-close")));
});
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fecharModal(overlay.id);
  });
});

function abrirModal(id) { document.getElementById(id).hidden = false; }
function fecharModal(id) {
  document.getElementById(id).hidden = true;
  if (id === "modalDetalhe") {
    historicoAberto = null;
    imagemColada = null;
  }
  if (id === "modalReprovar") reprovarTarefaId = null;
}

// ---------- Filtros ----------
const filtroBusca = document.getElementById("filtroBusca");
const filtroPrioridade = document.getElementById("filtroPrioridade");
const filtroVencidas = document.getElementById("filtroVencidas");
const btnLimparFiltros = document.getElementById("btnLimparFiltros");

[filtroBusca, filtroPrioridade, filtroVencidas].forEach((elm) => {
  elm.addEventListener("input", renderBoardEFiltros);
  elm.addEventListener("change", renderBoardEFiltros);
});
btnLimparFiltros.addEventListener("click", () => {
  filtroBusca.value = "";
  filtroPrioridade.value = "";
  filtroVencidas.checked = false;
  renderBoardEFiltros();
});

function tarefasFiltradas() {
  const termo = normalizar(filtroBusca.value.trim());
  const prio = filtroPrioridade.value;
  const somenteVencidas = filtroVencidas.checked;
  const hoje = hojeISO();
  return tarefas.filter((t) => {
    if (termo) {
      const alvo = normalizar(`${t.titulo} ${t.cliente ? t.cliente.nome : ""} ${t.responsavel_atual ? t.responsavel_atual.nome : ""} ${t.criado_por ? t.criado_por.nome : ""}`);
      if (!alvo.includes(termo)) return false;
    }
    if (prio && t.prioridade !== prio) return false;
    if (somenteVencidas) {
      const vencida = !!t.prazo && t.status !== "FINALIZADA" && t.prazo < hoje;
      if (!vencida) return false;
    }
    return true;
  });
}

function estaVencida(t) {
  return !!t.prazo && t.status !== "FINALIZADA" && t.prazo < hojeISO();
}

// ---------- Stats ----------
function renderStats() {
  const hoje = hojeISO();
  const atrasadas = tarefas.filter((t) => t.prazo && t.status !== "FINALIZADA" && t.prazo < hoje).length;
  document.getElementById("statTotal").textContent = tarefas.length;
  document.getElementById("statSemResponsavel").textContent = tarefas.filter((t) => t.status === "FALTA_ASSUMIR").length;
  document.getElementById("statAtrasadas").textContent = atrasadas;
  document.getElementById("statFinalizadas").textContent = tarefas.filter((t) => t.status === "FINALIZADA").length;

  const barChart = document.getElementById("barChart");
  barChart.innerHTML = "";
  const contagens = COLUNAS.map((c) => tarefas.filter((t) => t.status === c.status).length);
  const max = Math.max(1, ...contagens);
  COLUNAS.forEach((c, i) => {
    const alpha = 0.35 + (0.65 * i) / (COLUNAS.length - 1);
    const altura = Math.round((contagens[i] / max) * 130) + 4;
    const col = el("div", { class: "bar-col" }, [
      el("span", { class: "bar-count" }, [String(contagens[i])]),
      el("div", { class: "bar", style: `height:${altura}px;background:rgba(47,95,224,${alpha})` }),
      el("span", { class: "bar-label" }, [c.titulo]),
    ]);
    barChart.appendChild(col);
  });
}

// ---------- Board ----------
function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  const filtradas = tarefasFiltradas();
  const semResponsavelDelete = podeAtual("delete");

  COLUNAS.forEach((coluna) => {
    const tarefasColuna = filtradas
      .filter((t) => t.status === coluna.status)
      .sort((a, b) => (PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]) || (b.created_at.localeCompare(a.created_at)));

    const colEl = el("div", { class: "board-column", "data-status": coluna.status }, [
      el("div", { class: "board-column-head" }, [
        el("h3", {}, [coluna.titulo]),
        el("span", { class: "count-chip" }, [String(tarefasColuna.length)]),
      ]),
    ]);

    tarefasColuna.forEach((t) => colEl.appendChild(renderCard(t, semResponsavelDelete)));

    colEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      colEl.classList.add("drag-over");
    });
    colEl.addEventListener("dragleave", () => colEl.classList.remove("drag-over"));
    colEl.addEventListener("drop", (e) => {
      e.preventDefault();
      colEl.classList.remove("drag-over");
      const idArrastada = e.dataTransfer.getData("text/plain");
      handleDrop(idArrastada, coluna.status);
    });

    board.appendChild(colEl);
  });
}

function renderCard(t, podeExcluir) {
  const sugeridoParaMim = t.responsavel_sugerido && t.responsavel_sugerido.nome === (usuarioAtual() || {}).nome;
  const vencida = estaVencida(t);

  const chips = [];
  if (t.prioridade === "ALTA") {
    chips.push(el("span", { class: "chip", style: `background:${corPrioridade(t.prioridade)};color:#fff;font-weight:700` }, ["Alta"]));
  }
  chips.push(el("span", { class: `chip ${vencida ? "chip-error" : "chip-outline"}` }, [vencida ? `Vencida em ${formatarData(t.prazo)}` : formatarData(t.prazo)]));
  chips.push(el("span", { class: `chip ${t.responsavel_atual ? "chip-primary" : "chip-outline"}` }, [t.responsavel_atual ? t.responsavel_atual.nome : "sem responsável"]));
  if (t.anexos.length) chips.push(el("span", { class: "chip" }, [`📎 ${t.anexos.length}`]));
  if (t.comentarios.length) chips.push(el("span", { class: "chip" }, [`💬 ${t.comentarios.length}`]));

  const card = el("div", { class: "task-card", draggable: "true", "data-id": t.idmaster }, [
    el("div", { class: "task-card-top" }, [
      el("div", { class: "task-title-row" }, [
        el("span", { class: "priority-dot", style: `background:${corPrioridade(t.prioridade)}`, title: `Prioridade: ${rotuloPrioridade(t.prioridade)}` }),
        el("span", { class: "task-title" }, [t.titulo]),
      ]),
      podeExcluir ? el("button", { class: "icon-btn", title: "Excluir", onclick: (e) => { e.stopPropagation(); handleExcluir(t); } }, ["🗑"]) : null,
    ]),
    t.cliente ? el("div", { class: "task-meta" }, [`Cliente: ${t.cliente.nome}`]) : null,
    t.descricao ? el("div", { class: "task-desc" }, [t.descricao]) : null,
    t.responsavel_sugerido ? el("div", { class: "chip-row" }, [
      el("span", { class: `chip ${sugeridoParaMim ? "chip-suggested" : "chip-info"}` }, [sugeridoParaMim ? "Sugerido para você!" : `Sugerido: ${t.responsavel_sugerido.nome}`]),
    ]) : null,
    el("div", { class: "chip-row" }, chips),
  ]);

  card.addEventListener("click", () => abrirDetalhe(t.idmaster));
  card.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", t.idmaster);
    setTimeout(() => card.classList.add("dragging"), 0);
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  return card;
}

function handleDrop(tarefaId, destino) {
  const t = tarefas.find((x) => x.idmaster === tarefaId);
  if (!t || t.status === destino) return;
  const origem = t.status;

  if (podeAtual("mover")) {
    aplicarMudancaStatus(t, destino, { livre: true });
    return;
  }

  const acaoExigida = (TRANSICOES[origem] || {})[destino];
  if (!acaoExigida) {
    showError("Movimento não permitido", "Essa tarefa não pode pular direto para essa etapa.");
    return;
  }
  if (!podeAtual(acaoExigida)) {
    showError("Sem permissão", "Seu nível de acesso na esteira não permite essa ação.");
    return;
  }
  if (acaoExigida === "reprovar") {
    reprovarTarefaId = t.idmaster;
    abrirModal("modalReprovar");
    return;
  }
  executarTransicao(t, destino, acaoExigida);
}

const ACAO_LOG_POR_TRANSICAO = { assumir: "assumida", enviar_validacao: "enviada_validacao", validar: "validada", reprovar: "reprovada" };

function executarTransicao(t, destino, acaoExigida, motivo) {
  const origem = t.status;
  t.status = destino;
  if (origem === "FALTA_ASSUMIR" && destino === "EXECUTANDO") {
    t.responsavel_atual = usuarioAtual();
  }
  t.updated_at = new Date().toISOString();
  let detalhes = `${origem} → ${destino}`;
  if (motivo) detalhes += ` — Motivo: ${motivo}`;
  t.log.push({ acao: ACAO_LOG_POR_TRANSICAO[acaoExigida], detalhes, usuario: usuarioAtual(), created_at: new Date().toISOString() });
  persistirTarefas();
  if (historicoAberto === t.idmaster) preencherDetalhe(t);
}

function aplicarMudancaStatus(t, destino, opts) {
  const origem = t.status;
  t.status = destino;
  t.updated_at = new Date().toISOString();
  if (opts && opts.livre) {
    t.log.push({ acao: "movida_livre", detalhes: `${origem} → ${destino} (movimentação livre)`, usuario: usuarioAtual(), created_at: new Date().toISOString() });
  }
  persistirTarefas();
}

function handleExcluir(t) {
  if (!confirm(`"${t.titulo}" será removida definitivamente. Excluir?`)) return;
  const excluidas = getExcluidas();
  excluidas.unshift({ tarefa_id: t.idmaster, tarefa_titulo: t.titulo, excluido_por: usuarioAtual(), excluido_em: new Date().toISOString() });
  setExcluidas(excluidas);
  tarefas = tarefas.filter((x) => x.idmaster !== t.idmaster);
  persistirTarefas();
}

function persistirTarefas() {
  setTarefas(tarefas);
  renderTudo();
}

function renderTudo() {
  renderStats();
  renderBoardEFiltros();
}
function renderBoardEFiltros() {
  const algumFiltro = filtroBusca.value.trim() || filtroPrioridade.value || filtroVencidas.checked;
  btnLimparFiltros.hidden = !algumFiltro;
  renderBoard();
}

// ---------- Nova tarefa ----------
btnNovaTarefa.addEventListener("click", () => {
  document.getElementById("campoTitulo").value = "";
  document.getElementById("campoCliente").value = "";
  document.getElementById("campoDescricao").value = "";
  document.getElementById("campoObservacoes").value = "";
  document.getElementById("campoPrazo").value = "";
  document.getElementById("campoPrioridade").value = "MEDIA";
  document.getElementById("campoAnexos").value = "";
  novosItensChecklistCriacao = [];
  novosAnexosCriacao = [];
  renderChecklistCriacao();
  const sel = document.getElementById("campoResponsavelSugerido");
  sel.innerHTML = '<option value="">Nenhum</option>';
  getUsuarios().forEach((u) => sel.appendChild(el("option", { value: u.nome }, [u.nome])));
  abrirModal("modalCriar");
});

document.getElementById("campoAnexos").addEventListener("change", (e) => {
  novosAnexosCriacao = Array.from(e.target.files).map((f) => ({ nome_original: f.name }));
});

document.getElementById("btnAddItemChecklistCriacao").addEventListener("click", adicionarItemChecklistCriacao);
document.getElementById("campoNovoItemChecklist").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); adicionarItemChecklistCriacao(); }
});
function adicionarItemChecklistCriacao() {
  const campo = document.getElementById("campoNovoItemChecklist");
  const texto = campo.value.trim();
  if (!texto) return;
  novosItensChecklistCriacao.push(texto);
  campo.value = "";
  renderChecklistCriacao();
}
function renderChecklistCriacao() {
  const lista = document.getElementById("listaChecklistCriacao");
  lista.innerHTML = "";
  novosItensChecklistCriacao.forEach((texto, i) => {
    lista.appendChild(el("div", { class: "checklist-mini-row" }, [
      el("span", { style: "flex:1" }, [texto]),
      el("button", { class: "icon-btn", onclick: () => { novosItensChecklistCriacao.splice(i, 1); renderChecklistCriacao(); } }, ["🗑"]),
    ]));
  });
}

document.getElementById("btnConfirmarCriar").addEventListener("click", () => {
  const titulo = document.getElementById("campoTitulo").value.trim();
  if (!titulo) { showError("Informe um título para a tarefa"); return; }
  const clienteNome = document.getElementById("campoCliente").value.trim();
  const responsavelSugeridoNome = document.getElementById("campoResponsavelSugerido").value;
  const agora = new Date().toISOString();
  const nova = {
    idmaster: uid("t"),
    titulo,
    descricao: document.getElementById("campoDescricao").value.trim(),
    observacoes: document.getElementById("campoObservacoes").value.trim(),
    prazo: document.getElementById("campoPrazo").value || null,
    status: "FALTA_ASSUMIR",
    prioridade: document.getElementById("campoPrioridade").value,
    cliente: clienteNome ? { nome: clienteNome } : null,
    criado_por: usuarioAtual(),
    responsavel_atual: null,
    responsavel_sugerido: responsavelSugeridoNome ? { nome: responsavelSugeridoNome } : null,
    anexos: novosAnexosCriacao,
    comentarios: [],
    checklist: novosItensChecklistCriacao.map((texto) => ({ idmaster: uid("c"), texto, concluido: false, criado_por: usuarioAtual(), created_at: agora })),
    created_at: agora,
    updated_at: agora,
    log: [{ acao: "criada", detalhes: "", usuario: usuarioAtual(), created_at: agora }],
  };
  tarefas.unshift(nova);
  persistirTarefas();
  fecharModal("modalCriar");
  showSuccess("Tarefa criada", "Quem pode assumir já foi avisado no Teams.");
});

// ---------- Detalhe / histórico ----------
function abrirDetalhe(id) {
  historicoAberto = id;
  const t = tarefas.find((x) => x.idmaster === id);
  if (!t) return;
  document.getElementById("detalheTitulo").textContent = t.titulo;
  preencherDetalhe(t);
  abrirModal("modalDetalhe");
}

function feedItens(t) {
  const itens = [
    ...t.log.map((l) => ({ tipo: "log", created_at: l.created_at, log: l })),
    ...t.comentarios.map((c) => ({ tipo: "chat", created_at: c.created_at, comentario: c })),
  ];
  return itens.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function preencherDetalhe(t) {
  const main = document.getElementById("detalheMain");
  main.innerHTML = "";

  const chipsTopo = [
    el("span", { class: "chip" }, [(COLUNAS.find((c) => c.status === t.status) || {}).titulo || t.status]),
  ];
  if (t.cliente) chipsTopo.push(el("span", { class: "chip chip-outline" }, [`Cliente: ${t.cliente.nome}`]));
  chipsTopo.push(el("span", { class: "chip chip-outline" }, [formatarData(t.prazo)]));
  chipsTopo.push(el("span", { class: "chip chip-outline" }, [t.responsavel_atual ? t.responsavel_atual.nome : "sem responsável"]));
  if (t.responsavel_sugerido) chipsTopo.push(el("span", { class: "chip chip-info" }, [`Sugerido: ${t.responsavel_sugerido.nome}`]));

  if (podeAtual("checklist")) {
    const sel = el("select", { style: "border:1px solid var(--border);border-radius:999px;font-size:0.78rem;padding:0.2rem 0.5rem;" },
      PRIORIDADES.map((p) => el("option", { value: p.valor, selected: p.valor === t.prioridade ? "" : undefined }, [`Prioridade: ${p.label}`])));
    sel.addEventListener("change", () => {
      t.prioridade = sel.value;
      t.updated_at = new Date().toISOString();
      t.log.push({ acao: "prioridade_alterada", detalhes: `→ ${t.prioridade}`, usuario: usuarioAtual(), created_at: new Date().toISOString() });
      setTarefas(tarefas);
      renderTudo();
      preencherDetalhe(t);
    });
    chipsTopo.push(sel);
  } else {
    chipsTopo.push(el("span", { class: "chip chip-outline", style: `border-color:${corPrioridade(t.prioridade)}` }, [`Prioridade: ${rotuloPrioridade(t.prioridade)}`]));
  }
  main.appendChild(el("div", { class: "chip-row" }, chipsTopo));

  if (t.descricao) main.appendChild(el("p", {}, [t.descricao]));

  const acoesRapidas = [];
  if (t.status === "FALTA_ASSUMIR" && podeAtual("assumir")) {
    acoesRapidas.push(el("button", { class: "btn btn-primary", onclick: () => executarAcaoRapida(t, "EXECUTANDO", "assumir") }, ["Assumir"]));
  }
  if (t.status === "EXECUTANDO" && podeAtual("enviar_validacao")) {
    acoesRapidas.push(el("button", { class: "btn btn-primary", onclick: () => executarAcaoRapida(t, "VALIDAR", "enviar_validacao") }, ["Encaminhar para validação"]));
  }
  if (t.status === "VALIDAR" && podeAtual("validar")) {
    acoesRapidas.push(el("button", { class: "btn btn-primary", style: "background:var(--success)", onclick: () => executarAcaoRapida(t, "FINALIZADA", "validar") }, ["Validar"]));
  }
  if (t.status === "VALIDAR" && podeAtual("reprovar")) {
    acoesRapidas.push(el("button", { class: "btn btn-danger-outline", onclick: () => { fecharModal("modalDetalhe"); reprovarTarefaId = t.idmaster; abrirModal("modalReprovar"); } }, ["Recusar"]));
  }
  if (podeAtual("create")) {
    acoesRapidas.push(el("button", { class: "btn btn-text", onclick: () => handleDuplicar(t) }, ["⧉ Duplicar tarefa"]));
  }
  if (acoesRapidas.length) main.appendChild(el("div", { class: "chip-row", style: "margin:0.9rem 0" }, acoesRapidas));

  main.appendChild(el("hr", { style: "border:none;border-top:1px solid var(--border);margin:0.8rem 0" }));
  main.appendChild(el("strong", { style: "font-size:0.88rem" }, ["Checklist"]));
  const listaChecklist = el("div", { style: "margin-top:0.4rem" });
  if (t.checklist.length) {
    t.checklist.forEach((item) => {
      listaChecklist.appendChild(el("div", { class: "checklist-item-row" }, [
        el("input", { type: "checkbox", checked: item.concluido ? "" : undefined, disabled: podeAtual("checklist") ? undefined : "", onchange: () => toggleChecklistItem(t, item) }),
        el("span", { class: item.concluido ? "done" : "", style: "flex:1" }, [item.texto]),
        podeAtual("checklist") ? el("button", { class: "icon-btn", onclick: () => removerChecklistItem(t, item) }, ["🗑"]) : null,
      ]));
    });
  } else {
    listaChecklist.appendChild(el("p", { class: "empty-note" }, ["Sem itens no checklist."]));
  }
  main.appendChild(listaChecklist);
  if (podeAtual("checklist")) {
    const campoNovo = el("input", { type: "text", placeholder: "Adicionar item ao checklist..." });
    campoNovo.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && campoNovo.value.trim()) {
        e.preventDefault();
        adicionarChecklistItem(t, campoNovo.value.trim());
        campoNovo.value = "";
      }
    });
    const btnAdd = el("button", { class: "btn btn-outline" }, ["Adicionar"]);
    btnAdd.addEventListener("click", () => { if (campoNovo.value.trim()) { adicionarChecklistItem(t, campoNovo.value.trim()); campoNovo.value = ""; } });
    main.appendChild(el("div", { class: "checklist-add-row", style: "margin-top:0.5rem" }, [campoNovo, btnAdd]));
  }

  if (t.observacoes) {
    main.appendChild(el("hr", { style: "border:none;border-top:1px solid var(--border);margin:0.8rem 0" }));
    main.appendChild(el("p", {}, [el("b", {}, ["Observações: "]), t.observacoes]));
  }
  if (t.anexos.length) {
    main.appendChild(el("strong", { style: "font-size:0.88rem;display:block;margin-top:0.8rem" }, ["Anexos"]));
    t.anexos.forEach((a) => main.appendChild(el("div", { style: "font-size:0.85rem;color:var(--primary)" }, [`📎 ${a.nome_original}`])));
  }

  renderFeed(t);
  renderInputComentario(t);
}

function executarAcaoRapida(t, destino, acao) {
  executarTransicao(t, destino, acao);
}

function toggleChecklistItem(t, item) {
  item.concluido = !item.concluido;
  t.log.push({ acao: "checklist_atualizado", detalhes: `${item.texto} — ${item.concluido ? "concluído" : "reaberto"}`, usuario: usuarioAtual(), created_at: new Date().toISOString() });
  setTarefas(tarefas);
  renderTudo();
  preencherDetalhe(t);
}
function removerChecklistItem(t, item) {
  t.checklist = t.checklist.filter((x) => x.idmaster !== item.idmaster);
  t.log.push({ acao: "checklist_removido", detalhes: item.texto, usuario: usuarioAtual(), created_at: new Date().toISOString() });
  setTarefas(tarefas);
  preencherDetalhe(t);
}
function adicionarChecklistItem(t, texto) {
  t.checklist.push({ idmaster: uid("c"), texto, concluido: false, criado_por: usuarioAtual(), created_at: new Date().toISOString() });
  t.log.push({ acao: "checklist_adicionado", detalhes: texto, usuario: usuarioAtual(), created_at: new Date().toISOString() });
  setTarefas(tarefas);
  preencherDetalhe(t);
}

function handleDuplicar(t) {
  const agora = new Date().toISOString();
  const copia = {
    idmaster: uid("t"), titulo: t.titulo, descricao: t.descricao, observacoes: t.observacoes, prazo: t.prazo,
    status: "FALTA_ASSUMIR", prioridade: t.prioridade, cliente: t.cliente, criado_por: usuarioAtual(),
    responsavel_atual: null, responsavel_sugerido: t.responsavel_sugerido,
    anexos: t.anexos.slice(), comentarios: [],
    checklist: t.checklist.map((c) => ({ idmaster: uid("c"), texto: c.texto, concluido: false, criado_por: usuarioAtual(), created_at: agora })),
    created_at: agora, updated_at: agora,
    log: [{ acao: "criada", detalhes: "", usuario: usuarioAtual(), created_at: agora }],
  };
  tarefas.unshift(copia);
  persistirTarefas();
  fecharModal("modalDetalhe");
  showSuccess("Tarefa duplicada", "Uma cópia foi criada em 'Falta assumir' (sem o log e os comentários).");
}

function renderFeed(t) {
  const feed = document.getElementById("detalheFeed");
  feed.innerHTML = "";
  const itens = feedItens(t);
  if (!itens.length) {
    feed.appendChild(el("p", { class: "empty-note" }, ["Nenhuma movimentação ou ocorrência registrada ainda."]));
    return;
  }
  itens.forEach((item) => {
    if (item.tipo === "log") {
      const l = item.log;
      feed.appendChild(el("div", { class: `feed-log ${l.acao === "reprovada" ? "reprovada" : ""}` }, [
        el("span", { class: "feed-icon" }, ["●"]),
        el("div", {}, [
          el("span", { class: "feed-title" }, [`${l.usuario ? l.usuario.nome : "sistema"} ${ROTULO_ACAO_LOG[l.acao] || l.acao}`]),
          l.detalhes ? el("span", { class: "feed-detail" }, [l.detalhes]) : null,
          el("span", { class: "feed-time" }, [formatarDataHora(l.created_at)]),
        ]),
      ]));
    } else {
      const c = item.comentario;
      const bubbleChildren = [];
      if (c.texto) bubbleChildren.push(el("div", {}, [c.texto]));
      if (c.imagem_url) bubbleChildren.push(el("img", { src: c.imagem_url, alt: "Print anexado ao chat", onclick: () => window.open(c.imagem_url, "_blank") }));
      bubbleChildren.push(el("span", { class: "feed-time" }, [`${c.criado_por ? c.criado_por.nome : "—"} · ${formatarDataHora(c.created_at)}`]));
      feed.appendChild(el("div", { class: "feed-chat" }, [
        el("span", {}, ["💬"]),
        el("div", { class: "feed-bubble" }, bubbleChildren),
      ]));
    }
  });
  feed.scrollTop = feed.scrollHeight;
}

function renderInputComentario(t) {
  const container = document.getElementById("detalheInputComentario");
  container.innerHTML = "";
  if (!podeAtual("comentar")) return;

  if (imagemColada) {
    container.appendChild(el("div", { class: "paste-preview" }, [
      el("img", { src: imagemColada }),
      el("button", { onclick: () => { imagemColada = null; renderInputComentario(t); } }, ["✕"]),
    ]));
  }
  const campo = el("textarea", { rows: "1", placeholder: "Digite uma mensagem... (cole uma imagem com Ctrl+V)" });
  campo.addEventListener("paste", (e) => {
    const item = Array.from(e.clipboardData.items || []).find((i) => i.type.startsWith("image/"));
    if (!item) return;
    e.preventDefault();
    const arquivo = item.getAsFile();
    const reader = new FileReader();
    reader.onload = () => { imagemColada = reader.result; renderInputComentario(t); };
    reader.readAsDataURL(arquivo);
  });
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarComentario(t, campo.value); }
  });
  const btnEnviar = el("button", { class: "icon-btn", style: "font-size:1.1rem" }, ["➤"]);
  btnEnviar.addEventListener("click", () => enviarComentario(t, campo.value));
  container.appendChild(el("div", { class: "comment-input-row" }, [campo, btnEnviar]));
}

function enviarComentario(t, texto) {
  texto = (texto || "").trim();
  if (!texto && !imagemColada) return;
  const agora = new Date().toISOString();
  t.comentarios.push({ idmaster: uid("cm"), texto, imagem_url: imagemColada, criado_por: usuarioAtual(), created_at: agora });
  t.log.push({ acao: "comentario", detalhes: texto ? texto.slice(0, 200) : "(imagem colada no chat)", usuario: usuarioAtual(), created_at: agora });
  imagemColada = null;
  setTarefas(tarefas);
  renderStats();
  preencherDetalhe(t);
}

// ---------- Reprovar ----------
document.getElementById("btnConfirmarReprovar").addEventListener("click", () => {
  const motivo = document.getElementById("campoMotivoReprovacao").value.trim();
  if (!motivo || !reprovarTarefaId) return;
  const t = tarefas.find((x) => x.idmaster === reprovarTarefaId);
  if (t) executarTransicao(t, "EXECUTANDO", "reprovar", motivo);
  document.getElementById("campoMotivoReprovacao").value = "";
  fecharModal("modalReprovar");
});

// ---------- Tarefas excluídas ----------
btnExcluidas.addEventListener("click", () => {
  const conteudo = document.getElementById("conteudoExcluidas");
  const excluidas = getExcluidas();
  conteudo.innerHTML = "";
  if (!excluidas.length) {
    conteudo.appendChild(el("p", { class: "empty-note" }, ["Nenhuma tarefa excluída até agora."]));
  } else {
    const tabela = el("div", { class: "table-scroll" }, [
      el("table", { class: "data-table" }, [
        el("thead", {}, [el("tr", {}, [el("th", {}, ["Título"]), el("th", {}, ["Excluído por"]), el("th", {}, ["Excluído em"])])]),
        el("tbody", {}, excluidas.map((item) => el("tr", {}, [
          el("td", {}, [item.tarefa_titulo]),
          el("td", {}, [item.excluido_por ? item.excluido_por.nome : "—"]),
          el("td", {}, [formatarDataHora(item.excluido_em)]),
        ]))),
      ]),
    ]);
    conteudo.appendChild(tabela);
  }
  abrirModal("modalExcluidas");
});

renderTudo();
