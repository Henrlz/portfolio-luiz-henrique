"""Endpoints da esteira de Tarefas Trabalhistas.

Sem `from __future__ import annotations`: com anotação adiada, o django-ninja
não resolve `payload: TarefaCriarIn` (schema-body) e classifica o parâmetro
como query em vez de body — quebra em runtime com "QueryParams is not fully
defined" — é uma armadilha conhecida do django-ninja quando se usa
anotação adiada em rotas com corpo tipado.
"""
from typing import Optional

from django.db.models import Case, IntegerField, When
from ninja import File, Form, Router
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja_jwt.authentication import JWTAuth

from rh.models.tarefas_trabalhistas.acesso import (
    NivelCargoTarefa,
    TarefaTrabalhistaAcaoPermitida,
    TarefaTrabalhistaAcesso,
)
from rh.models.tarefas_trabalhistas.tarefa import (
    PESOS_PRIORIDADE,
    StatusTarefa,
    TarefaAnexo,
    TarefaChecklistItem,
    TarefaTrabalhista,
    TarefaTrabalhistaLog,
)
from rh.permissions.tarefas_trabalhistas.nivel_permissions import (
    obter_ou_provisionar_acesso,
    requer_acao_tarefa,
    requer_desenvolvedor,
)
from rh.schemas.tarefas_trabalhistas.tarefa_schema import (
    AcaoPermitidaOut,
    AtualizarMatrizIn,
    AtualizarNivelIn,
    AtualizarPrioridadeIn,
    ChecklistItemAtualizarIn,
    ChecklistItemIn,
    ChecklistItemOut,
    ComentarioOut,
    MinhaPermissaoOut,
    MoverIn,
    ReprovarIn,
    TarefaCriarIn,
    TarefaDetailOut,
    TarefaExcluidaOut,
    TarefaOut,
    UsuarioAcessoOut,
)
from rh.services.tarefas_trabalhistas.tarefa_service import TarefaTrabalhistaService

tarefas_trabalhistas_router = Router(tags=["RH - Tarefas Trabalhistas - v1"], auth=JWTAuth())


def _usuario_resumo(usuario) -> Optional[dict]:
    if not usuario:
        return None
    return {
        "id": usuario.id,
        "nome": usuario.get_full_name() or usuario.username,
        "email": usuario.email,
    }


def _cliente_resumo(cliente) -> Optional[dict]:
    if not cliente:
        return None
    return {"idmaster": cliente.idmaster, "nome": cliente.nome}


def _serializar(tarefa: TarefaTrabalhista) -> dict:
    return {
        "idmaster": tarefa.idmaster,
        "titulo": tarefa.titulo,
        "descricao": tarefa.descricao,
        "observacoes": tarefa.observacoes,
        "prazo": tarefa.prazo,
        "status": tarefa.status,
        "prioridade": tarefa.prioridade,
        "cliente": _cliente_resumo(tarefa.cliente),
        "criado_por": _usuario_resumo(tarefa.created_by),
        "responsavel_atual": _usuario_resumo(tarefa.responsavel_atual),
        "responsavel_sugerido": _usuario_resumo(tarefa.responsavel_sugerido),
        "total_anexos": getattr(tarefa, "total_anexos", None) or tarefa.anexos.count(),
        "total_comentarios": getattr(tarefa, "total_comentarios", None) or tarefa.comentarios.count(),
        "created_at": tarefa.created_at.isoformat(),
        "updated_at": tarefa.updated_at.isoformat(),
    }


def _obter_tarefa(tarefa_id: str) -> TarefaTrabalhista:
    tarefa = (
        TarefaTrabalhista.objects
        .select_related("created_by", "responsavel_atual", "responsavel_sugerido", "cliente")
        .filter(pk=tarefa_id)
        .first()
    )
    if not tarefa:
        raise HttpError(404, "Tarefa não encontrada.")
    return tarefa


