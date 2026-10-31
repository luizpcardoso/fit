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

A ficha guarda um snapshot da imagem do exercício no momento em que é criada. Assim, uma troca posterior no catálogo não altera silenciosamente fichas já entregues aos usuários.

## Validade das fichas

- Validade opcional na criação: sugestões de 30, 60 e 90 dias, prazo personalizado de 1 a 365 dias ou sem prazo. O formulário sugere 30 dias.
- A API calcula o vencimento a partir do instante de criação, armazenado em UTC; cada dia equivale a 24 horas. O app exibe a data no fuso do dispositivo.
- Fichas anteriores à funcionalidade ficam sem vencimento.
- A partir do vencimento, a lista, os detalhes e a execução mostram “Treino vencido”. O usuário continua podendo ativar e executar o treino normalmente.
- “Revalidar ficha” nos detalhes substitui a validade por um novo prazo **sempre a partir de agora**, inclusive se ainda estiver válida. Mantém ID, exercícios, histórico e estado de arquivamento.
- Somente o proprietário pode revalidar. Revalidar não cria ficha nem sessão de treino.

## Navegação

O menu inferior possui Fitness, Grupos, Início, Nutrição e Saúde. Fitness reúne Fichas, Histórico (treinos realizados) e Cardio. O topo de Fitness mostra o estado real antes da grade de áreas: com ficha ativa, um card com nome, próximo treino (o seguinte ao último realizado, A → B → C → A) e o botão “Treinar”, que abre a execução direto nesse treino; sem ficha ativa, um aviso para escolher uma; sem fichas, o estado vazio com “Criar ficha”. Em Fichas, “Nova ficha” no cabeçalho só aparece quando o estado vazio (que já tem “Criar ficha”) não está visível, e “Fichas arquivadas” só aparece quando há fichas arquivadas.

As cinco abas principais ficam no grupo `(tabs)`. Criação de ficha, detalhes e edição de sessão são telas do Stack raiz, protegidas pela sessão; não são abas ocultas. Isso permite abrir esses fluxos e voltar à tela anterior.

As telas de pilha usam o `ScreenHeader` padrão (voltar nomeado pelo destino e atalho para Início). Confirmações usam `showDialog`/`confirmAction` (o `Alert` nativo não funciona na web) com rótulos verbo + objeto (“Arquivar ficha”, “Excluir ficha”, “Remover treinos”). Falhas de carregamento mostram erro com “Tentar novamente”, nunca um carregamento infinito.

Nos detalhes, a ficha é apresentada como um único objeto: identidade, estado, validade e totais aparecem no cabeçalho. Editar, revalidar, ativar ou desativar, arquivar ou restaurar e excluir ficam agrupados em “Ações desta ficha”, antes do conteúdo dos treinos. Os treinos A–E usam abas horizontais; somente a divisão selecionada exibe seus exercícios e a ação para iniciar, evitando uma pilha vertical de cards que pareçam assuntos diferentes.

## Execução guiada

Na Home, “Abrir treinos” lista as divisões das fichas disponíveis, com destaque para a ativa. “Começar treino” nos detalhes abre a mesma jornada. A tela de execução mostra séries, repetições, carga, descanso e observações, permite marcar/desmarcar cada exercício (caixas de seleção acessíveis) e exibe o progresso. Há uma única ação principal, “Finalizar treino”, que salva a sessão pelo endpoint existente com os IDs dos exercícios marcados. Com exercícios pendentes, a confirmação explica que só os marcados serão registrados; sem nenhum marcado, a confirmação oferece “Registrar treino completo” (todos os exercícios do treino). Cancelar mantém as marcações. As marcações são locais até finalizar e não são recuperadas após fechar o aplicativo; enquanto houver marcações não salvas, sair pelo cabeçalho pede confirmação. Sem ficha ativa, a tela mostra um estado vazio (não um erro) com “Criar ficha” e, se houver fichas inativas, “Ver minhas fichas”; somente falha de rede mostra erro com “Tentar novamente”. O sucesso oferece acesso ao histórico. O restante dos indicadores demonstrativos da Home continua sendo uma prévia.

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
