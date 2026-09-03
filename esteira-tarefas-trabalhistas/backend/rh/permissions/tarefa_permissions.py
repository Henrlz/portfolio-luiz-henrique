"""Máquina de estados da esteira de Tarefas Trabalhistas.

Autorização de ação é feita por `nivel_permissions.py` (sistema de nível
próprio da rotina) — este módulo só sabe qual AÇÃO cada transição de status
exige, para o serviço conferir que a ação usada bate com a dona da transição
(ver `TarefaTrabalhistaService.transicionar`)."""
from __future__ import annotations

from rh.models.tarefas_trabalhistas.tarefa import StatusTarefa

# (de, para) -> ação exigida. Qualquer par fora deste mapa é rejeitado — a
# esteira não permite pular etapa.
TRANSICOES = {
    (StatusTarefa.FALTA_ASSUMIR, StatusTarefa.EXECUTANDO): "assumir",
    (StatusTarefa.EXECUTANDO, StatusTarefa.VALIDAR): "enviar_validacao",
    (StatusTarefa.VALIDAR, StatusTarefa.EXECUTANDO): "reprovar",
    (StatusTarefa.VALIDAR, StatusTarefa.FINALIZADA): "validar",
}


class TransicaoInvalidaError(ValueError):
    pass


def acao_da_transicao(de_status: str, para_status: str) -> str:
    """Devolve a ação exigida para a transição, ou levanta
    TransicaoInvalidaError se o salto de etapa não for permitido."""
    acao = TRANSICOES.get((de_status, para_status))
    if not acao:
        raise TransicaoInvalidaError(f"Transição não permitida: {de_status} -> {para_status}")
    return acao
