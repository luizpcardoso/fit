# CLAUDE.md — contexto do repositório Fit

As regras de produto, segurança e critério de conclusão estão em `AGENTS.md` (raiz) e são obrigatórias:

@AGENTS.md

Cada pacote tem um `AGENTS.md` complementar (`apps/api`, `apps/mobile`, `packages/contracts`, `packages/api-client`) — leia o do pacote antes de editá-lo. Este arquivo resume o que existe no código; em caso de conflito, `AGENTS.md` e `docs/` prevalecem.

## Visão rápida

App fitness social (treinos, metas semanais, grupos com feed) evoluindo para super app de saúde (nutrição, medidas, suplementos/medicamentos, injetáveis, bem-estar mental, portal profissional). Nome comercial ainda indefinido. Idioma do produto, da documentação, das mensagens de erro e dos testes: **português (pt-BR)**.

Monorepo npm workspaces (`apps/*`, `packages/*`):

| Pasta | O que é |
| --- | --- |
| `apps/mobile` | Expo SDK 58 / React Native 0.88 / React 19, expo-router (rotas em `src/app`), alias `@/*` → `src/*`. Foco Android; também roda na web (usada nos testes E2E). |
| `apps/api` | Fastify 5 + Sequelize 6 (MySQL) + Zod 4, ESM executado via `tsx` (sem build). Migrations Umzug. |
| `apps/web` | Portal profissional + home pública, TypeScript puro compilado com `tsc`, servido pela API em `/portal`. |
| `packages/contracts` | Schemas Zod e tipos públicos da fronteira app↔API (`src/index.ts`, `portal*.ts`, `diet.ts`, `pagination.ts`…). |
| `packages/api-client` | `createApiClient()` tipado: refresh de token com deduplicação, cache curto de GETs, normalização de URLs `/media/…`. |
| `design/palette.json` | Fonte única da paleta (light/dark/brand). |
| `docs/` | Decisões de produto e regras por módulo (ver índice abaixo). |
| `deploy/`, `compose.server.yaml`, `Dockerfile` | Servidor caseiro (Docker + MySQL + nginx/ngrok) e OTA Android. |
| `scripts/` | `generate-theme.mjs`, `build-android-release.mjs`, `publish-android-update.mjs`. |

## Comandos

```bash
npm install
npm run api            # API em :3333 (aplica migrations ao iniciar); Swagger em /docs fora de produção
npm run mobile         # Expo; mobile:android, mobile:web
npm run typecheck      # todos os workspaces (roda `npm run theme` antes)
npm test               # testes da API (node:test via tsx)
RUN_DB_TESTS=1 npm test   # inclui *.integration.test.ts contra o MySQL do apps/api/.env
npm run test:e2e       # Playwright em apps/mobile/e2e contra o app web (FIT_E2E_WEB_URL, padrão http://127.0.0.1:8087)
npm run theme          # regenera tema a partir de design/palette.json
npm run lint --workspace=@fit/mobile
npm run build --workspace=@fit/web
npm run db:migrate --workspace=@fit/api
npm run portal:admin --workspace=@fit/api -- email@existente   # promove primeiro admin do portal
```

Um único teste: `cd apps/api && node --import tsx --test test/workouts.test.ts`.

Ambiente: copie `apps/api/.env.example` → `apps/api/.env` (DB_*, JWT_SECRET, MEDIA_DIR opcional) e `apps/mobile/.env.example` → `apps/mobile/.env` (`EXPO_PUBLIC_API_URL` com o IP da máquina para celular físico). Nunca coloque segredos em `EXPO_PUBLIC_*`.

## API (`apps/api/src`)

