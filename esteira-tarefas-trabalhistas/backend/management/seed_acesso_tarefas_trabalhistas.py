"""
Semeia o sistema de acesso PRÓPRIO da esteira de Tarefas Trabalhistas
(`rh.models.tarefas_trabalhistas.acesso`) — substitui o RBAC multiempresa
para as ações desta rotina (ver plano da v2).

Idempotente. Uso: python manage.py seed_acesso_tarefas_trabalhistas

Faz três coisas:
1. Backfill: todo usuário com vínculo ativo em qualquer uma das empresas
   onde a rotina "Tarefas Trabalhistas" está habilitada (grupo da empresa) ganha
   `TarefaTrabalhistaAcesso(nivel=ASSISTENTE)` (get_or_create — não mexe em
   quem já tem nível definido).
2. Promove os e-mails confirmados para o nível DESENVOLVEDOR (acesso máximo).
3. Semeia uma matriz nível×ação DEFAULT, só se a tabela estiver vazia (nunca
   sobrescreve edição feita pela tela de administração).
4. Vincula todo mundo ao Grupo RBAC "Solicitante da Esteira" (já criado por
   `seed_grupos_tarefas_trabalhistas`) só para o item aparecer no menu — a
   autorização de ação em si não depende mais disso.
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from administrativo.models import RotinaModel
from autorizacao.models import EmpresaRotina, Grupo, UsuarioEmpresa, UsuarioEmpresaGrupo
from rh.models.tarefas_trabalhistas.acesso import (
    NivelCargoTarefa,
    TarefaTrabalhistaAcaoPermitida,
    TarefaTrabalhistaAcesso,
)

ROTA_TAREFAS_TRABALHISTAS = "/rh/tarefas-trabalhistas"
NOME_GRUPO_MENU = "Solicitante da Esteira"

EMAILS_DESENVOLVEDOR = [
    "usuario1@example.com",
    "usuario2@example.com",
    "usuario3@example.com",
    "usuario4@example.com",
    "usuario5@example.com",
    "usuario6@example.com",
]

MATRIZ_DEFAULT = {
    "view": [
        NivelCargoTarefa.ASSISTENTE, NivelCargoTarefa.ANALISTA_JR, NivelCargoTarefa.PLENO,
        NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA,
    ],
    "assumir": [
        NivelCargoTarefa.ASSISTENTE, NivelCargoTarefa.ANALISTA_JR, NivelCargoTarefa.PLENO,
        NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA,
    ],
    "enviar_validacao": [
        NivelCargoTarefa.ASSISTENTE, NivelCargoTarefa.ANALISTA_JR, NivelCargoTarefa.PLENO,
        NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA,
    ],
    "anexar": [
        NivelCargoTarefa.ASSISTENTE, NivelCargoTarefa.ANALISTA_JR, NivelCargoTarefa.PLENO,
        NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA,
    ],
    "comentar": [
        NivelCargoTarefa.ASSISTENTE, NivelCargoTarefa.ANALISTA_JR, NivelCargoTarefa.PLENO,
        NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA,
    ],
    "checklist": [
        NivelCargoTarefa.ASSISTENTE, NivelCargoTarefa.ANALISTA_JR, NivelCargoTarefa.PLENO,
        NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA,
    ],
    "create": [
        NivelCargoTarefa.ANALISTA_JR, NivelCargoTarefa.PLENO,
        NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA,
    ],
    "validar": [NivelCargoTarefa.PLENO, NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA],
    "reprovar": [NivelCargoTarefa.PLENO, NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA],
    # Movimentação livre no kanban (qualquer coluna, qualquer direção, sem
    # motivo) — Pleno/Sênior/Gerência reorganizam a esteira à vontade.
    "mover": [NivelCargoTarefa.PLENO, NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA],
    "delete": [NivelCargoTarefa.SENIOR, NivelCargoTarefa.GERENCIA],
}


class Command(BaseCommand):
    help = "Semeia o sistema de acesso por nível da esteira de Tarefas Trabalhistas."

    def handle(self, *args, **opts):
        rotina = RotinaModel.objects.filter(rota=ROTA_TAREFAS_TRABALHISTAS).first()
        if not rotina:
            self.stderr.write(self.style.ERROR(
                "Rotina não encontrada — rode seed_rotina_tarefas_trabalhistas antes."))
            return

        empresas_ids = set(
            EmpresaRotina.objects.filter(rotina=rotina, habilitada=True).values_list("empresa_id", flat=True)
        )
        usuario_ids_grupo_empresa = set(
            UsuarioEmpresa.objects.filter(empresa_id__in=empresas_ids, status=1)
            .values_list("usuario_id", flat=True)
        )

        criados = 0
        with transaction.atomic():
            for usuario_id in usuario_ids_grupo_empresa:
                _, criado = TarefaTrabalhistaAcesso.objects.get_or_create(usuario_id=usuario_id)
                if criado:
                    criados += 1

            promovidos = TarefaTrabalhistaAcesso.objects.filter(
                usuario__email__in=EMAILS_DESENVOLVEDOR
            ).update(nivel=NivelCargoTarefa.DESENVOLVEDOR)

            matriz_criada = 0
            if not TarefaTrabalhistaAcaoPermitida.objects.exists():
                for acao, niveis in MATRIZ_DEFAULT.items():
                    for nivel in niveis:
                        TarefaTrabalhistaAcaoPermitida.objects.get_or_create(nivel=nivel, acao=acao)
                        matriz_criada += 1

            grupo_menu = Grupo.objects.filter(nome=NOME_GRUPO_MENU, empresa_id__in=empresas_ids)
            vinculos_menu = 0
            for vinc in UsuarioEmpresa.objects.filter(
                usuario_id__in=usuario_ids_grupo_empresa, empresa_id__in=empresas_ids, status=1
            ):
                grupo = grupo_menu.filter(empresa_id=vinc.empresa_id).first()
                if not grupo:
                    continue
                _, criado_vinc = UsuarioEmpresaGrupo.objects.get_or_create(
                    usuario_empresa=vinc, grupo=grupo)
                if criado_vinc:
                    vinculos_menu += 1

        self.stdout.write(self.style.SUCCESS(
            f"Usuários do grupo da empresa: {len(usuario_ids_grupo_empresa)}. "
            f"Acessos criados (Assistente): {criados}. "
            f"Promovidos a Desenvolvedor: {promovidos}. "
            f"Linhas de matriz default semeadas: {matriz_criada}. "
            f"Vínculos de menu criados: {vinculos_menu}."
        ))
