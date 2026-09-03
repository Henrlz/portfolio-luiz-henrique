const seletorNivel = document.getElementById("seletorNivel");
const avisoRestrito = document.getElementById("avisoRestrito");
const btnVerComoDev = document.getElementById("btnVerComoDev");

montarSeletorNivel(seletorNivel, () => atualizarAcesso());
btnVerComoDev.addEventListener("click", () => {
  setNivelAtual("DESENVOLVEDOR");
  seletorNivel.value = "DESENVOLVEDOR";
  atualizarAcesso();
});

function atualizarAcesso() {
  const restrito = !ehDesenvolvedor(getNivelAtual());
  avisoRestrito.hidden = !restrito;
  document.getElementById("btnSalvarMatriz").disabled = restrito;
  document.querySelectorAll("#corpoMatriz input, #corpoUsuarios select, #corpoUsuarios input[type=checkbox]").forEach((i) => {
    i.disabled = restrito;
  });
}

// ---------- Usuários ----------
const buscaUsuario = document.getElementById("buscaUsuario");
const corpoUsuarios = document.getElementById("corpoUsuarios");
const contagemUsuarios = document.getElementById("contagemUsuarios");

buscaUsuario.addEventListener("input", renderUsuarios);

function renderUsuarios() {
  const usuarios = getUsuarios();
  const termo = normalizar(buscaUsuario.value.trim());
  const filtrados = termo ? usuarios.filter((u) => normalizar(u.nome).includes(termo) || normalizar(u.email).includes(termo)) : usuarios;
  contagemUsuarios.textContent = `${filtrados.length} de ${usuarios.length} usuários`;
  corpoUsuarios.innerHTML = "";
  filtrados.forEach((u) => {
    const selNivel = el("select", {}, NIVEIS.map((n) => el("option", { value: n.valor, selected: n.valor === u.nivel ? "" : undefined }, [n.rotulo])));
    selNivel.addEventListener("change", () => {
      const todos = getUsuarios();
      const alvo = todos.find((x) => x.id === u.id);
      alvo.nivel = selNivel.value;
      setUsuarios(todos);
      showSuccess("Nível atualizado", `${u.nome} agora é ${NIVEIS.find((n) => n.valor === selNivel.value).rotulo}.`);
    });
    const checkEmail = el("input", { type: "checkbox", checked: u.notificar_criacao_email ? "" : undefined });
    checkEmail.addEventListener("change", () => {
      const todos = getUsuarios();
      const alvo = todos.find((x) => x.id === u.id);
      alvo.notificar_criacao_email = checkEmail.checked;
      setUsuarios(todos);
    });
    corpoUsuarios.appendChild(el("tr", {}, [
      el("td", {}, [u.nome]),
      el("td", {}, [u.email]),
      el("td", {}, [selNivel]),
      el("td", { style: "text-align:center" }, [checkEmail]),
    ]));
  });
  atualizarAcesso();
}

// ---------- Matriz ----------
const cabecalhoMatriz = document.getElementById("cabecalhoMatriz");
const corpoMatriz = document.getElementById("corpoMatriz");
let matrizEmEdicao = new Set();

function chave(nivel, acao) { return `${nivel}:${acao}`; }

function renderMatriz() {
  ACOES.forEach((a) => cabecalhoMatriz.appendChild(el("th", {}, [a.rotulo])));

  const matriz = getMatriz();
  matrizEmEdicao = new Set();
  Object.entries(matriz).forEach(([nivel, acoes]) => acoes.forEach((acao) => matrizEmEdicao.add(chave(nivel, acao))));

  corpoMatriz.innerHTML = "";
  NIVEIS.filter((n) => n.valor !== "DESENVOLVEDOR").forEach((n) => {
    const linha = el("tr", {}, [el("td", {}, [n.rotulo])]);
    ACOES.forEach((a) => {
      const chk = el("input", { type: "checkbox", checked: matrizEmEdicao.has(chave(n.valor, a.valor)) ? "" : undefined });
      chk.addEventListener("change", () => {
        const k = chave(n.valor, a.valor);
        if (chk.checked) matrizEmEdicao.add(k); else matrizEmEdicao.delete(k);
      });
      linha.appendChild(el("td", {}, [chk]));
    });
    corpoMatriz.appendChild(linha);
  });
  const linhaDev = el("tr", {}, [el("td", {}, ["Desenvolvedor"])]);
  ACOES.forEach(() => linhaDev.appendChild(el("td", {}, [el("input", { type: "checkbox", checked: "", disabled: "" })])));
  corpoMatriz.appendChild(linhaDev);
  atualizarAcesso();
}

document.getElementById("btnSalvarMatriz").addEventListener("click", () => {
  const nova = {};
  NIVEIS.filter((n) => n.valor !== "DESENVOLVEDOR").forEach((n) => { nova[n.valor] = []; });
  matrizEmEdicao.forEach((k) => {
    const [nivel, acao] = k.split(":");
    if (nova[nivel]) nova[nivel].push(acao);
  });
  setMatriz(nova);
  showSuccess("Matriz de permissões atualizada");
});

renderUsuarios();
renderMatriz();