@tarefas_trabalhistas_router.get("/minha-permissao/", response=MinhaPermissaoOut)
def minha_permissao(request):
    """Nível do usuário logado + ações que ele pode fazer na esteira — o
    front usa isso para mostrar/esconder botões (a fonte real de autorização
    continua sendo `@requer_acao_tarefa` em cada endpoint)."""
    acesso = obter_ou_provisionar_acesso(request.auth)
    eh_dev = acesso.nivel == NivelCargoTarefa.DESENVOLVEDOR or getattr(request.auth, "is_superuser", False)
    if eh_dev:
        acoes = list(TarefaTrabalhistaAcaoPermitida.ACOES)
    else:
        acoes = list(
            TarefaTrabalhistaAcaoPermitida.objects.filter(nivel=acesso.nivel).values_list("acao", flat=True)
        )
    return {"nivel": acesso.nivel, "eh_desenvolvedor": eh_dev, "acoes": acoes}


@tarefas_trabalhistas_router.get("/excluidas/", response=list[TarefaExcluidaOut])
@requer_acao_tarefa("view")
def listar_excluidas(request, limite: int = 100):
    """Tarefas excluídas — a linha em si já foi apagada (CASCADE), então isto
    lê só do log de auditoria (que sobrevive à exclusão): título no momento,
    quem excluiu e quando. Não tem como "restaurar" a partir daqui."""
    qs = (
        TarefaTrabalhistaLog.objects.filter(acao=TarefaTrabalhistaLog.ACAO_EXCLUIDA)
        .select_related("created_by")
        .order_by("-created_at")[:limite]
    )
    return [
        {
            "tarefa_id": lg.tarefa_id,
            "tarefa_titulo": lg.tarefa_titulo,
            "excluido_por": _usuario_resumo(lg.created_by),
            "excluido_em": lg.created_at.isoformat(),
        }
        for lg in qs
    ]


@tarefas_trabalhistas_router.get("/", response=list[TarefaOut])
@requer_acao_tarefa("view")
def listar(
    request, status: str = None, responsavel_id: int = None, cliente_id: str = None,
    prioridade: str = None,
):
    qs = TarefaTrabalhista.objects.select_related(
        "created_by", "responsavel_atual", "responsavel_sugerido", "cliente"
    )
    if status:
        qs = qs.filter(status=status)
    if responsavel_id:
        qs = qs.filter(responsavel_atual_id=responsavel_id)
    if cliente_id:
        qs = qs.filter(cliente_id=cliente_id)
    if prioridade:
        qs = qs.filter(prioridade=prioridade)
    # Maior prioridade primeiro dentro de cada coluna do kanban (o front
    # agrupa por status preservando a ordem que vem daqui).
    qs = qs.annotate(
        _peso_prioridade=Case(
            *[When(prioridade=p, then=w) for p, w in PESOS_PRIORIDADE.items()],
            default=99, output_field=IntegerField(),
        )
    ).order_by("_peso_prioridade", "-created_at")
    return [_serializar(t) for t in qs]


