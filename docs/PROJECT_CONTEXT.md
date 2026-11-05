# Orami — contexto de produto

Nome confirmado: **Orami**. Assinatura: **Seu cuidado, no seu ritmo.**
Este arquivo guarda intenção e decisões; regras de desenvolvimento em `AGENTS.md`,
implementação e limites nos docs de módulo. Estado revisado em 02/11/2026;
implementado no repositório não significa publicado.

## Direção e estado

Saúde, fitness e bem-estar com metas individuais justas, múltiplos grupos independentes
e dados pessoais privados. Entregar fatias pequenas, sem implementar o roadmap automaticamente.

Já há código de autenticação/perfil, treinos/metas, grupos/feed, medicamentos/suplementos,
alimentação/dietas/gasto energético, peso/medidas, cardio, injetáveis, bem-estar mental,
portal profissional, lembretes locais e observabilidade. Regras e limitações ficam,
respectivamente, em `authentication.md`, `workouts.md`, `groups.md`, `supplements.md`,
`nutrition.md`, `cardio.md`, `injectables.md`, `mental-wellbeing.md`, `portal.md`,
`notifications.md` e `observability-context.md` (todos em `docs/`).

## Metas e Home — decisões

- Meta configurável de treinos e dias planejados; semana de segunda a domingo.
- Dia planejado sem treino gera atraso, não reprovação antecipada. Treinos em outros dias da mesma semana compensam; total ≥ alvo cumpre a meta. Semana insuficiente só falha após encerrar.
- Exemplo: meta 3 em seg/ter/qua, realizados sex/sáb/dom → cumprida. Streak principal desejado: semanas consecutivas cumpridas, sem exigir presença diária.
- Preservar histórico/snapshot semanal é requisito desejado; o app ainda não tem snapshots completos de metas por semana (`portal.md`). Não presumir essa garantia ao alterar metas.
- Regras já confirmadas para sessões: marcação como realizada, várias no mesmo dia contam, retroativos e correções permitidos; `cancelled` não conta. Detalhes em `workouts.md`.
- Treinos têm contagem própria, separada dos checks/check-in da rotina. Iniciar, pausar, finalizar ou cancelar treino não altera o total de checks; a Home apresenta o treino na meta semanal e o resumo de notificações informa os treinos realizados hoje separadamente, inclusive fora dos dias planejados.
- Home resume treino **semanal**, medicamentos/suplementos **diários** por tomadas previstas (não quantidade de produtos), alimentação e alertas. Não confundir períodos nem inventar dados ausentes; linguagem sem punição/recomendação de dose.
- Horários, alterações de metas em semana aberta e exceções devem seguir o módulo existente; decisões ainda ausentes precisam ser esclarecidas na tarefa correspondente.

## Grupos e privacidade — decisões

- Múltiplos grupos privados com convites, membros/papéis e conteúdo isolado; Social agrega os posts em um feed único, identificado por grupo; destino da publicação explícito e troca de grupo acessível.
- Treino pertence ao usuário, sem cópia por grupo. Compartilhar depende de autorização específica por grupo; não replicar conteúdo automaticamente para todos.
- Feed: eventos de treino conforme preferências, texto/foto, reações, comentários, notificações e moderação. Fronteiras de acesso/retenção em `groups.md`.
- Dados de saúde fora de feed, logs, analytics e notificações sem consentimento. Acompanhamento profissional exige tipo + capacidade individual + vínculo ativo + consentimento granular, revogável e auditável; administração não concede acesso clínico automático.
- Modelos e prescrições preservam autoria/histórico; atualizar modelo não reescreve material atribuído. Não há prontuário/diagnóstico; respeitar competências profissionais.
- Peso e medidas são registros independentes, preservando mistos legados. Lembretes locais opcionais e isolados por conta; não equivalem a push remoto.

## Identidade

Ocean Fit, símbolo Onda, linguagem acolhedora e sem estética hospitalar/agressiva.
Fonte única de cores: `design/palette.json`; marca em `brand.md`.
App usa fonte do sistema e tema Claro/Escuro/Sistema local; web usa Inter/Manrope.
Não substitua a identidade durante reformulações de layout.

## Backlog — depende de pedido/priorização

- Fórum, desafios/rankings justos entre metas diferentes; evolução dos filtros do feed agregado existente.
- Composição corporal avançada, fotos privadas de evolução e comparações.
- Agenda genérica (consultas, exames, reuniões, avaliações, compromissos pessoais), categorias extensíveis e lembretes; não confundir com a agenda atual de rotina.
- Integrações externas e expansão das competências profissionais conforme consentimento/habilitação.
- Definir escopo/ordem das próximas releases, política de mudança da meta semanal e exceções como lesão/férias quando solicitadas.

Stack/mapa/comandos em `AGENTS.md` e arquivos de cada área; operação em
`deploy/README.md`, versão/publicação em `versioning.md`. Não carregar esses documentos
para tarefas que não dependam deles.
