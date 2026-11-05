# Arquitetura

Monorepo npm; aplicativo e API implantáveis separadamente. Mapa/comandos na raiz
`AGENTS.md`, padrões técnicos nos `AGENTS.md` de cada área. Versões efetivas em
`package.json`/lockfile; não duplicá-las em contextos.

## Fronteiras

`Tela/estados → contrato público → cliente tipado → API → persistência`.
App Expo/React Native consome `packages/api-client` e schemas Zod de
`packages/contracts`; não importa modelos do banco. API Fastify/Sequelize/MySQL
valida entrada, autentica, autoriza por recurso e executa negócio/persistência.
Migrations Umzug versionadas são aplicadas ao iniciar; não editar migrations aplicadas.
Entrega e segurança seguem `AGENTS.md` e `docs/security.md`.

## Sessões, dados e portal

Contas/sessões no MySQL; access JWT curto vinculado à sessão persistida e refresh
opaco rotativo. Logout/suspensão/ativação podem revogar acesso imediatamente.
Detalhes em `docs/authentication.md`.

Dados pessoais filtrados pelo proprietário; grupos exigem associação, consentimento
por grupo e fronteira temporal (`docs/groups.md`). Nutrição/corpo preservam snapshots
históricos (`docs/nutrition.md`).

`apps/web` (TypeScript compilado) é servido pela API em `/portal`, compartilhando
contas/banco. Tokens web somente em memória. Acesso profissional depende da interseção
de tipo, capacidade individual, vínculo ativo e consentimento. Prescrições preservam
snapshot/autoria; modelos atualizados não alteram material entregue. Leia
`docs/portal-workspace-context.md` e `docs/portal.md` para trabalhar nesse domínio.

## Identidade e operação

Paleta Ocean Fit em `design/palette.json`; `npm run theme` gera cores mobile,
`apps/web/theme.css` e cores nativas em `apps/mobile/app.json`. Versione gerados com
fonte. Mobile usa `useAppTheme()`; web usa `--fit-*`/`--brand-*`. Não fixe cores de marca.
Tema do app é preferência local; home/portal seguem sistema. Marca: `docs/brand.md`.
Mudança nativa exige novo APK; JS compatível pode ser OTA. Operação:
`deploy/README.md` e `docs/versioning.md`.
