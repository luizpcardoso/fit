# Ajustes do aplicativo — novembro de 2026

## Comportamento

- A home oferece um sino com o total de notificações não lidas de grupos e convites profissionais. Atualiza ao abrir a home e a cada minuto enquanto ela está em foco. O histórico reúne os dois tipos em ordem cronológica, com carregamento, vazio, erro e nova tentativa.
- Convites profissionais usam `/me/notifications` e `/me/notifications/:id/read`. A leitura é persistente e idempotente. Só o destinatário autenticado pode consultar ou marcar suas notificações. O histórico conserva convites respondidos, expirados ou encerrados; lista os 200 mais recentes, mas o contador considera todos. Abrir ou responder um convite marca sua notificação como lida.
- Em Mente, “Contabilizar check-in de saúde mental” salva uma preferência privada da conta em `PATCH /auth/me`. Ligada por padrão; desligar retira o check-in do total, das pendências da home e do resumo diário da API, preservando o diário. O lembrete local continua com sua configuração independente.
- Meus profissionais mostra cards compactos com nome, situação, validade do convite e áreas de acompanhamento. Gerenciar expande permissões e ações de consentimento; planos recebidos têm expansão própria. As permissões e os avisos de dados sensíveis foram preservados.
- Criar e editar fichas mantêm um único rascunho. Alterar campos de um exercício atualiza o rascunho imediatamente. Recolher, reordenar ou trocar de exercício/treino mantém os valores. Apenas o botão geral persiste a ficha. A validação aponta o exercício inválido e falhas de rede preservam o rascunho para tentar novamente. As proteções de navegação e fechamento da página continuam ativas enquanto houver alterações.
- O catálogo busca por nome, músculo ou equipamento, sem distinguir acentos ou maiúsculas; prioriza nomes correspondentes, limita a 60 resultados e mantém exercícios privados fora da busca global. Foram acrescentadas 21 variações de exercícios, incluindo roscas, antebraços, membros inferiores e abdômen.

## Banco e compatibilidade

As migrações 036–038 acrescentam `notification_read_at` aos vínculos profissionais, `count_mental_check_in` aos usuários (padrão verdadeiro) e os novos exercícios globais. O servidor aplica migrações ao iniciar; para aplicação explícita, usar `npm run db:migrate --workspace=@fit/api` no ambiente desejado. Os novos exercícios também entram no portal global quando já há uma conta administradora. Nenhum dado emocional é incluído nas notificações.

A ausência de `countMentalCheckIn` em respostas antigas é interpretada como preferência ligada. Os IDs existentes do catálogo e de exercícios de fichas são preservados.

## Validação

- `npm run typecheck` e `npm run lint --workspace=@fit/mobile`.
- `npm test`: regressões da API e dos contratos.
- MySQL isolado: `RUN_DB_TESTS=1 DB_NAME=<banco_de_testes> node --import tsx --test --test-concurrency=1 apps/api/test/exercise-search.integration.test.ts apps/api/test/professional-management.integration.test.ts apps/api/test/workout-configuration.integration.test.ts apps/api/test/workout-edit.integration.test.ts`.
- Playwright com API e Expo locais: `FIT_E2E_DB_NAME=<banco_de_testes> npx playwright test --config apps/mobile/playwright.config.ts app-modifications workout-configuration`. Verifica convites, leitura persistente, cards, preferência após recarregar, busca por bíceps e novos exercícios, criação/edição de fichas sem salvar exercícios individualmente, validação, retenção após falha e aviso de saída, em temas claro e escuro.

Os testes de interface usam React Native Web. Gestos e teclado do dispositivo físico não foram executados nesta validação.
