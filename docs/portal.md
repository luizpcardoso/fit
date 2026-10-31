# Portal profissional

Usa as mesmas contas, sessões e MySQL do app. Servido pela API em `/portal`, com layout Petróleo responsivo e tema do sistema.

## Funcionalidades

- Tipos profissionais editáveis, capacidades por área e restrições individuais.
- Cadastro profissional exclusivo pelo administrador; senha temporária aleatória, exibida uma vez, válida por 48 horas; primeira ativação exige senha definitiva diferente e aceite das condições de uso de dados.
- Suspensão/reativação e regeneração de acesso para contas ainda não ativadas.
- Convites por e-mail válidos por sete dias, aceite/recusa pelo app, consentimento granular, redução de permissões e encerramento do vínculo.
- Bibliotecas globais e privadas organizadas por Fitness, Nutrição e Saúde & bem-estar: alimentos com porções e nutrientes, exercícios, categorias, fichas, metas, dietas e orientações de saúde mental.
- Busca, filtros de visibilidade/status/categoria e paginação nas bibliotecas; busca e paginação na auditoria.
- Fichas com divisões e configuração de exercícios; dietas com refeições, porções, nutrientes, substituições e orientações.
- Cada exercício pode ter uma imagem instrucional. O portal aceita JPEG, PNG ou WebP de até 8 MB e converte para WebP limitado a 900 × 700 px antes de armazenar.
- Conteúdos versionados e arquivamento reversível.
- Atribuição direta mediante capacidade manage, ou sugestão mediante suggest com aceite.
- Ajustes preservam versões anteriores e sessões realizadas. Fichas são materializadas nas tabelas de treino existentes e aparecem no app.
- Acompanhamento autorizado por área: treinos, metas, medidas, diário alimentar e check-ins mentais.
- Grupos: criação, edição, desativação/reativação, membros, convites por @usuário, papéis e remoção de membros. Proprietário não pode ser removido/rebaixado por esta ação.
- Auditoria administrativa com ator, ação, recurso e data.
- App: Perfil → Meus profissionais reúne convites, consentimentos e planos recebidos, incluindo prévia e aceite. Nutrição → Minha dieta mostra o plano por refeição, alternativas e macros; opções podem ser registradas no diário alimentar com ajuste das quantidades consumidas. Consulte `docs/nutrition.md`.

## Regras

O acesso ao aluno exige conta profissional ativa e ativada, capacidade no tipo, capacidade individual, vínculo ativo e consentimento para aquela ação. View, suggest e manage são independentes: para acompanhar e editar, selecione ambas as capacidades.

Ampliar permissões administrativas não amplia o consentimento do aluno. Novas áreas exigem novo convite após encerrar o vínculo anterior. Administradores não recebem acesso automático aos dados privados de saúde nem ao feed privado dos grupos.

Encerrar vínculo cancela sugestões pendentes, retira acesso profissional e preserva material recebido e histórico com autoria. Atualizar modelo não altera prescrições anteriores. Não há exclusão definitiva de planos pela interface web.

## Execução

1. `npm run build --workspace=@fit/web`.
2. Configure o MySQL existente em `apps/api/.env`.
3. `npm run api` aplica migrations e serve `http://localhost:3333/portal`.
4. Primeiro administrador: `npm run portal:admin --workspace=@fit/api -- seu-email`, usando uma conta existente.

Não há senha padrão no código. A conta de teste provisionada na conversa continua no banco até remoção solicitada. A promoção inicial exige acesso operacional ao banco.

Tokens ficam em memória: recarregar exige login; durante o uso, há renovação por refresh rotativo. Novos tokens são vinculados à sessão persistida: logout, suspensão e ativação invalidam essa sessão imediatamente. Tokens legados sem vínculo expiram pelo prazo anterior de 15 minutos. Fora do ambiente local, usar HTTPS.

## Limites do MVP

