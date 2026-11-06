# Treinos

## Decisões de produto

- Um usuário pode manter várias fichas, mas somente uma fica ativa.
- Trocar a ficha ativa preserva as anteriores como inativas; fichas também podem ser arquivadas e restauradas.
- Cada ficha possui de um a cinco treinos (Treino A, B, C…). As letras A–E são rótulos gerados, enquanto os nomes são definidos pelo usuário. No código e no banco o treino ainda se chama “divisão” (`workout_divisions`); a interface não usa essa palavra.
- Exercícios podem vir do catálogo ou ser criados manualmente e permanecem privados quando personalizados.
- Exercícios do catálogo podem ter uma imagem instrucional. A imagem aparece na seleção, nos detalhes da ficha e durante a execução do treino.
- Uma sessão conta quando o usuário a marca como realizada. É possível registrar o treino completo ou selecionar exercícios realizados.
- Vários treinos no mesmo dia são permitidos e contam individualmente.
- Lançamentos retroativos são permitidos.
- Treinos concluídos podem ter data, exercícios e status corrigidos.
- “Marcar como não realizado” (status `cancelled`) é reversível, preserva auditoria e deixa de contar para a meta. Na tela de correção, a mudança de status pede confirmação e é salva sozinha, sem levar as outras edições pendentes; “Salvar alterações” salva apenas data e exercícios.
- Fichas, sessões e exercícios personalizados são privados e acessíveis apenas ao proprietário.

Na criação de ficha, o seletor permite marcar vários exercícios do catálogo ou personalizados e confirmar o lote. Depois da confirmação, os exercícios aparecem em uma lista vertical de configuração, na ordem de seleção. Novos exercícios começam com 3 séries de 12 repetições, editáveis pelo usuário. Cancelar o seletor descarta apenas a seleção ainda não confirmada.

A ficha guarda um snapshot da imagem do exercício no momento em que é criada. Assim, uma troca posterior no catálogo não altera silenciosamente fichas já entregues aos usuários. Quando o snapshot está vazio (exercício do catálogo adicionado antes de ele ter imagem), a leitura da ficha usa a imagem atual do catálogo, sem gravar nada; exercícios próprios nunca herdam imagem. Teste: `apps/api/test/workout-image-fallback.integration.test.ts` (`RUN_DB_TESTS=1`, banco temporário).

## Validade das fichas

- Validade opcional na criação: sugestões de 30, 60 e 90 dias, prazo personalizado de 1 a 365 dias ou sem prazo. O formulário sugere 30 dias.
- A API calcula o vencimento a partir do instante de criação, armazenado em UTC; cada dia equivale a 24 horas. O app exibe a data no fuso do dispositivo.
- Fichas anteriores à funcionalidade ficam sem vencimento.
- A partir do vencimento, a lista, os detalhes e a execução mostram “Treino vencido”. O usuário continua podendo ativar e executar o treino normalmente.
- “Revalidar ficha” nos detalhes substitui a validade por um novo prazo **sempre a partir de agora**, inclusive se ainda estiver válida. Mantém ID, exercícios, histórico e estado de arquivamento.
- Somente o proprietário pode revalidar. Revalidar não cria ficha nem sessão de treino.

## Navegação

O menu inferior possui Fitness, Social (grupos), Início, Nutrição e Saúde. Fitness reúne Fichas, Histórico (treinos realizados) e Cardio. O topo de Fitness mostra o estado real antes da grade de áreas: com ficha ativa, um card com nome, próximo treino (o seguinte ao último realizado, A → B → C → A) e o botão “Treinar”, que abre a confirmação do treino, priorizando o planejado para hoje; sem ficha ativa, um aviso para escolher uma; sem fichas, o estado vazio com “Criar ficha”. Em Fichas, “Nova ficha” no cabeçalho só aparece quando o estado vazio (que já tem “Criar ficha”) não está visível, e “Fichas arquivadas” só aparece quando há fichas arquivadas.

As cinco abas principais ficam no grupo `(tabs)`. Criação de ficha, detalhes e edição de sessão são telas do Stack raiz, protegidas pela sessão; não são abas ocultas. Isso permite abrir esses fluxos e voltar à tela anterior.

As telas de pilha usam o `ScreenHeader` padrão (voltar nomeado pelo destino e atalho para Início). Confirmações usam `showDialog`/`confirmAction` (o `Alert` nativo não funciona na web) com rótulos verbo + objeto (“Arquivar ficha”, “Excluir ficha”, “Remover treinos”). Falhas de carregamento mostram erro com “Tentar novamente”, nunca um carregamento infinito.

