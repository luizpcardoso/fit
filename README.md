# Fit

Aplicativo de treinos, exercícios, metas e compartilhamento de progresso.

Este repositório usa uma estrutura de monorepo. O desenvolvimento é orientado pela experiência no aplicativo: primeiro a tela e seu fluxo, depois o contrato de dados e o endpoint necessário.

## Estrutura

- `apps/mobile`: aplicativo Expo/React Native.
- `apps/api`: backend, criado conforme as funcionalidades do app exigirem.
- `packages`: código compartilhado com limites explícitos.
- `docs`: visão do produto e decisões de arquitetura.

## Comandos

Instale as dependências e inicie a API:

```bash
npm install
npm run api
```

Em outro terminal, inicie o aplicativo:

```bash
npm run mobile
```

Swagger: `http://localhost:3333/docs`. Consulte `docs/authentication.md` para configurar o IP usado por um celular físico.

As migrations MySQL são executadas automaticamente ao iniciar a API. Para executá-las separadamente, use `npm run db:migrate --workspace=@fit/api`.

