# Suplementos e medicamentos

A aba Saúde alterna entre suplementos e medicamentos, com resumo diário compacto, busca, filtros de ativos/pausados e lista virtualizada de cadastros. O botão `+` do resumo abre o mesmo modal de tomadas usado na Home; o `+` de cada linha filtra esse modal pelo item. Cadastrar e editar usam um formulário compartilhado. Medicamentos têm horários preenchidos pelo usuário, sem sugestões automáticas. Quantidade, unidade (incluindo gotas), apresentação/concentração e observações são opcionais.

Os dois módulos compartilham `supplements` e `supplement_intakes`, diferenciados pela coluna `kind` (`supplement` ou `medication`). A migração 005 classifica os registros existentes como suplementos sem alterar IDs ou tomadas. Cada rota fixa o tipo no servidor; todas as consultas e alterações verificam proprietário e tipo. As mesmas operações abaixo existem em `/medications`. O cliente normaliza os dois formatos em `HealthToday`, utilizado pelo modal e contadores comuns.

A Home possui contadores reais independentes para as duas categorias. Marcar todas as tomadas de um item exige confirmação, inclusive sobre horários futuros. As marcações podem ser desfeitas; repetir uma requisição não duplica o consumo. O dia segue o fuso do dispositivo e é atualizado ao retomar o aplicativo ou na virada da data. Alertas são visuais dentro do app; notificações push ainda não estão implementadas.

