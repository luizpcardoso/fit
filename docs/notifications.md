# Notificações da rotina

## Experiência no aplicativo

Em Configurações → Lembretes nos horários, o usuário pode ativar os avisos deste aparelho e escolher medicamentos, suplementos, treino e aplicações. Medicamentos e suplementos usam os horários de cada cadastro; treino e aplicações usam horários configuráveis e somente os dias planejados. O lembrete do check-in continua disponível na área Mente.

As notificações são discretas: exibem categoria e quantidade de registros previstos, sem nomes, doses, emoções ou anotações. Ao tocar, abrem as atividades do dia para conferir e registrar a ação. Nenhuma ação de saúde é marcada automaticamente.

O resumo fixo, disponível no Android, mostra realizados e faltantes por categoria, calorias e horário da última atualização. Ele é opcional e pode aparecer na tela bloqueada, conforme explicado antes da ativação. Atualiza após registros e ao abrir o aplicativo; fechado, conserva a última atualização. A troca de dia substitui os números por uma mensagem para atualizar o resumo. Na versão Android com o módulo nativo `FitDailySummary`, dispensar o card dispara um receiver privado que restaura o último resumo, sem iniciar JavaScript nem manter um serviço ativo. Desativar o resumo ou sair da conta apaga o cache antes de cancelar a notificação, impedindo restauração por eventos atrasados. Aparelhos sem o módulo nativo continuam com o resumo anterior e mostram a necessidade de atualizar o APK.

## Agendamento e limites

- A programação local cobre até sete dias e é renovada ao abrir o app, voltar ao primeiro plano, mudar o dia ou concluir/alterar registros.
- Registros já realizados não geram avisos futuros. Itens pausados ou excluídos saem da próxima sincronização.
- Avisos no mesmo horário são agrupados; até 56 horários próximos são mantidos, reservando espaço para o check-in e o resumo. A tela informa quando esse limite foi atingido.
- Os horários seguem o fuso do aparelho. Ao mudar o fuso, reabrir o app recalcula a agenda.
- Depois de programados, os avisos funcionam com o app fechado. Abra o app dentro do período para renovar a agenda. O sistema operacional pode ajustar os horários para economizar bateria.
- Preferências ficam no armazenamento seguro, separadas por conta e aparelho. Encerrar/trocar a conta cancela os avisos desta rotina. Enquanto a conta continua autenticada, falhas ao consultar a agenda preservam a programação anterior dessa conta.
- Desligar os lembretes remove os avisos pendentes e exibidos desta rotina. A sincronização preserva os outros canais, incluindo o resumo e o lembrete de check-in.

