"""
Testes da esteira de Tarefas Trabalhistas: máquina de estados (serviço), o
sistema de nível de acesso próprio da rotina (global, não é o RBAC
multiempresa de `autorizacao`), o log de auditoria durável, checklist e
duplicação de tarefa.
"""
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase
from ninja.errors import HttpError

from rh.models.tarefas_trabalhistas.acesso import (
    NivelCargoTarefa,
    TarefaTrabalhistaAcaoPermitida,
    TarefaTrabalhistaAcesso,
)
from rh.models.tarefas_trabalhistas.tarefa import (
    StatusTarefa,
    TarefaTrabalhista,
    TarefaTrabalhistaLog,
)
from rh.permissions.tarefas_trabalhistas.tarefa_permissions import TransicaoInvalidaError
from rh.services.tarefas_trabalhistas.tarefa_service import TarefaTrabalhistaService
from rh.views.tarefas_trabalhistas import router as tarefas_router

User = get_user_model()


class TarefaTrabalhistaServiceTest(TestCase):
    """Máquina de estados: só via camada de serviço, sem HTTP/RBAC."""

    @classmethod
    def setUpTestData(cls):
        cls.criador = User.objects.create(username="criador", email="criador@x.com")
        cls.executor = User.objects.create(username="executor", email="executor@x.com")
        cls.outro_executor = User.objects.create(username="executor2", email="executor2@x.com")

    def _criar_tarefa(self):
        return TarefaTrabalhistaService.criar(
            titulo="Rescisão fulano", descricao="", observacoes="", prazo=None,
            cliente_id=None, responsavel_sugerido_id=None, usuario=self.criador,
        )

    def test_criar_cria_com_status_falta_assumir_e_evento_inicial(self):
        tarefa = self._criar_tarefa()
        self.assertEqual(tarefa.status, StatusTarefa.FALTA_ASSUMIR)
        self.assertIsNone(tarefa.responsavel_atual)
        eventos = list(tarefa.eventos.all())
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0].para_status, StatusTarefa.FALTA_ASSUMIR)

    def test_assumir_seta_responsavel_e_muda_status(self):
        tarefa = self._criar_tarefa()
        atualizada = TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
            acao_esperada="assumir", usuario=self.executor,
        )
        self.assertEqual(atualizada.status, StatusTarefa.EXECUTANDO)
        self.assertEqual(atualizada.responsavel_atual_id, self.executor.id)

    def test_assumir_falha_se_ja_assumida_por_outra_pessoa(self):
        """A 2ª tentativa relê o status já como EXECUTANDO (select_for_update
        serializa as duas chamadas) — (EXECUTANDO, EXECUTANDO) não é uma
        transição válida, então cai em TransicaoInvalidaError."""
        tarefa = self._criar_tarefa()
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
            acao_esperada="assumir", usuario=self.executor,
        )
        with self.assertRaises(TransicaoInvalidaError):
            TarefaTrabalhistaService.transicionar(
                tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
                acao_esperada="assumir", usuario=self.outro_executor,
            )
        tarefa.refresh_from_db()
        self.assertEqual(tarefa.responsavel_atual_id, self.executor.id)

    def test_pular_etapa_e_rejeitado(self):
        tarefa = self._criar_tarefa()
        with self.assertRaises(TransicaoInvalidaError):
            TarefaTrabalhistaService.transicionar(
                tarefa_id=tarefa.pk, para_status=StatusTarefa.FINALIZADA,
                acao_esperada="validar", usuario=self.executor,
            )

    def test_acao_que_nao_e_dona_da_transicao_e_rejeitada(self):
        """FALTA_ASSUMIR->EXECUTANDO é dona de 'assumir', não de 'reprovar' —
        mesmo sendo um par (de,para) válido para OUTRA transição (VALIDAR->
        EXECUTANDO), a ação errada não pode ser aceita aqui."""
        tarefa = self._criar_tarefa()
        with self.assertRaises(TransicaoInvalidaError):
            TarefaTrabalhistaService.transicionar(
                tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
                acao_esperada="reprovar", usuario=self.executor,
            )

    def test_fluxo_completo_ate_finalizada(self):
        tarefa = self._criar_tarefa()
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
            acao_esperada="assumir", usuario=self.executor,
        )
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.VALIDAR,
            acao_esperada="enviar_validacao", usuario=self.executor,
        )
        finalizada = TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.FINALIZADA,
            acao_esperada="validar", usuario=self.criador,
        )
        self.assertEqual(finalizada.status, StatusTarefa.FINALIZADA)
        self.assertEqual(finalizada.eventos.count(), 4)

    def test_reprovar_sem_motivo_e_rejeitado(self):
        tarefa = self._criar_tarefa()
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
            acao_esperada="assumir", usuario=self.executor,
        )
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.VALIDAR,
            acao_esperada="enviar_validacao", usuario=self.executor,
        )
        with self.assertRaises(ValueError):
            TarefaTrabalhistaService.transicionar(
                tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
                acao_esperada="reprovar", usuario=self.criador, motivo="   ",
            )
        tarefa.refresh_from_db()
        self.assertEqual(tarefa.status, StatusTarefa.VALIDAR)  # não avançou

    def test_reprovar_devolve_para_executando_e_registra_motivo_no_log(self):
        tarefa = self._criar_tarefa()
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
            acao_esperada="assumir", usuario=self.executor,
        )
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.VALIDAR,
            acao_esperada="enviar_validacao", usuario=self.executor,
        )
        reprovada = TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO,
            acao_esperada="reprovar", usuario=self.criador, motivo="Faltou anexo.",
        )
        self.assertEqual(reprovada.status, StatusTarefa.EXECUTANDO)
        log_reprovacao = TarefaTrabalhistaLog.objects.filter(
            tarefa_id=tarefa.pk, acao=TarefaTrabalhistaLog.ACAO_REPROVADA,
        ).get()
        self.assertIn("Faltou anexo.", log_reprovacao.detalhes)
        self.assertEqual(log_reprovacao.created_by_id, self.criador.id)

    def test_mover_livre_pula_para_qualquer_status_sem_seguir_maquina_de_estados(self):
        """`mover_livre` é reservado a quem tem a ação 'mover' (Pleno/Sênior/
        Gerência) — ao contrário de `transicionar`, não segue os pares de
        `acao_da_transicao` nem exige motivo: pode até voltar de VALIDAR
        direto pra FALTA_ASSUMIR, coisa que `transicionar` rejeitaria."""
        tarefa = self._criar_tarefa()
        movida = TarefaTrabalhistaService.mover_livre(
            tarefa_id=tarefa.pk, novo_status=StatusTarefa.VALIDAR, usuario=self.executor,
        )
        self.assertEqual(movida.status, StatusTarefa.VALIDAR)

        de_volta = TarefaTrabalhistaService.mover_livre(
            tarefa_id=tarefa.pk, novo_status=StatusTarefa.FALTA_ASSUMIR, usuario=self.executor,
        )
        self.assertEqual(de_volta.status, StatusTarefa.FALTA_ASSUMIR)
        self.assertTrue(
            TarefaTrabalhistaLog.objects.filter(
                tarefa_id=tarefa.pk, acao=TarefaTrabalhistaLog.ACAO_MOVIDA_LIVRE,
            ).exists()
        )

    def test_mover_livre_para_o_mesmo_status_e_no_op(self):
        tarefa = self._criar_tarefa()
        eventos_antes = tarefa.eventos.count()
        TarefaTrabalhistaService.mover_livre(
            tarefa_id=tarefa.pk, novo_status=StatusTarefa.FALTA_ASSUMIR, usuario=self.executor,
        )
        self.assertEqual(tarefa.eventos.count(), eventos_antes)

    def test_mover_livre_status_invalido_e_rejeitado(self):
        tarefa = self._criar_tarefa()
        with self.assertRaises(ValueError):
            TarefaTrabalhistaService.mover_livre(
                tarefa_id=tarefa.pk, novo_status="NAO_EXISTE", usuario=self.executor,
            )

    def test_excluir_remove_a_tarefa_mas_log_sobrevive(self):
        tarefa = self._criar_tarefa()
        tarefa_id = tarefa.pk
        titulo = tarefa.titulo
        TarefaTrabalhistaService.excluir(tarefa=tarefa, usuario=self.criador)
        self.assertFalse(TarefaTrabalhista.objects.filter(pk=tarefa_id).exists())

        log_exclusao = TarefaTrabalhistaLog.objects.filter(
            tarefa_id=tarefa_id, acao=TarefaTrabalhistaLog.ACAO_EXCLUIDA,
        ).get()
        self.assertEqual(log_exclusao.tarefa_titulo, titulo)
        self.assertEqual(log_exclusao.created_by_id, self.criador.id)

    def test_checklist_adicionar_concluir_remover(self):
        tarefa = self._criar_tarefa()
        item = TarefaTrabalhistaService.adicionar_item_checklist(
            tarefa=tarefa, texto="Conferir documentos", usuario=self.criador,
        )
        self.assertFalse(item.concluido)

        item = TarefaTrabalhistaService.atualizar_item_checklist(
            item=item, concluido=True, usuario=self.executor,
        )
        self.assertTrue(item.concluido)

        TarefaTrabalhistaService.remover_item_checklist(item=item, usuario=self.executor)
        self.assertEqual(tarefa.checklist.count(), 0)
        self.assertEqual(
            TarefaTrabalhistaLog.objects.filter(tarefa_id=tarefa.pk).count(),
            4,  # criada + checklist_adicionado + checklist_atualizado + checklist_removido
        )

    def test_duplicar_copia_conteudo_checklist_e_anexos_mas_nao_comentarios_nem_log(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        original = self._criar_tarefa()
        TarefaTrabalhistaService.adicionar_item_checklist(
            tarefa=original, texto="Item 1", usuario=self.criador,
        )
        TarefaTrabalhistaService.anexar(
            tarefa=original,
            arquivo=SimpleUploadedFile("doc.txt", b"conteudo"),
            usuario=self.criador,
        )
        TarefaTrabalhistaService.comentar(tarefa=original, texto="Não deve duplicar", usuario=self.criador)

        copia = TarefaTrabalhistaService.duplicar(tarefa=original, usuario=self.executor)

        self.assertNotEqual(copia.pk, original.pk)
        self.assertEqual(copia.titulo, original.titulo)
        self.assertEqual(copia.status, StatusTarefa.FALTA_ASSUMIR)
        self.assertIsNone(copia.responsavel_atual)
        self.assertEqual(copia.checklist.count(), 1)
        self.assertEqual(copia.checklist.first().texto, "Item 1")
        self.assertEqual(copia.anexos.count(), 1)
        self.assertEqual(copia.comentarios.count(), 0)
        # log da cópia só tem o que aconteceu NELA (criação + as cópias em si), nada da original
        self.assertTrue(
            TarefaTrabalhistaLog.objects.filter(tarefa_id=copia.pk, acao=TarefaTrabalhistaLog.ACAO_CRIADA).exists()
        )
        self.assertFalse(
            TarefaTrabalhistaLog.objects.filter(tarefa_id=copia.pk, acao=TarefaTrabalhistaLog.ACAO_COMENTARIO).exists()
        )

    def test_criar_aceita_prioridade_e_duplicar_copia(self):
        from rh.models.tarefas_trabalhistas.tarefa import PrioridadeTarefa

        tarefa = TarefaTrabalhistaService.criar(
            titulo="Urgente", descricao="", observacoes="", prazo=None,
            cliente_id=None, responsavel_sugerido_id=None, prioridade=PrioridadeTarefa.ALTA,
            usuario=self.criador,
        )
        self.assertEqual(tarefa.prioridade, PrioridadeTarefa.ALTA)
        copia = TarefaTrabalhistaService.duplicar(tarefa=tarefa, usuario=self.criador)
        self.assertEqual(copia.prioridade, PrioridadeTarefa.ALTA)

    def test_criar_sem_prioridade_cai_no_default_media(self):
        from rh.models.tarefas_trabalhistas.tarefa import PrioridadeTarefa

        tarefa = self._criar_tarefa()
        self.assertEqual(tarefa.prioridade, PrioridadeTarefa.MEDIA)

    def test_criar_com_prioridade_invalida_e_rejeitado(self):
        with self.assertRaises(ValueError):
            TarefaTrabalhistaService.criar(
                titulo="T", descricao="", observacoes="", prazo=None,
                cliente_id=None, responsavel_sugerido_id=None, prioridade="URGENTE",
                usuario=self.criador,
            )

    def test_atualizar_prioridade(self):
        from rh.models.tarefas_trabalhistas.tarefa import PrioridadeTarefa

        tarefa = self._criar_tarefa()
        atualizada = TarefaTrabalhistaService.atualizar_prioridade(
            tarefa=tarefa, prioridade=PrioridadeTarefa.ALTA, usuario=self.executor,
        )
        self.assertEqual(atualizada.prioridade, PrioridadeTarefa.ALTA)
        self.assertTrue(
            TarefaTrabalhistaLog.objects.filter(
                tarefa_id=tarefa.pk, acao=TarefaTrabalhistaLog.ACAO_PRIORIDADE_ALTERADA,
            ).exists()
        )

    def test_atualizar_prioridade_invalida_e_rejeitada(self):
        tarefa = self._criar_tarefa()
        with self.assertRaises(ValueError):
            TarefaTrabalhistaService.atualizar_prioridade(
                tarefa=tarefa, prioridade="NAO_EXISTE", usuario=self.executor,
            )

    def test_comentar_aceita_so_imagem_sem_texto(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        tarefa = self._criar_tarefa()
        comentario = TarefaTrabalhistaService.comentar(
            tarefa=tarefa, texto="", usuario=self.criador,
            imagem=SimpleUploadedFile("print.png", b"fake-image-bytes", content_type="image/png"),
        )
        self.assertEqual(comentario.texto, "")
        self.assertTrue(comentario.imagem)
        self.assertTrue(
            TarefaTrabalhistaLog.objects.filter(
                tarefa_id=tarefa.pk, acao=TarefaTrabalhistaLog.ACAO_COMENTARIO,
                detalhes="(imagem colada no chat)",
            ).exists()
        )


class NivelAcessoTest(TestCase):
    """Sistema de nível próprio da rotina: provisionamento automático, bypass
    do Desenvolvedor e a matriz nível×ação."""

    @classmethod
    def setUpTestData(cls):
        cls.assistente = User.objects.create(username="assis", email="assis@x.com")
        cls.pleno = User.objects.create(username="pleno", email="pleno@x.com")
        TarefaTrabalhistaAcesso.objects.create(usuario=cls.pleno, nivel=NivelCargoTarefa.PLENO)
        cls.dev = User.objects.create(username="dev", email="dev@x.com")
        TarefaTrabalhistaAcesso.objects.create(usuario=cls.dev, nivel=NivelCargoTarefa.DESENVOLVEDOR)

        TarefaTrabalhistaAcaoPermitida.objects.create(nivel=NivelCargoTarefa.PLENO, acao="create")
        TarefaTrabalhistaAcaoPermitida.objects.create(nivel=NivelCargoTarefa.PLENO, acao="mover")

    def _req(self, usuario):
        return SimpleNamespace(auth=usuario, user=usuario)

    def test_usuario_novo_e_provisionado_como_assistente_automaticamente(self):
        self.assertFalse(TarefaTrabalhistaAcesso.objects.filter(usuario=self.assistente).exists())
        from rh.schemas.tarefas_trabalhistas.tarefa_schema import TarefaCriarIn

        payload = TarefaCriarIn(titulo="T", descricao="", prazo=None)
        with self.assertRaises(HttpError):  # Assistente não tem 'create' na matriz
            tarefas_router.criar(self._req(self.assistente), payload)
        acesso = TarefaTrabalhistaAcesso.objects.get(usuario=self.assistente)
        self.assertEqual(acesso.nivel, NivelCargoTarefa.ASSISTENTE)

    def test_pleno_pode_criar_pois_esta_na_matriz(self):
        from rh.schemas.tarefas_trabalhistas.tarefa_schema import TarefaCriarIn

        payload = TarefaCriarIn(titulo="T", descricao="", prazo=None)
        status_code, corpo = tarefas_router.criar(self._req(self.pleno), payload)
        self.assertEqual(status_code, 201)

    def test_desenvolvedor_bypassa_a_matriz_inteira(self):
        from rh.schemas.tarefas_trabalhistas.tarefa_schema import TarefaCriarIn

        payload = TarefaCriarIn(titulo="T", descricao="", prazo=None)
        status_code, _ = tarefas_router.criar(self._req(self.dev), payload)
        self.assertEqual(status_code, 201)

    def test_pleno_move_tarefa_livremente_mas_assistente_nao(self):
        from rh.schemas.tarefas_trabalhistas.tarefa_schema import MoverIn

        tarefa = TarefaTrabalhistaService.criar(
            titulo="Livre", descricao="", observacoes="", prazo=None,
            cliente_id=None, responsavel_sugerido_id=None, usuario=self.dev,
        )
        status_code, corpo = tarefas_router.mover(
            self._req(self.pleno), tarefa.pk, MoverIn(status=StatusTarefa.VALIDAR),
        )
        self.assertEqual(status_code, 200)
        self.assertEqual(corpo["status"], StatusTarefa.VALIDAR)

        with self.assertRaises(HttpError):  # Assistente não tem 'mover' na matriz
            tarefas_router.mover(self._req(self.assistente), tarefa.pk, MoverIn(status=StatusTarefa.FALTA_ASSUMIR))

    def test_so_desenvolvedor_administra_niveis(self):
        with self.assertRaises(HttpError):
            tarefas_router.listar_acessos(self._req(self.pleno))
        resultado = tarefas_router.listar_acessos(self._req(self.dev))
        self.assertTrue(any(item["usuario"]["id"] == self.pleno.id for item in resultado))

    def test_desenvolvedor_promove_outro_usuario(self):
        from rh.schemas.tarefas_trabalhistas.tarefa_schema import AtualizarNivelIn

        payload = AtualizarNivelIn(nivel=NivelCargoTarefa.SENIOR)
        status_code, corpo = tarefas_router.atualizar_nivel(self._req(self.dev), self.assistente.id, payload)
        self.assertEqual(status_code, 200)
        self.assertEqual(corpo["nivel"], NivelCargoTarefa.SENIOR)

    def test_atualizar_nivel_so_flag_de_email_nao_mexe_no_nivel(self):
        """PATCH parcial: só `notificar_criacao_email`, sem `nivel` — não deve
        resetar o nível de quem já tinha um definido."""
        from rh.schemas.tarefas_trabalhistas.tarefa_schema import AtualizarNivelIn

        TarefaTrabalhistaAcesso.objects.filter(usuario=self.pleno).update(nivel=NivelCargoTarefa.PLENO)
        payload = AtualizarNivelIn(notificar_criacao_email=True)
        status_code, corpo = tarefas_router.atualizar_nivel(self._req(self.dev), self.pleno.id, payload)
        self.assertEqual(status_code, 200)
        self.assertEqual(corpo["nivel"], NivelCargoTarefa.PLENO)
        self.assertTrue(corpo["notificar_criacao_email"])

    def test_listar_acessos_traz_flag_de_email(self):
        TarefaTrabalhistaAcesso.objects.filter(usuario=self.pleno).update(notificar_criacao_email=True)
        resultado = tarefas_router.listar_acessos(self._req(self.dev))
        item = next(i for i in resultado if i["usuario"]["id"] == self.pleno.id)
        self.assertTrue(item["notificar_criacao_email"])


class NotificacoesTarefaTest(TestCase):
    """Tasks de e-mail (SMTP) — mockam `_enviar_email_html` pra não depender
    de rede/config nos testes; conferem só destinatários e idempotência."""

    @classmethod
    def setUpTestData(cls):
        cls.criador = User.objects.create(username="criador3", email="criador3@x.com")
        cls.executor = User.objects.create(username="executor3", email="executor3@x.com")

    def test_notificar_criacao_envia_email_so_pra_quem_esta_marcado(self):
        from unittest.mock import patch

        from rh.tasks import tarefas_trabalhistas_tasks as tasks_mod

        TarefaTrabalhistaAcesso.objects.create(
            usuario=self.executor, nivel=NivelCargoTarefa.PLENO, notificar_criacao_email=True,
        )
        tarefa = TarefaTrabalhistaService.criar(
            titulo="Aviso por email", descricao="", observacoes="", prazo=None,
            cliente_id=None, responsavel_sugerido_id=None, usuario=self.criador,
        )
        with patch.object(tasks_mod, "_notificar_criacao_teams"), \
             patch.object(tasks_mod, "_enviar_email_html") as mock_email:
            tasks_mod.notificar_criacao_tarefa_task(tarefa.idmaster)
        self.assertTrue(mock_email.called)
        destinatarios = mock_email.call_args.kwargs["destinatarios"]
        self.assertIn(self.executor.email, destinatarios)
        self.assertNotIn(self.criador.email, destinatarios)

    def test_verificar_prazos_avisa_d1_e_atrasada_uma_unica_vez(self):
        from datetime import timedelta
        from unittest.mock import patch

        from django.utils import timezone

        from rh.tasks import tarefas_trabalhistas_tasks as tasks_mod

        hoje = timezone.localdate()
        tarefa_prazo_amanha = TarefaTrabalhistaService.criar(
            titulo="D-1", descricao="", observacoes="", prazo=hoje + timedelta(days=1),
            cliente_id=None, responsavel_sugerido_id=None, usuario=self.criador,
        )
        tarefa_atrasada = TarefaTrabalhistaService.criar(
            titulo="Atrasada", descricao="", observacoes="", prazo=hoje - timedelta(days=2),
            cliente_id=None, responsavel_sugerido_id=None, usuario=self.criador,
        )

        with patch.object(tasks_mod, "_enviar_email_html") as mock_email:
            tasks_mod.verificar_prazos_tarefas_trabalhistas_task()
            self.assertEqual(mock_email.call_count, 2)

            mock_email.reset_mock()
            tasks_mod.verificar_prazos_tarefas_trabalhistas_task()
            self.assertEqual(mock_email.call_count, 0)  # idempotente: já avisou as duas

        self.assertTrue(
            TarefaTrabalhistaLog.objects.filter(
                tarefa_id=tarefa_prazo_amanha.pk, acao=TarefaTrabalhistaLog.ACAO_LEMBRETE_PRAZO,
            ).exists()
        )
        self.assertTrue(
            TarefaTrabalhistaLog.objects.filter(
                tarefa_id=tarefa_atrasada.pk, acao=TarefaTrabalhistaLog.ACAO_LEMBRETE_ATRASADA,
            ).exists()
        )

    def test_verificar_prazos_ignora_tarefa_finalizada(self):
        from datetime import timedelta
        from unittest.mock import patch

        from django.utils import timezone

        from rh.tasks import tarefas_trabalhistas_tasks as tasks_mod

        hoje = timezone.localdate()
        tarefa = TarefaTrabalhistaService.criar(
            titulo="Já concluída", descricao="", observacoes="", prazo=hoje - timedelta(days=5),
            cliente_id=None, responsavel_sugerido_id=None, usuario=self.criador,
        )
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.EXECUTANDO, acao_esperada="assumir", usuario=self.criador,
        )
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.VALIDAR, acao_esperada="enviar_validacao",
            usuario=self.criador,
        )
        TarefaTrabalhistaService.transicionar(
            tarefa_id=tarefa.pk, para_status=StatusTarefa.FINALIZADA, acao_esperada="validar", usuario=self.criador,
        )
        with patch.object(tasks_mod, "_enviar_email_html") as mock_email:
            tasks_mod.verificar_prazos_tarefas_trabalhistas_task()
        self.assertFalse(mock_email.called)


class TarefasExcluidasTest(TestCase):
    """Endpoint de tarefas excluídas lê só do log (a linha em si já se foi)."""

    @classmethod
    def setUpTestData(cls):
        cls.dev = User.objects.create(username="dev2", email="dev2@x.com")
        TarefaTrabalhistaAcesso.objects.create(usuario=cls.dev, nivel=NivelCargoTarefa.DESENVOLVEDOR)

    def _req(self, usuario):
        return SimpleNamespace(auth=usuario, user=usuario)

    def test_tarefa_excluida_aparece_na_listagem_com_quem_excluiu(self):
        tarefa = TarefaTrabalhistaService.criar(
            titulo="Vai ser excluída", descricao="", observacoes="", prazo=None,
            cliente_id=None, responsavel_sugerido_id=None, usuario=self.dev,
        )
        tarefa_id = tarefa.pk  # .delete() zera tarefa.pk em memória — captura antes
        TarefaTrabalhistaService.excluir(tarefa=tarefa, usuario=self.dev)

        resultado = tarefas_router.listar_excluidas(self._req(self.dev))
        self.assertTrue(any(item["tarefa_id"] == tarefa_id and item["tarefa_titulo"] == "Vai ser excluída"
                             for item in resultado))
