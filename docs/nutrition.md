# Acompanhamento nutricional e corporal

## Experiência

A aba **Nutrição** é o painel principal por data: mostra consumo, gasto, saldo, macros e a decomposição da estimativa. O gasto tem um único ponto de entrada, **Ajustar gasto**, que abre o formulário com a escolha entre *Personalizar estimativa* e *Informar valor* (de relógio, app ou aparelho); a explicação de que o valor salvo substitui a estimativa automática apenas naquela data aparece uma vez, nesse formulário. Quando o perfil não possui os dados necessários, um alerta direciona para o preenchimento do perfil ou oferece **Informar gasto manualmente**, para que ninguém fique sem caminho; a ausência de peso direciona para Corpo e medidas. O chip do balanço usa rótulos neutros (*Abaixo/Acima do gasto estimado*) e mostra *Parcial do dia* enquanto a data é hoje. As datas aparecem como “Hoje/Ontem/sex., 30 de out.”, nunca em formato ISO.

**Alimentação** (Nutrição) e **Corpo e medidas** (aba Saúde) são telas independentes. A primeira organiza refeições, alimentos e favoritas; a segunda concentra cadastro e evolução corporal. Todos os formulários exibem unidades, rejeitam valores negativos e só fecham depois que a API confirma a gravação.

O registro de refeições tem uma única escolha, sem níveis aninhados: **Rápida** (padrão: nome e calorias; a caixa “Informar proteínas, carboidratos e gorduras” revela os nutrientes opcionais), **Com alimentos** (alimentos pré-cadastrados com quantidade; nutrientes calculados) e **Refeição da dieta** (somente ao criar, quando há dieta). Data e horário usam a data selecionada e o horário atual, exibidos em uma linha com o botão “Alterar”; ao editar, os campos aparecem abertos. Sem nutrientes marcados, a rápida reutiliza o contrato de totais diretos: proteínas, carboidratos e gorduras são enviados como zero e fibras como null, sem estimar macros a partir das calorias. Ao editar, registros compostos só por alimentos do catálogo abrem em Com alimentos; os demais abrem em Rápida, com os nutrientes visíveis quando preenchidos. Os erros de validação apontam o campo (nome, horário, calorias ou quantidade). Itens guardam um snapshot da porção, unidade e nutrientes utilizados; editar ou excluir o alimento depois não recalcula o passado. Favoritas também são snapshots e podem ser reutilizadas informando **Porções** (1 = a porção salva, 0,5 = meia porção, 2 = porção dobrada; enviado como `multiplier`) sem alterar a favorita nem refeições anteriores.

## Dietas profissionais

Nutrição → Minha dieta é uma tela independente do diário alimentar. Exibe dietas recebidas e aceitas, profissional autor, objetivo, orientações, validade, refeições e porções. Sugestões ainda pendentes são aceitas em Perfil → Meus profissionais. Dietas substituídas ficam disponíveis em histórico, sem permitir novos registros por elas. Encerrar o vínculo profissional preserva os planos que o aluno já recebeu.

Cada refeição tem de uma a três opções: A é a principal; B e C são opcionais. Os nomes são fixos e derivados da refeição (por exemplo, Almoço A, Almoço B e Almoço C), sem edição livre. Cada opção mantém seus próprios alimentos e porções. O portal permite criar, editar e revisar essas opções. Dietas anteriores sem alternativas continuam compatíveis. O campo textual de substituições é uma orientação; estimativas das alternativas usam os alimentos estruturados de cada opção.

As estimativas de calorias, proteínas, carboidratos e gorduras são calculadas por `nutriente da porção de referência × quantidade / porção de referência`. O total diário da tela soma uma opção selecionada por refeição, nunca todas as alternativas. São estimativas do planejamento, não consumo confirmado.

Em Home ou Alimentação → Adicionar/Registrar refeição → Refeição da dieta, ou diretamente em Minha dieta, o aluno escolhe a refeição/opção, ajusta quantidades, data e horário e confirma o consumo. O servidor verifica propriedade, status e índices, lê o snapshot da prescrição e recalcula nutrientes. O cliente não envia calorias ou nomes como autoridade. Alimentos da dieta não precisam ser copiados para o catálogo privado do aluno.

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

Adicionar refeição na Home mantém a inserção rápida como padrão e mostra **Refeição da dieta** como terceira opção ao lado de Inserção rápida e Inserção detalhada. Ela abre a escolha das refeições das dietas ativas; sem dieta vinculada, apresenta o estado vazio com orientação. A consulta de dietas e a carga do catálogo são independentes: falhas no catálogo não impedem o uso da prescrição, e a falha ao consultar dietas oferece nova tentativa sem bloquear o registro manual. Sair da escolha da dieta retorna ao formulário anterior sem apagar os campos manuais.

Minha dieta mostra um plano por vez, com seletor quando há mais de um. O resumo apresenta a quantidade de refeições e as calorias planejadas; a agenda usa linhas compactas com horário, nome, alimentos/opções e calorias. Ao tocar, uma tela de detalhes mostra somente aquela refeição, suas alternativas, porções, nutrientes e substituições. Objetivo, orientações e validade ficam em Orientações da dieta. O histórico permanece consultável, sem registro por dietas substituídas.

O formulário de consumo também usa a agenda compacta e exibe apenas a refeição escolhida. A opção selecionada na consulta é preservada ao abrir o registro; quantidades podem ser ajustadas sem alterar a prescrição. Os fluxos da Home, Minha dieta e Alimentação reutilizam `GET /nutrition/diets` e `POST /nutrition/diet-meals`, mantendo autenticação, validação, cálculo no servidor e idempotência existentes. Planos vencidos continuam com aviso e o comportamento de registro já permitido pelo produto.


## Limite e nomes das opções

O contrato de escrita e o servidor aceitam a opção principal mais no máximo duas alternativas. Apenas a principal é obrigatória. Nomes recebidos em payloads antigos são normalizados no servidor para nome da refeição + letra; renomear uma refeição ou remover uma alternativa recalcula as letras pela posição. O portal remove o campo Nome da opção, identifica A/B/C, desabilita a adição no limite e permite remover B/C. O app usa as mesmas letras na consulta, prévia e registro. O índice de consumo fica restrito a 0–2 e a API também verifica se a opção existe na dieta daquele aluno.

Snapshots antigos permanecem legíveis e não são alterados no banco. Na consulta/registro pelo app são oferecidas até três opções. O editor do portal mantém visíveis alternativas antigas excedentes com aviso; é necessário revisá-las/removê-las explicitamente antes de salvar ou fazer uma nova atribuição. Consumos já registrados conservam seus alimentos e nutrientes originais. A separação entre schema de leitura histórica e schema de escrita evita invalidar dietas antigas durante a consulta.


Home e Nutrição usam a mesma formatação de sinal/unidade e a mesma explicação de cálculo. Nutrição mostra a estimativa automática e sua composição mesmo sem gasto salvo, assim como a Home. Salvar um gasto substitui a estimativa nas duas telas; excluí-lo restaura a estimativa automática quando houver dados suficientes. Dias sem refeições ou sem gasto disponível permanecem incompletos. A troca de datas não exibe o resumo anterior nem aceita respostas atrasadas. A escolha do peso para personalização também considera somente medidas até a data selecionada.
