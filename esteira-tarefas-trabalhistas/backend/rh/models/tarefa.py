from django.conf import settings
from django.db import models

from central.models import BaseModelAbstratic


class StatusTarefa(models.TextChoices):
    FALTA_ASSUMIR = "FALTA_ASSUMIR", "Falta assumir"
    EXECUTANDO = "EXECUTANDO", "Executando"
    VALIDAR = "VALIDAR", "Validar"
    FINALIZADA = "FINALIZADA", "Finalizada"


class PrioridadeTarefa(models.TextChoices):
    BAIXA = "BAIXA", "Baixa"
    MEDIA = "MEDIA", "Média"
    ALTA = "ALTA", "Alta"


# Peso de ordenação (menor = mais urgente) — usado em `listar()` pra trazer as
# tarefas de maior prioridade pro topo de cada coluna do kanban. Mantido fora
# da classe: um atributo de classe dentro de um TextChoices vira tentativa de
# membro do enum (quebra, já que o valor não é string).
PESOS_PRIORIDADE = {
    PrioridadeTarefa.ALTA: 0,
    PrioridadeTarefa.MEDIA: 1,
    PrioridadeTarefa.BAIXA: 2,
}


class TarefaTrabalhista(BaseModelAbstratic):
    """Item da esteira de tarefas trabalhistas (RH). `created_by`/`created_at`
    (BaseModelAbstratic) já registram quem criou e quando.

    Não é escopada por empresa operacional: a esteira serve o grupo da empresa
    inteiro de uma vez (ver `rh.models.tarefas_trabalhistas.acesso`). Quando a
    tarefa é sobre um cliente específico da EMPRESA, `cliente` identifica qual."""

    cliente = models.ForeignKey(
        "cliente.ClienteModel",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="tarefas_trabalhistas",
    )
    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, default="")
    observacoes = models.TextField(blank=True, default="")
    prazo = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=StatusTarefa.choices,
        default=StatusTarefa.FALTA_ASSUMIR,
    )
    prioridade = models.CharField(
        max_length=10,
        choices=PrioridadeTarefa.choices,
        default=PrioridadeTarefa.MEDIA,
    )
    responsavel_atual = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tarefas_trabalhistas_assumidas",
    )
    responsavel_sugerido = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tarefas_trabalhistas_sugeridas",
        help_text="Sugestão de quem deve assumir, indicada por quem criou. "
                  "Não atribui automaticamente — só destaca na notificação.",
    )

    class Meta:
        db_table = "rh_tarefa_trabalhista"
        verbose_name = "Tarefa Trabalhista"
        verbose_name_plural = "Tarefas Trabalhistas"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="idx_tarefa_trab_status"),
        ]

    def __str__(self):
        return f"{self.titulo} [{self.status}]"


class TarefaTrabalhistaEvento(BaseModelAbstratic):
    """Trilha de auditoria da esteira: cada transição de status vira um evento.
    `created_by` = usuário que executou a transição; vazio na criação (via
    action=criar, de_status="")."""

    tarefa = models.ForeignKey(
        TarefaTrabalhista,
        on_delete=models.CASCADE,
        related_name="eventos",
    )
    de_status = models.CharField(max_length=20, blank=True, default="")
    para_status = models.CharField(max_length=20, choices=StatusTarefa.choices)

    class Meta:
        db_table = "rh_tarefa_trabalhista_evento"
        verbose_name = "Evento da Tarefa Trabalhista"
        verbose_name_plural = "Eventos da Tarefa Trabalhista"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.tarefa_id}: {self.de_status or '—'} -> {self.para_status}"


def tarefa_anexo_path(instance, filename):
    return f"tarefas_trabalhistas/{instance.tarefa_id}/{filename}"


