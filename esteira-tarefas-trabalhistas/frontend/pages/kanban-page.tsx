"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useSelector } from "react-redux"
import { RootState } from "@/src/store/store"
import {
    Box,
    Button,
    Card,
    Checkbox,
    Chip,
    Divider,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    useTheme,
} from "@mui/material"
import { alpha } from "@mui/material/styles"
import {
    Add,
    AssignmentLateOutlined,
    AssignmentOutlined,
    AttachFileOutlined,
    CalendarMonth,
    ChatBubbleOutlineOutlined,
    ContentCopyOutlined,
    DeleteOutlined,
    GroupOutlined,
    HistoryOutlined,
    NotificationsActiveOutlined,
    PersonOutlined,
    RestoreFromTrashOutlined,
    SearchOutlined,
    SendOutlined,
    SettingsOutlined,
    TaskAltOutlined,
    WarningAmberOutlined,
} from "@mui/icons-material"
import { BarChart } from "@mui/x-charts/BarChart"
import { MetricCard } from "@/src/components/cards"
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { PageContainer, PageHeader, ContentCard } from "@/src/components/layout"
import { AppModal } from "@/src/components/common/AppModal"
import { AppTextField } from "@/src/components/inputs/AppTextField"
import { AppDropzone } from "@/src/components/common/AppDropzone"
import { ClienteSelect, type ClienteSelecaoOption } from "@/src/components/inputs/ClienteSelect"
import { UsuarioSelect, type UsuarioSelecaoOption } from "@/src/components/inputs/UsuarioSelect"
import { showDeleteConfirm, showError, showSuccess } from "@/src/components/feedback/alert"
import requisicaoGlobal from "@/src/utils/requisicaoGlobal"
import { UrlsTarefasTrabalhistas } from "@/src/constants"

type StatusTarefa = "FALTA_ASSUMIR" | "EXECUTANDO" | "VALIDAR" | "FINALIZADA"

type UsuarioResumo = { id: number; nome: string; email: string }
type ClienteResumo = { idmaster: string; nome: string }

type Prioridade = "BAIXA" | "MEDIA" | "ALTA"

type Tarefa = {
    idmaster: string
    titulo: string
    descricao: string
    observacoes: string
    prazo: string | null
    status: StatusTarefa
    prioridade: Prioridade
    cliente: ClienteResumo | null
    criado_por: UsuarioResumo | null
    responsavel_atual: UsuarioResumo | null
    responsavel_sugerido: UsuarioResumo | null
    total_anexos: number
    total_comentarios: number
    created_at: string
    updated_at: string
}

type TarefaEvento = {
    de_status: string
    para_status: string
    usuario: UsuarioResumo | null
    created_at: string
}

type Anexo = { idmaster: string; nome_original: string; url: string; criado_por: UsuarioResumo | null; created_at: string }
type Comentario = { idmaster: string; texto: string; imagem_url: string | null; criado_por: UsuarioResumo | null; created_at: string }
type LogEntry = { acao: string; detalhes: string; usuario: UsuarioResumo | null; created_at: string }
type ChecklistItem = { idmaster: string; texto: string; concluido: boolean; criado_por: UsuarioResumo | null; created_at: string }
type TarefaExcluida = { tarefa_id: string; tarefa_titulo: string; excluido_por: UsuarioResumo | null; excluido_em: string }

type TarefaDetalhe = Tarefa & {
    eventos: TarefaEvento[]
    anexos: Anexo[]
    comentarios: Comentario[]
    checklist: ChecklistItem[]
    log: LogEntry[]
}

const ROTULO_ACAO_LOG: Record<string, string> = {
    criada: "criou a tarefa",
    assumida: "assumiu a tarefa",
    enviada_validacao: "enviou para validação",
    validada: "validou (concluiu) a tarefa",
    reprovada: "reprovou a tarefa",
    excluida: "excluiu a tarefa",
    anexo_adicionado: "anexou um arquivo",
    anexo_removido: "removeu um anexo",
    comentario: "comentou",
    checklist_adicionado: "adicionou um item ao checklist",
    checklist_atualizado: "atualizou um item do checklist",
    checklist_removido: "removeu um item do checklist",
    movida_livre: "moveu a tarefa livremente",
    prioridade_alterada: "alterou a prioridade",
    lembrete_prazo: "lembrete de prazo próximo enviado pelo sistema",
    lembrete_atrasada: "aviso de atraso enviado ao criador",
}

const PRIORIDADES: { valor: Prioridade; label: string; cor: string }[] = [
    { valor: "BAIXA", label: "Baixa", cor: "#9ca3af" },
    { valor: "MEDIA", label: "Média", cor: "#3b82f6" },
    { valor: "ALTA", label: "Alta", cor: "#dc2626" },
]

function corPrioridade(prioridade: string): string {
    return PRIORIDADES.find((p) => p.valor === prioridade)?.cor ?? "#9ca3af"
}

function rotuloPrioridade(prioridade: string): string {
    return PRIORIDADES.find((p) => p.valor === prioridade)?.label ?? prioridade
}

type MinhaPermissao = { nivel: string; eh_desenvolvedor: boolean; acoes: string[] }

const COLUNAS: { status: StatusTarefa; titulo: string }[] = [
    { status: "FALTA_ASSUMIR", titulo: "Falta assumir" },
    { status: "EXECUTANDO", titulo: "Executando" },
    { status: "VALIDAR", titulo: "Validar" },
    { status: "FINALIZADA", titulo: "Finalizada" },
]

const TRANSICOES: Partial<Record<StatusTarefa, Partial<Record<StatusTarefa, { url: string; acao: string }>>>> = {
    FALTA_ASSUMIR: {
        EXECUTANDO: { url: UrlsTarefasTrabalhistas.assumir, acao: "assumir" },
    },
    EXECUTANDO: {
        VALIDAR: { url: UrlsTarefasTrabalhistas.enviarValidacao, acao: "enviar_validacao" },
    },
    VALIDAR: {
        EXECUTANDO: { url: UrlsTarefasTrabalhistas.reprovar, acao: "reprovar" },
        FINALIZADA: { url: UrlsTarefasTrabalhistas.validar, acao: "validar" },
    },
}