Nos detalhes, a ficha é apresentada como um único objeto: identidade, estado, validade e totais aparecem no cabeçalho. Editar, revalidar, ativar ou desativar, arquivar ou restaurar e excluir ficam agrupados em “Ações desta ficha”, antes do conteúdo dos treinos. Os treinos A–E usam abas horizontais; somente a divisão selecionada exibe seus exercícios e a ação para iniciar, evitando uma pilha vertical de cards que pareçam assuntos diferentes.

Os treinos possuem contagem independente dos checks/check-in da rotina. A conclusão completa ou parcial atualiza a meta semanal de treinos, sem incrementar nem criar pendência nos checks diários. A Home mantém a lista de checks separada do treino; notificações exibem os treinos realizados hoje em linha própria.

## Execução guiada e sessão persistente

Antes de criar uma sessão, o app apresenta “Qual treino vamos fazer?” com o treino planejado para a data local. Sem planejamento, usa o próximo treino da ficha ativa; abrir um treino específico nos detalhes o pré-seleciona. “Escolher outro treino” lista todos os treinos com exercícios de fichas disponíveis, inclusive inativas. A escolha vale apenas para a sessão: não altera a agenda nem ativa outra ficha. Fichas arquivadas ficam fora da lista. O rodapé mantém “Iniciar treino A/B/C…” visível; o aviso explica que o cronômetro começará e que cada série será salva. Consultas da sugestão têm limite de espera para permitir usar as fichas em cache offline.

Somente confirmar “Iniciar treino” cria uma sessão com UUID, snapshot da ficha e exercícios, posição atual, séries realizadas e estado (`running`, `paused`, `completed`, `discarded`), e inicia o cronômetro. Abrir a confirmação ou trocar a seleção não cria sessão. Uma conta mantém no máximo uma sessão aberta. A Home mantém um card fixo acima da rolagem com treino em andamento/pausado, exercício atual, progresso, séries, tempo e “Continuar”; ele permanece visível ao rolar, inclusive sem conexão, e abre a sessão preservando seu estado. Fitness também oferece a retomada; sair da tela não descarta marcações. Treinos esquecidos não são finalizados automaticamente.

A execução apresenta um exercício por vez, imagem ampliável ou ilustração genérica local, prescrição e orientações. “Concluir exercício”, no rodapé fixo, registra todas as séries restantes do exercício atual em um toque, remove o estado pulado e encerra o descanso, preservando o cronômetro e os demais exercícios. A ação seguinte passa a “Próximo exercício” ou “Finalizar treino”; não há avanço ou finalização automática.

O botão “+ Série” junto ao contador mantém o registro uma série por vez, limitado ao total prescrito. “Desfazer” corrige a última série. Imediatamente após concluir o exercício inteiro, “Desfazer conclusão do exercício” restaura as séries parciais anteriores, sem apagar as que já estavam realizadas. Essa restauração em lote vale na tela atual até outra ação de progresso/navegação; após reabrir, continuam disponíveis as correções por série. Séries antigas marcadas fora de ordem continuam válidas: o contador preenche a primeira série ainda não realizada. Não há grade de checkboxes.

Setas anterior/próximo e “Trocar exercício” permitem navegar livremente, inclusive em pausa. Navegar não conclui exercícios nem reinicia o relógio. A lista geral, imagem ampliada, orientações, preferências e detalhes de sincronização abrem em painéis. “Concluir exercício” e pausa permanecem fora da rolagem e dentro da área segura, acima dos botões de navegação do Android. A estrutura reserva espaço para nome, prescrição, contador, ajuda e estado de salvamento; registrar/desfazer uma série ou iniciar descanso não altera a altura do card nem desloca os controles.

“Tempo total” (HH:MM:SS) e “Descanso” são mostrados simultaneamente em painéis separados. O tempo total também acompanha a pausa no rodapé. Pausar bloqueia o registro de séries e congela treino e descanso; retomar desconta o intervalo. O descanso começa automaticamente ao registrar uma série individual quando há duração prescrita; a última série e a conclusão do exercício inteiro encerram o descanso. Há início manual (60 s se não houver prescrição), reinício, acréscimo de 30 s e cancelamento. Ambos os cronômetros são derivados de horários, sem depender de um intervalo JS em segundo plano. Ao finalizar, o tempo registrado fica congelado.