Referências de interação: [Medisafe — registrar doses](https://help-center.medisafe.com/en/articles/8103148-how-do-i-add-a-dose-of-my-med) e [MyTherapy — acompanhamento diário](https://www.mytherapyapp.com/).

Os suplementos são privados e acessíveis somente ao proprietário autenticado. O módulo organiza a rotina informada pelo usuário; não prescreve produtos, dosagens ou horários.

Cada suplemento possui nome, estado ativo/pausado e, opcionalmente, quantidade por consumo, unidade e observações. A frequência diária pode ser configurada entre uma e seis doses. Cada dose tem horário próprio ou o item fica **Sem horário** (`times: []`): as doses aparecem em “A qualquer hora” na Rotina de hoje, podem ser marcadas juntas e nunca geram notificação. Itens com horário têm a chave **Lembrar nos horários** (`remind`, padrão ligada), que retira o item da agenda de lembretes sem afetar a rotina. **Dias da semana** são opcionais (`weekdays`, segunda=1 … domingo=7; null = todos os dias): fora deles o item não entra na rotina, no resumo diário nem nos lembretes. Na lista de cadastros, o item fora do dia mostra “Não previsto para hoje”, sem contador nem botão de registro. Migration `046-health-item-schedule.ts` acrescenta `weekdays_json` (nullable) e `remind` (padrão verdadeiro), preservando os itens existentes; omitir os campos numa edição mantém os valores.

Ao selecionar a frequência, o aplicativo sugere horários igualmente distribuídos em 24 horas, começando às `07:00` e arredondando para o múltiplo de 30 minutos mais próximo. Exemplos: duas doses sugerem `07:00` e `19:00`; três doses sugerem `07:00`, `15:00` e `23:00`; cinco doses sugerem `07:00`, `12:00`, `16:30`, `21:30` e `02:00`. As sugestões são apenas preenchimento inicial e todos os horários permanecem editáveis. Horários repetidos e formatos diferentes de `HH:MM` são rejeitados.

A Home mostra consumos realizados e previstos no dia. Tocar no card abre um modal, sem sair da tela, agrupado por suplemento. Nele, cada horário pode ser marcado ou desmarcado e “Marcar tudo” conclui todos os consumos pendentes daquele suplemento. Horários definidos que já passaram recebem um alerta discreto enquanto permanecerem pendentes. Na aba Saúde, cada consumo também pode ser marcado ou desmarcado. A unicidade por suplemento, data e posição impede duplicidade por repetição da requisição.

Uma dose pode ser **dispensada** só naquele dia (`POST/DELETE /supplements|medications/:id/dismissals` com `{date, slot}`, idempotente, validando dono e tipo). A dose dispensada continua em `items` com `dismissedAt` para permitir desfazer, mas sai de `total`, `consumed` e `remaining` (contada em `dismissed`), do resumo diário, dos atrasos e da agenda de lembretes. Migration `047-daily-dismissals.ts` cria `supplement_dismissals` (único por item, data e posição).

Pausar um suplemento remove seus consumos das contagens futuras e do resumo atual, preservando o histórico. Editar a frequência muda a programação diária sem apagar registros já armazenados. Datas diárias são calculadas no fuso do dispositivo e enviadas como `YYYY-MM-DD`.

## Endpoints

- `GET /supplements`
- `POST /supplements`
- `PATCH /supplements/:id`
- `GET /supplements/today?date=YYYY-MM-DD`
- `POST /supplements/:id/intakes`
- `DELETE /supplements/:id/intakes`

## Exclusão e paginação

`DELETE /supplements/:id` e `DELETE /medications/:id` excluem logicamente o cadastro do próprio usuário. A migration 031 adiciona `deleted_at`; tomadas anteriores continuam armazenadas, enquanto o cadastro excluído deixa de aparecer no resumo/programação diária e não pode ser reativado pelo endpoint de edição. Pausar continua sendo uma operação distinta e reversível.

As telas usam `GET /supplements/page` e `/medications/page` com `page`, `pageSize` (padrão 5, máximo 50), `search` e `status=all|active|paused`. O app pede 20 por vez numa lista contínua com “Carregar mais”, sem paginação numerada nem rolagem interna. Tocar no card abre a edição; “Excluir” fica dentro da edição, com a mesma confirmação. O resumo do topo fala em doses (“3 doses pendentes · 2 atrasadas”). Os endpoints antigos continuam retornando arrays. Contagem e registros compartilham transação e a ordenação possui desempate por id.

## Uso eventual e imagens

Medicamentos e suplementos têm `usageMode` (`recurring` ou `occasional`) e `illustration` opcional (`tablet`, `capsule`, `bottle`, `drops`, `powder`, `shaker`; null usa a imagem padrão da categoria). Migration `049-health-occasional-intakes.ts` mantém cadastros anteriores como recorrentes; PATCH sem esses campos preserva seus valores. A galeria pronta não recebe fotos. As opções usam cards de largura fixa, legendas com espaço para duas linhas e rolagem horizontal, compartilhando o padrão com as imagens de treino e capas de fichas. Os vetores em `design/scenes/health-*.svg` e as miniaturas são gerados por `node scripts/generate-scenes.mjs --health-only`.

Eventuais não possuem obrigação diária: são excluídos de `/today`, progresso, atrasos, dispensas e agenda de lembretes, mesmo quando um cliente envia horários. Na tela de tomadas, **Rotina** e **Eventuais** são opções separadas. A imagem escolhida aparece nos cadastros, tomadas e Rotina de hoje, sem ser substituída pela conclusão. O card da Home mostra a quantidade de tomadas eventuais como texto secundário, fora da fração de progresso.

Endpoints equivalentes em `/supplements` e `/medications`:

- `GET /medications/occasional?date=YYYY-MM-DD`: retorna `{date, items, intakes, count}`; itens ativos eventuais e cadastros com tomadas nessa data, inclusive pausados ou atualmente recorrentes. Cada tomada tem `{id, itemId, date, time}`.
- `POST /medications/:id/occasional-intakes`: recebe `{operationId, date, time}` com UUID e horário local `HH:MM`. Exige item ativo eventual do proprietário e da categoria. Permite várias tomadas, inclusive no mesmo horário; repetir a mesma operação e dados é idempotente. Reutilizar a operação com outros dados é rejeitado.
- `DELETE /medications/:id/occasional-intakes/:intakeId`: desfaz individualmente e de forma idempotente. Um marcador de cancelamento preserva a identidade da operação, impedindo que reenvios posteriores recriem a tomada desfeita.

As tomadas ficam em `supplement_occasional_intakes`, separadas dos slots recorrentes. Trocar o modo não converte nem apaga registros; pausados não aceitam novas tomadas. Cadastros excluídos saem das consultas, mantendo as tomadas armazenadas. Dados e operações são privados, filtrados por usuário e categoria no servidor.

O horário inicial é o atual e pode ser ajustado. O fluxo **Registrar em data anterior** oferece os eventuais separadamente. Falhas de envio mantêm a operação para tentar novamente sem duplicidade; botões ficam bloqueados enquanto a gravação está em andamento.
