# API — complemento da raiz

Fastify + Sequelize/MySQL + Zod, ESM via `tsx`, migrations Umzug; versões em `package.json`.

- `src/app.ts`: `buildApp(options)`, módulos registrados quando recebem repositório; testes usam `app.inject` e fakes (`MemoryAuthRepository`). Erro público: `{code, message, fieldErrors?}`.
- `src/server.ts`: ambiente, banco, migrations, mídias, limpezas e registro de portal/OTA. Novo módulo precisa da ligação correspondente nos dois arquivos.
- Padrão: `<modulo>-repository.ts` para SQL filtrado por proprietário; `<modulo>-routes.ts` para rotas e schemas de `@fit/contracts`. Identidade: `request.user.sub`; recurso alheio normalmente retorna 404. Preserve exceções documentadas por módulo.
- Selecione apenas campos públicos; mantenha compatibilidade ou documente quebra. Transações quando necessário; revise concorrência, repetição e idempotência nas mutações.
- Migrations `src/migrations/NNN-descricao.ts`: consulte a próxima numeração (há dois `005-*`); nunca edite migration aplicada. `npm run db:migrate --workspace=@fit/api`.
- Auth: JWT 15 min com `sessionHash`, refresh opaco rotativo 30 dias salvo como SHA-256; `onRequest` verifica revogação. Detalhes: `docs/authentication.md`.
- Limite global de 120 req/min contado por conta quando o token é válido (`user:<id>`) e por IP nas demais requisições; rotas de login/cadastro mantêm limites próprios por IP. Erros 4xx do Fastify mantêm o status; 5xx gravam no stderr só método, rota (modelo), tipo e código do erro, sem mensagem, ids ou conteúdo.
- Mídia: `media-storage.ts`, UUID validado, WebP via sharp, `MEDIA_DIR` (padrão `apps/api/storage/media`). Novos assets web precisam da lista explícita em `src/portal.ts`.
- Testes em `test/*.test.ts`; integrações normalmente exigem `RUN_DB_TESTS=1`. Consulte o teste antes de executar: alguns criam banco temporário, outros usam o configurado; sempre isole de produção. `ux.integration.test.ts` exige ambiente carregado no shell.