- `server.ts`: lê env, conecta MySQL, roda migrations, migra mídias legadas, agenda limpeza de fotos expiradas e monta `buildApp()` com repositórios Sequelize; registra portal, gestão profissional, conteúdo do portal e rotas OTA (`UPDATES_DIR`).
- `app.ts`: `buildApp(options)` — auth (`/auth/register|login|refresh|me|logout`), perfil social, avatar, `/health`, rate limit global (120/min, menores em auth), headers de segurança, error handler que devolve `{code, message, fieldErrors?}` sem detalhes internos. Os módulos só são registrados se o repositório correspondente for passado — é assim que os testes injetam fakes.
- Padrão por módulo: `<modulo>-repository.ts` (SQL/Sequelize, sempre filtrando por `userId`) + `<modulo>-routes.ts` (`registerXRoutes(app, repo, secure, ...)`, validação Zod com schemas de `@fit/contracts`, identidade sempre de `request.user.sub`). Recurso de outro usuário responde **404**, não 403.
- Módulos: workouts (+ metas semanais, validade de fichas, catálogo), supplements/medications (mesma tabela, discriminador `kind`), nutrition + diet + daily-energy, cardio, shortcuts (Home), mental-wellbeing, injectables, groups (feed, convites, papéis, moderação, fotos de 48h), feedback, portal / professional-management / portal-content.
- Auth: access JWT de 15 min contendo `sessionHash`, refresh opaco rotativo de 30 dias armazenado como SHA-256; hook `onRequest` revoga access tokens de sessões encerradas.
- Mídia: `media-storage.ts` grava WebP em `MEDIA_DIR` (padrão `apps/api/storage/media`) com chave UUID validada; imagens processadas com `sharp`.
- Migrations: `src/migrations/NNN-descricao.ts`, aplicadas em ordem de nome. Crie sempre a próxima numeração (atenção: já existem dois arquivos `005-*`). Nunca edite uma migration já aplicada.
- Testes: `apps/api/test/*.test.ts` usam `buildApp` + `app.inject` com repositórios fake/memória (`MemoryAuthRepository`); `*.integration.test.ts` são pulados sem `RUN_DB_TESTS=1`. Toda rota protegida precisa de casos de não autenticado, recurso de outro usuário e payload inválido.

## Mobile (`apps/mobile/src`)

- `app/_layout.tsx`: `Stack.Protected` separa telas autenticadas e `login`/`register`; tabs em `app/(tabs)` (Home/index, workouts, groups, nutrition, health, profile). Demais telas são rotas de pilha (`workout-run.tsx`, `group-detail.tsx`, `diet.tsx`…).
- `auth/auth-context.tsx`: `useAuth()` expõe `user`, ações de sessão e `api` (cliente tipado). Tokens em `expo-secure-store` no nativo (localStorage apenas no build web).
- Tema: `theme/theme-provider.tsx` → `useAppTheme()` com `colors` (`AppPalette`); preferência Claro/Escuro/Sistema local ao aparelho. Não usar cores fixas; `constants/palette.generated.ts` é gerado (não editar à mão).
- `hooks/` (`use-paged-data`, `use-health-routine`…), `utils/` (arquivos `.web.ts` substituem implementações nativas na web), `components/` (formulários, modais, cards reutilizáveis).
- Toda tela trata carregamento, vazio, erro e sucesso; consome a API somente via `@fit/api-client`.
- Diálogos e retorno: `showDialog`/`confirmAction`/`showToast` de `components/app-dialog.tsx`. Nunca use `Alert.alert` (no React Native Web ele não faz nada). Confirmações usam verbo + objeto ("Excluir ficha", não "Confirmar").
- Telas de pilha usam `components/screen-header.tsx` (Voltar com o nome do destino + atalho para o Início). Formulários com alterações pendentes registram `useUnsavedChanges` (`utils/unsaved-changes.ts`), que também cobre o voltar do Android.
- Para voltar a uma aba a partir de uma tela de pilha use `router.dismissTo('/rota')`, nunca `router.replace`, que empilha uma segunda instância das abas.
- Datas: `utils/dates.ts` (`formatRelativeDay`, `formatShortDate`, `formatSpokenDate`…); nunca exibir `YYYY-MM-DD`.
- Fundo de modal é irmão (absoluteFill) da folha, não pai: evita botões aninhados.
- Estados acessíveis com props `aria-*` (`aria-checked`, `aria-selected`, `aria-disabled`, `aria-busy`, `aria-expanded`): o React Native Web 0.21 ignora `accessibilityState`, e as `aria-*` também funcionam no nativo. Abas recebem o foco da navegação em `aria-selected`.
- Ícones: importe `MaterialCommunityIcons` de `@/components/icon` (decorativo, `aria-hidden`), nunca direto de `@expo/vector-icons`; botões só com ícone precisam de `accessibilityLabel`.

