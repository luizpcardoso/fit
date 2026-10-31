# Revisão UX/UI — 30/10/2026

## A. Resumo executivo

Implementadas as 13 frentes da atividade no aplicativo Expo e na API Fastify. Preservadas as alterações que já estavam no repositório. A validação cobre API com MySQL isolado, navegador Chromium e layouts responsivos. A homologação nativa em Android/iOS permanece pendente; não foi executado build nativo nem teste com teclado virtual real.

Correções principais: compartilhamento de treino sem acesso a atividade nula, exclusão lógica de medicamentos/suplementos preservando tomadas, conclusão diretamente na Home, listagens paginadas no servidor e acompanhamento de consumo alimentar com meta opcional.

## B. Checklist

“Concluída” abaixo refere-se ao fluxo implementado e validado em web/API. A ressalva de homologação nativa aplica-se à entrega como um todo.

| ID | Entrega | Status | Arquivos principais e observações |
|---|---|---|---|
| 01 | Excluir medicamentos/suplementos | Concluída | `health-routine.tsx`, `confirm-dialog.tsx`, `supplement-{routes,repository}.ts`, migration 031. Confirmação cancelável, exclusão lógica, tomadas preservadas, cadastro não reativável por PATCH. |
| 02 | Switch no escuro | Concluída | `health-item-form.tsx`, `constants/theme.ts`. Trilha, indicador e estado acessível explícitos; texto ativo/pausado preservado. |
| 03 | Guia corporal | Concluída | `body-measurement-guide.tsx`, `nutrition-forms.tsx`. SVG gerado localmente, regiões selecionáveis e seleção pelo foco do campo; orientação textual, direita/esquerda do próprio corpo. Campos existentes, sem adicionar panturrilha inexistente. |
| 04 | Histórico corporal paginado | Concluída | `body-measurements.tsx`, `nutrition-{routes,repository}.ts`, `pagination.tsx`. Cinco registros, ordenação por data/criação/id, resumo mais recente independente da página, página válida após exclusão. |
| 05 | Controles fixos e cinco registros | Concluída | `health-routine.tsx`, `use-paged-data.ts`, `supplement-repository.ts`. Cabeçalho externo à lista, filtros reiniciam página, lista com rolagem própria. Cabeçalho compacto em alturas menores. |
| 06 | Gráfico em modal | Concluída | `injectables.tsx`. Seleção entre injetáveis, tratamento de erro e ausência de meia-vida/aplicações, cancelamento de respostas antigas. Cálculo existente preservado. |
| 07 | Remover ação duplicada | Concluída | `mental-wellbeing.tsx`. Removido “Fazer check-in”; ação do card preservada e nomeada “Como se sente hoje?”. Histórico e persistência mantidos. |
| 08 | Alimentação mais direta | Concluída | `food-tracking.tsx`, `nutrition-forms.tsx`, `daily-nutrition-card.tsx`. Totais diários, atalhos para nomes, horário atual, busca de alimentos, confirmação de exclusão também na web e feedback sem pergunta obrigatória sobre favoritas. |
| 09 | Crash ao compartilhar treino | Concluída | `share-activity-modal.tsx`, `workout-run.tsx`, `workout-routes.ts`, `group-{routes,repository}.ts`. Conteúdo desmontado quando atividade vira null, bloqueio síncrono de envio, erro recuperável, consentimento explícito por grupo e transação. |
| 10 | Conclusão na Home | Concluída | `(tabs)/index.tsx`. Tomadas usam o endpoint existente, atualizam após confirmação e bloqueiam cliques repetidos. Detalhes e conclusão são controles separados. Eventos que exigem mais dados mantêm seu fluxo próprio. |
| 11 | Atalho Saúde Mental | Concluída | `home-shortcuts.tsx`, `shortcut-repository.ts`, contratos, migration 033. Adição única às preferências existentes, limite ampliado de quatro para cinco; edições posteriores continuam livres. |
| 12 | Notificações com contraste | Concluída | `constants/theme.ts`, `(tabs)/index.tsx`, `group-notifications.tsx`. Tokens semânticos, borda e texto de destaque, estado “Nova” também textual/acessível. |
| 13 | Card calórico e registro rápido | Concluída | `home-nutrition.tsx`, `daily-nutrition-card.tsx`, `nutrition-goal.ts`, migration 032. Meta privada opcional, consumido/restante/progresso e mesmo formulário de refeições. |