O agendamento usa [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), incluindo canais, permissões, notificações locais por data e abertura por toque. O comportamento de entrega em repouso segue as [restrições de alarmes do Android](https://developer.android.com/develop/background-work/services/alarms).

## API e segurança

`GET /me/reminder-agenda?from=YYYY-MM-DD&to=YYYY-MM-DD` exige sessão, aceita no máximo sete dias e usa exclusivamente o usuário autenticado. Retorna categorias, horários e quantidades pendentes; não expõe nomes nem detalhes pessoais. Campos de consulta extras são rejeitados e a resposta usa `private, no-store`.

`GET /me/daily-summary` passa a incluir agregados opcionais por categoria, mantendo os campos anteriores. A preferência de contabilizar o check-in continua respeitada. Não há migração nova de banco para estes lembretes.

## Validação

- Testes de agenda: autenticação, limites de período, dados de outra conta, horários, exclusão de ações concluídas e ausência de nomes pessoais.
- Testes do planejador e sincronização: fuso local, agrupamento, categorias desligadas, horários passados, virada de ano, limite de 56 avisos, cancelamento de obsoletos, repetição sem duplicação, troca de conta e falhas do agendador.
- Integração MySQL com criação, consumo e pausa de medicamento real, conferindo agenda e resumo.
- Teste Playwright da tela de configurações e acesso à área Mente. No navegador, as notificações nativas permanecem indisponíveis e isso é explicado na tela.
- Typecheck, lint, regressões automatizadas e exportação do bundle Android.

A entrega efetiva no sistema, permissões do aparelho, som, tela bloqueada e recuperação após reiniciar o dispositivo ainda precisam de teste em Android/iOS real ou emulador. A exportação do bundle não substitui esse teste.

## Restauração após dispensar no Android

O módulo local fica em `apps/mobile/modules/fit-daily-summary` e é incluído pelo autolinking do Expo, inclusive após gerar novamente o projeto Android. O fingerprint do runtime inclui seu código nativo; a mudança exige um novo APK, preservando compatibilidade do JavaScript com versões anteriores pela detecção do módulo opcional.

O receiver usa o `deleteIntent` da notificação. Um cache atômico no diretório privado sem backup contém somente título, texto agregado e validade. Após a validade, a restauração exibe mensagem neutra em vez dos números do dia anterior. Um alarme inexato faz a mesma troca à meia-noite, respeitando os limites de energia do sistema. Não há novas permissões para serviços ou alarmes exatos. O toque abre as atividades do dia por um intent explícito para o próprio app.

O Android 14 permite dispensar notificações ongoing; a restauração trata esse evento, mas não impede que a pessoa bloqueie o canal, revogue notificações ou force a parada do aplicativo. Também não há garantia idêntica em todos os fabricantes. Referências: [mudança no Android 14](https://developer.android.com/about/versions/14/behavior-changes-all#non-dismissable-notifications) e [deleteIntent](https://developer.android.com/reference/android/app/Notification.Builder#setDeleteIntent(android.app.PendingIntent)).

Testes Android do módulo: `./gradlew :fit-daily-summary:testDebugUnitTest` (com o SDK e a configuração local de assinatura de desenvolvimento exigida pelo projeto). Cobrem restauração, desligamento, eventos atrasados, atualização sem duplicação, expiração e bloqueio de notificações.

## Indicador na aba Grupos

O ícone Grupos da barra inferior mostra um contador de posts ainda não vistos, limitado visualmente a `99+`. Um pulso breve destaca alterações no contador quando outra aba está aberta; a preferência de reduzir movimento é respeitada. O nome acessível da aba informa a quantidade completa.

O campo opcional `postsUnseen` de `/groups/dashboard` considera somente posts visíveis de outros autores nos grupos dos quais a pessoa participa, respeitando a data de entrada, a última leitura e pessoas ocultadas. Publicações próprias, comentários, reações e posts removidos não aumentam esse indicador. As contagens anteriores do dashboard são preservadas. Não há migração nova.

Um estado compartilhado mantém home e menu sincronizados. Consulta ao iniciar, navegar, voltar ao primeiro plano, alterar grupos/ocultações e a cada 30 segundos com o app ativo. Escritas de saúde não disparam consultas extras de grupos. Abrir a lista de grupos conserva o contador; abrir um feed aplica a leitura existente do servidor e atualiza o indicador. Falhas conservam a última contagem confirmada; sair ou trocar de conta descarta o estado.

Validação específica: integração MySQL em `group-badge.integration.test.ts` e Playwright em `group-tab-badge.spec.ts`, publicando por outra conta enquanto a home permanece aberta e conferindo a retirada do indicador após abrir o feed.

## Correção de atualização do card fixo — 02/11/2026

O resumo fixo consulta a API sem reutilizar cache ou requisições pendentes anteriores. Escritas bem-sucedidas invalidam tanto respostas em cache quanto consultas iniciadas durante a gravação, antes de avisar os assinantes. Isso impede que alterações de medicamentos/check-ins atualizem a notificação com um resumo anterior à gravação. Respostas antigas continuam impedidas de repovoar o cache. Manter essa regra e o teste de concorrência em `client-efficiency.test.ts` ao alterar o transporte. Não foi gerado build; a apresentação no Android físico permanece para homologação.

## Lembretes independentes de peso e medidas — 02/11/2026

Corpo e medidas oferece dois controles opcionais de lembrete diário ou semanal, com horários e dias próprios e desligados inicialmente. Usam avisos locais sem valores corporais, fotos ou observações. A ativação de um não ativa o outro e não impõe uma frequência de registro. O app instalado solicita permissão; no navegador os controles ficam indisponíveis com explicação.

`BodyRemindersProvider` vive dentro da autenticação e lê preferências por conta em SecureStore. `body-reminder-plan.ts` contém parsing seguro e sincronização serializada/injetável; `body-reminders.ts` integra Expo. IDs estáveis evitam duplicação; apenas notificações com `bodyReminder=true` são canceladas. Salvar falhando restaura o agendamento anterior quando possível; logout limpa os avisos e respostas atrasadas não reintroduzem a conta antiga. `addBodyReminderResponseListener` valida tipo/payload e trata toque normal ou abertura a frio, abrindo `/body-measurements` com o modo de registro correspondente. Não há dados corporais no payload da notificação.

Sempre atualizar este contexto junto do código. Os testes automatizados cobrem independência dos registros, preferências/horários, substituição sem duplicação, logout e agendamento atrasado. Entrega real no Android/iOS ainda requer homologação física; não gerar build nesta rodada.

Atualização de periodicidade: peso e medidas permitem escolher Diário ou Semanal de forma independente. No semanal, escolher um dia (domingo=1 até sábado=7, padrão Expo) e horário, confirmando em Salvar lembrete. Preferências antigas sem frequência continuam diárias, preservando os agendamentos anteriores. A sincronização substitui o aviso existente com trigger DAILY ou WEEKLY, sem duplicar. Testes cobrem compatibilidade e envio dos dias/horários independentes ao agendador. Não foi gerado build.

## Alerta de medicamento com horário passado

O resumo fixo acrescenta ⚠️ no título e uma contagem de horários passados sem registro de tomada. A API retorna somente `overdueMedications` (opcional para compatibilidade), calculado no horário da Bahia para a data corrente: horário estritamente anterior ao minuto atual, sem `consumedAt`. Registros sem horário, futuros ou já confirmados não entram. Ausência de registro não comprova que a dose não foi tomada; o texto não recomenda tomar, repetir ou ajustar doses. Nomes e doses continuam fora do resumo.

Com o app ativo, o resumo consulta novamente a cada minuto para detectar a passagem do horário, além das atualizações por mutação e retorno ao primeiro plano. Com o app fechado, o card conserva o último estado atualizado; não há promessa de alerta pontual sem JavaScript em execução. Ao confirmar a tomada, o próximo resumo retira o indicador. Testes cobrem horários, fuso, datas diferentes, confirmação e texto. Manter esta seção atualizada ao alterar a regra; nenhum build gerado.

## Checks em data anterior — 02/11/2026

Medicamentos, Suplementos e Injetáveis oferecem o botão **Registrar em data anterior**, separado dos controles de hoje. Abre `components/retroactive-health-modal.tsx`, inicialmente em ontem, permite consultar uma data passada e confirmar individualmente uma tomada/slot ou aplicação prevista. Editar a data exige nova consulta antes de habilitar as confirmações; consultas atrasadas não substituem a data atual do formulário. Não há marcação em lote nem desfazer registros antigos neste modal. Checks existentes aparecem bloqueados como Já registrado.

Reutiliza os contratos/endpoints autenticados já existentes: `GET /medications|supplements/today?date=...`, POST de `intakes` com data/slot, `GET /injectables/today?date=...` e POST de `applications` com data. Não há nova tabela, migração ou alteração da regra dos registros de hoje. As chaves únicas e os INSERTs idempotentes existentes preservam checks e timestamps anteriores. A data é a realização informada; o timestamp de confirmação continua sendo o instante real de registro.

Limite explícito: a lista é construída pelos cadastros ativos e programação atuais. Não reconstrói prescrições, doses ou horários históricos alterados. O modal explica isso e solicita apenas ações realmente realizadas, sem recomendar tomar/aplicar doses esquecidas. Pausados e dias não previstos de injetável seguem o comportamento existente da API. A função serve para recuperar um check esquecido, não para compensar clinicamente doses.

Manter este contexto atualizado ao mudar o fluxo. Teste `retroactive-health.integration.test.ts` usa MySQL em banco temporário próprio para as três categorias, incluindo acesso sem autenticação/de outra conta, datas inválidas, repetição sem duplicação e preservação dos outros dias. Não gerar build nesta rodada; homologação visual/native permanece pendente.

Validação do fluxo retroativo: integração real MySQL aprovada em banco isolado, lint mobile aprovado e tipos verificados. Não foi publicado nem gerado build.

Compatibilidade de publicação: clientes antigos validam o resumo com schema estrito. Por isso a API só acrescenta `overdueMedications` quando recebe `x-orami-summary-version: 2`, enviado pelo cliente atualizado. Sem esse cabeçalho, mantém o formato anterior para não quebrar o card dos APKs já instalados.

## Progresso de checks separado do treino — 02/11/2026

O título do resumo contabiliza somente checks de rotina (medicamentos, suplementos e injetáveis) e o check-in mental, quando habilitado. Treino planejado é uma atividade diferente: permanece na categoria `workout` e no estado `pending`, mas não altera o numerador nem o denominador de `checks`. Exemplo: nove checks concluídos e um treino pendente aparecem como `9 de 9 checks`, com `Treinos hoje: 0 realizados · treino planejado pendente` no detalhamento. Dois treinos realizados, inclusive fora de dias planejados, aparecem como `Treinos hoje: 2 realizados`, mantendo `9 de 9 checks`. A Home aplica a mesma separação: treino fica na meta semanal e fora da lista/contagem de checks diários. Atualizar esta regra e seu teste juntos para não voltar a apresentar checks completos como incompletos.

## Controle opcional da sessão de treino

É independente do resumo diário e dos lembretes de horário. Em Configurações → Treino em andamento, na confirmação inicial ou nas opções do treino, “Controlar pela notificação” ativa o card Android mediante permissão. Começa desligado; a preferência é salva separadamente por conta/aparelho. Desligar remove o card e o alarme de descanso sem encerrar a sessão ou perder séries. Com o controle desligado, a pessoa usa o app.

No APK com `FitWorkout.showControls`, a versão expandida informa treino, exercício, séries, tempo total e descanso, e permite registrar uma série, anterior/próximo e pausar/retomar. Nomes de exercícios podem aparecer com o aparelho desbloqueado; a ativação informa isso e a tela bloqueada usa visibilidade privada. Ações são persistidas com criptografia antes da atualização do card e recuperadas pelo app. Finalização exige confirmação no app. O módulo atualizado exige novo APK; versões antigas têm fallback básico. Regras, privacidade, limitações de entrega e testes ficam em `docs/workouts.md`, seção Notificação Android.