## Tema compartilhado

Tokens em `constants/theme.ts`: `Type` (escala tipográfica, mínimo 12), `Radius` (4/8/12/16/20/24/28/pill) e `Scrim` (fundo de modal). Cores sempre de `useAppTheme().colors`: `onPrimary` para conteúdo sobre a cor primária, `fieldBorder` para contorno de campos (3:1), `controlTrackOff`/`controlThumb` para interruptores. Alvos de toque com no mínimo 44×44.


Edite `design/palette.json` e rode `npm run theme`: atualiza `apps/mobile/src/constants/palette.generated.ts`, `apps/web/theme.css` e cores nativas em `apps/mobile/app.json`. Versione os gerados junto. Os scripts `start/web/android/ios` do mobile já regeneram. A doc antiga chama a paleta de "Ocean Fit"; a atual em `design/palette.json` é a "Petróleo".

## Fluxo para uma nova funcionalidade

1. Ler o doc do módulo em `docs/` e `docs/feature-checklist.md`.
2. Tela/estados no app → schema em `packages/contracts` → método em `packages/api-client` → repositório + rotas na API (+ migration) → registrar em `app.ts`/`server.ts` → testes (unitário com fake + integração quando houver SQL) → atualizar o doc do módulo.
3. Rodar `npm run typecheck`, `npm test` (e `RUN_DB_TESTS=1` se mexeu em SQL) e lint do mobile.

Perguntar ao usuário antes de decidir visibilidade/privacidade, exclusão/retenção, dados sensíveis de saúde, integrações externas ou interpretações que mudem o fluxo (ver "Perguntas obrigatórias" em `AGENTS.md`).

## Índice de docs

`PROJECT_CONTEXT.md` (visão e regras de produto, meta semanal flexível), `architecture.md`, `security.md`, `feature-checklist.md`, `authentication.md`, `workouts.md`, `supplements.md`, `nutrition.md`, `cardio.md`, `groups.md`, `injectables.md`, `mental-wellbeing.md`, `portal.md`, `feedback.md`, `navigation.md`, `mobile-performance.md`, `ux-ui-review.md`, `product.md`. Operação do servidor, APK e OTA: `deploy/README.md`.

## Convenções e cuidados

- Código compacto e denso (muitas rotas em uma linha); siga o estilo do arquivo que está editando.
- Regras de negócio e permissões ficam na API; o app nunca envia `userId` para identificar o dono.
- Metas de treino são **semanais** (seg–dom, contam treinos de qualquer dia da semana); contadores de medicamentos/suplementos são **diários**.
- Dados de saúde são privados por padrão; nada vai para feed, logs ou notificações sem consentimento. Portal profissional exige tipo + capacidade individual + vínculo ativo + consentimento.
- Testes MySQL e E2E: use um banco com `test` no nome. `ux.integration.test.ts` exige o `.env` carregado no shell. O Metro pode manter `EXPO_PUBLIC_API_URL` de `apps/mobile/.env.local` em cache; os E2E reescrevem chamadas a `:3333` para `FIT_E2E_API_URL`.
- Mudanças nativas (SDK Expo, libs nativas, `app.json`, certificado) exigem novo APK; mudanças JS compatíveis podem sair por OTA (`scripts/publish-android-update.mjs`). Chaves de assinatura vivem fora do repo (`~/.local/share/fit/`).
- Não versionar `.env`, `deploy/runtime.env`, `deploy/data/`, `artifacts/android|ota`, keystores.
- Nunca rodar `docker compose down -v` no servidor (apaga o banco).