Cada interação é persistida antes de atualizar a tela: SecureStore com fragmentos criptografados e troca atômica da geração no aplicativo nativo; localStorage na web, isolado por conta. O cache de fichas é separado do progresso. As fichas já carregadas permitem início offline, e o treino aberto continua disponível após reabrir. A autenticação recupera o perfil junto das credenciais em falhas de rede; revogação/autorização continuam na API. Ao sair com dados pendentes, um único diálogo oferece continuar no app para sincronizar ou sair e apagar os dados locais. Logout confirmado limpa o progresso local, as fichas em cache e a notificação; dados já sincronizados podem ser recuperados pela mesma conta no próximo login. A preferência booleana do card é guardada separadamente por conta/aparelho e permanece para o próximo login, sem guardar conteúdo do treino.

Sincronização usa versão e UUID de mutação. A requisição pendente é persistida para repetir exatamente o mesmo envio após queda de conexão/resposta perdida. Séries, navegação, pausa e descanso gravam apenas no aparelho. O primeiro bloco é enviado ao iniciar; as alterações seguintes são agrupadas em uma janela de cinco minutos, sem adiar o envio a cada toque. Há checkpoint ao reabrir, sair ou voltar ao app, envio imediato ao finalizar/descartar e botão manual. Sem alterações não há timer de consulta. Falhas usam espera progressiva de 1, 2, 4 e até 5 minutos; alternar o foco respeita essa espera. Controles da notificação também ficam locais e entram no próximo bloco. Alteração de outro aparelho ou outra sessão aberta produz conflito explícito: o progresso local é preservado até confirmar “Usar sessão da conta”. Não há sincronização contínua com o processo encerrado.

Finalização mostra exercícios completos, exercícios com séries parciais e mantém somente atividade efetivamente registrada. Sem séries realizadas, finalizar fica indisponível; é possível descartar mediante confirmação. A conclusão parcial conta uma sessão para a meta, como antes. Offline, o resultado fica pendente: API grava sessão e histórico na mesma transação, de forma idempotente; somente após sincronizar atualiza metas/histórico e permite compartilhar. Descarte não conta. A data do registro é a data local de início; continua corrigível no histórico. Não existe publicação automática nesta jornada.

O histórico distingue completo/parcial e séries realizadas. A tela de correção lê o snapshot original via `execution.runId` para mostrar os detalhes mesmo após editar/excluir a ficha. Correções de data, exercícios e status continuam no registro do histórico; o detalhamento de séries mostra explicitamente a execução original, sem reescrever auditoria.

### Notificação Android

O card é **opcional e desligado inicialmente**. “Controlar pela notificação” aparece na confirmação inicial, nas opções da sessão e em Configurações → Treino em andamento. A ativação solicita permissão do Android e explica que nomes dos exercícios podem aparecer com o aparelho desbloqueado. Negar permissão mantém o controle desligado. Desligar recupera as ações nativas pendentes e remove card/alarme, sem pausar, descartar ou apagar o progresso. O treino continua controlável pelo app e os cronômetros permanecem disponíveis.

