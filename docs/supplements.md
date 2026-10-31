# Suplementos e medicamentos

A aba Saúde alterna entre suplementos e medicamentos, com resumo diário compacto, busca, filtros de ativos/pausados e lista virtualizada de cadastros. O botão `+` do resumo abre o mesmo modal de tomadas usado na Home; o `+` de cada linha filtra esse modal pelo item. Cadastrar e editar usam um formulário compartilhado. Medicamentos têm horários preenchidos pelo usuário, sem sugestões automáticas. Quantidade, unidade (incluindo gotas), apresentação/concentração e observações são opcionais.

Os dois módulos compartilham `supplements` e `supplement_intakes`, diferenciados pela coluna `kind` (`supplement` ou `medication`). A migração 005 classifica os registros existentes como suplementos sem alterar IDs ou tomadas. Cada rota fixa o tipo no servidor; todas as consultas e alterações verificam proprietário e tipo. As mesmas operações abaixo existem em `/medications`. O cliente normaliza os dois formatos em `HealthToday`, utilizado pelo modal e contadores comuns.

A Home possui contadores reais independentes para as duas categorias. Marcar todas as tomadas de um item exige confirmação, inclusive sobre horários futuros. As marcações podem ser desfeitas; repetir uma requisição não duplica o consumo. O dia segue o fuso do dispositivo e é atualizado ao retomar o aplicativo ou na virada da data. Alertas são visuais dentro do app; notificações push ainda não estão implementadas.

Referências de interação: [Medisafe — registrar doses](https://help-center.medisafe.com/en/articles/8103148-how-do-i-add-a-dose-of-my-med) e [MyTherapy — acompanhamento diário](https://www.mytherapyapp.com/).

Os suplementos são privados e acessíveis somente ao proprietário autenticado. O módulo organiza a rotina informada pelo usuário; não prescreve produtos, dosagens ou horários.

Cada suplemento possui nome, estado ativo/pausado e, opcionalmente, quantidade por consumo, unidade e observações. A frequência diária pode ser configurada entre uma e seis doses e exige um horário para cada dose.

Ao selecionar a frequência, o aplicativo sugere horários igualmente distribuídos em 24 horas, começando às `07:00` e arredondando para o múltiplo de 30 minutos mais próximo. Exemplos: duas doses sugerem `07:00` e `19:00`; três doses sugerem `07:00`, `15:00` e `23:00`; cinco doses sugerem `07:00`, `12:00`, `16:30`, `21:30` e `02:00`. As sugestões são apenas preenchimento inicial e todos os horários permanecem editáveis. Horários repetidos e formatos diferentes de `HH:MM` são rejeitados.

A Home mostra consumos realizados e previstos no dia. Tocar no card abre um modal, sem sair da tela, agrupado por suplemento. Nele, cada horário pode ser marcado ou desmarcado e “Marcar tudo” conclui todos os consumos pendentes daquele suplemento. Horários definidos que já passaram recebem um alerta discreto enquanto permanecerem pendentes. Na aba Saúde, cada consumo também pode ser marcado ou desmarcado. A unicidade por suplemento, data e posição impede duplicidade por repetição da requisição.

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

As telas usam `GET /supplements/page` e `/medications/page` com `page`, `pageSize` (padrão 5, máximo 50), `search` e `status=all|active|paused`. Os endpoints antigos continuam retornando arrays. Contagem e registros compartilham transação e a ordenação possui desempate por id.
