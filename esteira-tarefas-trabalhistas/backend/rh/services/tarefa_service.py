from __future__ import annotations

from django.db import transaction

from rh.models.tarefas_trabalhistas.tarefa import (
    StatusTarefa,
    TarefaAnexo,
    TarefaChecklistItem,
    TarefaComentario,
    TarefaTrabalhista,
    TarefaTrabalhistaEvento,
    TarefaTrabalhistaLog,
)
from rh.permissions.tarefas_trabalhistas.tarefa_permissions import (
    TransicaoInvalidaError,
    acao_da_transicao,
)

# acao_esperada (ver `transicionar`) -> ação correspondente no log de auditoria.
_ACAO_LOG_POR_TRANSICAO = {
    "assumir": TarefaTrabalhistaLog.ACAO_ASSUMIDA,
    "enviar_validacao": TarefaTrabalhistaLog.ACAO_ENVIADA_VALIDACAO,
    "validar": TarefaTrabalhistaLog.ACAO_VALIDADA,
    "reprovar": TarefaTrabalhistaLog.ACAO_REPROVADA,
}


class TarefaTrabalhistaService:

    @staticmethod
    def _log(*, tarefa: TarefaTrabalhista, acao: str, detalhes: str, usuario) -> None:
        TarefaTrabalhistaLog.objects.create(
            tarefa_id=tarefa.idmaster,
            tarefa_titulo=tarefa.titulo,
            acao=acao,
            detalhes=detalhes,
            created_by=usuario,
        )

    @staticmethod
    def criar(
        *, titulo: str, descricao: str, observacoes: str, prazo,
        cliente_id: str | None, responsavel_sugerido_id: int | None, usuario,
        prioridade: str = "MEDIA",
    ) -> TarefaTrabalhista:
        from rh.models.tarefas_trabalhistas.tarefa import PrioridadeTarefa

        if prioridade not in PrioridadeTarefa.values:
            raise ValueError(f"Prioridade inválida: {prioridade}")
        with transaction.atomic():
            tarefa = TarefaTrabalhista.objects.create(
                titulo=titulo,
                descricao=descricao,
                observacoes=observacoes,
                prazo=prazo,
                cliente_id=cliente_id,
                responsavel_sugerido_id=responsavel_sugerido_id,
                prioridade=prioridade,
                created_by=usuario,
                updated_by=usuario,
            )
            TarefaTrabalhistaEvento.objects.create(
                tarefa=tarefa,
                de_status="",
                para_status=StatusTarefa.FALTA_ASSUMIR,
                created_by=usuario,
            )
            TarefaTrabalhistaService._log(
                tarefa=tarefa, acao=TarefaTrabalhistaLog.ACAO_CRIADA, detalhes="", usuario=usuario,
            )

            from rh.tasks.tarefas_trabalhistas_tasks import notificar_criacao_tarefa_task
            transaction.on_commit(lambda: notificar_criacao_tarefa_task.delay(tarefa.idmaster))
        return tarefa

    @staticmethod
    def duplicar(*, tarefa: TarefaTrabalhista, usuario) -> TarefaTrabalhista:
        """Cria uma tarefa nova com o mesmo conteúdo (título, descrição,
        observações, prazo, cliente, responsável sugerido, checklist e
        anexos) — nasce do zero na esteira (Falta assumir, sem responsável
        atual). NÃO copia o log nem os comentários da tarefa original: log é
        história de uma instância específica, comentários são ocorrências
        daquela tarefa, não conteúdo reaproveitável."""
        from django.core.files.base import ContentFile

        nova = TarefaTrabalhistaService.criar(
            titulo=tarefa.titulo,
            descricao=tarefa.descricao,
            observacoes=tarefa.observacoes,
            prazo=tarefa.prazo,
            cliente_id=tarefa.cliente_id,
            responsavel_sugerido_id=tarefa.responsavel_sugerido_id,
            prioridade=tarefa.prioridade,
            usuario=usuario,
        )
        for item in tarefa.checklist.all():
            TarefaTrabalhistaService.adicionar_item_checklist(tarefa=nova, texto=item.texto, usuario=usuario)
        for anexo in tarefa.anexos.all():
            copia = ContentFile(anexo.arquivo.read(), name=anexo.nome_original)
            TarefaTrabalhistaService.anexar(tarefa=nova, arquivo=copia, usuario=usuario)
        return nova

    @staticmethod
    def excluir(*, tarefa: TarefaTrabalhista, usuario) -> None:
        """Registra o log ANTES de excluir: `TarefaTrabalhistaLog` não tem FK
        pra tarefa (só guarda `tarefa_id`/`tarefa_titulo` soltos) exatamente
        pra sobreviver ao CASCADE do delete — é o único jeito de saber quem
        excluiu o quê depois que a tarefa já não existe mais."""
        TarefaTrabalhistaService._log(
            tarefa=tarefa, acao=TarefaTrabalhistaLog.ACAO_EXCLUIDA, detalhes="", usuario=usuario,
        )
        tarefa.delete()

    @staticmethod
    def anexar(*, tarefa: TarefaTrabalhista, arquivo, usuario) -> TarefaAnexo:
        anexo = TarefaAnexo.objects.create(
            tarefa=tarefa,
            arquivo=arquivo,
            nome_original=arquivo.name,
            created_by=usuario,
        )
        TarefaTrabalhistaService._log(
            tarefa=tarefa, acao=TarefaTrabalhistaLog.ACAO_ANEXO_ADICIONADO,
            detalhes=anexo.nome_original, usuario=usuario,
        )
        return anexo

    @staticmethod
    def remover_anexo(*, anexo: TarefaAnexo, usuario) -> None:
        TarefaTrabalhistaService._log(
            tarefa=anexo.tarefa, acao=TarefaTrabalhistaLog.ACAO_ANEXO_REMOVIDO,
            detalhes=anexo.nome_original, usuario=usuario,
        )
        anexo.arquivo.delete(save=False)
        anexo.delete()

    @staticmethod
    def comentar(*, tarefa: TarefaTrabalhista, texto: str, usuario, imagem=None) -> TarefaComentario:
        comentario = TarefaComentario.objects.create(
            tarefa=tarefa,
            texto=texto,
            imagem=imagem,
            created_by=usuario,
        )
        detalhes = texto[:200] if texto else "(imagem colada no chat)"
        TarefaTrabalhistaService._log(
            tarefa=tarefa, acao=TarefaTrabalhistaLog.ACAO_COMENTARIO,
            detalhes=detalhes, usuario=usuario,
        )
        return comentario

    @staticmethod
    def atualizar_prioridade(*, tarefa: TarefaTrabalhista, prioridade: str, usuario) -> TarefaTrabalhista:
        from rh.models.tarefas_trabalhistas.tarefa import PrioridadeTarefa

        if prioridade not in PrioridadeTarefa.values:
            raise ValueError(f"Prioridade inválida: {prioridade}")
        anterior = tarefa.prioridade
        if anterior == prioridade:
            return tarefa
        tarefa.prioridade = prioridade
        tarefa.updated_by = usuario
        tarefa.save(update_fields=["prioridade", "updated_by", "updated_at"])
        TarefaTrabalhistaService._log(
            tarefa=tarefa, acao=TarefaTrabalhistaLog.ACAO_PRIORIDADE_ALTERADA,
            detalhes=f"{anterior} → {prioridade}", usuario=usuario,
        )
        return tarefa

    @staticmethod
    def adicionar_item_checklist(*, tarefa: TarefaTrabalhista, texto: str, usuario) -> TarefaChecklistItem:
        item = TarefaChecklistItem.objects.create(
            tarefa=tarefa,
            texto=texto,
            created_by=usuario,
        )
        TarefaTrabalhistaService._log(
            tarefa=tarefa, acao=TarefaTrabalhistaLog.ACAO_CHECKLIST_ADICIONADO,
            detalhes=item.texto, usuario=usuario,
        )
        return item

    @staticmethod
    def atualizar_item_checklist(*, item: TarefaChecklistItem, concluido: bool, usuario) -> TarefaChecklistItem:
        item.concluido = concluido
        item.updated_by = usuario
        item.save(update_fields=["concluido", "updated_by", "updated_at"])
        TarefaTrabalhistaService._log(
            tarefa=item.tarefa,
            acao=TarefaTrabalhistaLog.ACAO_CHECKLIST_ATUALIZADO,
            detalhes=f"{item.texto} — {'concluído' if concluido else 'reaberto'}",
            usuario=usuario,
        )
        return item

    @staticmethod
    def remover_item_checklist(*, item: TarefaChecklistItem, usuario) -> None:
        TarefaTrabalhistaService._log(
            tarefa=item.tarefa, acao=TarefaTrabalhistaLog.ACAO_CHECKLIST_REMOVIDO,
            detalhes=item.texto, usuario=usuario,
        )
        item.delete()

    @staticmethod
    def transicionar(
        *, tarefa_id: str, para_status: str, acao_esperada: str, usuario, motivo: str = "",
    ) -> TarefaTrabalhista:
        """Aplica uma transição de status validando a máquina de estados.
        `motivo` só é usado (e exigido) na reprovação — fica registrado no log
        de auditoria, pra quem reprovou explicar o porquê.
        `acao_esperada` é a ação que o endpoint chamador já validou via
        `@requer_acao_tarefa` (ex.: "assumir") — confere-se aqui que ela é
        exatamente a ação dona da transição (de_status, para_status), não só
        que o par é uma transição válida de ALGUMA ação. Sem essa checagem,
        duas transições que compartilham o mesmo para_status (ex.:
        FALTA_ASSUMIR→EXECUTANDO via "assumir" e VALIDAR→EXECUTANDO via
        "reprovar") deixariam alguém com só "assumir" reprovar uma tarefa em
        VALIDAR chamando o endpoint /assumir/.
        Usa select_for_update para não deixar duas pessoas assumirem a mesma
        tarefa ao mesmo tempo: a segunda chamada só prossegue depois que a
        primeira já commitou, então relê `de_status` já como EXECUTANDO — e
        `acao_da_transicao` rejeita (EXECUTANDO, EXECUTANDO) como transição
        inválida antes de qualquer outra checagem."""
        with transaction.atomic():
            tarefa = TarefaTrabalhista.objects.select_for_update().filter(pk=tarefa_id).first()
            if not tarefa:
                raise ValueError("Tarefa não encontrada.")

            de_status = tarefa.status
            acao_real = acao_da_transicao(de_status, para_status)  # levanta TransicaoInvalidaError se inválida
            if acao_real != acao_esperada:
                raise TransicaoInvalidaError(
                    f"Transição {de_status} -> {para_status} exige a ação '{acao_real}', não '{acao_esperada}'."
                )

            motivo = motivo.strip()
            if acao_esperada == "reprovar" and not motivo:
                raise ValueError("Informe o motivo da reprovação.")

            if de_status == StatusTarefa.FALTA_ASSUMIR and para_status == StatusTarefa.EXECUTANDO:
                tarefa.responsavel_atual = usuario

            tarefa.status = para_status
            tarefa.updated_by = usuario
            tarefa.save(update_fields=["status", "responsavel_atual", "updated_by", "updated_at"])

            TarefaTrabalhistaEvento.objects.create(
                tarefa=tarefa,
                de_status=de_status,
                para_status=para_status,
                created_by=usuario,
            )
            detalhes = f"{de_status} → {para_status}"
            if motivo:
                detalhes += f" — Motivo: {motivo}"
            log_acao = _ACAO_LOG_POR_TRANSICAO[acao_esperada]
            TarefaTrabalhistaService._log(
                tarefa=tarefa,
                acao=log_acao,
                detalhes=detalhes,
                usuario=usuario,
            )

            if acao_esperada in ("validar", "reprovar"):
                from rh.tasks.tarefas_trabalhistas_tasks import notificar_resultado_tarefa_task
                transaction.on_commit(
                    lambda: notificar_resultado_tarefa_task.delay(tarefa.idmaster, log_acao, motivo, usuario.id)
                )
        return tarefa

    @staticmethod
    def mover_livre(*, tarefa_id: str, novo_status: str, usuario) -> TarefaTrabalhista:
        """Move a tarefa para qualquer status, em qualquer direção — sem
        seguir os pares definidos em `acao_da_transicao` nem exigir motivo.
        Reservado a quem tem a ação 'mover' na matriz (Pleno/Sênior/Gerência
        por padrão, além do bypass de Desenvolvedor): esses níveis podem
        reorganizar a esteira livremente, diferente do fluxo formal de
        assumir/validar/reprovar. Ainda usa select_for_update e ainda loga
        (para auditoria), só que sem e-mail — isso não é uma validação nem
        uma reprovação."""
        if novo_status not in StatusTarefa.values:
            raise ValueError(f"Status inválido: {novo_status}")
        with transaction.atomic():
            tarefa = TarefaTrabalhista.objects.select_for_update().filter(pk=tarefa_id).first()
            if not tarefa:
                raise ValueError("Tarefa não encontrada.")

            de_status = tarefa.status
            if de_status == novo_status:
                return tarefa

            tarefa.status = novo_status
            tarefa.updated_by = usuario
            tarefa.save(update_fields=["status", "updated_by", "updated_at"])

            TarefaTrabalhistaEvento.objects.create(
                tarefa=tarefa, de_status=de_status, para_status=novo_status, created_by=usuario,
            )
            TarefaTrabalhistaService._log(
                tarefa=tarefa,
                acao=TarefaTrabalhistaLog.ACAO_MOVIDA_LIVRE,
                detalhes=f"{de_status} → {novo_status} (movimentação livre)",
                usuario=usuario,
            )
        return tarefa

    @staticmethod
    def usuarios_notificaveis():
        """Usuários com a ação 'assumir' na esteira (matriz nível×ação, mais
        os DESENVOLVEDOR que bypassam a matriz) — são quem recebe o aviso de
        nova tarefa no Teams. Global (grupo da empresa inteiro), não por empresa."""
        from django.contrib.auth import get_user_model

        from rh.models.tarefas_trabalhistas.acesso import (
            NivelCargoTarefa,
            TarefaTrabalhistaAcaoPermitida,
            TarefaTrabalhistaAcesso,
        )

        user_model = get_user_model()
        niveis_com_acesso = set(
            TarefaTrabalhistaAcaoPermitida.objects.filter(acao="assumir").values_list("nivel", flat=True)
        )
        niveis_com_acesso.add(NivelCargoTarefa.DESENVOLVEDOR)
        usuario_ids = TarefaTrabalhistaAcesso.objects.filter(
            nivel__in=niveis_com_acesso,
        ).values_list("usuario_id", flat=True)
        return user_model.objects.filter(id__in=usuario_ids, is_active=True).exclude(email="")

    @staticmethod
    def usuarios_notificaveis_email_criacao():
        """Usuários marcados (na tela de Permissões) pra receber e-mail —
        além do Teams, que depende de credencial Graph ainda pendente — toda
        vez que uma tarefa nova é criada. Lista própria, independente do
        nível de cargo: quem administra decide direto quem entra."""
        from django.contrib.auth import get_user_model

        from rh.models.tarefas_trabalhistas.acesso import TarefaTrabalhistaAcesso

        usuario_ids = TarefaTrabalhistaAcesso.objects.filter(
            notificar_criacao_email=True,
        ).values_list("usuario_id", flat=True)
        return get_user_model().objects.filter(id__in=usuario_ids, is_active=True).exclude(email="")
