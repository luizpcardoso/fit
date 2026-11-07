# Acompanhamento nutricional e corporal

## Experiência

A aba **Nutrição** é o painel principal por data: mostra consumo, gasto, saldo, macros e a decomposição da estimativa. O gasto tem um único ponto de entrada, **Ajustar gasto**, que abre o formulário com a escolha entre *Personalizar estimativa* e *Informar valor* (de relógio, app ou aparelho); a explicação de que o valor salvo substitui a estimativa automática apenas naquela data aparece uma vez, nesse formulário. Quando o perfil não possui os dados necessários, um alerta direciona para o preenchimento do perfil ou oferece **Informar gasto manualmente**, para que ninguém fique sem caminho; a ausência de peso direciona para Corpo e medidas. O chip do balanço usa rótulos neutros (*Abaixo/Acima do gasto estimado*) e mostra *Parcial do dia* enquanto a data é hoje. As datas aparecem como “Hoje/Ontem/sex., 30 de out.”, nunca em formato ISO.

**Alimentação** (Nutrição) e **Corpo e medidas** (aba Saúde) são telas independentes. A primeira organiza refeições, alimentos e favoritas; a segunda concentra cadastro e evolução corporal. Os formulários exibem unidades e rejeitam valores negativos. Novas refeições fecham após confirmar a gravação local durável; o envio ao servidor acontece em segundo momento. Cadastros de alimentos, edição de refeições já confirmadas e demais formulários continuam esperando a API.

O registro de refeições tem uma única escolha, sem níveis aninhados: **Adição rápida** (padrão: nome e calorias; a caixa “Informar macronutrientes” revela proteínas, carboidratos, gorduras e fibras, todos opcionais), **Com alimentos** (alimentos pré-cadastrados com quantidade; nutrientes calculados) e **Refeição da dieta** (somente ao criar, quando há dieta). Escolher a categoria preenche o nome com o rótulo dela (ex.: Almoço) enquanto o nome estiver vazio ou ainda for o rótulo automático; um nome digitado nunca é substituído. O formulário oferece Agora ou Selecionar horário, com ajustes de 30 minutos, digitação exata opcional e alteração de data (detalhes abaixo). Sem nutrientes marcados, a rápida reutiliza o contrato de totais diretos: proteínas, carboidratos e gorduras são enviados como zero e fibras como null, sem estimar macros a partir das calorias. Ao editar, registros compostos só por alimentos do catálogo abrem em Com alimentos; os demais abrem em Rápida, com os nutrientes visíveis quando preenchidos. Os erros de validação apontam o campo (nome, horário, calorias ou quantidade). Itens guardam um snapshot da porção, unidade e nutrientes utilizados; editar ou excluir o alimento depois não recalcula o passado. Favoritas também são snapshots e podem ser reutilizadas informando **Porções** (1 = a porção salva, 0,5 = meia porção, 2 = porção dobrada; enviado como `multiplier`) sem alterar a favorita nem refeições anteriores.

## Dietas profissionais

Nutrição → Minha dieta é uma tela independente do diário alimentar. Exibe dietas recebidas e aceitas, profissional autor, objetivo, orientações, validade, refeições e porções. Sugestões ainda pendentes são aceitas em Perfil → Meus profissionais. Dietas substituídas ficam disponíveis em histórico, sem permitir novos registros por elas. Encerrar o vínculo profissional preserva os planos que o aluno já recebeu.

Cada refeição tem de uma a três opções: A é a principal; B e C são opcionais. Os nomes são fixos e derivados da refeição (por exemplo, Almoço A, Almoço B e Almoço C), sem edição livre. Cada opção mantém seus próprios alimentos e porções. O portal permite criar, editar e revisar essas opções. Dietas anteriores sem alternativas continuam compatíveis. O campo textual de substituições é uma orientação; estimativas das alternativas usam os alimentos estruturados de cada opção.

As estimativas de calorias, proteínas, carboidratos e gorduras são calculadas por `nutriente da porção de referência × quantidade / porção de referência`. O total diário da tela soma uma opção selecionada por refeição, nunca todas as alternativas. São estimativas do planejamento, não consumo confirmado.