@tarefas_trabalhistas_router.post("/", response={201: TarefaOut})
@requer_acao_tarefa("create")
def criar(request, payload: TarefaCriarIn):
    try:
        tarefa = TarefaTrabalhistaService.criar(
            titulo=payload.titulo,
            descricao=payload.descricao,
            observacoes=payload.observacoes,
            prazo=payload.prazo,
            cliente_id=payload.cliente_id,
            responsavel_sugerido_id=payload.responsavel_sugerido_id,
            prioridade=payload.prioridade,
            usuario=request.auth,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    return 201, _serializar(tarefa)


@tarefas_trabalhistas_router.get("/{tarefa_id}/", response=TarefaDetailOut)
@requer_acao_tarefa("view")
def detalhe(request, tarefa_id: str):
    tarefa = _obter_tarefa(tarefa_id)
    eventos = [
        {
            "de_status": ev.de_status,
            "para_status": ev.para_status,
            "usuario": _usuario_resumo(ev.created_by),
            "created_at": ev.created_at.isoformat(),
        }
        for ev in tarefa.eventos.select_related("created_by").order_by("created_at")
    ]
    anexos = [
        {
            "idmaster": an.idmaster,
            "nome_original": an.nome_original,
            "url": request.build_absolute_uri(an.arquivo.url),
            "criado_por": _usuario_resumo(an.created_by),
            "created_at": an.created_at.isoformat(),
        }
        for an in tarefa.anexos.select_related("created_by").order_by("created_at")
    ]
    comentarios = [
        {
            "idmaster": c.idmaster,
            "texto": c.texto,
            "imagem_url": request.build_absolute_uri(c.imagem.url) if c.imagem else None,
            "criado_por": _usuario_resumo(c.created_by),
            "created_at": c.created_at.isoformat(),
        }
        for c in tarefa.comentarios.select_related("created_by").order_by("created_at")
    ]
    checklist = [
        {
            "idmaster": it.idmaster,
            "texto": it.texto,
            "concluido": it.concluido,
            "criado_por": _usuario_resumo(it.created_by),
            "created_at": it.created_at.isoformat(),
        }
        for it in tarefa.checklist.select_related("created_by").order_by("created_at")
    ]
    log = [
        {
            "acao": lg.acao,
            "detalhes": lg.detalhes,
            "usuario": _usuario_resumo(lg.created_by),
            "created_at": lg.created_at.isoformat(),
        }
        for lg in TarefaTrabalhistaLog.objects.filter(tarefa_id=tarefa_id)
        .select_related("created_by").order_by("created_at")
    ]
    return {
        **_serializar(tarefa), "eventos": eventos, "anexos": anexos,
        "comentarios": comentarios, "checklist": checklist, "log": log,
    }


@tarefas_trabalhistas_router.delete("/{tarefa_id}/", response={200: dict})
@requer_acao_tarefa("delete")
def excluir(request, tarefa_id: str):
    tarefa = _obter_tarefa(tarefa_id)
    TarefaTrabalhistaService.excluir(tarefa=tarefa, usuario=request.auth)
    return 200, {"ok": True, "tarefa_id": tarefa_id}


@tarefas_trabalhistas_router.post("/{tarefa_id}/duplicar/", response={201: TarefaOut})
@requer_acao_tarefa("create")
def duplicar(request, tarefa_id: str):
    tarefa = _obter_tarefa(tarefa_id)
    nova = TarefaTrabalhistaService.duplicar(tarefa=tarefa, usuario=request.auth)
    return 201, _serializar(nova)


@tarefas_trabalhistas_router.post("/{tarefa_id}/anexos/", response={201: dict})
@requer_acao_tarefa("anexar")
def anexar(request, tarefa_id: str, arquivo: UploadedFile = File(...)):
    tarefa = _obter_tarefa(tarefa_id)
    anexo = TarefaTrabalhistaService.anexar(tarefa=tarefa, arquivo=arquivo, usuario=request.auth)
    return 201, {
        "idmaster": anexo.idmaster,
        "nome_original": anexo.nome_original,
        "url": request.build_absolute_uri(anexo.arquivo.url),
    }


@tarefas_trabalhistas_router.delete("/{tarefa_id}/anexos/{anexo_id}/", response={200: dict})
@requer_acao_tarefa("anexar")
def remover_anexo(request, tarefa_id: str, anexo_id: str):
    anexo = TarefaAnexo.objects.filter(pk=anexo_id, tarefa_id=tarefa_id).first()
    if not anexo:
        raise HttpError(404, "Anexo não encontrado.")
    TarefaTrabalhistaService.remover_anexo(anexo=anexo, usuario=request.auth)
    return 200, {"ok": True, "anexo_id": anexo_id}


@tarefas_trabalhistas_router.post("/{tarefa_id}/comentarios/", response={201: ComentarioOut})
@requer_acao_tarefa("comentar")
def comentar(
    request, tarefa_id: str, texto: str = Form(""), imagem: UploadedFile = File(None),
):
    """Multipart em vez de body JSON: um comentário pode ser só texto, só
    imagem colada no chat (print), ou os dois — pelo menos um dos dois é
    obrigatório."""
    tarefa = _obter_tarefa(tarefa_id)
    texto = texto.strip()
    if not texto and not imagem:
        raise HttpError(400, "Comentário vazio.")
    c = TarefaTrabalhistaService.comentar(tarefa=tarefa, texto=texto, imagem=imagem, usuario=request.auth)
    return 201, {
        "idmaster": c.idmaster,
        "texto": c.texto,
        "imagem_url": request.build_absolute_uri(c.imagem.url) if c.imagem else None,
        "criado_por": _usuario_resumo(c.created_by),
        "created_at": c.created_at.isoformat(),
    }


@tarefas_trabalhistas_router.patch("/{tarefa_id}/prioridade/", response={200: TarefaOut})
@requer_acao_tarefa("checklist")
def atualizar_prioridade(request, tarefa_id: str, payload: AtualizarPrioridadeIn):
    tarefa = _obter_tarefa(tarefa_id)
    try:
        tarefa = TarefaTrabalhistaService.atualizar_prioridade(
            tarefa=tarefa, prioridade=payload.prioridade, usuario=request.auth,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    return 200, _serializar(tarefa)


@tarefas_trabalhistas_router.post("/{tarefa_id}/checklist/", response={201: ChecklistItemOut})
@requer_acao_tarefa("checklist")
def adicionar_item_checklist(request, tarefa_id: str, payload: ChecklistItemIn):
    tarefa = _obter_tarefa(tarefa_id)
    texto = payload.texto.strip()
    if not texto:
        raise HttpError(400, "Item de checklist vazio.")
    item = TarefaTrabalhistaService.adicionar_item_checklist(tarefa=tarefa, texto=texto, usuario=request.auth)
    return 201, {
        "idmaster": item.idmaster,
        "texto": item.texto,
        "concluido": item.concluido,
        "criado_por": _usuario_resumo(item.created_by),
        "created_at": item.created_at.isoformat(),
    }


@tarefas_trabalhistas_router.patch("/{tarefa_id}/checklist/{item_id}/", response={200: ChecklistItemOut})
@requer_acao_tarefa("checklist")
def atualizar_item_checklist(request, tarefa_id: str, item_id: str, payload: ChecklistItemAtualizarIn):
    item = TarefaChecklistItem.objects.filter(pk=item_id, tarefa_id=tarefa_id).first()
    if not item:
        raise HttpError(404, "Item de checklist não encontrado.")
    item = TarefaTrabalhistaService.atualizar_item_checklist(
        item=item, concluido=payload.concluido, usuario=request.auth,
    )
    return 200, {
        "idmaster": item.idmaster,
        "texto": item.texto,
        "concluido": item.concluido,
        "criado_por": _usuario_resumo(item.created_by),
        "created_at": item.created_at.isoformat(),
    }


@tarefas_trabalhistas_router.delete("/{tarefa_id}/checklist/{item_id}/", response={200: dict})
@requer_acao_tarefa("checklist")
def remover_item_checklist(request, tarefa_id: str, item_id: str):
    item = TarefaChecklistItem.objects.filter(pk=item_id, tarefa_id=tarefa_id).first()
    if not item:
        raise HttpError(404, "Item de checklist não encontrado.")
    TarefaTrabalhistaService.remover_item_checklist(item=item, usuario=request.auth)
    return 200, {"ok": True, "item_id": item_id}


def _endpoint_transicao(request, tarefa_id: str, para_status: str, acao_esperada: str, motivo: str = ""):
    try:
        tarefa = TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa_id,
            para_status=para_status,
            acao_esperada=acao_esperada,
            usuario=request.auth,
            motivo=motivo,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    return 200, _serializar(tarefa)


@tarefas_trabalhistas_router.post("/{tarefa_id}/assumir/", response={200: TarefaOut})
@requer_acao_tarefa("assumir")
def assumir(request, tarefa_id: str):
    return _endpoint_transicao(request, tarefa_id, StatusTarefa.EXECUTANDO, "assumir")


@tarefas_trabalhistas_router.post("/{tarefa_id}/enviar-validacao/", response={200: TarefaOut})
@requer_acao_tarefa("enviar_validacao")
def enviar_validacao(request, tarefa_id: str):
    return _endpoint_transicao(request, tarefa_id, StatusTarefa.VALIDAR, "enviar_validacao")


@tarefas_trabalhistas_router.post("/{tarefa_id}/validar/", response={200: TarefaOut})
@requer_acao_tarefa("validar")
def validar(request, tarefa_id: str):
    return _endpoint_transicao(request, tarefa_id, StatusTarefa.FINALIZADA, "validar")


@tarefas_trabalhistas_router.post("/{tarefa_id}/reprovar/", response={200: TarefaOut})
@requer_acao_tarefa("reprovar")
def reprovar(request, tarefa_id: str, payload: ReprovarIn):
    return _endpoint_transicao(request, tarefa_id, StatusTarefa.EXECUTANDO, "reprovar", motivo=payload.motivo)


@tarefas_trabalhistas_router.post("/{tarefa_id}/mover/", response={200: TarefaOut})
@requer_acao_tarefa("mover")
def mover(request, tarefa_id: str, payload: MoverIn):
    """Move a tarefa pra qualquer coluna, em qualquer direção — sem passar
    pela máquina de estados normal nem exigir motivo. Só quem tem a ação
    'mover' (Pleno/Sênior/Gerência por padrão) enxerga isso como movimento
    livre no kanban; os demais continuam restritos aos botões/transições
    formais (assumir/enviar_validacao/validar/reprovar)."""
    try:
        tarefa = TarefaTrabalhistaService.mover_livre(
            tarefa_id=tarefa_id, novo_status=payload.status, usuario=request.auth,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    return 200, _serializar(tarefa)


# ---------------------------------------------------------------------------
# Administração de acesso (só nível Desenvolvedor) — níveis por usuário e a
# matriz nível×ação. Nada disso passa por `autorizacao`: é o próprio sistema
# de nível que se administra.
# ---------------------------------------------------------------------------
@tarefas_trabalhistas_router.get("/permissoes/usuarios/", response=list[UsuarioAcessoOut])
@requer_desenvolvedor()
def listar_acessos(request):
    acessos = TarefaTrabalhistaAcesso.objects.select_related("usuario").order_by("usuario__first_name")
    return [
        {"usuario": _usuario_resumo(a.usuario), "nivel": a.nivel,
         "notificar_criacao_email": a.notificar_criacao_email}
        for a in acessos
    ]


@tarefas_trabalhistas_router.patch("/permissoes/usuarios/{usuario_id}/", response={200: UsuarioAcessoOut})
@requer_desenvolvedor()
def atualizar_nivel(request, usuario_id: int, payload: AtualizarNivelIn):
    defaults = {"updated_by": request.auth}
    if payload.nivel is not None:
        if payload.nivel not in NivelCargoTarefa.values:
            raise HttpError(400, f"Nível inválido: {payload.nivel}")
        defaults["nivel"] = payload.nivel
    if payload.notificar_criacao_email is not None:
        defaults["notificar_criacao_email"] = payload.notificar_criacao_email
    acesso, _ = TarefaTrabalhistaAcesso.objects.update_or_create(
        usuario_id=usuario_id, defaults=defaults,
    )
    acesso.refresh_from_db()
    return 200, {
        "usuario": _usuario_resumo(acesso.usuario), "nivel": acesso.nivel,
        "notificar_criacao_email": acesso.notificar_criacao_email,
    }


@tarefas_trabalhistas_router.get("/permissoes/matriz/", response=list[AcaoPermitidaOut])
@requer_desenvolvedor()
def obter_matriz(request):
    return [
        {"nivel": p.nivel, "acao": p.acao}
        for p in TarefaTrabalhistaAcaoPermitida.objects.all()
    ]


@tarefas_trabalhistas_router.put("/permissoes/matriz/", response={200: list[AcaoPermitidaOut]})
@requer_desenvolvedor()
def atualizar_matriz(request, payload: AtualizarMatrizIn):
    from django.db import transaction

    niveis_validos = set(NivelCargoTarefa.values)
    acoes_validas = set(TarefaTrabalhistaAcaoPermitida.ACOES)
    for item in payload.permissoes:
        if item.nivel not in niveis_validos:
            raise HttpError(400, f"Nível inválido: {item.nivel}")
        if item.acao not in acoes_validas:
            raise HttpError(400, f"Ação inválida: {item.acao}")

    with transaction.atomic():
        TarefaTrabalhistaAcaoPermitida.objects.all().delete()
        TarefaTrabalhistaAcaoPermitida.objects.bulk_create([
            TarefaTrabalhistaAcaoPermitida(nivel=item.nivel, acao=item.acao, created_by=request.auth)
            for item in payload.permissoes
        ])

    return 200, [
        {"nivel": p.nivel, "acao": p.acao}
        for p in TarefaTrabalhistaAcaoPermitida.objects.all()
    ]