function normalizar(texto: string): string {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function formatarData(iso: string | null): string {
    if (!iso) return "sem prazo"
    const [ano, mes, dia] = iso.split("-")
    return `${dia}/${mes}/${ano}`
}

function TarefaCard({
    tarefa,
    podeExcluir,
    meuUsuarioId,
    onExcluir,
    onVerHistorico,
}: {
    tarefa: Tarefa
    podeExcluir: boolean
    meuUsuarioId: string
    onExcluir: (tarefa: Tarefa) => void
    onVerHistorico: (tarefa: Tarefa) => void
}) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: tarefa.idmaster,
        data: { status: tarefa.status },
    })

    const souEuOSugerido = !!tarefa.responsavel_sugerido && String(tarefa.responsavel_sugerido.id) === meuUsuarioId
    const hojeISO = new Date().toISOString().slice(0, 10)
    const estaVencida = !!tarefa.prazo && tarefa.status !== "FINALIZADA" && tarefa.prazo < hojeISO

    return (
        <Card
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            variant="outlined"
            onClick={() => onVerHistorico(tarefa)}
            sx={{
                p: 1.5,
                mb: 1.5,
                cursor: "grab",
                opacity: isDragging ? 0.5 : 1,
                transform: transform ? CSS.Translate.toString(transform) : undefined,
                "&:hover": { boxShadow: 2 },
            }}
        >
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", pr: 1, minWidth: 0 }}>
                    <Box
                        sx={{
                            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                            bgcolor: corPrioridade(tarefa.prioridade),
                        }}
                        title={`Prioridade: ${rotuloPrioridade(tarefa.prioridade)}`}
                    />
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                        {tarefa.titulo}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5}>
                    {podeExcluir && (
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation()
                                onExcluir(tarefa)
                            }}
                        >
                            <DeleteOutlined fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            </Stack>

            {tarefa.cliente && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Cliente: {tarefa.cliente.nome}
                </Typography>
            )}

            {tarefa.descricao && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {tarefa.descricao}
                </Typography>
            )}

            {tarefa.responsavel_sugerido && (
                <Chip
                    size="small"
                    variant="filled"
                    color={souEuOSugerido ? "secondary" : "info"}
                    icon={souEuOSugerido ? <NotificationsActiveOutlined fontSize="small" /> : undefined}
                    sx={{ mt: 1, fontWeight: souEuOSugerido ? 700 : 400 }}
                    label={souEuOSugerido ? "Sugerido para você!" : `Sugerido: ${tarefa.responsavel_sugerido.nome}`}
                />
            )}

            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 1, flexWrap: "wrap" }}>
                {tarefa.prioridade === "ALTA" && (
                    <Chip
                        size="small"
                        variant="filled"
                        label={rotuloPrioridade(tarefa.prioridade)}
                        sx={{ bgcolor: corPrioridade(tarefa.prioridade), color: "#fff", fontWeight: 700 }}
                    />
                )}
                <Chip
                    size="small"
                    icon={estaVencida ? <WarningAmberOutlined fontSize="small" /> : <CalendarMonth fontSize="small" />}
                    label={estaVencida ? `Vencida em ${formatarData(tarefa.prazo)}` : formatarData(tarefa.prazo)}
                    color={estaVencida ? "error" : "default"}
                    variant={estaVencida ? "filled" : "outlined"}
                />
                <Chip
                    size="small"
                    icon={<PersonOutlined fontSize="small" />}
                    label={tarefa.responsavel_atual?.nome || "sem responsável"}
                    color={tarefa.responsavel_atual ? "primary" : "default"}
                    variant={tarefa.responsavel_atual ? "filled" : "outlined"}
                />
                {tarefa.total_anexos > 0 && (
                    <Chip
                        size="small"
                        icon={<AttachFileOutlined fontSize="small" />}
                        label={tarefa.total_anexos}
                    />
                )}
                {tarefa.total_comentarios > 0 && (
                    <Chip
                        size="small"
                        icon={<ChatBubbleOutlineOutlined fontSize="small" />}
                        label={tarefa.total_comentarios}
                    />
                )}
            </Stack>
        </Card>
    )
}

function Coluna({
    status,
    titulo,
    tarefas,
    podeExcluir,
    meuUsuarioId,
    onExcluir,
    onVerHistorico,
}: {
    status: StatusTarefa
    titulo: string
    tarefas: Tarefa[]
    podeExcluir: boolean
    meuUsuarioId: string
    onExcluir: (tarefa: Tarefa) => void
    onVerHistorico: (tarefa: Tarefa) => void
}) {
    const { setNodeRef, isOver } = useDroppable({ id: status })

    return (
        <Box
            ref={setNodeRef}
            sx={{
                flex: 1,
                minWidth: 260,
                bgcolor: (theme) => alpha(theme.palette.text.primary, isOver ? 0.06 : 0.03),
                borderRadius: 2,
                p: 1.5,
                transition: "background-color .15s ease",
            }}
        >
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {titulo}
                </Typography>
                <Chip size="small" label={tarefas.length} />
            </Stack>
            {tarefas.map((t) => (
                <TarefaCard
                    key={t.idmaster}
                    tarefa={t}
                    podeExcluir={podeExcluir}
                    meuUsuarioId={meuUsuarioId}
                    onExcluir={onExcluir}
                    onVerHistorico={onVerHistorico}
                />
            ))}
        </Box>
    )
}

const PERMISSAO_VAZIA: MinhaPermissao = { nivel: "ASSISTENTE", eh_desenvolvedor: false, acoes: [] }