## C. Alterações técnicas

### Contratos e endpoints

- Novos `GET /medications/page`, `GET /supplements/page` e `GET /body-measurements/page`. Os GET antigos continuam disponíveis com seu formato anterior.
- Paginação limitada (1–50), padrão de cinco, página limitada e ordenação com desempate por id. Contagem e consulta são executadas na mesma transação. Busca usa parâmetros SQL e trata caracteres como texto literal.
- Novos `DELETE /medications/:id`, `DELETE /supplements/:id`: propriedade e tipo verificados sob lock; `deleted_at` e `active=0` são gravados juntos.
- Novo `PUT /nutrition/goal` aceita `targetCalories` inteiro positivo ou null para remover. O resumo existente ganhou `consumptionGoal` sem retirar campos anteriores.
- `POST /workout-sessions` aceita `shareAutomatically` opcional. O app envia false e oferece seleção explícita; consumidores antigos mantêm as preferências de compartilhamento já autorizadas.
- `POST /groups/share-activity` verifica propriedade da atividade e todos os grupos antes de inserir. Falha de permissão retorna 403/404; a operação inteira é transacional. O índice único existente impede duplicação por origem/grupo, inclusive em concorrência.

### Persistência e regras

- Migration 031: `deleted_at` em suplementos/medicamentos e índices para paginação de cadastros e medidas.
- Migration 032: tabela privada `nutrition_goals` vinculada ao usuário.
- Migration 033: acrescenta Saúde Mental uma única vez às preferências já persistidas, sem apagar os atalhos anteriores.
- Correção necessária para instalação limpa: migration 008 agora ignora seeds já existentes, inseridos pela 007. O erro foi reproduzido em MySQL local antes do ajuste.
- A meta de consumo é uma configuração atual do usuário, não uma prescrição calculada nem um snapshot diário. `restante = meta − consumido`; acima da meta aparece como excedente e o progresso visual é limitado a 100%.
- O saldo antigo (`consumo − gasto`) permanece no módulo nutricional. Calorias de exercício não são adicionadas à meta alimentar.
- Não havia agendador de notificações de medicamentos/suplementos neste código. A programação diária deriva dos cadastros ativos; itens excluídos deixam de entrar nela. A notificação local existente é a de Saúde Mental e foi preservada.
- Nova dependência apenas de desenvolvimento: Playwright, para regressão E2E e capturas responsivas. Nenhuma biblioteca nova foi adicionada ao bundle do aplicativo.

## D. Matriz de testes

| Verificação | Resultado | Evidência |
|---|---|---|
| Baseline antes das edições | Passou | Typecheck; 32 testes passaram e 9 integrações foram inicialmente ignoradas por configuração. |
| Migrations em MySQL 8 isolado | Passou | Incluindo 031–033. Detectada e corrigida duplicação preexistente da migration 008. |
| `npm run typecheck` | Passou | API, mobile, portal, cliente e contratos. |
| `npm run lint --workspace=@fit/mobile` | Passou | Sem erros ou warnings na execução final. |
| `RUN_DB_TESTS=1 npm test` | Passou | 45 testes; 0 falhas e 0 ignorados. Inclui regressões e todas as integrações existentes. |
| E2E Playwright | Passou por cenário: 8/8, em execuções completas e direcionadas | Compartilhamento com falha e nova tentativa, exclusão, paginação, Home/refeição, injetáveis, Saúde Mental, medidas e capturas. |
| Build Expo web | Passou | Exportação de produção com API local de teste. |
| `npm run build --workspace=@fit/web` | Passou | Portal TypeScript. Não existe script de build separado para API. |
| `git diff --check` | Passou | Revisão adicional comparou os arquivos com o backup anterior, pois grande parte do projeto já era untracked. |
| `npm audit --json` | Alertas | 11: 4 high, 2 moderate, 5 low. Sem correção forçada. |
| Android/iOS nativos | Não executado | Sem dispositivo/emulador nesta validação. |

Testes novos: `ux-workout.test.ts`, `ux-rules.test.ts`, `ux.integration.test.ts` e `apps/mobile/e2e/ux.spec.ts`.

