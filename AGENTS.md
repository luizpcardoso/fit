# Orami — instruções do projeto

App de saúde e fitness; monorepo npm. Produto, docs, erros e testes em pt-BR.
Trabalhe pela raiz deste repositório (`fit/`), que fica dentro da pasta de trabalho homônima.

## Leitura econômica

- Leia o `AGENTS.md` da área editada; consulte apenas docs e trechos relacionados à tarefa. Não carregue todo `docs/` nem releia regras já disponíveis na sessão.
- Este arquivo concentra regras gerais; os arquivos por área contêm somente complementos. `CLAUDE.md` é uma entrada alternativa, sem contexto duplicado.
- Intenção de produto/backlog: `docs/PROJECT_CONTEXT.md`. Implementação: código + doc do módulo. Registre divergências; não trate roadmap ou validação antiga como entrega atual.
- Atualize a fonte correspondente quando decisões mudarem; mantenha contextos com estado final, limites e comandos úteis, sem diário de execução, cópias de código ou contagens de testes que envelhecem.

## Entrega e decisões

- Comece pelo objetivo, fluxo e estados da tela; entregue interface → contrato → API → integração real e testes. Trate carregamento, vazio, erro, falta de conexão e sucesso quando aplicáveis. Mocks não concluem uma funcionalidade.
- Mudanças visuais, textos, navegação estática e refatorações não exigem endpoints artificiais. Evite APIs, campos e abstrações especulativas; implemente apenas a fatia solicitada.
- Pergunte antes de decisões sensíveis/irreversíveis ainda não autorizadas: permissões/visibilidade, exclusão/retenção/recuperação, pagamentos, uso de saúde/localização/fotos/contatos, serviços externos/custos/lock-in ou interpretações que alterem o fluxo principal. Resolva detalhes reversíveis pelos padrões existentes.
- Mudanças pequenas e verificáveis; atualize docs e `.env.example` quando necessário.

## Segurança e conclusão

- API é autoridade de negócio e autorização por recurso; derive identidade da sessão, nunca de `userId`/papel enviados pelo cliente. Menor privilégio, acesso negado por padrão, dados de saúde privados e compartilhamento explícito.
- Valide entrada/saída, formatos, limites, paginação e uploads; use SQL parametrizado/ORM, proteção contra abuso e erros sem SQL/stack traces/detalhes internos. Não exponha modelos do banco nos contratos.
- Nunca inclua segredos no cliente/`EXPO_PUBLIC_*`, Git ou logs; não registre tokens, senhas ou conteúdo de saúde. Tokens nativos em armazenamento seguro; limpe dados privados no logout. Não desative TLS/certificados nem force correções destrutivas de dependências sem revisão/testes.
- Antes de concluir funcionalidade, consulte `docs/security.md` e `docs/feature-checklist.md`. Verifique fluxo integrado, privacidade, acesso autorizado/não autenticado/de outra conta/sem papel e payload inválido; rode testes relevantes, typecheck e lint aplicáveis. Não declare verificações não executadas.
- Integrações MySQL/E2E usam banco isolado com `test` no nome; nunca execute `docker compose down -v` no servidor. Não versione `.env`, `deploy/runtime.env`, `deploy/data/`, APK/OTA ou keystores; assinaturas ficam fora do repo.

## Mapa e comandos

`apps/mobile` (Expo), `apps/api` (Fastify/MySQL), `apps/web` (portal/home), `packages/contracts` (Zod público), `packages/api-client` (HTTP tipado); `design/palette.json` é a fonte de cores.

- Desenvolvimento: `npm run api`, `npm run mobile`, `npm run mobile:web`, `npm run mobile:android`.
- Validação: `npm run typecheck` (regenera tema), `npm test`, `npm run lint --workspace=@fit/mobile`.
- SQL: `RUN_DB_TESTS=1 npm test` (integrações opcionais). Teste isolado: `node --import tsx --test apps/api/test/<arquivo>.test.ts`.
- E2E: `npm run test:e2e` (app); `npm run test:e2e --workspace=@fit/web` (portal, fontes em memória).
- Tema: edite `design/palette.json`, rode `npm run theme` e versione os gerados mobile/web/`app.json`. Não edite gerados manualmente.
- Ambiente: exemplos em `apps/api/.env.example` e `apps/mobile/.env.example`; dispositivo físico precisa de URL acessível para a API.

## Contexto por tarefa

| Tema | Ler quando relacionado |
| --- | --- |
| Treinos/metas | `docs/workouts.md`; treino semanal seg–dom, doses diárias |
| Corpo/alimentação | `docs/nutrition.md`; peso e medidas independentes, preservar registros mistos antigos |
| Lembretes/resumo | `docs/notifications.md`, `docs/daily-summary-notification.md`; preferências/agendas isoladas por conta |
| Portal | `docs/portal-workspace-context.md` primeiro; `docs/portal.md` para regras detalhadas |
| Telemetria/métricas/retenção | `docs/observability-context.md`; 30 dias de eventos / 12 meses de agregados, sem saúde ou identificação pessoal no painel |
| Outros módulos | `docs/{authentication,groups,supplements,cardio,injectables,mental-wellbeing,feedback}.md` conforme a área |
| UX/desempenho/marca | `docs/{navigation,mobile-performance,brand}.md` conforme a mudança |
| Operação/release | `deploy/README.md`, `docs/versioning.md`; alteração nativa exige APK, JS compatível pode usar OTA |
