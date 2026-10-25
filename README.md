# Fit

Aplicativo de treinos, exercícios, metas e compartilhamento de progresso.

Este repositório usa uma estrutura de monorepo. O desenvolvimento é orientado pela experiência no aplicativo: primeiro a tela e seu fluxo, depois o contrato de dados e o endpoint necessário.

## Estrutura

- `apps/mobile`: aplicativo Expo/React Native.
- `apps/api`: backend, criado conforme as funcionalidades do app exigirem.
- `packages`: código compartilhado com limites explícitos.
- `docs`: visão do produto e decisões de arquitetura.

## Comandos

Após a instalação do aplicativo:

```bash
npm run mobile
```