Integração cobre exclusão e histórico, reativação indevida, ownership, medicamentos versus suplementos, 12 registros por tipo, busca paginada, ordenação de datas empatadas, correção de página após exclusão, meta ausente e configurada, alteração/exclusão de refeição, usuário externo, grupo não autorizado e três compartilhamentos concorrentes sem duplicar publicação.

Os testes E2E usam contas geradas apenas na API local. O limite real de autenticação permanece ativo; o teste respeita `Retry-After` e espaça as execuções se os limites de autenticação ou do restante da API forem atingidos. Nenhum controle de produção foi desabilitado.

### Evidência E2E final

A rodada completa aprovou seis cenários; os dois restantes foram corrigidos e repetidos com sucesso. A última rodada direcionada aprovou medicamentos/switch, medidas/guia e capturas Home/Alimentação (3/3). A execução direcionada anterior também confirmou falha de persistência na Home sem marcação falsa e nova tentativa bem-sucedida. Não foi executada outra rodada completa de oito após esses ajustes finais. Isso corresponde a oito cenários distintos com execução aprovada, sem apresentar uma única rodada completa como 8/8.

Foram detectados e corrigidos: papéis de botão ausentes, estado marcado não exposto na web, seletor de imagem acessível no teste, propriedade web específica da cor do indicador do switch e ritmo de requisições dos testes. Houve respostas 429 legítimas em execuções iniciais; o teste passou a respeitar os limites existentes.

### Inspeção visual e contraste

Capturas locais em `artifacts/ux-review/`: dez de medicamentos (dois temas × cinco larguras), switch escuro, guia corporal e Home/Alimentação claro/escuro. Foram inspecionadas imagens, além das verificações automatizadas. A inspeção encontrou título quebrando a última letra em 320 px e sobreposição parcial do botão Home com Cadastrar; ambos corrigidos com tipografia responsiva e altura reservada na linha de voltar.

Medição dos tokens finais (razão WCAG): texto de notificação 7,25:1 claro e 9,36:1 escuro; borda destacada 4,71:1 e 3,36:1; indicador/trilha do switch inativo 4,54:1 e 5,42:1, ativo 5,35:1 e 11,81:1. Isso verifica os pares escolhidos, sem constituir certificação WCAG do aplicativo inteiro.

## E. Segurança e qualidade

- Sessão JWT e identidade derivada pelo servidor; operações privadas usam `user_id`, nunca proprietário fornecido pelo app.
- Exclusão lógica preserva chaves estrangeiras e histórico e impede novas tomadas/reativação do item excluído.
- Compartilhamento explícito, sem grupo pré-selecionado; locks e índice único protegem concorrência e repetição.
- Falha social não invalida treino já persistido. Interface não marca conclusão como confirmada antes da resposta da API.
- Respostas antigas de paginação e gráfico não substituem uma seleção mais recente.
- Sem alterações em credenciais, `.env`, produção ou infraestrutura remota. Banco e contas de teste isolados.
- Auditoria de dependências continua com alertas, incluindo cadeia do Expo, node-forge e dependências transitivas de Sequelize. As recomendações automáticas incluem mudança de versão principal/downgrade; precisam de atualização de stack separada com compatibilidade verificada.

## F. Pendências e limites

- Homologar Android/iOS, teclado virtual, safe areas reais, leitor de tela nativo, escala de fonte do sistema e gestos.
- Não foram simuladas todas as combinações da matriz extensa de falhas: timeout real, navegação durante cada salvamento e todas as modalidades de sessão expirada exigem cobertura adicional. Há testes de autenticação/ownership e falhas recuperáveis nas operações críticas.
- Auditoria de dependências permanece com os 11 alertas descritos; nenhuma atualização incompatível foi aplicada.
- A meta alimentar pode ser definida pelo usuário; o aplicativo não recomenda valor. Caso seja necessário histórico de metas por dia, essa regra precisa de uma evolução própria.

## G. Como validar localmente

Verificações sem banco:

```bash
npm run typecheck
npm run lint --workspace=@fit/mobile
npm test
npm run build --workspace=@fit/web
npm audit
```

