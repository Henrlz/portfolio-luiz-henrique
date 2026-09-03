import logging

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)

# Persona (agentes.ColaboradorDigital) que envia os avisos da esteira de
# Tarefas Trabalhistas no Teams. Cadastrado via admin (mesmo mecanismo de
# `agentes/services/canais_graph.py`) — sem infra nova.
PERSONA_NOTIFICADOR_RH = "rh_tarefas_trabalhistas"


def _layout_resultado(*, cor: str, cor_fundo: str, selo: str, titulo: str, campos_html: str, link: str) -> str:
    """Card de e-mail (fundo cinza claro + cartão branco arredondado, no
    padrão de tabelas aninhadas que sobrevive à maioria dos clientes de
    e-mail) — `cor`/`cor_fundo` marcam visualmente validada (verde) vs.
    reprovada (vermelho); `selo` é o texto do badge no topo do cartão."""
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:#f3f4f6; padding:32px 16px; font-family: Arial, Helvetica, sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="max-width:520px; background:#ffffff; border-radius:16px; overflow:hidden;
                        border:1px solid #e5e7eb;">
            <tr>
              <td style="background:{cor_fundo}; padding:20px 28px;">
                <span style="display:inline-block; background:{cor}; color:#fff; font-size:11px;
                             font-weight:700; letter-spacing:.05em; padding:4px 12px; border-radius:999px;
                             text-transform:uppercase;">
                  {selo}
                </span>
                <h1 style="margin:12px 0 0; font-size:20px; color:#111827;">{titulo}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                  {campos_html}
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                  <tr>
                    <td style="border-radius:10px; background:{cor};">
                      <a href="{link}"
                         style="display:inline-block; padding:13px 26px; color:#fff; font-size:14px;
                                font-weight:700; text-decoration:none;">
                        Abrir a tarefa →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px; border-top:1px solid #f3f4f6;">
                <p style="margin:0; color:#9ca3af; font-size:11px;">
                  Esteira de Tarefas Trabalhistas · Task Management (grupo da empresa)
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    """


def _campo(icone: str, rotulo: str, valor: str) -> str:
    return f"""
    <tr>
      <td style="padding:9px 0; border-bottom:1px solid #f3f4f6; vertical-align:top; width:28px;">{icone}</td>
      <td style="padding:9px 0 9px 4px; border-bottom:1px solid #f3f4f6; vertical-align:top;">
        <div style="color:#9ca3af; font-size:11px; text-transform:uppercase; letter-spacing:.04em;">{rotulo}</div>
        <div style="color:#111827; font-size:14px; margin-top:2px;">{valor}</div>
      </td>
    </tr>
    """


def _caixa_destaque(*, cor: str, cor_fundo: str, rotulo: str, texto: str) -> str:
    return f"""
    <div style="margin-top:16px; padding:12px 14px; background:{cor_fundo}; border-left:3px solid {cor};
                border-radius:6px;">
      <div style="color:{cor}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em;">
        {rotulo}
      </div>
      <div style="color:#374151; font-size:14px; margin-top:4px;">{texto}</div>
    </div>
    """


def _enviar_email_html(*, destinatarios, assunto: str, corpo_html: str, contexto: str) -> None:
    """SMTP do Django (`settings.EMAIL_BACKEND`/`DEFAULT_FROM_EMAIL`, mesmo
    caminho de `accounts/services/email_service.py`) — não Microsoft Graph: a
    `IntegracaoAzureConfig` global (sem empresa) ainda não tem credencial real
    (tenant_id/client_id/secret em branco), então
    `agentes_integracoes.services.graph_mail.enviar_email` falha pra qualquer
    envio "sem empresa". Nunca propaga exceção — quem chama decide se algo
    mais precisa acontecer; aqui só logamos."""
    from django.core.mail import EmailMultiAlternatives

    destinatarios = [e for e in destinatarios if e]
    if not destinatarios:
        return
    try:
        msg = EmailMultiAlternatives(assunto, assunto, settings.DEFAULT_FROM_EMAIL, destinatarios)
        msg.attach_alternative(corpo_html, "text/html")
        msg.send(fail_silently=False)
    except Exception:
        logger.warning("Falha ao enviar e-mail (%s)", contexto, exc_info=True)


@shared_task(name="rh.tarefas_trabalhistas.notificar_criacao", ignore_result=True)
def notificar_criacao_tarefa_task(tarefa_idmaster: str) -> None:
    """Avisa no Teams quem pode assumir a tarefa recém-criada, e por e-mail
    (SMTP, mesmo caminho de `notificar_resultado_tarefa_task`) a lista fixa
    configurada em Permissões (`TarefaTrabalhistaAcesso.notificar_criacao_email`)
    — os dois avisos são independentes: falha de um não afeta o outro, e
    nenhum dos dois derruba a criação da tarefa."""
    from django.utils.html import escape

    from rh.models.tarefas_trabalhistas.tarefa import TarefaTrabalhista
    from rh.services.tarefas_trabalhistas.tarefa_service import TarefaTrabalhistaService

    tarefa = (
        TarefaTrabalhista.objects.filter(pk=tarefa_idmaster)
        .select_related("created_by", "cliente", "responsavel_sugerido").first()
    )
    if not tarefa:
        logger.warning("Tarefa trabalhista %s não encontrada para notificação.", tarefa_idmaster)
        return

    link = f"{settings.FRONT_URL}/rh/tarefas-trabalhistas/{tarefa.idmaster}"
    criador = tarefa.created_by.get_full_name() or tarefa.created_by.username if tarefa.created_by else "—"
    prazo_fmt = tarefa.prazo.strftime("%d/%m/%Y") if tarefa.prazo else "sem prazo definido"

    _notificar_criacao_teams(tarefa=tarefa, link=link, criador=criador, prazo_fmt=prazo_fmt)

    campos = (
        _campo("📋", "Tarefa", f"<b>{escape(tarefa.titulo)}</b>")
        + _campo("🏢", "Cliente", escape(tarefa.cliente.nome) if tarefa.cliente else "—")
        + _campo("🙋", "Criada por", escape(criador))
        + _campo("📅", "Prazo", prazo_fmt)
    )
    if tarefa.responsavel_sugerido:
        nome_sugerido = tarefa.responsavel_sugerido.get_full_name() or tarefa.responsavel_sugerido.username
        campos += _campo("💡", "Sugestão de responsável", escape(nome_sugerido))
    corpo_html = _layout_resultado(
        cor="#2563eb", cor_fundo="#eff6ff", selo="Nova tarefa",
        titulo=tarefa.titulo, campos_html=campos, link=link,
    )
    destinatarios = [
        u.email for u in TarefaTrabalhistaService.usuarios_notificaveis_email_criacao()
    ]
    _enviar_email_html(
        destinatarios=destinatarios,
        assunto=f"Nova tarefa trabalhista: {tarefa.titulo}",
        corpo_html=corpo_html,
        contexto=f"criação tarefa={tarefa_idmaster}",
    )


def _notificar_criacao_teams(*, tarefa, link: str, criador: str, prazo_fmt: str) -> None:
    from agentes.models import ColaboradorDigital
    from agentes_integracoes.services.config_service import obter_config_azure
    from agentes_integracoes.services.graph_teams import enviar_teams_como_colaborador
    from rh.services.tarefas_trabalhistas.tarefa_service import TarefaTrabalhistaService

    col = ColaboradorDigital.objects.filter(persona=PERSONA_NOTIFICADOR_RH).first()
    if not col:
        logger.warning(
            "Sem ColaboradorDigital '%s' cadastrado — aviso Teams da tarefa %s não enviado.",
            PERSONA_NOTIFICADOR_RH, tarefa.idmaster,
        )
        return

    username = col.email_para_teams
    senha = col.senha_teams
    if not senha:
        az = obter_config_azure(None)  # esteira é global (grupo da empresa), sem empresa — cai no config default
        senha = getattr(az, "teams_senha_agentes_padrao", "") if az else ""
    if not (username and senha):
        logger.warning(
            "Sem credencial ROPC do Teams para '%s' — aviso Teams da tarefa %s não enviado.",
            PERSONA_NOTIFICADOR_RH, tarefa.idmaster,
        )
        return

    destinatarios = TarefaTrabalhistaService.usuarios_notificaveis()
    corpo_base = (
        f"<b>Nova tarefa trabalhista:</b> {tarefa.titulo}<br>"
        f"Criada por: {criador}<br>"
        f"Prazo: {prazo_fmt}<br><br>"
        f'<a href="{link}">Abrir e assumir esta tarefa</a>'
    )
    corpo_sugerido = (
        "<b>Você foi sugerido(a) para assumir esta tarefa.</b><br><br>" + corpo_base
    )

    for usuario in destinatarios:
        corpo_html = corpo_sugerido if usuario.id == tarefa.responsavel_sugerido_id else corpo_base
        try:
            enviar_teams_como_colaborador(
                username=username, senha=senha,
                conteudo_html=corpo_html,
                destinatario_email=usuario.email,
            )
        except Exception:
            logger.warning(
                "Falha ao notificar Teams (tarefa=%s, destinatario=%s)",
                tarefa.idmaster, usuario.email, exc_info=True,
            )


@shared_task(name="rh.tarefas_trabalhistas.notificar_resultado", ignore_result=True)
def notificar_resultado_tarefa_task(
    tarefa_idmaster: str, acao: str, motivo: str = "", usuario_id: int | None = None,
) -> None:
    """E-mail pro responsável da tarefa e pra quem validou/reprovou avisando o
    resultado — quando reprovada, inclui o motivo escrito por quem reprovou
    (Pleno/Sênior/Gerência). Nunca derruba a transição: qualquer falha de
    envio é só logada. Vai por SMTP (`_enviar_email_html`) — ver docstring
    dela sobre por que não é Microsoft Graph."""
    from django.contrib.auth import get_user_model
    from django.utils.html import escape

    from rh.models.tarefas_trabalhistas.tarefa import TarefaTrabalhista

    tarefa = (
        TarefaTrabalhista.objects.filter(pk=tarefa_idmaster)
        .select_related("created_by", "responsavel_atual", "cliente").first()
    )
    if not tarefa:
        logger.warning("Tarefa trabalhista %s não encontrada para notificação de resultado.", tarefa_idmaster)
        return

    ator = get_user_model().objects.filter(pk=usuario_id).first() if usuario_id else None
    destinatarios = {
        u.email for u in (tarefa.responsavel_atual, ator) if u and u.email
    }
    if not destinatarios:
        return

    link = f"{settings.FRONT_URL}/rh/tarefas-trabalhistas/{tarefa.idmaster}"
    aprovada = acao == "validada"
    cor = "#16a34a" if aprovada else "#dc2626"
    cor_fundo = "#f0fdf4" if aprovada else "#fef2f2"
    ator_nome = escape((ator.get_full_name() or ator.username) if ator else "—")
    responsavel_nome = escape(
        (tarefa.responsavel_atual.get_full_name() or tarefa.responsavel_atual.username)
        if tarefa.responsavel_atual else "—"
    )
    titulo_email = "Tarefa validada e concluída" if aprovada else "Tarefa reprovada"
    assunto = f"{titulo_email}: {tarefa.titulo}"

    campos = (
        _campo("📋", "Tarefa", f"<b>{escape(tarefa.titulo)}</b>")
        + _campo("🏢", "Cliente", escape(tarefa.cliente.nome) if tarefa.cliente else "—")
        + _campo("👤", "Responsável", responsavel_nome)
        + _campo("📅", "Prazo", tarefa.prazo.strftime("%d/%m/%Y") if tarefa.prazo else "sem prazo definido")
        + _campo("✅" if aprovada else "↩️", "Validada por" if aprovada else "Reprovada por", ator_nome)
    )
    extras = ""
    if tarefa.descricao:
        extras += _caixa_destaque(
            cor="#6b7280", cor_fundo="#f9fafb", rotulo="Descrição da tarefa",
            texto=escape(tarefa.descricao).replace("\n", "<br>"),
        )
    if not aprovada:
        extras += _caixa_destaque(
            cor=cor, cor_fundo=cor_fundo, rotulo="Motivo da reprovação",
            texto=escape(motivo),
        )
    if extras:
        campos += f'<tr><td colspan="2">{extras}</td></tr>'
    corpo_html = _layout_resultado(
        cor=cor, cor_fundo=cor_fundo,
        selo="Validada" if aprovada else "Reprovada",
        titulo=titulo_email,
        campos_html=campos,
        link=link,
    )

    _enviar_email_html(
        destinatarios=destinatarios, assunto=assunto, corpo_html=corpo_html,
        contexto=f"resultado tarefa={tarefa_idmaster} acao={acao}",
    )


@shared_task(name="rh.tarefas_trabalhistas.verificar_prazos", ignore_result=True)
def verificar_prazos_tarefas_trabalhistas_task() -> None:
    """Roda diariamente (CELERY_BEAT_SCHEDULE): dois lembretes independentes,
    cada um só enviado uma vez por tarefa (idempotente via checagem no log,
    já que rodar de novo no mesmo dia — ou reprocessar — não deve duplicar
    e-mail):
    - D-1: prazo é amanhã e a tarefa ainda não foi finalizada — avisa quem
      está com ela (responsável atual; se ainda nem foi assumida, quem criou).
    - Atrasada: prazo já passou e a tarefa ainda não foi finalizada — avisa
      SEMPRE quem criou, com o retrato completo (inclusive se ninguém nunca
      assumiu)."""
    from datetime import timedelta

    from django.utils import timezone
    from django.utils.html import escape

    from rh.models.tarefas_trabalhistas.tarefa import StatusTarefa, TarefaTrabalhista, TarefaTrabalhistaLog

    hoje = timezone.localdate()
    amanha = hoje + timedelta(days=1)
    base_qs = (
        TarefaTrabalhista.objects.exclude(status=StatusTarefa.FINALIZADA)
        .select_related("created_by", "responsavel_atual", "cliente")
    )

    def _ja_avisado(tarefa_id: str, acao: str) -> bool:
        return TarefaTrabalhistaLog.objects.filter(tarefa_id=tarefa_id, acao=acao).exists()

    def _campos_tarefa(tarefa) -> str:
        responsavel = (
            (tarefa.responsavel_atual.get_full_name() or tarefa.responsavel_atual.username)
            if tarefa.responsavel_atual else "ainda não foi assumida"
        )
        return (
            _campo("📋", "Tarefa", f"<b>{escape(tarefa.titulo)}</b>")
            + _campo("🏢", "Cliente", escape(tarefa.cliente.nome) if tarefa.cliente else "—")
            + _campo("📌", "Status atual", escape(dict(StatusTarefa.choices).get(tarefa.status, tarefa.status)))
            + _campo("👤", "Responsável", escape(responsavel))
            + _campo("📅", "Prazo", tarefa.prazo.strftime("%d/%m/%Y") if tarefa.prazo else "sem prazo definido")
        )

    for tarefa in base_qs.filter(prazo=amanha):
        if _ja_avisado(tarefa.pk, TarefaTrabalhistaLog.ACAO_LEMBRETE_PRAZO):
            continue
        destinatario = tarefa.responsavel_atual or tarefa.created_by
        if not destinatario or not destinatario.email:
            continue
        link = f"{settings.FRONT_URL}/rh/tarefas-trabalhistas/{tarefa.idmaster}"
        corpo_html = _layout_resultado(
            cor="#d97706", cor_fundo="#fffbeb", selo="Prazo amanhã",
            titulo="O prazo desta tarefa vence amanhã", campos_html=_campos_tarefa(tarefa), link=link,
        )
        _enviar_email_html(
            destinatarios=[destinatario.email],
            assunto=f"Prazo vence amanhã: {tarefa.titulo}",
            corpo_html=corpo_html,
            contexto=f"lembrete prazo tarefa={tarefa.pk}",
        )
        TarefaTrabalhistaLog.objects.create(
            tarefa_id=tarefa.pk, tarefa_titulo=tarefa.titulo,
            acao=TarefaTrabalhistaLog.ACAO_LEMBRETE_PRAZO, detalhes="Lembrete D-1 enviado",
        )

    for tarefa in base_qs.filter(prazo__lt=hoje):
        if _ja_avisado(tarefa.pk, TarefaTrabalhistaLog.ACAO_LEMBRETE_ATRASADA):
            continue
        if not tarefa.created_by or not tarefa.created_by.email:
            continue
        link = f"{settings.FRONT_URL}/rh/tarefas-trabalhistas/{tarefa.idmaster}"
        corpo_html = _layout_resultado(
            cor="#dc2626", cor_fundo="#fef2f2", selo="Atrasada",
            titulo="Uma tarefa que você criou está atrasada", campos_html=_campos_tarefa(tarefa), link=link,
        )
        _enviar_email_html(
            destinatarios=[tarefa.created_by.email],
            assunto=f"Tarefa atrasada: {tarefa.titulo}",
            corpo_html=corpo_html,
            contexto=f"lembrete atraso tarefa={tarefa.pk}",
        )
        TarefaTrabalhistaLog.objects.create(
            tarefa_id=tarefa.pk, tarefa_titulo=tarefa.titulo,
            acao=TarefaTrabalhistaLog.ACAO_LEMBRETE_ATRASADA, detalhes="Aviso de atraso enviado",
        )