- A API ainda limita as listas administrativas e a biblioteca a 200 registros e membros a 500. A interface pagina e filtra esse conjunto; paginação no servidor continua necessária antes de volumes maiores.
- Progresso alimentar mostra os registros da data final selecionada. Ausência de registro não significa descumprimento.
- Fichas respeitam o limite atual do app: três disponíveis e uma ativa. Atribuições que ultrapassem o limite falham sem gravação parcial.
- O catálogo legado de exercícios continua existindo. Exercícios globais novos são gravados também no catálogo do app. A migração 029 importa as sugestões de fichas existentes para a biblioteca global do portal. Alimentos e modelos profissionais ficam na biblioteca no mesmo banco, sem expor alimentos privados dos usuários.
- Mente oferece orientações e acompanhamento de check-ins consentidos; não implementa prontuário clínico ou diagnóstico.
- Verificação de e-mail, recuperação de senha e MFA não fazem parte desta entrega. Homologação em dispositivo mobile físico continua necessária.
- O histórico de versões preserva as metas prescritas; os indicadores semanais seguem as regras atuais do app, que ainda não possuem snapshots completos de metas por semana.

## Verificação

`npm run build --workspace=@fit/web`, `npm run typecheck` e `RUN_DB_TESTS=1 npm test`.

A suíte com MySQL real cobre provisionamento, ativação única, bloqueio da senha antiga, restrições, isolamento, convites, consentimento, revogação, fichas integradas ao domínio existente, idempotência, versões e substituição, dieta sugerida/aceita e grupos. Registros sintéticos são removidos ao final.

A interface foi inspecionada no navegador: login, navegação, editor de fichas e editor de dieta a 390px sem overflow horizontal da página.
# Administração de profissionais e catálogos

O administrador pode criar um acesso profissional informando nome, sobrenome,
e-mail e telefone, e vinculá-lo a um tipo profissional previamente criado. O
tipo delimita as capacidades que podem ser concedidas. O profissional recebe
uma senha temporária válida por 48 horas e precisa definir uma senha definitiva
no primeiro acesso. Depois da ativação, a senha pode ser alterada pelo próprio
portal mediante confirmação da senha atual.

O administrador pode corrigir os dados básicos, trocar o tipo e as capacidades,
suspender ou reativar o acesso. A suspensão revoga as sessões do profissional.

Os catálogos de exercícios, fichas, metas, alimentos, dietas,
orientações e categorias exibem itens ativos e desativados. O administrador pode
criar, editar, desativar/reativar e excluir. A exclusão é bloqueada quando o item
já integra um plano ou sugestão; nesse caso ele deve ser desativado para preservar
o histórico. A migração 028 importa o catálogo legado de exercícios para a gestão
do portal, e a migração 029 importa as sugestões de fichas de treino existentes.
Na interface, as bibliotecas são agrupadas por Fitness, Nutrição e Saúde &
bem-estar e oferecem busca, filtros e paginação.
O editor de exercícios permite anexar, substituir ou remover uma única imagem.
Essa imagem aparece no catálogo e é preservada como snapshot ao criar uma ficha.


## Home pública

A raiz `/` apresenta o Fit, seus recursos e o botão para baixar o APK sem login no site. O acesso ao gestor está no cabeçalho e no rodapé, apontando para `/portal`.

O endereço do APK será configurado na constante `APK_DOWNLOAD_URL` em `apps/web/src/home.ts`. Enquanto estiver `null`, o botão leva à seção de download e informa que o APK estará disponível em breve. Ao definir a URL pública e recompilar o web, os botões passam a apontar para o arquivo. Para arquivos hospedados em outro domínio, configure `Content-Disposition: attachment` na hospedagem para garantir o download.


Dietas permitem 1 a 3 opções por refeição: nome da refeição + A, B ou C, gerados automaticamente. A é obrigatória; B/C são opcionais. Não há campo para nomear opções livremente. Renomear a refeição atualiza todos os rótulos; remover uma opção reordena as letras e libera a adição novamente. O limite também é validado pela API. Planos antigos excedentes não perdem alimentos automaticamente: o portal solicita revisão antes de salvar.