Em Home ou Alimentação → Adicionar/Registrar refeição → Refeição da dieta, ou diretamente em Minha dieta, o aluno escolhe a refeição/opção, ajusta quantidades, data e horário e confirma o consumo. O servidor verifica propriedade, status e índices, lê o snapshot da prescrição e recalcula nutrientes. O cliente pode informar nome livre e categoria para o registro pessoal; alimentos, porções de referência e nutrientes continuam sendo lidos da prescrição, nunca do cliente. Alimentos da dieta não precisam ser copiados para o catálogo privado do aluno.

`GET /nutrition/diets` retorna somente dietas ativas/substituídas do próprio aluno, com opções e macros. `POST /nutrition/diet-meals` registra consumo nas tabelas existentes de refeições e itens, preservando porção, nome, unidade e nutrientes e associando a origem à dieta/opção. Repetir a mesma requisição não cria outro consumo. As migrations `027-diet-meal-tracking.ts` adicionam referências opcionais, sem modificar registros anteriores.

Uma dieta com validade encerrada mostra aviso e continua consultável/utilizável pelo aluno, como acontece com fichas vencidas. Não há publicação automática em grupos nem acesso a dietas de outros usuários. Alterar modelos ou substituir prescrições não recalcula refeições já registradas. Registros desse tipo também podem virar favoritos, mantendo snapshots.

## Gasto calórico

A estimativa usa Mifflin–St Jeor:

`basal = 10 × peso(kg) + 6,25 × altura(cm) − 5 × idade + ajuste por sexo`

O ajuste é `+5` para a base masculina e `−161` para a feminina. A base vem de `estimationSex` (`female`/`male`/`null`) do perfil, campo separado de `gender` (identidade). No formulário de estimativa personalizada o seletor se chama **Base da fórmula** e é inicializado com `estimationSex`; sem base definida, a escolha é obrigatória para estimar, e o valor manual continua disponível. O texto principal das telas é leigo; nomes de fórmula, MET e referências ficam em “Saiba mais”/“Detalhes do cálculo”. Cada nível de rotina tem uma descrição curta. O basal é multiplicado por um fator de atividade cotidiana (`1,2`, `1,3`, `1,4`, `1,5` ou `1,6`) definido explicitamente como rotina sem exercício formal. Somente depois são somadas as calorias dos exercícios daquele dia, evitando contagem duplicada.

O registro manual substitui a estimativa da mesma data. A restrição única `(user_id, expenditure_date)` garante um único gasto efetivo por usuário e data. Dados e resultado da estimativa são armazenados como snapshot.

## Privacidade e persistência

Alimentos, refeições, favoritas, gastos e medidas são privados. Todos os endpoints derivam o usuário do access token e filtram leituras, edições e exclusões por `user_id`. Datas e horários chegam como valores locais (`YYYY-MM-DD` e `HH:MM`), sem conversão silenciosa para outro dia.

A migration `011-create-nutrition-tracking.ts` cria as tabelas e índices necessários e é aplicada automaticamente na inicialização da API.

## Meta de consumo e acesso pela Home

A Home e Alimentação consomem o mesmo `GET /nutrition/summary`. O resumo contém `consumptionGoal`, independente do gasto: `remainingCalories = targetCalories - consumed.calories`, considerando zero consumo em dias vazios. O progresso visual fica entre zero e um; excedentes continuam explícitos no texto. O saldo anterior, consumo menos gasto, permanece com seu significado original.

`PUT /nutrition/goal` salva uma meta inteira positiva de até 30.000 kcal ou null para remover, sempre para o usuário autenticado. É uma preferência atual e opcional, sem recomendação calculada ou histórico por dia. Migration 032 cria `nutrition_goals`. A Home reutiliza o formulário real de refeições e atualiza seu resumo após salvar; o cliente invalida seu cache em mutações.

O histórico corporal usa `/body-measurements/page` (cinco por padrão), com ordenação por data, criação e id. O retorno inclui os dois registros mais recentes para o resumo não depender da página consultada. Os GET antigos foram mantidos. O formulário oferece guia SVG das regiões já previstas no contrato e alternativa textual.

## Balanço calórico na Home

A Home prioriza consumo registrado, gasto para 24 horas e balanço parcial (`consumo − gasto`), com ação Adicionar refeição e card explicativo. Sem refeições, o balanço fica pendente; sem perfil/peso suficientes, não inventa gasto e oferece atalhos de preenchimento. Não há cor de sucesso para déficit nem incentivo a atingir um saldo negativo. A meta de consumo continua disponível em Alimentação.

