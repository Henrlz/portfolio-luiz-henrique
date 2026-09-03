"""Autorização própria da esteira de Tarefas Trabalhistas — substitui o RBAC
multiempresa (`autorizacao.requer_permissao`) para as AÇÕES desta rotina
(criar/excluir/assumir/validar/etc). O RBAC continua existindo só para o item
de menu aparecer (ver `seed_rotina_tarefas_trabalhistas`/`seed_grupos_tarefas_trabalhistas`).

Global, não por empresa: cada usuário tem um único nível
(`rh.models.tarefas_trabalhistas.acesso.NivelCargoTarefa`), e uma matriz
nível×ação (`TarefaTrabalhistaAcaoPermitida`) decide o que cada nível pode
fazer. DESENVOLVEDOR bypassa a matriz inteira.
"""
from __future__ import annotations

from functools import wraps

from ninja.errors import HttpError


def _usuario(request):
    user = getattr(request, "auth", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        return user
    return None


def obter_ou_provisionar_acesso(user):
    """Provisiona automaticamente como ASSISTENTE no primeiro acesso (sem
    exigir backfill manual pra gente nova)."""
    from rh.models.tarefas_trabalhistas.acesso import TarefaTrabalhistaAcesso

    acesso, _ = TarefaTrabalhistaAcesso.objects.get_or_create(usuario=user)
    return acesso


def eh_desenvolvedor(user) -> bool:
    from rh.models.tarefas_trabalhistas.acesso import NivelCargoTarefa

    if getattr(user, "is_superuser", False):
        return True
    return obter_ou_provisionar_acesso(user).nivel == NivelCargoTarefa.DESENVOLVEDOR


def usuario_pode(user, acao: str) -> bool:
    from rh.models.tarefas_trabalhistas.acesso import (
        NivelCargoTarefa,
        TarefaTrabalhistaAcaoPermitida,
    )

    if getattr(user, "is_superuser", False):
        return True

    acesso = obter_ou_provisionar_acesso(user)
    if acesso.nivel == NivelCargoTarefa.DESENVOLVEDOR:
        return True
    return TarefaTrabalhistaAcaoPermitida.objects.filter(nivel=acesso.nivel, acao=acao).exists()


def requer_acao_tarefa(acao: str):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user = _usuario(request)
            if user is None:
                raise HttpError(401, "Usuário não autenticado.")
            if not usuario_pode(user, acao):
                raise HttpError(403, "Seu nível de acesso na esteira não permite essa ação.")
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def requer_desenvolvedor():
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            user = _usuario(request)
            if user is None:
                raise HttpError(401, "Usuário não autenticado.")
            if not eh_desenvolvedor(user):
                raise HttpError(403, "Só o nível Desenvolvedor administra os acessos da esteira.")
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator
