"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Box,
    Button,
    Checkbox,
    MenuItem,
    Paper,
    Select,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material"
import { ArrowBack, Search } from "@mui/icons-material"
import { PageContainer, PageHeader, ContentCard } from "@/src/components/layout"
import { AppTextField } from "@/src/components/inputs/AppTextField"
import { showError, showSuccess } from "@/src/components/feedback/alert"
import requisicaoGlobal from "@/src/utils/requisicaoGlobal"
import { UrlsTarefasTrabalhistas } from "@/src/constants"

function normalizar(texto: string): string {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

type UsuarioResumo = { id: number; nome: string; email: string }
type UsuarioAcesso = { usuario: UsuarioResumo; nivel: string; notificar_criacao_email: boolean }
type AcaoPermitida = { nivel: string; acao: string }

const NIVEIS = [
    { valor: "ASSISTENTE", rotulo: "Assistente" },
    { valor: "ANALISTA_JR", rotulo: "Analista Jr" },
    { valor: "PLENO", rotulo: "Pleno" },
    { valor: "SENIOR", rotulo: "Sênior" },
    { valor: "GERENCIA", rotulo: "Gerência" },
    { valor: "DESENVOLVEDOR", rotulo: "Desenvolvedor" },
]

const ACOES = [
    { valor: "view", rotulo: "Ver" },
    { valor: "create", rotulo: "Criar" },
    { valor: "anexar", rotulo: "Anexar" },
    { valor: "comentar", rotulo: "Comentar" },
    { valor: "checklist", rotulo: "Checklist" },
    { valor: "assumir", rotulo: "Assumir" },
    { valor: "enviar_validacao", rotulo: "Enviar p/ validação" },
    { valor: "validar", rotulo: "Validar" },
    { valor: "reprovar", rotulo: "Reprovar" },
    { valor: "mover", rotulo: "Mover livremente" },
    { valor: "delete", rotulo: "Excluir" },
]

export default function PermissoesTarefasTrabalhistasPage() {
    const router = useRouter()
    const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([])
    const [matriz, setMatriz] = useState<Set<string>>(new Set())
    const [carregando, setCarregando] = useState(true)
    const [salvandoMatriz, setSalvandoMatriz] = useState(false)
    const [busca, setBusca] = useState("")

    const chave = (nivel: string, acao: string) => `${nivel}:${acao}`

    const carregar = useCallback(async () => {
        setCarregando(true)
        const [respUsuarios, respMatriz] = await Promise.all([
            requisicaoGlobal<UsuarioAcesso[]>({ rota: UrlsTarefasTrabalhistas.permissoesUsuarios, metodo: "get", mostrarMensagem: false }),
            requisicaoGlobal<AcaoPermitida[]>({ rota: UrlsTarefasTrabalhistas.permissoesMatriz, metodo: "get", mostrarMensagem: false }),
        ])
        if (respUsuarios.error) {
            showError("Sem acesso à administração da esteira", respUsuarios.error)
        }
        setUsuarios(Array.isArray(respUsuarios.data) ? respUsuarios.data : [])
        setMatriz(new Set((respMatriz.data ?? []).map((item) => chave(item.nivel, item.acao))))
        setCarregando(false)
    }, [])

    useEffect(() => {
        carregar()
    }, [carregar])

    const usuariosFiltrados = useMemo(() => {
        const termo = normalizar(busca.trim())
        if (!termo) return usuarios
        return usuarios.filter((u) =>
            normalizar(u.usuario.nome).includes(termo) || normalizar(u.usuario.email).includes(termo)
        )
    }, [usuarios, busca])

    const matrizComoLista = useMemo(
        () => Array.from(matriz).map((item) => {
            const [nivel, acao] = item.split(":")
            return { nivel, acao }
        }),
        [matriz],
    )

    const handleMudarNivel = async (usuarioId: number, novoNivel: string) => {
        const resp = await requisicaoGlobal<UsuarioAcesso>({
            rota: UrlsTarefasTrabalhistas.atualizarNivelUsuario.replace("[usuarioId]", String(usuarioId)),
            metodo: "patch",
            obj: { nivel: novoNivel },
            mostrarMensagem: false,
        })
        if (resp.error || !resp.data) {
            showError("Não foi possível mudar o nível", resp.error ?? undefined)
            return
        }
        setUsuarios((atual) => atual.map((u) => (u.usuario.id === usuarioId ? { ...u, nivel: novoNivel } : u)))
    }

    const handleToggleEmailCriacao = async (usuarioId: number, valor: boolean) => {
        const resp = await requisicaoGlobal<UsuarioAcesso>({
            rota: UrlsTarefasTrabalhistas.atualizarNivelUsuario.replace("[usuarioId]", String(usuarioId)),
            metodo: "patch",
            obj: { notificar_criacao_email: valor },
            mostrarMensagem: false,
        })
        if (resp.error || !resp.data) {
            showError("Não foi possível atualizar a notificação por e-mail", resp.error ?? undefined)
            return
        }
        setUsuarios((atual) => atual.map((u) => (u.usuario.id === usuarioId ? { ...u, notificar_criacao_email: valor } : u)))
    }

    const handleToggleAcao = (nivel: string, acao: string) => {
        setMatriz((atual) => {
            const proxima = new Set(atual)
            const k = chave(nivel, acao)
            if (proxima.has(k)) proxima.delete(k)
            else proxima.add(k)
            return proxima
        })
    }

    const handleSalvarMatriz = async () => {
        setSalvandoMatriz(true)
        const resp = await requisicaoGlobal({
            rota: UrlsTarefasTrabalhistas.permissoesMatriz,
            metodo: "put",
            obj: { permissoes: matrizComoLista },
            mostrarMensagem: false,
        })
        setSalvandoMatriz(false)
        if (resp.error) {
            showError("Não foi possível salvar a matriz", resp.error)
            return
        }
        showSuccess("Matriz de permissões atualizada")
    }

    return (
        <PageContainer>
            <PageHeader
                title="Permissões da Esteira"
                subtitle="Só quem é nível Desenvolvedor acessa esta tela"
                actions={
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBack />}
                        onClick={() => router.push("/rh/tarefas-trabalhistas")}
                    >
                        Voltar para as tarefas
                    </Button>
                }
            />

            {!carregando && (
                <>
                    <ContentCard sx={{ mb: 3 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, flexWrap: "wrap", gap: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                Nível de cada usuário
                            </Typography>
                            <AppTextField
                                size="small"
                                placeholder="Pesquisar por nome ou e-mail"
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                startIcon={<Search fontSize="small" />}
                                sx={{ minWidth: 280 }}
                            />
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                            {usuariosFiltrados.length} de {usuarios.length} usuários
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 480 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Usuário</TableCell>
                                        <TableCell>E-mail</TableCell>
                                        <TableCell>Nível</TableCell>
                                        <TableCell align="center">Avisar por e-mail quando criar tarefa</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {usuariosFiltrados.map((u) => (
                                        <TableRow key={u.usuario.id}>
                                            <TableCell>{u.usuario.nome}</TableCell>
                                            <TableCell>{u.usuario.email}</TableCell>
                                            <TableCell>
                                                <Select
                                                    size="small"
                                                    value={u.nivel}
                                                    onChange={(e) => handleMudarNivel(u.usuario.id, e.target.value)}
                                                >
                                                    {NIVEIS.map((n) => (
                                                        <MenuItem key={n.valor} value={n.valor}>{n.rotulo}</MenuItem>
                                                    ))}
                                                </Select>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Checkbox
                                                    checked={u.notificar_criacao_email}
                                                    onChange={(e) => handleToggleEmailCriacao(u.usuario.id, e.target.checked)}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </ContentCard>

                    <ContentCard>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                O que cada nível pode fazer
                            </Typography>
                            <Button variant="contained" onClick={handleSalvarMatriz} disabled={salvandoMatriz}>
                                Salvar
                            </Button>
                        </Box>
                        <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Nível</TableCell>
                                        {ACOES.map((a) => <TableCell key={a.valor} align="center">{a.rotulo}</TableCell>)}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {NIVEIS.filter((n) => n.valor !== "DESENVOLVEDOR").map((n) => (
                                        <TableRow key={n.valor}>
                                            <TableCell>{n.rotulo}</TableCell>
                                            {ACOES.map((a) => (
                                                <TableCell key={a.valor} align="center">
                                                    <Checkbox
                                                        checked={matriz.has(chave(n.valor, a.valor))}
                                                        onChange={() => handleToggleAcao(n.valor, a.valor)}
                                                    />
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell>Desenvolvedor</TableCell>
                                        {ACOES.map((a) => (
                                            <TableCell key={a.valor} align="center">
                                                <Checkbox checked disabled />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </ContentCard>
                </>
            )}
        </PageContainer>
    )
}