`GET /nutrition/summary` acrescenta `energyEstimate`, calculado no servidor para o usuário autenticado. O campo é opcional no contrato para compatibilidade com versões anteriores. `balance` e `status` usam o gasto efetivo de `energyEstimate` (estimativa automática ou substituição salva). `expenditure` continua representando apenas o gasto explicitamente salvo, para edição e exclusão. Home e Nutrição exibem o mesmo saldo retornado pelo servidor, sem recalcular no cliente.

A estimativa automática usa Mifflin–St Jeor, idade na data, base para estimativas (`estimationSex`)/altura do perfil e último peso medido até a data, sem usar medidas futuras. Disponível entre 19 e 78 anos (faixa do estudo de origem). Base de 24 horas = metabolismo de repouso × 1,2, hipótese conservadora de rotina básica. O nível de atividade do perfil não multiplica essa base, pois pode incluir exercício.

Somente treinos concluídos na data são somados. Como o registro ainda não contém duração, cada treino usa **45 minutos como hipótese do produto**, a 3,5 MET; não se trata de duração medida ou de recomendação científica. Energia adicional = `(3,5 − 1) × peso × 45 / 60`. Cardios estimados usam `(MET − 1) × peso da sessão × duração / 60`. O desconto de 1 MET remove o repouso já coberto pela base. Cardios manuais com duração descontam `peso × duração / 60` (mínimo zero); sem duração, o valor é interpretado como calorias ativas. Não registrar a mesma atividade como treino e cardio ou em dois modos.

Um gasto diário já salvo (manual ou estimado) substitui integralmente a estimativa automática; não recebe nenhum exercício adicional. A Home atualiza ao retornar de treinos/medidas/perfil e após criar cardio na própria Home. Nenhuma estimativa automática é gravada como gasto manual. O total é do dia inteiro, não gasto acumulado até agora; consumo e balanço permanecem parciais enquanto faltarem refeições.

