# Task Management — Esteira de Tarefas Trabalhistas

Kanban de controle de tarefas do setor trabalhista (RH), construído como parte
de uma plataforma interna maior de automações (monorepo Django Ninja +
Next.js) para uma empresa de médio porte. Este repositório contém um recorte
anonimizado do código-fonte real dessa funcionalidade — nomes de empresa,
e-mails e domínios foram removidos/substituídos por placeholders.

> Como é um recorte de um monorepo privado, alguns imports referenciam
> módulos internos (autenticação, permissões multiempresa, integração com
> Microsoft Graph, etc.) que não fazem parte deste repositório — o código
> não roda isoladamente, mas reflete fielmente os padrões usados em produção.

## O que a ferramenta faz

- Kanban com 4 colunas (Falta assumir → Executando → Validar → Finalizada),
  com drag-and-drop.
- Sistema de nível de acesso **próprio da rotina** (Assistente → Analista Jr
  → Pleno → Sênior → Gerência → Desenvolvedor), com uma matriz nível × ação
  editável pela própria tela de administração — sem depender do RBAC
  genérico da plataforma.
- Prioridade por tarefa (Baixa/Média/Alta), com as mais urgentes sempre no
  topo de cada coluna.
- Anexos, checklist de subtarefas, comentários (com suporte a colar
  print/imagem direto no chat) e um log de auditoria que **sobrevive à
  exclusão da tarefa** (por decisão de design, não tem FK para o registro
  pai).
- Duplicação de tarefa e histórico de tarefas excluídas.
- Notificações automáticas por e-mail: na criação (lista configurável),
  na validação/reprovação (com motivo), lembrete de prazo próximo (D-1) e
  aviso de atraso para quem criou a tarefa — via tasks assíncronas
  (Celery) com templates HTML responsivos.
- Filtro/busca por texto, prioridade e tarefas vencidas.

## Stack

- **Backend:** Django + Django Ninja (API tipada com Pydantic), Celery +
  Redis/RabbitMQ para tarefas assíncronas e agendadas, PostgreSQL.
- **Frontend:** Next.js (App Router) + TypeScript + MUI, `@dnd-kit` para o
  drag-and-drop do kanban.

## Estrutura

```
backend/
  rh/models/        modelos (tarefa, níveis de acesso, log de auditoria)
  rh/schemas/        contratos de entrada/saída da API (Pydantic/Ninja)
  rh/services/       regras de negócio (máquina de estados, permissões)
  rh/permissions/    decorators de autorização própria da rotina
  rh/views/          endpoints (Django Ninja router)
  rh/tasks/          e-mails e lembretes assíncronos (Celery)
  rh/tests/          suíte de testes (Django TestCase)
  rh/migrations/     migrações do modelo de dados
  management/        comando de seed do sistema de permissões

frontend/
  pages/kanban-page.tsx              tela principal (kanban + dashboard)
  pages/permissoes/permissoes-page.tsx  administração de níveis e matriz
```

## Alguns detalhes de engenharia que valem destaque

- **Log de auditoria sem FK**: `TarefaTrabalhistaLog` guarda `tarefa_id`
  como texto solto (não `ForeignKey`) de propósito — é o único jeito de
  saber quem excluiu o quê depois que a tarefa (e tudo que tem FK pra ela)
  já foi removida em cascata.
- **Validação de transição de estado**: a máquina de estados confere não só
  se o par (status atual → novo status) é válido, mas se ele é *dono* da
  ação que o endpoint já autorizou — evita que alguém explore dois
  endpoints diferentes que levam ao mesmo status para escalar privilégio.
- **Lembretes idempotentes**: a rotina diária de prazos (D-1 e atraso)
  registra no próprio log que já avisou — reprocessar o dia não duplica
  e-mail.
- **Sistema de permissão isolado**: em vez de reaproveitar o RBAC
  multiempresa da plataforma (pensado para outro escopo), a rotina tem seu
  próprio nível de cargo, global, com bypass total para o nível máximo —
  decisão tomada depois que o modelo genérico se mostrou inadequado para
  uma ferramenta usada pela empresa inteira de uma vez.