Para integrações, use um MySQL **exclusivo de testes**, com nome contendo `test`, e exporte `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_SSL=false`. Não aponte para o banco normal do aplicativo.

```bash
npm run db:migrate --workspace=@fit/api
RUN_DB_TESTS=1 npm test
```

Para E2E, inicie a API com esse mesmo banco:

```bash
HOST=127.0.0.1 PORT=33317 MEDIA_DIR=/tmp/fit-ux-media npm run start --workspace=@fit/api
```

Exporte o app e sirva o resultado:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:33317 npm exec --workspace=@fit/mobile -- expo export --platform web --output-dir .ux-web
# Em apps/mobile:
npx expo serve .ux-web --port 8087
# Na raiz, em outro terminal:
npx playwright install chromium
npm run test:e2e
```

As migrations são aplicadas automaticamente na inicialização normal da API. Publicar requer entregar API, contratos/cliente e app de forma compatível, com as migrations executadas antes do novo app.

Referências de validação: [WCAG 2.2 — contraste não textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast), [WHO STEPS — protocolo de medidas](https://cdn.who.int/media/docs/default-source/ncds/ncd-surveillance/steps/part3.pdf?sfvrsn=9bb0f167_2), [Playwright](https://playwright.dev/docs/intro).

### Revisão de badges, avatares e ícones no tema escuro

O par `primaryStrong`/`primarySoft` tinha contraste de apenas 1,08:1 no escuro. O token `onPrimarySoft` agora identifica conteúdo sobre fundos suaves: contraste de 9,02:1 no claro e 7,77:1 no escuro. A correção inclui o avatar e o badge de papel em Grupos (texto do badge ampliado para 11), iniciais nos comentários, membros e avisos de configurações. Ícones e indicadores que usavam a cor primária de preenchimento sobre superfícies temáticas passam a usar `link`, que se adapta ao tema. Foram revisados também Home, atalhos, Fitness, saúde, perfil, modais e estados vazios/carregamento. Conteúdo escuro sobre botões brancos ou fundos menta mantém sua combinação apropriada.

`npm run theme` verifica contraste mínimo de 4,5:1 dos pares de conteúdo definidos antes de gerar os tokens do app e do portal. O teste E2E Grupos verifica as cores efetivamente renderizadas do avatar e do badge nos dois temas e registra capturas em 390 px. Esses controles protegem os pares revisados, sem representar certificação de todas as combinações do aplicativo.

## Campos, teclado e balanço calórico

Os formulários do app usam `FormInput`: cores do tema, placeholder, seleção, cursor, altura mínima e fonte de pelo menos 16 px para evitar zoom automático no iOS web. `FormScrollView` mantém os toques nos controles com teclado aberto e usa insets nativos quando a tela não possui `KeyboardAvoidingView`. O Android usa `softwareKeyboardLayoutMode: resize`; o modal de comentários agora inclui reposicionamento no iOS. No navegador, `useWebKeyboard` acompanha `visualViewport`, limita a altura de páginas/modais e revela o campo focado somente quando ele fica fora da área visível, sem remount de inputs.

O card de balanço da Home usa a lista de refeições do resumo diário para apresentar “Registre ao menos uma refeição para começar a calcular seu balanço calórico.”. Esse estado só aparece após carregar com sucesso um período vazio. Carregamento e erro mantêm apresentações próprias; uma refeição de zero calorias também encerra o estado vazio. Com refeições, o valor permanece calculado pela API.

Validação automatizada inclui contratos e controles, concorrência e isolamento em MySQL, e Playwright em temas claro/escuro com largura de 320/390 px. O teclado físico/virtual de aparelhos Android e iOS exige uma verificação manual adicional; redimensionamento de navegador não reproduz integralmente os teclados nativos.

### Arquivos desta implementação

- Infraestrutura de formulários: `apps/mobile/src/components/form-input.tsx`, `form-scroll-view.tsx`, `auth/auth-shell.tsx`, `apps/mobile/src/hooks/use-web-keyboard.ts`, `apps/mobile/src/app/_layout.tsx` e `apps/mobile/app.json`.
- Fichas: `apps/mobile/src/app/workout-create.tsx`, `apps/mobile/src/components/workout-stepper.tsx`, `exercise-thumbnail.tsx`, `professional-plans.tsx`, `floating-home-button.tsx` e `apps/mobile/src/utils/workout-controls.ts`.
- Balanço: `apps/mobile/src/components/home-energy-card.tsx`.
- Telas migradas para campos/rolagem compartilhados: `login.tsx`, `register.tsx`, `feedback.tsx`, `profile-details.tsx`, `session-edit.tsx`, `mental-wellbeing.tsx`, `health-routine.tsx`, `group-detail.tsx`, `group-manage.tsx`, `group-post.tsx` e `(tabs)/groups.tsx`, em `apps/mobile/src/app/`.
- Formulários migrados em `apps/mobile/src/components/`: `cardio-section.tsx`, `health-item-form.tsx`, `injectable-form.tsx`, `nutrition-forms.tsx`, `daily-nutrition-card.tsx`, `diet-meal-form.tsx` e `validity-picker.tsx`.
- Contrato e persistência: `packages/contracts/src/index.ts`, `apps/api/src/workout-repository.ts` e `apps/api/src/migrations/034-workout-create-request.ts`.
- Testes novos: `apps/api/test/workout-configuration.test.ts`, `workout-configuration.integration.test.ts` e `apps/mobile/e2e/workout-configuration.spec.ts`.
- Documentação: este arquivo e `docs/workouts.md`.

### Resultado da validação

`npm run typecheck` e `npm run lint --workspace=@fit/mobile` aprovados. A suíte completa, incluindo todos os testes opcionais de banco, passou com **53 testes aprovados e nenhum ignorado** em MySQL isolado. O teste Playwright passou nos dois temas (**2 cenários aprovados**), usando API e banco reais para persistência, catálogo, biblioteca e nutrição. A interceptação de rede é usada somente para provocar falhas temporárias e verificar recuperação, e para encaminhar a origem de desenvolvimento ao servidor isolado.

Os cenários verificam as três entradas de ficha, estado vazio do personal, busca e seleção, miniatura/ampliação, séries, faixa de repetições, carga decimal, largura de 320 px, botão de salvar visível, confirmação de saída, rascunho após erro, repetição segura do salvamento, criação pela biblioteca e balanço sem refeições/com refeições/com falha de carregamento. Capturas locais ficam em `artifacts/ux-review/workout-{light,dark}-{sources,editor,nutrition}.png` (ignoradas pelo Git).

Para repetir os testes de banco, configurar as credenciais habituais e `RUN_DB_TESTS=1`, apontando `DB_NAME` para um banco exclusivo de testes com migrações aplicadas. O teste `ux.integration.test.ts` preexistente exige credenciais já carregadas no ambiente. Para Playwright, definir `FIT_E2E_DB_NAME`, `FIT_E2E_API_URL` e `FIT_E2E_WEB_URL` para os serviços isolados; `MEDIA_DIR`, quando usado, deve ser igual no servidor e nos testes. Iniciar Expo em `CI=1` evita que a geração dos artefatos de teste reinicie o bundle durante a execução.

### Simplificação da configuração de fichas

`WorkoutExerciseCard` (`apps/mobile/src/components/workout-exercise-card.tsx`) apresenta o resumo compacto e os controles de um único exercício expandido. `workout-create.tsx` mantém separadamente a cópia em edição e o rascunho confirmado da ficha. O salvamento local valida `workoutExerciseInputSchema` e nunca persiste isoladamente um exercício.

O teste `workout-configuration.spec.ts` foi adaptado para cobrir campos inicialmente ocultos, expansão acessível, validação local, proteção ao trocar de card, cancelamento, reabertura, reordenação e ausência de fichas na API após “Salvar exercício”. A persistência final continua sendo verificada com API e banco isolados reais, nos dois temas.

A verificação de foco também identificou que o `on-drag` do React Native Web fecha o teclado em rolagens programáticas. `FormScrollView` agora mantém `keyboardDismissMode="none"` na web, preservando foco ao revelar automaticamente o campo; o comportamento nativo permanece igual.

Validação desta simplificação: typecheck de todos os workspaces e lint mobile aprovados; suíte padrão com 42 testes aprovados e 11 integrações opcionais ignoradas; cenários Playwright claro e escuro aprovados separadamente, com API e MySQL reais em ambiente isolado. O Expo de desenvolvimento usado pelo aplicativo permaneceu ativo na porta 8081.

## Revisão de sobreposição do teclado

A infraestrutura anterior dependia de `automaticallyAdjustKeyboardInsets` (somente iOS) e de `adjustResize` no Android. Isso não acompanha de forma consistente a troca de campo, o cursor em textos longos nem as janelas próprias de `Modal`.

`FormScrollView` agora usa `KeyboardAwareScrollView` de `react-native-keyboard-controller` 1.22.7, versão indicada pelo Expo SDK 58 instalado. O `KeyboardProvider` fica na raiz. O componente acompanha foco, seleção/cursor e a animação do teclado em Android e iOS, com margem de 16 pontos. Formulários com rolagem têm um único responsável pelo teclado: os antigos `KeyboardAvoidingView` foram removidos para evitar compensação em dobro. Rolagens horizontais continuam como `ScrollView` comum.

Foram revisados todos os locais com entrada de texto em `apps/mobile/src`:

- Login e cadastro: formulário centralizado com espaço de teclado participando do layout.
- Saúde mental, feedback, perfil e edição de treino realizado: campos dentro da rolagem compartilhada, incluindo anotações multilinha.
- Medicamentos e suplementos: cabeçalho e busca passaram para o cabeçalho rolável da lista; formulários de cadastro e horários usam a mesma infraestrutura.
- Injetáveis, alimentos, refeições, favoritas, gasto calórico, meta de consumo e medidas corporais: revisão dos formulários em modais.
- Cardio e editor de publicação: as folhas inferiores crescem e permitem rolagem ao receber o teclado.
- Criação de grupo: folha antes fixa agora tem rolagem limitada à tela, com nomes acessíveis para os dois campos.
- Fichas: botão de salvar acompanha o teclado; a margem de revelação dos campos inclui a altura real desse rodapé. `FormStickyFooter` desconta a área segura inferior para manter as ações encostadas no teclado, sem cobrir a borda do campo. A confirmação no catálogo e o registro da dieta usam o mesmo tratamento. O catálogo mantém a virtualização e usa a rolagem compartilhada também no campo personalizado do fim da lista.
- Publicação em grupos, convite por identificador e comentários: formulários compartilham a rolagem; o compositor fixo dos comentários usa `FormKeyboardAvoidingView`, com posição da janela medida automaticamente.

No navegador, `useWebKeyboard` acompanha altura **e deslocamento** de `visualViewport`, mudanças de foco, digitação e seleção. O modal acompanha o topo visível e a revelação respeita os limites de rolagem, cabeçalhos e rodapés. O foco é preservado durante a rolagem automática.

### Como verificar

`apps/mobile/e2e/keyboard.spec.ts` usa API local real e testa telas de 320 e 390 px, nos dois temas, simulando a redução apenas de `visualViewport` (sem diminuir a janela inteira). Verifica que os campos permanecem inteiramente dentro da área útil e que a escrita e a troca de campo preservam o foco. Capturas ficam em `artifacts/ux-review/keyboard-*.png`.

A dependência inclui código nativo: **gerar e instalar uma nova build Android/iOS** para entregar esta correção. Uma atualização OTA destinada ao runtime antigo não instala o controlador. A política de runtime por fingerprint já configurada distingue essa mudança. Referências: [Expo — teclado](https://docs.expo.dev/guides/keyboard-handling/), [KeyboardAwareScrollView](https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view).

### Resultado desta revisão de teclado

- Typecheck de todos os workspaces aprovado; typecheck mobile repetido após o ajuste final de área segura. Lint mobile e exportação web de produção aprovados.
- Playwright contra API/banco locais isolados: **2 cenários aprovados**, em 320 px/claro e 390 px/escuro. Inclui login, cadastro, diário com texto longo, perfil, feedback, criação de grupo, publicação, busca/cadastro de medicamento, injetável, refeição, medidas e ficha.
- Build Android debug compilada com o controlador nativo. Android 16/API 36 emulado, com tela de 360 × 640 e teclado Gboard real: e-mail/senha e troca de foco, diário com 14 linhas adicionais e cursor visível, nome/descrição do grupo, nome do treino, rodapé de salvar, campo personalizado do catálogo e compositor de comentários verificados com digitação, inspeção de limites e capturas.
- O teste nativo encontrou e corrigiu uma segunda sobreposição: o rodapé que acompanha o teclado precisava compensar a área segura inferior. Após o ajuste, o campo terminou em y=648 e o rodapé começou em y=681, acima do teclado em y=1023, no emulador usado. Essa correção é compartilhada pelos rodapés da ficha, catálogo e consumo da dieta.
- Capturas nativas finais: `artifacts/ux-review/keyboard-android-{login-email,login-password,mental-note,mental-long-note,group-description,group-name,workout-name,catalog-custom,comment-composer}.png`. O teste longo do diário confirma visualmente a última linha e o cursor acima do teclado; um campo multilinha pode continuar acima da área de rolagem para acompanhar o cursor.
- iOS foi revisado na implementação, mas não executado em simulador/aparelho neste ambiente Linux. A validação nativa foi feita com APK debug e Metro; não houve publicação nem alteração do aplicativo instalado do usuário.

Na preparação local do APK debug, o bootstrap Android gerado precisou explicitar temporariamente `useDevSupport = BuildConfig.DEBUG` para se conectar ao Metro. O arquivo gerado original foi restaurado depois da compilação. O endereço de API antigo retido pelo bundle foi encaminhado a uma API local com banco exclusivo `fit_keyboard_test`, sem usar dados reais. Esse encaminhamento e os serviços temporários foram encerrados ao terminar a verificação.

## Segunda rodada — 31/10/2026

Correções aplicadas a partir da revisão heurística (Nielsen, WCAG 2.2 e guias de alvo de toque do Android) com uso simulado no navegador.

- **Funciona na web:** `Alert.alert` (no-op no React Native Web) foi substituído por `showDialog`/`confirmAction`/`showToast`. Arquivar, excluir, sair e demais confirmações voltaram a funcionar no navegador.
- **Ações destrutivas e sociais confirmadas:** remover publicação/comentário, ocultar pessoa (com lista para desfazer em Configurações → Pessoas ocultadas), denunciar com motivo escolhido, troca de função por seletor, sair da conta, marcar treino como não realizado.
- **Primeiro uso:** meta semanal não definida aparece como convite (sem "0/3" presumido); sem ficha ativa, "Treinar" vira "Criar ficha" e a tela de treino mostra estado vazio com ação.
- **Navegação:** cabeçalho padrão (`ScreenHeader`) no lugar do botão flutuante; "Início" em vez de "Home"; menu com Meus profissionais e Feedback; aba Perfil inacessível e template do Expo removidos; retornos para abas com `dismissTo`.
- **Linguagem:** glossário (ficha, Treino A/B/C, treino realizado, Corpo e medidas, Mente), datas em pt-BR, jargão técnico (Mifflin–St Jeor, MET) movido para "Detalhes do cálculo", papéis e motivos traduzidos, textos neutros em gênero na Mente.
- **Perfil:** gênero separado de "Base para estimativas" (`estimationSex`, migration 035); erros por campo; validação do @usuário só quando muda.
- **Edição de ficha:** `PUT /workout-plans/:id`, preservando o histórico; fichas de profissional são somente leitura.
- **Visual e acessibilidade:** escala tipográfica (mínimo 12 px) e de raios, `fieldBorder` com 3:1 validado pelo gerador do tema, alvos ≥ 44 px, papéis e rótulos em todos os controles, nenhum botão aninhado, contorno do card Fitness no tema escuro, interruptores com tokens de contraste.
- **Saúde e sensibilidade:** balanço calórico pode ser ocultado do Início; rótulos neutros no balanço parcial; apoio (CVV 188/SAMU 192) sobe para o topo quando o humor do dia é o mais baixo.

Verificação: typecheck e lint sem erros; 60 testes da API (incluindo integrações MySQL em banco de teste) aprovados; percurso manual a 375 px nos temas claro e escuro com auditoria automática por tela (botões aninhados, texto < 12 px, controles sem nome, alvos < 24 px).

Pendências conhecidas: recuperação de senha exige serviço de e-mail (integração externa, decisão do produto); homologação em aparelho Android/iOS real; cardio manual em "calorias ativas" não registra duração (ver `docs/cardio.md`).