Referências: [Mifflin et al. (1990)](https://pubmed.ncbi.nlm.nih.gov/2305711/) e [Compêndio de Atividades Físicas 2024 — treino de resistência, código 02054](https://pacompendium.com/conditioning-exercise/). Intensidade, duração real e rotina podem diferir da hipótese; não é medição individual nem prescrição alimentar.

## Consulta compacta da dieta e registro pela Home

Adicionar refeição na Home mantém a inserção rápida como padrão e mostra **Usar minha dieta** como terceira opção ao lado de Adição rápida e Escolher alimentos. Ela abre a escolha das refeições das dietas ativas; sem dieta vinculada, apresenta o estado vazio com orientação. A consulta de dietas e a carga do catálogo são independentes: falhas no catálogo não impedem o uso da prescrição, e a falha ao consultar dietas oferece nova tentativa sem bloquear o registro manual. Sair da escolha da dieta retorna ao formulário anterior sem apagar os campos manuais.

Minha dieta mostra um plano por vez, com seletor quando há mais de um. O resumo apresenta a quantidade de refeições e as calorias planejadas; a agenda usa linhas compactas com horário, nome, alimentos/opções e calorias. Ao tocar, uma tela de detalhes mostra somente aquela refeição, suas alternativas, porções, nutrientes e substituições. Objetivo, orientações e validade ficam em Orientações da dieta. O histórico permanece consultável, sem registro por dietas substituídas.

O formulário de consumo também usa a agenda compacta e exibe apenas a refeição escolhida. A opção selecionada na consulta é preservada ao abrir o registro; quantidades podem ser ajustadas sem alterar a prescrição. Os fluxos da Home, Minha dieta e Alimentação reutilizam `GET /nutrition/diets` e `POST /nutrition/diet-meals`, mantendo autenticação, validação, cálculo no servidor e idempotência existentes. Planos vencidos continuam com aviso e o comportamento de registro já permitido pelo produto.


## Limite e nomes das opções

O contrato de escrita e o servidor aceitam a opção principal mais no máximo duas alternativas. Apenas a principal é obrigatória. Nomes recebidos em payloads antigos são normalizados no servidor para nome da refeição + letra; renomear uma refeição ou remover uma alternativa recalcula as letras pela posição. O portal remove o campo Nome da opção, identifica A/B/C, desabilita a adição no limite e permite remover B/C. O app usa as mesmas letras na consulta, prévia e registro. O índice de consumo fica restrito a 0–2 e a API também verifica se a opção existe na dieta daquele aluno.

Snapshots antigos permanecem legíveis e não são alterados no banco. Na consulta/registro pelo app são oferecidas até três opções. O editor do portal mantém visíveis alternativas antigas excedentes com aviso; é necessário revisá-las/removê-las explicitamente antes de salvar ou fazer uma nova atribuição. Consumos já registrados conservam seus alimentos e nutrientes originais. A separação entre schema de leitura histórica e schema de escrita evita invalidar dietas antigas durante a consulta.


Home e Nutrição usam a mesma formatação de sinal/unidade e a mesma explicação de cálculo. Nutrição mostra a estimativa automática e sua composição mesmo sem gasto salvo, assim como a Home. Salvar um gasto substitui a estimativa nas duas telas; excluí-lo restaura a estimativa automática quando houver dados suficientes. Dias sem refeições ou sem gasto disponível permanecem incompletos. A troca de datas não exibe o resumo anterior nem aceita respostas atrasadas. A escolha do peso para personalização também considera somente medidas até a data selecionada.

## Peso e medidas separados — 02/11/2026

Na mesma tela Corpo e medidas, **Registrar peso** abre data/peso/observação; **Registrar medidas** abre data/regiões/observação, sem campo de peso. Cada ação cria um registro independente no contrato privado existente de `/body-measurements`. Medidas não exigem peso e peso não exige medidas. O schema existente já aceita ambos; não há nova tabela nem migração. Registros antigos mistos continuam editáveis, sem troca de modo capaz de descartar silenciosamente seus valores.

O formulário usa `entryMode` e `utils/body-record.ts` para separar os payloads. Ao editar, conserva os campos do registro existente. O histórico continua compartilhado. `/body-measurements/page` acrescenta `latestWeights` (opcional no contrato para compatibilidade) com os dois pesos mais recentes do próprio usuário, independentemente da página e dos registros que só contêm medidas. O resumo Último peso usa esses dados, sem comparar com linhas de medidas sem peso. O cálculo de energia existente continua escolhendo o último peso até a data consultada.

Lembretes de peso e medidas ficam nesta tela, com ativação e horários independentes, desligados por padrão. Podem ser diários ou semanais, locais e opcionais, com aviso de que não é necessário registrar diariamente. Preferências por conta no SecureStore; trocar de conta/sair cancela agendamentos e restaura somente os da conta atual. Tocar no aviso abre o formulário correspondente, inclusive na abertura a frio autenticada. Web explica que o recurso exige o app instalado.

Contexto de manutenção: atualizar esta seção e `docs/notifications.md` ao mudar modos, contratos, periodicidade ou privacidade. Arquivos: `app/body-measurements.tsx`, `components/nutrition-forms.tsx`, `body-reminder-settings.tsx`, `body-reminders-provider.tsx`, `utils/body-record.ts`, `body-reminder-plan.ts`, `body-reminders.ts` e o listener de notificações no layout raiz. O sincronizador injetável é testado sem dependência de Expo; cancela obsoletos, evita duplicação e descarta agendamentos atrasados após logout.

Validação desta separação: typecheck de todos os workspaces e lint mobile aprovados; 3 testes focados de registros/lembretes e integração de nutrição com MySQL real aprovados em banco temporário isolado. Suíte padrão anterior à inclusão desses casos: sem falhas (72 aprovados, 16 integrações opcionais ignoradas). Não foi gerado build; verificação da entrega dos avisos e interação visual em aparelho físico permanece pendente.

Atualização de periodicidade: peso e medidas permitem escolher Diário ou Semanal de forma independente. No semanal, escolher um dia (domingo=1 até sábado=7, padrão Expo) e horário, confirmando em Salvar lembrete. Preferências antigas sem frequência continuam diárias, preservando os agendamentos anteriores. A sincronização substitui o aviso existente com trigger DAILY ou WEEKLY, sem duplicar. Testes cobrem compatibilidade e envio dos dias/horários independentes ao agendador. Não foi gerado build.


## Categoria e horário no registro de refeições

Distribuído no APK 1.05. Home e Alimentação reutilizam os controles de categoria e horário em registro rápido, alimentos, favoritas e consumo de dieta.

- Categoria opcional: Café da manhã, Lanche da manhã, Almoço, Lanche da tarde, Jantar e Ceia. Nome da refeição é obrigatório e livre. Selecionar uma categoria usa o rótulo como nome inicial (inclusive no consumo da dieta quando a refeição corresponde a uma categoria); trocar a categoria só troca o nome se ele ainda for o rótulo anterior; remover a categoria limpa apenas o rótulo automático. O usuário pode completar ou substituir o texto, por exemplo Marmita congelada.
- Os horários sugeridos são referências de produto, calculadas pelo ponto médio de faixas locais: 06–09 → 07:30; 09–11 → 10:00; 11–14 → 12:30; 14–17 → 15:30; 18–21 → 19:30; 21–23 → 22:00. Não são médias populacionais nem horários obrigatórios.
- Escolher categoria preenche a referência e seleciona horário customizado quando não há ajuste manual nem escolha explícita de Agora. Ao editar um registro, o horário existente é preservado. Mudar a categoria preserva o nome, um horário ajustado e a escolha explícita de Agora. A ação Usar horário sugerido permite reaplicar a referência.
- Agora captura data e hora locais no momento de salvar, inclusive se o formulário atravessar a meia-noite. Para outra data, usa-se Selecionar horário; Agora fica indisponível até voltar à data de hoje. Data continua no calendário local, sem conversão UTC.
- Selecionar horário mostra um campo HH:MM editável diretamente por toque e teclado, entre os botões −30/+30 minutos. Os passos preservam os minutos exatos e ficam desabilitados quando ultrapassariam o dia. A validação continua aceitando somente 00:00 a 23:59. Os modos de registro são Adição rápida, Escolher alimentos e Usar minha dieta, cada um com uma descrição do que será informado.
- **Personalizar** (no cabeçalho das categorias) abre os horários de cada categoria. Valores salvos substituem a referência padrão nos tiles, na sugestão de horário e em “Usar horário sugerido”; campo vazio volta ao padrão. Ficam na conta (`GET/PATCH /me/preferences`, `mealCategoryTimes`), valendo no app e na web. `user_preferences` (migration `048-user-preferences.ts`) guarda um JSON validado por usuário, com leitura que volta aos padrões se o conteúdo for inválido; o PATCH substitui as chaves enviadas. O cliente mantém as preferências só em memória por conta.
- Favoritas guardam a categoria como parte do snapshot. Na reutilização, categoria, data e horário podem mudar só para o novo consumo; porções continuam proporcionais. Alterar a categoria não altera o nome da favorita.
- Consumo da dieta aceita nome e categoria pessoais, preserva vínculo com a refeição/opção e cálculos no servidor. Trocar a alternativa da mesma refeição preserva nome, categoria e horário já escolhidos. O nome profissional segue visível como contexto e não muda na prescrição.

Migration `043-meal-categories.ts` adiciona `category` nullable em refeições e favoritas. Contratos usam enum restrito, sem novos endpoints ou permissões. Clientes anteriores podem omitir a categoria; uma edição antiga preserva a existente e null explícito remove. Registros anteriores mantêm nomes e horários, sem inferência retroativa de categoria. No consumo de dieta, omitir nome mantém o nome da prescrição para compatibilidade. Dados seguem privados e filtrados por proprietário.

Verificação: `apps/api/test/meal-entry.test.ts` cobre horários, validação e integração em banco temporário criado/excluído pelo próprio teste (`RUN_DB_TESTS=1`). `apps/mobile/e2e/meal-entry.spec.ts` usa API local isolada (`FIT_MEAL_ENTRY_E2E=1`) para categoria/nome, Agora ao salvar, passos e edição exata, data passada, edição, favoritas, falha de rede e viewport de 320 px nos temas claro/escuro. `diet.spec.ts` verifica o fluxo com prescrição real em banco de testes. A validação de interface usa o modo web SPA como aproximação do app nativo; não cobre SSR nem teclado/gestos em aparelho físico. A configuração final de saída web permanece `server`. Distribuição no APK 1.05, com a API e a migração atualizadas no servidor.


## Registro local e sincronização adiada

Distribuído no APK 1.05. Novas refeições rápidas, por alimentos, consumo de dietas e reutilização de favoritas usam uma fila privada por conta. Salvar confirma primeiro o armazenamento no aparelho, mesmo sem internet; falha de armazenamento mantém o formulário aberto. A Home e Alimentação incluem os registros pendentes nos totais e mostram o estado do envio. Categoria, horário, nome e nutrientes digitados não disparam requisições durante a edição.

- Aplicativo: SecureStore criptografado em fragmentos, com duas gerações e troca atômica do ponteiro. Web: localStorage, somente na conta autenticada. Fila e referências recuperam após encerrar/reabrir o processo. Logout avisa sobre pendências antes de apagá-las; outra conta não herda dados, cache nem envios antigos.
- A fila agrupa até 25 registros por requisição, após uma janela de 60 s. Enviar agora percorre até quatro lotes para escoar as 100 pendências possíveis, interrompendo em falha. Há checkpoint na abertura e ao mudar o estado do app, além de Enviar agora. Sem pendências não há timer/requisição de sincronização. Rede indisponível e erro temporário preservam a fila, com espera progressiva entre tentativas; nenhuma garantia de execução com o processo encerrado ou suspenso pelo sistema operacional.
- Alimentos, dietas, favoritas e resumos consultados ficam em cache por até cinco minutos; até 14 dias de resumos são mantidos. Sem conexão, utiliza-se o conteúdo já carregado. Novas refeições rápidas independem do catálogo; alimentos/dietas/favoritas precisam ter sido carregados antes. Atualizar alimentação e o gesto de atualizar invalidam o cache explicitamente. Os totais locais são provisórios até a conferência pelo servidor.
- Uma refeição pendente pode ser editada antes da primeira tentativa de envio. Após tentar enviar, o app exige confirmação antes de editar para evitar sobrescrever um registro cujo retorno pode ter sido perdido. Remover uma pendência tentada gera cancelamento durável: se o servidor já a recebeu, será removida; se não recebeu, o cancelamento impede um reenvio antigo de recriá-la. Edição/exclusão de refeições já confirmadas e cadastros de alimentos/favoritas continuam sendo operações explícitas online, sem requisições por campo.
- Se a dieta/favorita/alimento deixou de estar disponível, a entrada permanece visível com indicação de revisão, sem repetição automática. Remover e registrar novamente permite corrigir a origem. Uma entrada rejeitada não impede o envio das demais. A fila tem limite de 100 pendências; não descarta registros antigos para aceitar outros.

`POST /nutrition/meal-sync` valida lote, UUIDs, limites, datas, formatos e origem. O usuário vem do token; o cabeçalho opcional `x-orami-owner` só confirma que a conta não mudou. Alimentos, favoritas e dietas são autorizados e recalculados no servidor, sem aceitar o preview local como autoridade. Migration `044-nutrition-sync-receipts.ts` guarda recibo por `(user_id, request_id)` na mesma transação da refeição. Repetições simultâneas ou após resposta perdida retornam o mesmo resultado. Recibos de refeições removidas permanecem sem conteúdo alimentar para impedir recriação; são excluídos com a conta. `Meal.syncId` permite ocultar uma cópia recebida do servidor enquanto a confirmação local está pendente, evitando contar a mesma refeição duas vezes.

`deferred-sync.test.ts` cobre fila durável, resposta perdida, concorrência, cancelamento, limite de tentativas e falha de armazenamento. `meal-entry.test.ts`, com `RUN_DB_TESTS=1`, cria/exclui banco isolado e verifica recibos, lotes parciais, repetição concorrente, cancelamento e isolamento. `deferred-sync.spec.ts` usa API real com `FIT_DEFERRED_SYNC_E2E=1` para registrar offline, reabrir, reenviar em lote sem duplicar e verificar confirmação/limpeza no logout, nos dois temas. API e migração atualizadas no servidor para o APK 1.05.

A Home reserva espaço para o número e a explicação do balanço antes da primeira refeição, evitando deslocamento ao iniciar os registros. Durante atualização com dados disponíveis, mantém o resumo visível; falhas continuam sinalizadas com opção de nova tentativa. Os seletores de modo mantêm a mesma borda ao selecionar, sem alterar a geometria.

## Evolução do peso e histórico corporal

Corpo e medidas mostra um gráfico de linha do peso com períodos de 30 dias, 90 dias e 1 ano, desenhado com Views (sem módulo nativo novo, distribuível por OTA) e com descrição acessível de início, fim, mínimo e máximo. Os pontos vêm de `GET /body-measurements/weights?from=AAAA-MM-DD`, que devolve só `{ date, weightKg }` do próprio usuário, do mais antigo ao mais recente (até 400). O histórico usa `/body-measurements/page` com 10 por vez e “Carregar mais”; a variação de peso de cada item compara com o registro seguinte já carregado. Os lembretes ficam no fim da tela, depois dos dados. Números visíveis usam vírgula decimal (`utils/numbers.ts`).