class TarefaAnexo(BaseModelAbstratic):
    """Anexo de uma tarefa. `created_by`/`created_at` (BaseModelAbstratic)
    registram quem anexou e quando."""

    tarefa = models.ForeignKey(
        TarefaTrabalhista,
        on_delete=models.CASCADE,
        related_name="anexos",
    )
    arquivo = models.FileField(upload_to=tarefa_anexo_path)
    nome_original = models.CharField(max_length=255)

    class Meta:
        db_table = "rh_tarefa_trabalhista_anexo"
        verbose_name = "Anexo da Tarefa Trabalhista"
        verbose_name_plural = "Anexos da Tarefa Trabalhista"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.nome_original} (tarefa#{self.tarefa_id})"


def tarefa_comentario_imagem_path(instance, filename):
    return f"tarefas_trabalhistas/{instance.tarefa_id}/chat/{filename}"


class TarefaComentario(BaseModelAbstratic):
    """Comentário livre na tarefa — histórico de ocorrências (chat), separado
    da trilha de transição de status (`TarefaTrabalhistaEvento`). `created_by`/
    `created_at` (BaseModelAbstratic) registram autor e quando.

    `imagem` é opcional (print colado no chat) — um comentário pode ser só
    texto, só imagem, ou os dois; por isso `texto` também é `blank=True`."""

    tarefa = models.ForeignKey(
        TarefaTrabalhista,
        on_delete=models.CASCADE,
        related_name="comentarios",
    )
    texto = models.TextField(blank=True, default="")
    imagem = models.ImageField(upload_to=tarefa_comentario_imagem_path, null=True, blank=True)

    class Meta:
        db_table = "rh_tarefa_trabalhista_comentario"
        verbose_name = "Comentário da Tarefa Trabalhista"
        verbose_name_plural = "Comentários da Tarefa Trabalhista"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.created_by_id}: {self.texto[:40]} (tarefa#{self.tarefa_id})"


class TarefaChecklistItem(BaseModelAbstratic):
    """Item de checklist dentro da tarefa. `created_by`/`created_at`
    (BaseModelAbstratic) registram quem adicionou e quando; `updated_by` fica
    com quem marcou/desmarcou por último."""

    tarefa = models.ForeignKey(
        TarefaTrabalhista,
        on_delete=models.CASCADE,
        related_name="checklist",
    )
    texto = models.CharField(max_length=255)
    concluido = models.BooleanField(default=False)

    class Meta:
        db_table = "rh_tarefa_trabalhista_checklist_item"
        verbose_name = "Item de Checklist da Tarefa Trabalhista"
        verbose_name_plural = "Itens de Checklist da Tarefa Trabalhista"
        ordering = ["created_at"]

    def __str__(self):
        marca = "x" if self.concluido else " "
        return f"[{marca}] {self.texto} (tarefa#{self.tarefa_id})"


class TarefaTrabalhistaLog(BaseModelAbstratic):
    """Log de auditoria da tarefa — quem fez o quê e quando (criação, cada
    transição de status, anexos, comentários, exclusão). `created_by`/
    `created_at` (BaseModelAbstratic) já são "por quem"/"quando".

    Deliberadamente SEM FK (`tarefa_id` é só um CharField, não
    ForeignKey) — ao contrário de `TarefaTrabalhistaEvento`/`TarefaAnexo`/
    `TarefaComentario`, que são CASCADE e somem se a tarefa for excluída, este
    log precisa sobreviver à própria exclusão (é o registro de que ela
    aconteceu e quem fez). `tarefa_titulo` é um retrato do título no momento
    do log, pelo mesmo motivo."""

    ACAO_CRIADA = "criada"
    ACAO_ASSUMIDA = "assumida"
    ACAO_ENVIADA_VALIDACAO = "enviada_validacao"
    ACAO_VALIDADA = "validada"
    ACAO_REPROVADA = "reprovada"
    ACAO_EXCLUIDA = "excluida"
    ACAO_ANEXO_ADICIONADO = "anexo_adicionado"
    ACAO_ANEXO_REMOVIDO = "anexo_removido"
    ACAO_COMENTARIO = "comentario"
    ACAO_CHECKLIST_ADICIONADO = "checklist_adicionado"
    ACAO_CHECKLIST_ATUALIZADO = "checklist_atualizado"
    ACAO_CHECKLIST_REMOVIDO = "checklist_removido"
    ACAO_MOVIDA_LIVRE = "movida_livre"
    ACAO_PRIORIDADE_ALTERADA = "prioridade_alterada"
    ACAO_LEMBRETE_PRAZO = "lembrete_prazo"
    ACAO_LEMBRETE_ATRASADA = "lembrete_atrasada"
    ACAO_CHOICES = [
        (ACAO_CRIADA, "Criada"),
        (ACAO_ASSUMIDA, "Assumida"),
        (ACAO_ENVIADA_VALIDACAO, "Enviada para validação"),
        (ACAO_VALIDADA, "Validada / Concluída"),
        (ACAO_REPROVADA, "Reprovada"),
        (ACAO_EXCLUIDA, "Excluída"),
        (ACAO_ANEXO_ADICIONADO, "Anexo adicionado"),
        (ACAO_ANEXO_REMOVIDO, "Anexo removido"),
        (ACAO_COMENTARIO, "Comentário"),
        (ACAO_CHECKLIST_ADICIONADO, "Item de checklist adicionado"),
        (ACAO_CHECKLIST_ATUALIZADO, "Item de checklist marcado/desmarcado"),
        (ACAO_CHECKLIST_REMOVIDO, "Item de checklist removido"),
        (ACAO_MOVIDA_LIVRE, "Movida livremente"),
        (ACAO_PRIORIDADE_ALTERADA, "Prioridade alterada"),
        (ACAO_LEMBRETE_PRAZO, "Lembrete de prazo próximo enviado"),
        (ACAO_LEMBRETE_ATRASADA, "Aviso de atraso enviado ao criador"),
    ]

    tarefa_id = models.CharField(max_length=30, db_index=True)
    tarefa_titulo = models.CharField(max_length=255)
    acao = models.CharField(max_length=30, choices=ACAO_CHOICES)
    detalhes = models.CharField(max_length=500, blank=True, default="")

    class Meta:
        db_table = "rh_tarefa_trabalhista_log"
        verbose_name = "Log da Tarefa Trabalhista"
        verbose_name_plural = "Logs da Tarefa Trabalhista"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["tarefa_id", "created_at"], name="idx_tt_log_tarefa_criado"),
        ]

    def __str__(self):
        return f"{self.tarefa_titulo}: {self.acao} ({self.created_by_id})"
