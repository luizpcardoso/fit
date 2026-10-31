# Arquitetura

## Organização inicial

O projeto é um monorepo com aplicativo e API implantáveis separadamente.

## Fluxo de uma funcionalidade

```text
necessidade do usuário
  -> fluxo e tela do app
  -> estados da interface
  -> contrato de dados
  -> endpoint da API
  -> integração e testes
```

O aplicativo não importa modelos do banco. Contratos compartilhados representam apenas a fronteira pública da API.

## Autenticação

O app consome contratos públicos de `packages/contracts` por meio do cliente tipado em `packages/api-client`. A API Fastify persiste contas e sessões no MySQL por meio do Sequelize, aplica migrations versionadas na inicialização e usa access tokens curtos e refresh tokens opacos rotativos. Consulte `docs/authentication.md` para o fluxo e os endpoints.

O mesmo limite de confiança é aplicado a fichas e sessões de treino. Consulte `docs/workouts.md` para as regras confirmadas e o contrato HTTP.

Suplementos e seus consumos diários também pertencem exclusivamente ao usuário autenticado. Consulte `docs/supplements.md`.

O acompanhamento nutricional, gasto calórico e medidas corporais usa snapshots históricos e propriedade por usuário. Consulte `docs/nutrition.md`.

Grupos e feed social usam autorização por associação, consentimento individual por grupo e uma fronteira temporal de acesso. Consulte `docs/groups.md`.

Uma funcionalidade de produto só termina após a integração real entre tela e endpoint. Dados simulados podem apoiar a construção inicial da interface, mas não constituem a entrega final.

Alterações puramente visuais não geram endpoints sem propósito. Toda operação real de leitura ou mutação introduzida por uma funcionalidade deve possuir contrato e endpoint correspondentes.

## Limite de confiança

```text
aplicativo não confiável
  -> validação do contrato
  -> autenticação
  -> autorização do recurso
  -> regra de negócio na API
  -> persistência
```

A API nunca assume que ocultar um botão no aplicativo impede uma ação. Identidade, permissão, propriedade e regras de negócio são verificadas no servidor.

## Portal profissional

`apps/web` é compilado com TypeScript e servido pela mesma API em `/portal`. Compartilha contas e MySQL com o app. Os contratos profissionais ficam em `packages/contracts`; o cliente do app expõe consentimentos e planos recebidos. Papéis da plataforma não concedem acesso automático à saúde dos alunos: operações profissionais exigem a interseção de tipo, restrição individual, vínculo ativo e consentimento. Prescrições mantêm snapshots e autoria; alterações não reescrevem material entregue. Consulte `docs/portal.md` para fluxos, limites e validação.

Os novos access tokens incluem uma referência à sessão persistida. A API verifica sua validade mesmo antes do vencimento do JWT, permitindo revogação imediata em logout, suspensão e ativação de credencial definitiva. Sessões web mantêm tokens apenas em memória.

## Identidade visual compartilhada

A paleta Petróleo do app, home pública e gestor tem uma única fonte em
`design/palette.json`. Os grupos `light` e `dark` definem cores por função;
`brand` define superfícies de marca que mantêm contraste nas duas aparências.

Para mudar a identidade, edite esse arquivo e execute `npm run theme` na raiz.
O comando atualiza `apps/mobile/src/constants/palette.generated.ts`,
`apps/web/theme.css` e as cores nativas do splash/ícone em `apps/mobile/app.json`.
Versione os arquivos gerados junto com a fonte. O build web também gera o tema.
Depois recompile o web (`npm run build --workspace=@fit/web`) e recarregue o app;
alterações no splash/ícone nativo exigem uma nova build Android/iOS.

Componentes mobile usam `useAppTheme()` / `AppPalette`; estilos web usam os tokens
`--fit-*` e `--brand-*`, disponibilizados em `/theme.css`. Evite cores de marca
fixas nas telas. `primary` e `accent` aceitam texto branco; `secondary` é o destaque
menta e deve ser combinado com `primaryStrong` (texto escuro). A preferência
clara/escura do app permanece disponível; home e gestor seguem a do sistema.