export default function TarefasTrabalhistasPage() {
    const router = useRouter()
    const theme = useTheme()
    const userData = useSelector((state: RootState) => state.userData.item)
    const meuUsuarioId = String(userData?.id ?? "")
    const [tarefas, setTarefas] = useState<Tarefa[]>([])
    const [minhaPermissao, setMinhaPermissao] = useState<MinhaPermissao>(PERMISSAO_VAZIA)
    const [carregando, setCarregando] = useState(true)
    const [modalCriarAberto, setModalCriarAberto] = useState(false)
    const [novoTitulo, setNovoTitulo] = useState("")
    const [novaDescricao, setNovaDescricao] = useState("")
    const [novasObservacoes, setNovasObservacoes] = useState("")
    const [novoPrazo, setNovoPrazo] = useState("")
    const [novaPrioridade, setNovaPrioridade] = useState<Prioridade>("MEDIA")
    const [novoCliente, setNovoCliente] = useState<ClienteSelecaoOption | null>(null)
    const [novoResponsavelSugerido, setNovoResponsavelSugerido] = useState<UsuarioSelecaoOption | null>(null)
    const [novosAnexos, setNovosAnexos] = useState<File[]>([])
    const [novosItensChecklist, setNovosItensChecklist] = useState<string[]>([])
    const [novoItemChecklistTexto, setNovoItemChecklistTexto] = useState("")
    const [salvandoCriacao, setSalvandoCriacao] = useState(false)
    const [filtroBusca, setFiltroBusca] = useState("")
    const [filtroPrioridade, setFiltroPrioridade] = useState<Prioridade | "">("")
    const [filtroSomenteVencidas, setFiltroSomenteVencidas] = useState(false)
    const [modalExcluidasAberto, setModalExcluidasAberto] = useState(false)
    const [tarefasExcluidas, setTarefasExcluidas] = useState<TarefaExcluida[]>([])
    const [carregandoExcluidas, setCarregandoExcluidas] = useState(false)
    const [duplicando, setDuplicando] = useState(false)
    const [historico, setHistorico] = useState<TarefaDetalhe | null>(null)
    const [novoComentario, setNovoComentario] = useState("")
    const [imagemColada, setImagemColada] = useState<File | null>(null)
    const [previewImagemColada, setPreviewImagemColada] = useState<string | null>(null)
    const [novoItemChecklist, setNovoItemChecklist] = useState("")
    const [enviandoComentario, setEnviandoComentario] = useState(false)
    const [reprovarTarefaId, setReprovarTarefaId] = useState<string | null>(null)
    const [motivoReprovacao, setMotivoReprovacao] = useState("")
    const [enviandoReprovacao, setEnviandoReprovacao] = useState(false)

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    const podeCriar = minhaPermissao.acoes.includes("create")
    const podeExcluir = minhaPermissao.acoes.includes("delete")
    const podeComentar = minhaPermissao.acoes.includes("comentar")
    const podeChecklist = minhaPermissao.acoes.includes("checklist")

    type FeedItem =
        | { tipo: "log"; created_at: string; log: LogEntry }
        | { tipo: "chat"; created_at: string; comentario: Comentario }

    const feedItens = useMemo<FeedItem[]>(() => {
        if (!historico) return []
        const itens: FeedItem[] = [
            ...historico.log.map((log): FeedItem => ({ tipo: "log", created_at: log.created_at, log })),
            ...historico.comentarios.map((comentario): FeedItem => ({ tipo: "chat", created_at: comentario.created_at, comentario })),
        ]
        return itens.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }, [historico])

    const carregarDados = useCallback(async () => {
        setCarregando(true)
        const [respLista, respPermissao] = await Promise.all([
            requisicaoGlobal<Tarefa[]>({ rota: UrlsTarefasTrabalhistas.listar, metodo: "get", mostrarMensagem: false }),
            requisicaoGlobal<MinhaPermissao>({ rota: UrlsTarefasTrabalhistas.minhaPermissao, metodo: "get", mostrarMensagem: false }),
        ])
        setTarefas(Array.isArray(respLista.data) ? respLista.data : [])
        setMinhaPermissao(respPermissao.data ?? PERMISSAO_VAZIA)
        setCarregando(false)
    }, [])

    useEffect(() => {
        carregarDados()
    }, [carregarDados])

    const tarefasFiltradas = useMemo(() => {
        const termo = normalizar(filtroBusca.trim())
        const hojeISO = new Date().toISOString().slice(0, 10)
        return tarefas.filter((t) => {
            if (termo) {
                const alvo = normalizar(
                    `${t.titulo} ${t.cliente?.nome ?? ""} ${t.responsavel_atual?.nome ?? ""} ${t.criado_por?.nome ?? ""}`
                )
                if (!alvo.includes(termo)) return false
            }
            if (filtroPrioridade && t.prioridade !== filtroPrioridade) return false
            if (filtroSomenteVencidas) {
                const vencida = !!t.prazo && t.status !== "FINALIZADA" && t.prazo < hojeISO
                if (!vencida) return false
            }
            return true
        })
    }, [tarefas, filtroBusca, filtroPrioridade, filtroSomenteVencidas])

    const tarefasPorStatus = useMemo(() => {
        const mapa: Record<StatusTarefa, Tarefa[]> = {
            FALTA_ASSUMIR: [], EXECUTANDO: [], VALIDAR: [], FINALIZADA: [],
        }
        tarefasFiltradas.forEach((t) => mapa[t.status]?.push(t))
        return mapa
    }, [tarefasFiltradas])

    const estatisticas = useMemo(() => {
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        const atrasadas = tarefas.filter((t) => {
            if (!t.prazo || t.status === "FINALIZADA") return false
            return new Date(`${t.prazo}T00:00:00`) < hoje
        }).length
        return {
            total: tarefas.length,
            atrasadas,
            semResponsavel: tarefas.filter((t) => t.status === "FALTA_ASSUMIR").length,
            finalizadas: tarefas.filter((t) => t.status === "FINALIZADA").length,
        }
    }, [tarefas])

    const rampaStatus = COLUNAS.map((_, i) => alpha(theme.palette.primary.main, 0.32 + (0.68 * i) / (COLUNAS.length - 1)))

    const limparFormularioCriacao = () => {
        setNovoTitulo("")
        setNovaDescricao("")
        setNovasObservacoes("")
        setNovoPrazo("")
        setNovaPrioridade("MEDIA")
        setNovoCliente(null)
        setNovoResponsavelSugerido(null)
        setNovosAnexos([])
        setNovosItensChecklist([])
        setNovoItemChecklistTexto("")
    }

    const handleAdicionarItemChecklistCriacao = () => {
        const texto = novoItemChecklistTexto.trim()
        if (!texto) return
        setNovosItensChecklist((atual) => [...atual, texto])
        setNovoItemChecklistTexto("")
    }

    const handleRemoverItemChecklistCriacao = (indice: number) => {
        setNovosItensChecklist((atual) => atual.filter((_, i) => i !== indice))
    }

    const handleCriar = async () => {
        if (!novoTitulo.trim()) {
            showError("Informe um título para a tarefa")
            return
        }
        setSalvandoCriacao(true)
        const resp = await requisicaoGlobal<Tarefa>({
            rota: UrlsTarefasTrabalhistas.criar,
            metodo: "post",
            obj: {
                titulo: novoTitulo,
                descricao: novaDescricao,
                observacoes: novasObservacoes,
                prazo: novoPrazo || null,
                prioridade: novaPrioridade,
                cliente_id: novoCliente?.cliente_id || null,
                responsavel_sugerido_id: novoResponsavelSugerido?.usuario_id || null,
            },
            mostrarMensagem: false,
        })
        if (resp.error || !resp.data) {
            setSalvandoCriacao(false)
            showError("Não foi possível criar a tarefa", resp.error ?? undefined)
            return
        }
        const tarefaCriada = resp.data

        for (const arquivo of novosAnexos) {
            const formData = new FormData()
            formData.append("arquivo", arquivo)
            await requisicaoGlobal({
                rota: UrlsTarefasTrabalhistas.anexar.replace("[id]", tarefaCriada.idmaster),
                metodo: "post",
                obj: formData,
                mostrarMensagem: false,
            })
        }

        for (const texto of novosItensChecklist) {
            await requisicaoGlobal({
                rota: UrlsTarefasTrabalhistas.checklist.replace("[id]", tarefaCriada.idmaster),
                metodo: "post",
                obj: { texto },
                mostrarMensagem: false,
            })
        }

        setSalvandoCriacao(false)
        setTarefas((atual) => [{ ...tarefaCriada, total_anexos: novosAnexos.length, total_comentarios: 0 }, ...atual])
        setModalCriarAberto(false)
        limparFormularioCriacao()
        showSuccess("Tarefa criada", "Quem pode assumir já foi avisado no Teams.")
    }

    const handleExcluir = async (tarefa: Tarefa) => {
        const confirmacao = await showDeleteConfirm(
            "Excluir tarefa?",
            `"${tarefa.titulo}" será removida definitivamente.`,
            "Excluir",
        )
        if (!confirmacao.isConfirmed) return

        const resp = await requisicaoGlobal({
            rota: UrlsTarefasTrabalhistas.excluir.replace("[id]", tarefa.idmaster),
            metodo: "delete",
            mostrarMensagem: false,
        })
        if (resp.error) {
            showError("Não foi possível excluir a tarefa", resp.error)
            return
        }
        setTarefas((atual) => atual.filter((t) => t.idmaster !== tarefa.idmaster))
    }

    const handleDuplicar = async () => {
        if (!historico) return
        setDuplicando(true)
        const resp = await requisicaoGlobal<Tarefa>({
            rota: UrlsTarefasTrabalhistas.duplicar.replace("[id]", historico.idmaster),
            metodo: "post",
            mostrarMensagem: false,
        })
        setDuplicando(false)
        if (resp.error || !resp.data) {
            showError("Não foi possível duplicar a tarefa", resp.error ?? undefined)
            return
        }
        setTarefas((atual) => [resp.data as Tarefa, ...atual])
        setHistorico(null)
        showSuccess("Tarefa duplicada", "Uma cópia foi criada em 'Falta assumir' (sem o log e os comentários).")
    }

    const handleAlterarPrioridade = async (prioridade: Prioridade) => {
        if (!historico) return
        const resp = await requisicaoGlobal<Tarefa>({
            rota: UrlsTarefasTrabalhistas.atualizarPrioridade.replace("[id]", historico.idmaster),
            metodo: "patch",
            obj: { prioridade },
            mostrarMensagem: false,
        })
        if (resp.error || !resp.data) {
            showError("Não foi possível alterar a prioridade", resp.error ?? undefined)
            return
        }
        const atualizada = resp.data
        setHistorico((atual) => (atual ? { ...atual, prioridade: atualizada.prioridade } : atual))
        // recarrega a lista pra já refletir a nova posição (maior prioridade sobe pro topo da coluna)
        carregarDados()
    }

    const handleAbrirExcluidas = async () => {
        setModalExcluidasAberto(true)
        setCarregandoExcluidas(true)
        const resp = await requisicaoGlobal<TarefaExcluida[]>({
            rota: UrlsTarefasTrabalhistas.excluidas,
            metodo: "get",
            mostrarMensagem: false,
        })
        setCarregandoExcluidas(false)
        setTarefasExcluidas(resp.data ?? [])
    }

    const handleVerHistorico = async (tarefa: Tarefa) => {
        const resp = await requisicaoGlobal<TarefaDetalhe>({
            rota: UrlsTarefasTrabalhistas.detalhe.replace("[id]", tarefa.idmaster),
            metodo: "get",
            mostrarMensagem: false,
        })
        if (resp.data) setHistorico(resp.data)
    }

    const handleAcaoRapida = async (url: string) => {
        if (!historico) return
        const resp = await requisicaoGlobal<Tarefa>({
            rota: url.replace("[id]", historico.idmaster),
            metodo: "post",
            mostrarMensagem: false,
        })
        if (resp.error || !resp.data) {
            showError("Não foi possível concluir a ação", resp.error ?? undefined)
            return
        }
        const atualizada = resp.data
        setTarefas((atual) => atual.map((t) => (t.idmaster === atualizada.idmaster ? atualizada : t)))
        handleVerHistorico(atualizada) // recarrega o detalhe pra já mostrar o novo status e a entrada no log
    }

    const handleColarImagemChat = (event: React.ClipboardEvent<HTMLDivElement>) => {
        const item = Array.from(event.clipboardData.items).find((i) => i.type.startsWith("image/"))
        if (!item) return
        const arquivo = item.getAsFile()
        if (!arquivo) return
        event.preventDefault()
        setImagemColada(arquivo)
        setPreviewImagemColada(URL.createObjectURL(arquivo))
    }

    const handleRemoverImagemColada = () => {
        if (previewImagemColada) URL.revokeObjectURL(previewImagemColada)
        setImagemColada(null)
        setPreviewImagemColada(null)
    }

    const handleComentar = async () => {
        if (!historico || (!novoComentario.trim() && !imagemColada)) return
        setEnviandoComentario(true)
        const formData = new FormData()
        formData.append("texto", novoComentario.trim())
        if (imagemColada) formData.append("imagem", imagemColada)
        const resp = await requisicaoGlobal<Comentario>({
            rota: UrlsTarefasTrabalhistas.comentar.replace("[id]", historico.idmaster),
            metodo: "post",
            obj: formData,
            mostrarMensagem: false,
        })
        setEnviandoComentario(false)
        if (resp.error || !resp.data) {
            showError("Não foi possível enviar o comentário", resp.error ?? undefined)
            return
        }
        const comentarioCriado = resp.data
        setHistorico((atual) => atual && { ...atual, comentarios: [...atual.comentarios, comentarioCriado] })
        setNovoComentario("")
        handleRemoverImagemColada()
        setTarefas((atual) => atual.map((t) =>
            t.idmaster === historico.idmaster ? { ...t, total_comentarios: t.total_comentarios + 1 } : t
        ))
    }

    const handleAdicionarItemChecklist = async () => {
        if (!historico || !novoItemChecklist.trim()) return
        const resp = await requisicaoGlobal<ChecklistItem>({
            rota: UrlsTarefasTrabalhistas.checklist.replace("[id]", historico.idmaster),
            metodo: "post",
            obj: { texto: novoItemChecklist.trim() },
            mostrarMensagem: false,
        })
        if (resp.error || !resp.data) {
            showError("Não foi possível adicionar o item", resp.error ?? undefined)
            return
        }
        const itemCriado = resp.data
        setHistorico((atual) => atual && { ...atual, checklist: [...atual.checklist, itemCriado] })
        setNovoItemChecklist("")
    }

    const handleToggleItemChecklist = async (item: ChecklistItem) => {
        if (!historico) return
        const resp = await requisicaoGlobal<ChecklistItem>({
            rota: UrlsTarefasTrabalhistas.checklistItem.replace("[id]", historico.idmaster).replace("[itemId]", item.idmaster),
            metodo: "patch",
            obj: { concluido: !item.concluido },
            mostrarMensagem: false,
        })
        if (resp.error || !resp.data) {
            showError("Não foi possível atualizar o item", resp.error ?? undefined)
            return
        }
        const itemAtualizado = resp.data
        setHistorico((atual) => atual && {
            ...atual,
            checklist: atual.checklist.map((i) => (i.idmaster === itemAtualizado.idmaster ? itemAtualizado : i)),
        })
    }

    const handleRemoverItemChecklist = async (item: ChecklistItem) => {
        if (!historico) return
        const resp = await requisicaoGlobal({
            rota: UrlsTarefasTrabalhistas.checklistItem.replace("[id]", historico.idmaster).replace("[itemId]", item.idmaster),
            metodo: "delete",
            mostrarMensagem: false,
        })
        if (resp.error) {
            showError("Não foi possível remover o item", resp.error)
            return
        }
        setHistorico((atual) => atual && {
            ...atual,
            checklist: atual.checklist.filter((i) => i.idmaster !== item.idmaster),
        })
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over) return

        const origem = active.data.current?.status as StatusTarefa | undefined
        const destino = over.id as StatusTarefa
        if (!origem || origem === destino) return

        // Pleno/Sênior/Gerência (e Desenvolvedor) têm a ação "mover": arrastam
        // pra qualquer coluna, em qualquer direção, sem passar pelas
        // transições formais (assumir/validar/reprovar) nem exigir motivo.
        if (minhaPermissao.acoes.includes("mover")) {
            const resp = await requisicaoGlobal<Tarefa>({
                rota: UrlsTarefasTrabalhistas.mover.replace("[id]", active.id as string),
                metodo: "post",
                obj: { status: destino },
                mostrarMensagem: false,
            })
            if (resp.error || !resp.data) {
                showError("Não foi possível mover a tarefa", resp.error ?? undefined)
                return
            }
            const atualizada = resp.data
            setTarefas((atual) => atual.map((t) => (t.idmaster === atualizada.idmaster ? atualizada : t)))
            return
        }

        const transicao = TRANSICOES[origem]?.[destino]
        if (!transicao) {
            showError("Movimento não permitido", "Essa tarefa não pode pular direto para essa etapa.")
            return
        }
        if (!minhaPermissao.acoes.includes(transicao.acao)) {
            showError("Sem permissão", "Seu nível de acesso na esteira não permite essa ação.")
            return
        }

        if (transicao.acao === "reprovar") {
            setReprovarTarefaId(active.id as string)
            return
        }

        const resp = await requisicaoGlobal<Tarefa>({
            rota: transicao.url.replace("[id]", active.id as string),
            metodo: "post",
            mostrarMensagem: false,
        })
        if (resp.error || !resp.data) {
            showError("Não foi possível mover a tarefa", resp.error ?? undefined)
            return
        }
        const atualizada = resp.data
        setTarefas((atual) => atual.map((t) => (t.idmaster === atualizada.idmaster ? atualizada : t)))
    }

    const handleConfirmarReprovacao = async () => {
        if (!reprovarTarefaId || !motivoReprovacao.trim()) return
        setEnviandoReprovacao(true)
        const resp = await requisicaoGlobal<Tarefa>({
            rota: UrlsTarefasTrabalhistas.reprovar.replace("[id]", reprovarTarefaId),
            metodo: "post",
            obj: { motivo: motivoReprovacao.trim() },
            mostrarMensagem: false,
        })
        setEnviandoReprovacao(false)
        if (resp.error || !resp.data) {
            showError("Não foi possível reprovar a tarefa", resp.error ?? undefined)
            return
        }
        const atualizada = resp.data
        setTarefas((atual) => atual.map((t) => (t.idmaster === atualizada.idmaster ? atualizada : t)))
        setReprovarTarefaId(null)
        setMotivoReprovacao("")
    }

    return (
        <PageContainer>
            <PageHeader
                title="Task Management"
                subtitle="Esteira de tarefas do setor trabalhista"
                actions={
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant="outlined"
                            startIcon={<RestoreFromTrashOutlined />}
                            onClick={handleAbrirExcluidas}
                        >
                            Tarefas excluídas
                        </Button>
                        {minhaPermissao.eh_desenvolvedor && (
                            <Button
                                variant="outlined"
                                startIcon={<SettingsOutlined />}
                                onClick={() => router.push("/rh/tarefas-trabalhistas/permissoes")}
                            >
                                Permissões
                            </Button>
                        )}
                        {podeCriar && (
                            <Button variant="contained" startIcon={<Add />} onClick={() => setModalCriarAberto(true)}>
                                Nova tarefa
                            </Button>
                        )}
                    </Stack>
                }
            />

            {!carregando && (
                <ContentCard sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                        Visão geral
                    </Typography>
                    <Grid container spacing={1.5} sx={{ alignItems: "stretch", mb: estatisticas.total > 0 ? 2 : 0 }}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: "flex" }}>
                            <MetricCard
                                title="Total de tarefas"
                                value={estatisticas.total}
                                icon={<AssignmentOutlined />}
                                color="primary"
                                dense
                                sx={{ flex: 1 }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: "flex" }}>
                            <MetricCard
                                title="Sem responsável"
                                value={estatisticas.semResponsavel}
                                icon={<GroupOutlined />}
                                color="warning"
                                dense
                                sx={{ flex: 1 }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: "flex" }}>
                            <MetricCard
                                title="Em atraso"
                                value={estatisticas.atrasadas}
                                icon={<AssignmentLateOutlined />}
                                color="error"
                                dense
                                sx={{ flex: 1 }}
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: "flex" }}>
                            <MetricCard
                                title="Finalizadas"
                                value={estatisticas.finalizadas}
                                icon={<TaskAltOutlined />}
                                color="success"
                                dense
                                sx={{ flex: 1 }}
                            />
                        </Grid>
                    </Grid>

                    {estatisticas.total > 0 && (
                        <BarChart
                            height={260}
                            series={[{
                                data: COLUNAS.map((c) => tarefasPorStatus[c.status].length),
                                valueFormatter: (v: number | null) => `${v ?? 0} tarefa(s)`,
                            }]}
                            xAxis={[{
                                scaleType: "band",
                                data: COLUNAS.map((c) => c.titulo),
                                // Etapas da esteira são uma progressão (Falta assumir -> Finalizada),
                                // não categorias soltas — por isso uma rampa de UM matiz claro->escuro,
                                // não 4 cores semânticas sem relação entre si.
                                colorMap: { type: "ordinal", colors: rampaStatus },
                                tickLabelStyle: { fontSize: 12 },
                            }]}
                            yAxis={[{ tickMinStep: 1 }]}
                            borderRadius={8}
                            hideLegend
                            grid={{ horizontal: true }}
                            sx={{
                                "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { stroke: theme.palette.divider },
                                "& .MuiChartsGrid-line": { stroke: alpha(theme.palette.text.primary, 0.06) },
                            }}
                        />
                    )}
                </ContentCard>
            )}

            <ContentCard>
                <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}>
                    <AppTextField
                        size="small"
                        placeholder="Buscar por título, cliente ou responsável..."
                        value={filtroBusca}
                        onChange={(e) => setFiltroBusca(e.target.value)}
                        sx={{ minWidth: 260, flex: 1 }}
                        startIcon={<SearchOutlined fontSize="small" />}
                    />
                    <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id="filtro-prioridade-label">Prioridade</InputLabel>
                        <Select
                            labelId="filtro-prioridade-label"
                            label="Prioridade"
                            value={filtroPrioridade}
                            onChange={(e) => setFiltroPrioridade(e.target.value as Prioridade | "")}
                        >
                            <MenuItem value="">Todas</MenuItem>
                            {PRIORIDADES.map((p) => (
                                <MenuItem key={p.valor} value={p.valor}>{p.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <Checkbox
                            size="small"
                            checked={filtroSomenteVencidas}
                            onChange={(e) => setFiltroSomenteVencidas(e.target.checked)}
                        />
                        <Typography variant="body2" color="text.secondary">Somente vencidas</Typography>
                    </Stack>
                    {(filtroBusca || filtroPrioridade || filtroSomenteVencidas) && (
                        <Button
                            size="small"
                            onClick={() => { setFiltroBusca(""); setFiltroPrioridade(""); setFiltroSomenteVencidas(false) }}
                        >
                            Limpar filtros
                        </Button>
                    )}
                </Stack>
                {carregando ? (
                    <Stack direction="row" spacing={2}>
                        {COLUNAS.map((c) => <Skeleton key={c.status} variant="rounded" width="100%" height={300} />)}
                    </Stack>
                ) : (
                    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                            {COLUNAS.map((coluna) => (
                                <Coluna
                                    key={coluna.status}
                                    status={coluna.status}
                                    titulo={coluna.titulo}
                                    tarefas={tarefasPorStatus[coluna.status]}
                                    podeExcluir={podeExcluir}
                                    meuUsuarioId={meuUsuarioId}
                                    onExcluir={handleExcluir}
                                    onVerHistorico={handleVerHistorico}
                                />
                            ))}
                        </Stack>
                    </DndContext>
                )}
            </ContentCard>

            <AppModal
                open={modalCriarAberto}
                onOpenChange={setModalCriarAberto}
                title="Nova tarefa trabalhista"
                tamanhoWidth="midle"
                isFooter
                handleButtonConfirme={handleCriar}
                textButton="Criar"
                loading={salvandoCriacao}
            >
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <AppTextField
                        label="Título"
                        value={novoTitulo}
                        onChange={(e) => setNovoTitulo(e.target.value)}
                        fullWidth
                        autoFocus
                    />
                    <ClienteSelect
                        label="Cliente"
                        value={novoCliente}
                        onChange={setNovoCliente}
                        fullWidth
                    />
                    <AppTextField
                        label="Descrição"
                        value={novaDescricao}
                        onChange={(e) => setNovaDescricao(e.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                    />
                    <AppTextField
                        label="Observações"
                        value={novasObservacoes}
                        onChange={(e) => setNovasObservacoes(e.target.value)}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                    <Stack direction="row" spacing={2}>
                        <AppTextField
                            label="Prazo"
                            type="date"
                            value={novoPrazo}
                            onChange={(e) => setNovoPrazo(e.target.value)}
                            fullWidth
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                        <FormControl fullWidth>
                            <InputLabel id="nova-prioridade-label">Prioridade</InputLabel>
                            <Select
                                labelId="nova-prioridade-label"
                                label="Prioridade"
                                value={novaPrioridade}
                                onChange={(e) => setNovaPrioridade(e.target.value as Prioridade)}
                            >
                                {PRIORIDADES.map((p) => (
                                    <MenuItem key={p.valor} value={p.valor}>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: p.cor }} />
                                            <span>{p.label}</span>
                                        </Stack>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                    <UsuarioSelect
                        label="Sugerir responsável (opcional)"
                        value={novoResponsavelSugerido}
                        onChange={setNovoResponsavelSugerido}
                        fullWidth
                    />
                    <AppDropzone
                        label="Anexos"
                        description="Arraste os arquivos ou clique para selecionar."
                        multiple
                        value={novosAnexos}
                        onFilesChange={setNovosAnexos}
                    />

                    <Stack spacing={0.5}>
                        <Typography variant="subtitle2">Checklist (opcional)</Typography>
                        {novosItensChecklist.length > 0 && (
                            <Stack spacing={0.5}>
                                {novosItensChecklist.map((texto, indice) => (
                                    <Stack key={indice} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                                        <Typography variant="body2" sx={{ flex: 1 }}>
                                            {texto}
                                        </Typography>
                                        <IconButton size="small" onClick={() => handleRemoverItemChecklistCriacao(indice)}>
                                            <DeleteOutlined fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                        <Stack direction="row" spacing={1}>
                            <AppTextField
                                size="small"
                                placeholder="Adicionar item ao checklist..."
                                value={novoItemChecklistTexto}
                                onChange={(e) => setNovoItemChecklistTexto(e.target.value)}
                                fullWidth
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault()
                                        handleAdicionarItemChecklistCriacao()
                                    }
                                }}
                            />
                            <Button
                                variant="outlined"
                                onClick={handleAdicionarItemChecklistCriacao}
                                disabled={!novoItemChecklistTexto.trim()}
                            >
                                Adicionar
                            </Button>
                        </Stack>
                    </Stack>
                </Stack>
            </AppModal>

            <AppModal
                open={!!historico}
                onOpenChange={(open) => {
                    if (!open) {
                        setHistorico(null)
                        setNovoComentario("")
                        setNovoItemChecklist("")
                    }
                }}
                title={historico?.titulo ?? "Detalhes da tarefa"}
                tamanhoWidth="extraBig"
                contentSx={{
                    p: 0,
                    height: "75vh",
                    maxHeight: "75vh",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                }}
            >
                <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0, overflowY: "auto", p: 2.5 }}>
                    {historico && (
                        <>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                                <Chip size="small" label={COLUNAS.find((c) => c.status === historico.status)?.titulo ?? historico.status} />
                                {historico.cliente && <Chip size="small" variant="outlined" label={`Cliente: ${historico.cliente.nome}`} />}
                                <Chip size="small" variant="outlined" icon={<CalendarMonth fontSize="small" />} label={formatarData(historico.prazo)} />
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    icon={<PersonOutlined fontSize="small" />}
                                    label={historico.responsavel_atual?.nome || "sem responsável"}
                                />
                                {historico.responsavel_sugerido && (
                                    <Chip size="small" variant="outlined" color="info" label={`Sugerido: ${historico.responsavel_sugerido.nome}`} />
                                )}
                                {minhaPermissao.acoes.includes("checklist") ? (
                                    <FormControl size="small" sx={{ minWidth: 130 }}>
                                        <Select
                                            value={historico.prioridade}
                                            onChange={(e) => handleAlterarPrioridade(e.target.value as Prioridade)}
                                            sx={{ height: 32 }}
                                        >
                                            {PRIORIDADES.map((p) => (
                                                <MenuItem key={p.valor} value={p.valor}>
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                        <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: p.cor }} />
                                                        <span>Prioridade: {p.label}</span>
                                                    </Stack>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                ) : (
                                    <Chip
                                        size="small"
                                        variant="outlined"
                                        label={`Prioridade: ${rotuloPrioridade(historico.prioridade)}`}
                                        sx={{ borderColor: corPrioridade(historico.prioridade) }}
                                    />
                                )}
                            </Stack>
                            {historico.descricao && (
                                <Typography variant="body2">{historico.descricao}</Typography>
                            )}

                            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                                {historico.status === "FALTA_ASSUMIR" && minhaPermissao.acoes.includes("assumir") && (
                                    <Button variant="contained" onClick={() => handleAcaoRapida(UrlsTarefasTrabalhistas.assumir)}>
                                        Assumir
                                    </Button>
                                )}
                                {historico.status === "EXECUTANDO" && minhaPermissao.acoes.includes("enviar_validacao") && (
                                    <Button variant="contained" onClick={() => handleAcaoRapida(UrlsTarefasTrabalhistas.enviarValidacao)}>
                                        Encaminhar para validação
                                    </Button>
                                )}
                                {historico.status === "VALIDAR" && minhaPermissao.acoes.includes("validar") && (
                                    <Button variant="contained" color="success" onClick={() => handleAcaoRapida(UrlsTarefasTrabalhistas.validar)}>
                                        Validar
                                    </Button>
                                )}
                                {historico.status === "VALIDAR" && minhaPermissao.acoes.includes("reprovar") && (
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        onClick={() => {
                                            const id = historico.idmaster
                                            setHistorico(null)
                                            setReprovarTarefaId(id)
                                        }}
                                    >
                                        Recusar
                                    </Button>
                                )}
                                {podeCriar && (
                                    <Button
                                        variant="text"
                                        startIcon={<ContentCopyOutlined fontSize="small" />}
                                        onClick={handleDuplicar}
                                        disabled={duplicando}
                                    >
                                        Duplicar tarefa
                                    </Button>
                                )}
                            </Stack>
                            <Divider />

                            <Typography variant="subtitle2">Checklist</Typography>
                            <Stack spacing={0.5}>
                                {historico.checklist.length ? (
                                    historico.checklist.map((item) => (
                                        <Stack key={item.idmaster} direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                                            <Checkbox
                                                size="small"
                                                checked={item.concluido}
                                                disabled={!podeChecklist}
                                                onChange={() => handleToggleItemChecklist(item)}
                                            />
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    flex: 1,
                                                    textDecoration: item.concluido ? "line-through" : "none",
                                                    color: item.concluido ? "text.secondary" : "text.primary",
                                                }}
                                            >
                                                {item.texto}
                                            </Typography>
                                            {podeChecklist && (
                                                <IconButton size="small" onClick={() => handleRemoverItemChecklist(item)}>
                                                    <DeleteOutlined fontSize="small" />
                                                </IconButton>
                                            )}
                                        </Stack>
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.secondary">Sem itens no checklist.</Typography>
                                )}
                            </Stack>
                            {podeChecklist && (
                                <Stack direction="row" spacing={1}>
                                    <AppTextField
                                        size="small"
                                        placeholder="Adicionar item ao checklist..."
                                        value={novoItemChecklist}
                                        onChange={(e) => setNovoItemChecklist(e.target.value)}
                                        fullWidth
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                handleAdicionarItemChecklist()
                                            }
                                        }}
                                    />
                                    <Button variant="outlined" onClick={handleAdicionarItemChecklist} disabled={!novoItemChecklist.trim()}>
                                        Adicionar
                                    </Button>
                                </Stack>
                            )}
                            <Divider />
                        </>
                    )}
                    {historico?.observacoes && (
                        <Typography variant="body2" color="text.secondary">
                            <b>Observações:</b> {historico.observacoes}
                        </Typography>
                    )}
                    {!!historico?.anexos.length && (
                        <Stack spacing={0.5}>
                            <Typography variant="subtitle2">Anexos</Typography>
                            {historico.anexos.map((an) => (
                                <a key={an.idmaster} href={an.url} download={an.nome_original}>
                                    {an.nome_original}
                                </a>
                            ))}
                        </Stack>
                    )}
                </Stack>

                <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />
                <Divider sx={{ display: { xs: "block", md: "none" } }} />

                <Stack
                    sx={{
                        width: { xs: "100%", md: 420 },
                        flexShrink: 0,
                        height: "100%",
                        overflow: "hidden",
                    }}
                >
                    <Box sx={{ px: 2.5, py: 1.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Chat da tarefa
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Histórico de movimentações e ocorrências, em ordem cronológica.
                        </Typography>
                    </Box>
                    <Divider />
                    <Stack spacing={1.5} sx={{ flex: 1, overflowY: "auto", p: 2, minHeight: 0 }}>
                        {feedItens.length ? (
                            feedItens.map((item, idx) =>
                                item.tipo === "log" ? (
                                    <Stack key={`log-${idx}`} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                                        <HistoryOutlined
                                            fontSize="small"
                                            sx={{ color: item.log.acao === "reprovada" ? "error.main" : "text.secondary", mt: "2px" }}
                                        />
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {item.log.usuario?.nome ?? "sistema"} {ROTULO_ACAO_LOG[item.log.acao] ?? item.log.acao}
                                            </Typography>
                                            {item.log.detalhes && (
                                                <Typography
                                                    variant="caption"
                                                    color={item.log.acao === "reprovada" ? "error" : "text.secondary"}
                                                    sx={{ display: "block" }}
                                                >
                                                    {item.log.detalhes}
                                                </Typography>
                                            )}
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(item.log.created_at).toLocaleString("pt-BR")}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                ) : (
                                    <Stack key={item.comentario.idmaster} direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
                                        <ChatBubbleOutlineOutlined fontSize="small" color="primary" sx={{ mt: "2px" }} />
                                        <Box
                                            sx={{
                                                minWidth: 0,
                                                flex: 1,
                                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
                                                borderRadius: 1.5,
                                                p: 1,
                                            }}
                                        >
                                            {item.comentario.texto && (
                                                <Typography variant="body2">{item.comentario.texto}</Typography>
                                            )}
                                            {item.comentario.imagem_url && (
                                                <Box
                                                    component="img"
                                                    src={item.comentario.imagem_url}
                                                    alt="Print anexado ao chat"
                                                    onClick={() => window.open(item.comentario.imagem_url as string, "_blank", "noopener,noreferrer")}
                                                    sx={{
                                                        display: "block", maxWidth: "100%", maxHeight: 220,
                                                        borderRadius: 1, mt: item.comentario.texto ? 0.75 : 0,
                                                        cursor: "zoom-in",
                                                    }}
                                                />
                                            )}
                                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                                {item.comentario.criado_por?.nome ?? "—"} · {new Date(item.comentario.created_at).toLocaleString("pt-BR")}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                )
                            )
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                Nenhuma movimentação ou ocorrência registrada ainda.
                            </Typography>
                        )}
                    </Stack>
                    {podeComentar && (
                        <>
                            <Divider />
                            <Stack spacing={1} sx={{ p: 1.5 }}>
                                {previewImagemColada && (
                                    <Box sx={{ position: "relative", display: "inline-block", width: "fit-content" }}>
                                        <Box
                                            component="img"
                                            src={previewImagemColada}
                                            alt="Prévia da imagem colada"
                                            sx={{ maxHeight: 120, borderRadius: 1, display: "block", border: "1px solid", borderColor: "divider" }}
                                        />
                                        <IconButton
                                            size="small"
                                            onClick={handleRemoverImagemColada}
                                            sx={{
                                                position: "absolute", top: -8, right: -8, bgcolor: "background.paper",
                                                border: "1px solid", borderColor: "divider",
                                                "&:hover": { bgcolor: "background.paper" },
                                            }}
                                        >
                                            <DeleteOutlined fontSize="small" />
                                        </IconButton>
                                    </Box>
                                )}
                                <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
                                    <AppTextField
                                        placeholder="Digite uma mensagem..."
                                        value={novoComentario}
                                        onChange={(e) => setNovoComentario(e.target.value)}
                                        onPaste={handleColarImagemChat}
                                        fullWidth
                                        multiline
                                        minRows={1}
                                        maxRows={4}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault()
                                                handleComentar()
                                            }
                                        }}
                                    />
                                    <IconButton
                                        color="primary"
                                        onClick={handleComentar}
                                        disabled={enviandoComentario || (!novoComentario.trim() && !imagemColada)}
                                    >
                                        <SendOutlined />
                                    </IconButton>
                                </Stack>
                            </Stack>
                        </>
                    )}
                </Stack>
            </AppModal>

            <AppModal
                open={!!reprovarTarefaId}
                onOpenChange={(open) => {
                    if (!open) {
                        setReprovarTarefaId(null)
                        setMotivoReprovacao("")
                    }
                }}
                title="Reprovar tarefa"
                isFooter
                handleButtonConfirme={handleConfirmarReprovacao}
                textButton="Reprovar"
                disableButtonConfirm={!motivoReprovacao.trim()}
                loading={enviandoReprovacao}
            >
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Explique o motivo — a tarefa volta para &ldquo;Executando&rdquo; e o motivo fica registrado no histórico.
                    </Typography>
                    <AppTextField
                        label="Motivo da reprovação"
                        value={motivoReprovacao}
                        onChange={(e) => setMotivoReprovacao(e.target.value)}
                        fullWidth
                        multiline
                        minRows={3}
                        autoFocus
                    />
                </Stack>
            </AppModal>

            <AppModal
                open={modalExcluidasAberto}
                onOpenChange={setModalExcluidasAberto}
                title="Tarefas excluídas"
                tamanhoWidth="big"
            >
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    A tarefa em si já foi removida — esta lista vem do log de auditoria, que sobrevive à exclusão. Não é possível restaurar por aqui.
                </Typography>
                {carregandoExcluidas ? (
                    <Stack spacing={1}>
                        <Skeleton variant="rounded" height={40} />
                        <Skeleton variant="rounded" height={40} />
                        <Skeleton variant="rounded" height={40} />
                    </Stack>
                ) : tarefasExcluidas.length ? (
                    <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Título</TableCell>
                                    <TableCell>Excluído por</TableCell>
                                    <TableCell>Excluído em</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {tarefasExcluidas.map((item) => (
                                    <TableRow key={`${item.tarefa_id}-${item.excluido_em}`}>
                                        <TableCell>{item.tarefa_titulo}</TableCell>
                                        <TableCell>{item.excluido_por?.nome ?? "—"}</TableCell>
                                        <TableCell>{new Date(item.excluido_em).toLocaleString("pt-BR")}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Typography variant="body2" color="text.secondary">Nenhuma tarefa excluída até agora.</Typography>
                )}
            </AppModal>
        </PageContainer>
    )
}
