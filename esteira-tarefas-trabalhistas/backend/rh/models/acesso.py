from django.conf import settings
from django.db import models

from central.models import BaseModelAbstratic


class NivelCargoTarefa(models.TextChoices):
    """Nível de acesso PRÓPRIO da esteira de Tarefas Trabalhistas — não é o
    `CargoModel` do RH nem o RBAC multiempresa (`autorizacao`). Global para
    todo o grupo da empresa, não por empresa. Ordem crescente de acesso.
    DESENVOLVEDOR é o nível máximo: bypassa a matriz de ações e é o único que
    administra os níveis de outros usuários e a própria matriz."""

    ASSISTENTE = "ASSISTENTE", "Assistente"
    ANALISTA_JR = "ANALISTA_JR", "Analista Jr"
    PLENO = "PLENO", "Pleno"
    SENIOR = "SENIOR", "Sênior"
    GERENCIA = "GERENCIA", "Gerência"
    DESENVOLVEDOR = "DESENVOLVEDOR", "Desenvolvedor"


class TarefaTrabalhistaAcesso(BaseModelAbstratic):
    """Nível de cargo do usuário dentro da esteira. Um registro por usuário
    (provisionado automaticamente como ASSISTENTE no primeiro acesso — ver
    `rh.permissions.tarefas_trabalhistas.nivel_permissions.usuario_pode`)."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="acesso_tarefas_trabalhistas",
    )
    nivel = models.CharField(
        max_length=20,
        choices=NivelCargoTarefa.choices,
        default=NivelCargoTarefa.ASSISTENTE,
    )
    notificar_criacao_email = models.BooleanField(
        default=False,
        help_text="Recebe e-mail (não só Teams) sempre que uma tarefa nova é criada na esteira. "
                  "Lista editável na própria tela de Permissões.",
    )

    class Meta:
        db_table = "rh_tarefa_trabalhista_acesso"
        verbose_name = "Acesso à Esteira de Tarefas Trabalhistas"
        verbose_name_plural = "Acessos à Esteira de Tarefas Trabalhistas"

    def __str__(self):
        return f"{self.usuario_id} = {self.nivel}"


class TarefaTrabalhistaAcaoPermitida(BaseModelAbstratic):
    """Matriz editável nível × ação — fonte única de quem pode fazer o quê na
    esteira (fora do bypass do nível DESENVOLVEDOR). Editável pela tela de
    administração; `seed_acesso_tarefas_trabalhistas` só semeia um default se
    a tabela estiver vazia (nunca sobrescreve edição feita pela tela)."""

    ACOES = [
        "view", "create", "delete", "anexar", "comentar", "checklist",
        "assumir", "enviar_validacao", "validar", "reprovar", "mover",
    ]

    nivel = models.CharField(max_length=20, choices=NivelCargoTarefa.choices)
    acao = models.CharField(max_length=30)

    class Meta:
        db_table = "rh_tarefa_trabalhista_acao_permitida"
        verbose_name = "Ação permitida por nível (Tarefas Trabalhistas)"
        verbose_name_plural = "Ações permitidas por nível (Tarefas Trabalhistas)"
        constraints = [
            models.UniqueConstraint(fields=["nivel", "acao"], name="uq_tarefa_nivel_acao"),
        ]

    def __str__(self):
        return f"{self.nivel}: {self.acao}"
