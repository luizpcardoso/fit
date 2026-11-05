# Portal — contexto de trabalho

Estado no repositório em 02/11/2026; não comprova publicação. Leia antes dos fontes
grandes; detalhes de domínio em `docs/portal.md`. Atualize ao mudar navegação,
permissões, contratos ou limites, registrando o estado final.

## Fluxos e autorização

- Admin entra em **Métricas do app**; profissional em **Meus alunos** (ordem alfabética, busca sem acentos, filtros, indicadores e paginação). Convite em tela própria.
- **Painel do aluno** resume fichas/dietas/metas/orientações atribuídas neste vínculo, com acesso aos modelos e atribuição. Histórico separado de progresso; progresso exige `*.view`, independente de `manage`/`suggest`. Consulta inicial: 30 dias; alimentação: uma data.
- **Minhas fichas/dietas/metas/orientações**: modelos privados do ator. Editar modelo não altera planos atribuídos. Atribuir pelo painel ou biblioteca exige aluno autorizado, prévia, aceite/aplicação direta conforme capacidade e substituição explícita.
- Capas de fichas: catálogo ilustrativo fixo, sem upload; seleção exclusiva do admin em Fichas de treino, validada na API. Profissionais preservam a escolha ao editar outros campos; cópias/atribuições herdam a capa. Assets públicos genéricos, disponíveis offline no app.
- Imagens de exercícios: cadastro, substituição e remoção exclusivos do admin, inclusive quando o profissional possui `fitness.manage`; API e editor aplicam a mesma regra.
- Catálogos/listas globais na administração; profissionais mantêm acesso a exercícios/alimentos de referência nos editores. Melhorar UI não amplia permissões de saúde.
- Grupos: busca/status, criação própria e detalhe Participantes/Convidar/Configurações; ações por membro, proprietário protegido. Profissional lista apenas grupos próprios; admin lista todos, sem acesso novo ao feed privado.
- Autorização profissional combina conta ativa/ativada, tipo, capacidade individual, vínculo ativo e consentimento. Regras completas e limites clínicos em `portal.md`.

## Mapa

`apps/web/src/`: `management.ts` (navegação/DOM), `students.ts` (diretório/convite),
`library.ts` (modelos/atribuição/painel), `groups.ts` (gestão), `analytics.ts` (admin).
`apps/web/style.css`: responsividade. API em `apps/api/src/`: `portal.ts` (lista explícita
de assets; registre novos JS), `professional-management.ts` (vínculos/consentimento),
`portal-content.ts` (conteúdo/progresso/grupos). Consultas: `packages/contracts/src/portal.ts`.

## Contratos e limites

- `GET /portal/relationships`, `/portal/groups`, `/portal/content` retornam arrays em lotes de 200; `offset` opcional inteiro 0–1.000.000, padrão 0, ordem estável com ID como desempate. Conteúdo aceita `kind=workout&scope=private`; `scope=private|global` filtra no SQL antes do limite, junto da autorização.
- Portal percorre lotes e filtra/pagina localmente; não há busca remota por termo. Histórico de atribuições: 200; membros: 500. Convites de grupo: envio/confirmação, sem listagem de pendentes. Sem prontuário ou dados clínicos novos.
- Métricas, retenção e implantação da coleta pertencem a `docs/observability-context.md`; não duplicar definições aqui.

## Validação e operação

- `npm run typecheck`; `npm run test:e2e --workspace=@fit/web` (fontes transpilados em memória, fixtures só em testes: >200 alunos, atribuição, grupos, admin, falhas e 390px).
- MySQL isolado: `RUN_DB_TESTS=1 node --import tsx --test apps/api/test/professional-management.integration.test.ts apps/api/test/portal-contracts.test.ts apps/api/test/portal.test.ts`. Cria/remove dados sintéticos; revisar ambiente antes.
- `npm run build --workspace=@fit/web` gera `dist` ignorado; recompile antes de servir/publicar. Capturas ignoradas: `artifacts/ux-review/portal-*.png`.
- Verificação registrada em 02/11/2026: tipos, build web, navegador/390px e contratos/autorização/MySQL aprovados; atualização posterior de métricas validada sem novo build/publicação. Isso não substitui checks da próxima mudança. Homologação física continua pendente.