O módulo local `FitWorkout`, no pacote `modules/fit-daily-summary`, usa `DecoratedCustomViewStyle`: recolhido, mostra treino/exercício, posição, séries e cronômetro; expandido, mostra também descanso e “Concluir série”, com ações do sistema Anterior, Pausar/Retomar e Próximo. Tempo total e descanso têm cronômetros nativos independentes. Completar séries respeita o limite da prescrição e fica indisponível em pausa; navegar não marca séries. Finalização e descarte permanecem no app com confirmação. Tocar no card abre a sessão. O layout compacto respeita os 48 dp disponíveis e o expandido usa a decoração e os estilos de texto do sistema, conforme a [documentação oficial de notificações personalizadas](https://developer.android.com/develop/ui/views/notifications/custom-notification).

As ações persistem o estado antes de atualizar o card, sem precisar de JavaScript. O snapshot nativo contém somente IDs, nomes dos exercícios, quantidade de séries, descanso e progresso, criptografado com Android Keystore; não contém carga, orientações, imagens ou tokens. Intents são privados/imutáveis e identificados por sessão, impedindo controles antigos de afetarem uma nova. Com o app aberto, um evento interno recupera as ações imediatamente; ao reabrir, o estado é recuperado e confirmado antes de sincronizar. O card usa visibilidade privada na tela bloqueada e respeita a permissão/canal do sistema. Dispensá-lo não descarta o treino; não há tentativa de impedir a dispensa pelo usuário.

O descanso usa um alarme nativo inexato, sem permissões de alarme exato ou sensores e sem serviço continuamente ativo. Economia de bateria/forçar parada podem atrasar ou impedir o aviso; ao reabrir, o tempo é recalculado e o progresso é recuperado. Após reinício do aparelho, a sessão é recuperada ao abrir o app; não há receiver de boot. Finalizar, descartar ou sair da conta remove card e alarme.

Os novos controles e layouts exigem **novo APK**. JavaScript detecta `showControls` de forma opcional: APKs anteriores mantêm o card básico Pausar/Retomar/Abrir e exibem a orientação de atualizar para navegar/registrar séries na notificação. Expo Go não possui os controles nativos. Web/iOS possuem execução persistente e controles no app, sem notificação contínua equivalente nesta entrega. A reformulação não adiciona endpoints nem migrações à sessão persistente já existente.

### Imagens: somente admin

Somente administradores podem cadastrar, substituir ou remover imagens de exercícios, com autorização novamente aplicada em `PortalContentService.setExerciseImage`. O portal oculta o editor de imagens para profissionais. Usuários/profissionais consomem as imagens cadastradas, sem campo de upload no treino. Mantêm-se validação JPEG/PNG/WebP de até 8 MB, otimização WebP, cache e snapshots existentes. Sem imagem, falha no carregamento ou indisponibilidade offline exibem a ilustração genérica com identificação de conteúdo ilustrativo. Não há preenchimento automático de fotos específicas do catálogo.

### Ilustrações pré-definidas dos treinos A/B/C

Cada treino da ficha pode ter uma ilustração opcional de grupo muscular. O seletor de criação/edição oferece 13 opções locais: peito, costas, pernas, ombros, braços, abdômen, glúteos, corpo inteiro e combinações costas + ombros, peito + ombros, peito + tríceps, costas + bíceps e pernas + glúteos. “Sem ilustração” remove a escolha. A imagem identifica o treino e não modifica nome, exercícios ou prescrições. Somente “Salvar ficha/alterações” persiste a seleção; ela participa da proteção de alterações pendentes.

A escolha é exibida nos detalhes e antes de iniciar. Os arquivos WebP têm 512 × 384 px, proporção 4:3, sem textos e sem recorte dos corpos. O catálogo é empacotado no cliente, sem download de serviço externo no app nativo. O desenho usa um fundo branco consistente, inclusive no tema escuro, e IDs desconhecidos/falhas têm alternativa local. A prévia da escolha reserva sua altura para não redimensionar o formulário ao trocar ou remover a imagem. Galeria e prompts: `design/workout-illustrations/README.md`.

Não existe upload neste fluxo. Escolher uma ilustração pronta para um treino próprio é diferente de cadastrar imagens instrucionais de exercícios: estas continuam exclusivas do admin. Fichas recebidas do profissional permanecem sem edição pelo aluno.

`illustrationId` é opcional/nullable e validado por enum em criação/edição de ficha. A migração `042-workout-division-illustration` adiciona a coluna nullable. Clientes anteriores que mantêm o ID do treino e omitem o campo conservam a ilustração existente ao editar; `null` limpa explicitamente. Reutilizam-se as rotas autenticadas atuais, sem novo endpoint ou URL arbitrária. Sessões/histórico não são reescritos ao trocar uma ilustração.

Distribuído no APK 1.05, com a migração aplicada pelo fluxo normal da API no servidor. Testes específicos: `apps/api/test/workout-illustrations.test.ts` (contrato e MySQL isolado) e `apps/mobile/e2e/workout-illustrations.spec.ts` (API real, claro/escuro, proporção/seleção e persistência em A/B, criação/edição, detalhes e confirmação de início).

### Persistência e implantação

A migração `041-create-workout-runs` cria `workout_runs`, privada por proprietário, com snapshot, progresso, versão, última mutação e vínculo ao histórico. Aplicar antes da nova API; o servidor usa o migrador existente. Rotas antigas de registro/correção continuam compatíveis. A ficha original não precisa existir para finalizar uma sessão previamente sincronizada. Um início inteiramente offline cuja ficha seja alterada/excluída antes do primeiro envio pode ser recusado pela API; o cliente mantém os dados locais e mostra o erro, sem associar silenciosamente exercícios diferentes.


## Endpoints

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/exercises` | Pesquisa catálogo de exercícios |
| `GET` | `/workout-plans` | Lista fichas do usuário |
| `POST` | `/workout-plans` | Cria ficha, divisões e exercícios |
| `GET` | `/workout-plans/:id` | Detalha ficha própria (inclui `origin`: `own` ou `professional`) |
| `PUT` | `/workout-plans/:id` | Edita ficha própria (nome, validade, treinos e exercícios) preservando o histórico |
| `POST` | `/workout-plans/:id/activate` | Ativa ficha e inativa a anterior |
| `PATCH` | `/workout-plans/:id/archive` | Arquiva ou restaura ficha |
| `POST` | `/workout-plans/:id/renew` | Revalida a ficha por 1 a 365 dias a partir de agora |
| `GET` | `/workout-runs/active` | Recupera a sessão aberta da conta (ou `null`), sem cache HTTP |
| `GET` | `/workout-runs/:id` | Recupera execução e séries próprias, inclusive encerradas |
| `PUT` | `/workout-runs/:id` | Cria/sincroniza por versão e mutação; encerra e registra histórico atomicamente |
| `GET` | `/workout-sessions` | Lista sessões realizadas/canceladas |
| `POST` | `/workout-sessions` | Registra sessão realizada |
| `PATCH` | `/workout-sessions/:id` | Corrige data, exercícios ou status |

Todos os endpoints exigem autenticação e derivam o proprietário do token. Identificadores enviados pelo aplicativo nunca concedem acesso a recursos de outro usuário.

## Adição e configuração de fichas

A entrada “Nova ficha” oferece criação personalizada, biblioteca de modelos prontos e fichas do personal. “Usar ficha do meu personal” só aparece quando `/me/professionals` retorna um vínculo ativo; se a consulta falhar, a opção continua disponível. O atalho para a biblioteca dentro do formulário some depois que um modelo é aplicado. Na biblioteca, chips filtram por nível e objetivo; o conteúdo vem do banco e não é renomeado, mas as referências são exibidas traduzidas (“Referências: ACSM, OMS”; “preparticipation screening” → “triagem pré-participação”) e o nível não é repetido quando já está no título. A biblioteca usa `/workout-plan-suggestions` e cria uma cópia editável; substituir uma configuração preenchida exige confirmação. Fichas do personal usam `/me/professional-assignments`, filtradas para treinos pendentes ou ativos do aluno autenticado. O aceite mantém o fluxo de consentimento existente; não copia prescrições privadas de outros profissionais.

Na configuração, imagens vêm somente dos metadados do catálogo autenticado e do armazenamento WebP existente. Miniaturas usam cache, proporção preservada, alternativa sem imagem e ampliação acessível. Séries variam de 1 a 20; repetições numéricas ou faixas podem ser incrementadas; orientações textuais continuam editáveis. Carga aceita vírgula ou ponto decimal e botões com passo de 0,5 kg, entre 0 e 2.000 kg. Descanso permanece opcional, de 0 a 3.600 segundos. Os contratos são validados novamente pela API.

O resumo fixo indica o total de exercícios e quantos treinos já têm exercícios. “Salvar ficha” fica fora da rolagem e dentro da área que acompanha o teclado. Navegar, voltar pelo sistema ou fechar a página com alterações pede confirmação. O rascunho permanece em memória quando uma operação falha; não há recuperação após encerramento forçado do aplicativo. Durante a persistência, o formulário fica bloqueado e a navegação só ocorre após confirmação da API.

`POST /workout-plans` aceita `requestId` UUID opcional. O cliente mantém a chave em tentativas com o mesmo conteúdo; a API serializa a criação por proprietário e retorna o mesmo ID para repetições, inclusive após uma resposta perdida. Uma mudança no conteúdo gera nova chave. A migração `034-workout-create-request` adiciona o campo nullable e o índice único por proprietário, mantendo clientes anteriores compatíveis. Aplicar as migrações antes de subir esta versão da API.

## Configuração compacta por exercício

A lista da divisão começa recolhida: cada card mostra número, nome, miniatura e resumo de séries, repetições, carga e descanso. Tocar no nome ou na seta abre apenas aquele exercício. Reordenação, remoção e observações ficam no card expandido.

A edição usa uma cópia temporária separada. “Salvar exercício” valida o contrato compartilhado, atualiza somente o rascunho da ficha em memória e recolhe o card, sem chamar a API. “Cancelar edição” restaura os valores anteriores; se houve alterações, pede confirmação. Trocar de exercício, divisão ou quantidade de divisões, ou abrir a seleção de novos exercícios, também protege ajustes pendentes.

“Salvar ficha” é a única ação que persiste a ficha. Fica desabilitado até salvar ou cancelar o exercício aberto. O fluxo final mantém a autenticação, autorização, idempotência e validação no backend existentes. Não há endpoint novo para esse salvamento local.

## Clareza no cadastro de ficha

A configuração é agrupada em “Sobre a ficha”, “Organização dos treinos” e “Escolha o treino para editar”. A quantidade aparece por extenso (por exemplo, “4 treinos” e “A, B, C e D”); “Alterar” revela opções com quantidade e letras na mesma linha. A ajuda diferencia listas de exercícios de frequência semanal. Reduzir a quantidade pede confirmação se os treinos removidos tiverem exercícios ou nomes personalizados.

As abas de edição mostram “Treino A”, “Treino B” etc. com a contagem de exercícios ou “Sem exercícios”. Elas rolam horizontalmente em telas pequenas, mantêm o treino ativo à vista e expõem seleção e agrupamento para tecnologias assistivas. O treino aberto indica sua posição na ficha. O vazio oferece uma ação direta para adicionar exercícios. Os cards de exercício continuam compactos e expandem para baixo.

Na criação, o prazo personalizado só aparece ao selecionar “Outro prazo”; os demais usos de `ValidityPicker` mantêm o campo sempre visível. O cabeçalho fixo reúne voltar, título e Home, evitando controles flutuantes sobre o conteúdo. O rodapé fixo mostra quantos treinos já têm exercícios e mantém “Salvar ficha” acessível. Na web, a rolagem do campo focado considera os limites do formulário, além do viewport, para evitar que cabeçalho ou rodapé cubram campos ao abrir o teclado. A validação direciona a rolagem ao nome, à validade ou ao treino incompleto, mantendo os dados preenchidos. O contrato e os endpoints existentes são preservados.

Referências de UX: [agrupamento de controles — W3C](https://www.w3.org/WAI/tutorials/forms/grouping/), [rótulos e instruções — WCAG](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) e [divulgação progressiva — Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/).

Validação desta revisão: typecheck dos workspaces e lint mobile aprovados; seis testes de contratos, controles e rotas de treino aprovados; integração MySQL de idempotência e isolamento aprovada em banco exclusivo; dois cenários Playwright (claro e escuro) aprovados com API e MySQL reais, incluindo larguras de 320 e 390 px, teclado, alteração de quantidade, proteção de nomes personalizados, cards expansíveis e persistência final.

O acesso por “Fichas → Criar ficha → Biblioteca” usa esse mesmo formulário. O bloco de quantidade tem fundo suave de destaque e rótulo explícito; as abas de edição aparecem em uma seção separada por divisor e espaçamento adicional.

## Edição de ficha

Decisão do produto: a pessoa edita a ficha atual (não cria cópia). Em “Ações desta ficha”, “Editar ficha” abre `workout-create?id=<ficha>` em modo edição: título “Editar ficha”, formulário preenchido, validade atual mantida até tocar em “Alterar validade” (o novo prazo conta a partir do salvamento, como na revalidação; “Sem prazo” remove o vencimento), botão “Salvar alterações”, aviso de alterações não salvas, toast “Ficha atualizada.” e retorno aos detalhes, que recarregam ao receber foco.

`PUT /workout-plans/:id` reaproveita as regras de criação (`updateWorkoutPlanSchema` = `createWorkoutPlanSchema` sem `requestId`, com `id` opcional em treinos e exercícios). Exige autenticação, valida com Zod (400), responde 404 para ficha inexistente ou de outro usuário e 403 `PROFESSIONAL_PLAN_READ_ONLY` para fichas recebidas de profissional (existe `professional_assignments.workout_plan_id` apontando para a ficha). Nesses casos o app não mostra “Editar ficha” e explica que o ajuste deve ser pedido ao profissional. Sucesso retorna a ficha atualizada (200).

Preservação do histórico (tudo em uma transação, com `SELECT … FOR UPDATE` na ficha):

- Sessões guardam snapshot de nome da ficha, nome e letra do treino, data, status e IDs dos exercícios realizados; a edição não altera `workout_sessions`.
- Treinos e exercícios enviados com `id` da própria ficha são atualizados no lugar, mantendo o ID referenciado pelas sessões. IDs desconhecidos ou repetidos viram linhas novas.
- Exercício com nome ou exercício de catálogo diferente do registrado ganha linha nova, para que sessões antigas não passem a mostrar outro exercício.
- Exercícios removidos são apagados da ficha; os IDs continuam nas sessões, e a correção de sessão informa quantos registrados não fazem mais parte da ficha.
- Treinos removidos são apagados por último (depois de mover exercícios mantidos); as sessões continuam no histórico e só perdem o vínculo (`division_id` vira `NULL`).
- As letras A–E são recalculadas pela posição. Metas planejadas que apontavam para um treino removido passam a exibir “qualquer treino”.

Testes: `apps/api/test/workout-edit.test.ts` (401, 404 de outro usuário, 400 para payload inválido, 403 para ficha de profissional, sucesso) e `apps/api/test/workout-edit.integration.test.ts` (MySQL: histórico preservado, validade mantida/removida, isolamento e bloqueio de ficha de profissional; roda com `RUN_DB_TESTS=1`).

## Verificação da sessão persistente

- `npm run typecheck`, `npm run lint --workspace=@fit/mobile`, `npm test`.
- `RUN_DB_TESTS=1 node --import tsx apps/api/test/workout-runs.integration.test.ts`: cria/migra/remove um banco exclusivo `fit_workout_runs_test_*`; usa as credenciais locais sem modificar o banco configurado.
- Playwright: `FIT_WORKOUT_RUN_E2E=1 FIT_E2E_WEB_URL=http://127.0.0.1:8099 FIT_E2E_API_URL=http://127.0.0.1:33329 npx playwright test --config apps/mobile/playwright.config.ts workout-run.spec.ts`. Requer API local com banco exclusivo de testes e Expo configurado para essa API. Cobre temas claro/escuro, larguras de 320 e 390 px, sugestão C e troca para A antes de criar sessão, contador e conclusão do exercício inteiro com desfazer sem alterar a altura do card, banner da Home fixo durante a rolagem, cronômetro, recarregamento, persistência offline, pausa, sincronização, conclusão parcial/completa pela ação principal, início de uma nova sessão, meta separada dos checks e detalhamento no histórico.
- Android: compilar `:fit-daily-summary:compileDebugKotlin` e executar `:fit-daily-summary:testDebugUnitTest` (relógio de pausa/descanso, controles de exercício/séries, layout real de RemoteViews e regressão do resumo diário). Homologar em aparelho a permissão negada, controles com JS encerrado, pausa/retomada, bloqueio de tela, reinício, economia de bateria e cancelamento de alarmes no logout. Compilação não comprova esses comportamentos físicos.

Na reformulação da execução, feedback de salvamento e contador usam regiões de status acessíveis sem mover o foco, conforme [WCAG — mensagens de status](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). Prévia opcional do conteúdo expandido (Robolectric, sem a moldura/ações do sistema): definir `FIT_WORKOUT_PREVIEW_PATH` ao executar os testes nativos. Essa prévia não substitui a homologação em aparelho.

O card fixo na Home e a ação de concluir o exercício inteiro são distribuídos no APK 1.05. Reutilizam a sessão persistente e a sincronização existentes, sem novo endpoint, migração ou alteração nativa. A conclusão atualiza o progresso da notificação existente; seu botão nativo de série permanece disponível conforme o APK instalado.


A sincronização adiada é compartilhada com a fila de refeições (`utils/deferred-sync.ts`), sem polling quando limpa. `deferred-sync.test.ts` verifica agrupamento, espera progressiva e recuperação; `deferred-sync.spec.ts` conta envios reais e verifica que marcar/desfazer várias séries não dispara uma requisição por interação. O cabeçalho opcional `x-orami-owner` é conferido com a identidade do token para impedir que uma tarefa pendente atravesse uma troca de conta; ele não concede acesso nem define o proprietário.

## Capa da ficha personalizada

O usuário pode escolher uma das oito capas locais ao criar ou editar sua própria ficha. O seletor usa miniaturas com proporção 16:9 e não faz upload de fotos. `coverId` opcional/nullable usa enum restrito no contrato de criação/edição; omitir na edição preserva a capa existente. A escolha explícita prevalece sobre a capa da sugestão, cuja existência continua sendo validada. Sem escolha no cliente legado, a API mantém a seleção automática existente. Fichas de profissionais continuam protegidas contra edição pelo aluno.

O card inicial de Fitness usa a capa da ficha sobre fundo sólido, sem figura decorativa adicional. Fundos da Home e banners de treino usam composições vetoriais próprias, exportadas em alta resolução por `node scripts/generate-scenes.mjs --fitness-only`. Os controles de séries têm uma linha própria para evitar quebra de Desfazer em telas estreitas. Cronômetros reservam espaço para as legendas de pausa/descanso.

## Execução com carga e repetições (novembro de 2026)

A tela de execução foi reorganizada para o ritmo série → descanso → série:

- Cabeçalho fixo com voltar, “Finalizar” e opções; abaixo, uma faixa fixa com treino, tempo total (selo “Pausado” quando for o caso) e progresso por exercícios (“2 de 9 exercícios”). Não há mais painel separado de tempo nem texto permanente de sincronização: o estado de salvamento aparece em Opções e só vira aviso na tela quando há erro.
- Registro simples (novembro de 2026): cada série é uma bolinha numerada; tocar marca ou desmarca. Não há kg/reps por série. A carga é um campo único e opcional por exercício (“última vez X kg”), preenchido com a última execução do mesmo exercício nesta divisão (`GET /workout-runs/previous?divisionId=`) ou, sem histórico/offline, com a prescrição. Reps não são digitadas: cada série grava as reps da última vez ou da prescrição (quando é um número), para o volume continuar disponível. Alterar a carga depois de marcar séries corrige a carga dessas séries sem mexer no descanso.
- Navegação por uma faixa horizontal de miniaturas (número, imagem ou ilustração genérica e selo de concluído/parcial); o botão de lista abre todos os exercícios. A barra fixa mostra “X de N exercícios”. O exercício atual mostra a imagem em destaque (toque amplia); sem imagem, a ilustração genérica.
- A confirmação inicial lista os exercícios abertos, com miniatura, séries × reps e carga prescrita.
- A ação principal do rodapé é “Concluir série X de N”; depois da última, “Próximo exercício” e, no fim, “Finalizar treino”. “Concluir todas as séries”, “Desfazer conclusão do exercício”, “Iniciar descanso”, “Pular por enquanto” e orientações ficam no menu do exercício. Pausado, o rodapé mostra só “Retomar treino”.
- O descanso fica numa barra fixa acima da ação principal, com contagem, −15 s, +15 s e Pular; ao zerar com o app aberto vibra uma vez e mostra “Pode continuar”. A linha “A seguir” mostra o próximo exercício e sua prescrição.
- Painéis (lista de exercícios, menu do exercício, opções) são bottom sheets com alça e botão fechar no topo; “Descartar treino” aparece em vermelho.
- O resumo final mostra duração, séries, exercícios completos e, quando informado, volume (kg × reps); lista completos, parciais e não feitos; e, depois de sincronizar, a meta da semana. “Concluir” volta ao Início; “Iniciar outro treino” volta à escolha.
- Com uma sessão aberta, Início, atalhos, Fitness e detalhes da ficha mostram “Continuar treino X” no lugar de iniciar.

Contrato: cada item de `progress.exercises` aceita `performed: { set, reps, loadKg }[]` opcional (reps 0–999, carga 0–2000, uma entrada por série dentro da prescrição; a API rejeita o resto). Progresso antigo sem `performed` continua válido. As regras puras (`toggleWorkoutRunSet`, `updateWorkoutRunSetValues`, `workoutRunVolume`, `completeWorkoutRunExercise` com valores) ficam em `packages/contracts/src/workout-run.ts`. Carga e reps não vão para o armazenamento da notificação: o app retira `performed` antes de entregar o progresso ao módulo nativo e os recoloca ao ler as ações feitas pela notificação.

Notificação Android (novo APK): recolhida, a segunda linha mostra o descanso (“Descanso até 10:42 · próxima série 3/4”) ou a contagem de séries. As ações do sistema seguem o momento: “Concluir série X/N”, Anterior e Próximo; durante o descanso, “Concluir série”, “+30 s” e “Pular descanso”; pausado, Retomar e Abrir treino. O descanso aparece como horário de término, não como contagem regressiva, porque o alarme continua inexato (decisão de produto: sem permissão de alarme exato) e uma contagem poderia passar de zero antes da atualização; ao disparar, o card passa a “Descanso concluído”. O card continua opcional e é oferecido uma vez, ao iniciar o primeiro treino no Android (“Ativar controle” / “Agora não”), além de Opções e Configurações.

Histórico: Fitness → Histórico usa `GET /workout-sessions/page` (20 por vez, “Carregar mais”), agrupa por semana (seg–dom) com “X de N” da meta quando a semana está completa na tela e mostra “Esta semana” no grupo atual. Detalhes da ficha mostram os treinos primeiro, a gestão (editar, revalidar, ativar, arquivar, excluir) no menu “⋯” e “Iniciar treino X” fixo no rodapé.
