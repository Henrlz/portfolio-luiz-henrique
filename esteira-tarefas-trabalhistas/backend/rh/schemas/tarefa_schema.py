from datetime import date
from typing import Optional

from ninja import Schema


class TarefaCriarIn(Schema):
    titulo: str
    descricao: str = ""
    observacoes: str = ""
    prazo: Optional[date] = None
    cliente_id: Optional[str] = None
    responsavel_sugerido_id: Optional[int] = None
    prioridade: str = "MEDIA"


class AtualizarPrioridadeIn(Schema):
    prioridade: str


class UsuarioResumoOut(Schema):
    id: int
    nome: str
    email: str


class ClienteResumoOut(Schema):
    idmaster: str
    nome: str


class AnexoOut(Schema):
    idmaster: str
    nome_original: str
    url: str
    criado_por: Optional[UsuarioResumoOut] = None
    created_at: str


class ComentarioIn(Schema):
    texto: str


class ReprovarIn(Schema):
    motivo: str


class MoverIn(Schema):
    status: str


class ComentarioOut(Schema):
    idmaster: str
    texto: str
    imagem_url: Optional[str] = None
    criado_por: Optional[UsuarioResumoOut] = None
    created_at: str


class ChecklistItemIn(Schema):
    texto: str


class ChecklistItemAtualizarIn(Schema):
    concluido: bool


class ChecklistItemOut(Schema):
    idmaster: str
    texto: str
    concluido: bool
    criado_por: Optional[UsuarioResumoOut] = None
    created_at: str


class TarefaOut(Schema):
    idmaster: str
    titulo: str
    descricao: str
    observacoes: str
    prazo: Optional[date] = None
    status: str
    prioridade: str = "MEDIA"
    cliente: Optional[ClienteResumoOut] = None
    criado_por: Optional[UsuarioResumoOut] = None
    responsavel_atual: Optional[UsuarioResumoOut] = None
    responsavel_sugerido: Optional[UsuarioResumoOut] = None
    total_anexos: int = 0
    total_comentarios: int = 0
    created_at: str
    updated_at: str


class TarefaEventoOut(Schema):
    de_status: str
    para_status: str
    usuario: Optional[UsuarioResumoOut] = None
    created_at: str


class LogOut(Schema):
    acao: str
    detalhes: str
    usuario: Optional[UsuarioResumoOut] = None
    created_at: str


class TarefaDetailOut(TarefaOut):
    eventos: list[TarefaEventoOut] = []
    anexos: list[AnexoOut] = []
    comentarios: list[ComentarioOut] = []
    checklist: list[ChecklistItemOut] = []
    log: list[LogOut] = []


class TarefaExcluidaOut(Schema):
    tarefa_id: str
    tarefa_titulo: str
    excluido_por: Optional[UsuarioResumoOut] = None
    excluido_em: str


class UsuarioAcessoOut(Schema):
    usuario: UsuarioResumoOut
    nivel: str
    notificar_criacao_email: bool = False


class MinhaPermissaoOut(Schema):
    nivel: str
    eh_desenvolvedor: bool
    acoes: list[str]


class AtualizarNivelIn(Schema):
    nivel: Optional[str] = None
    notificar_criacao_email: Optional[bool] = None


class AcaoPermitidaOut(Schema):
    nivel: str
    acao: str


class AtualizarMatrizIn(Schema):
    permissoes: list[AcaoPermitidaOut]
