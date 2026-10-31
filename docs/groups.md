# Grupos e feed social

## Fotos temporárias e publicação conjunta

Na aba Grupos, “Publicar em grupos” permite selecionar destinos e enviar o mesmo texto/foto em uma operação. Todos os destinos devem permitir a publicação; as inserções são transacionais. Posts com imagem expiram após 48 horas da criação, incluindo texto e comentários. A API exclui o registro e o arquivo da imagem (quando nenhum outro post ainda o utiliza), com limpeza a cada minuto, na inicialização e ao consultar feed/mídia. Texto sem imagem não expira. Consulte `docs/mobile-performance.md` para armazenamento local, cache e migração das mídias antigas.

O avatar em Perfil pode ser alterado ou removido, não expira e é convertido para WebP de até 512 × 512 px. Fotos do feed usam até 1920 px, preservam proporção e são regravadas sem metadados. O username é único no banco; conflitos concorrentes retornam mensagem de identificador já utilizado.

## Escopo entregue

O módulo implementa grupos privados por convite, feed independente por grupo, publicações manuais com texto e uma foto, eventos de atividade, cinco reações, comentários, notificações internas e moderação. Discussões em formato de fórum permanecem fora deste escopo; por enquanto, a conversa acontece nos comentários das publicações.

## Regra central de consentimento

O administrador define quais tipos de conteúdo o grupo aceita. Cada usuário define, separadamente em cada grupo, quais atividades pessoais deseja compartilhar automaticamente. A permissão do grupo nunca ativa uma preferência do usuário nem substitui seu consentimento.

- Preferências começam desativadas (`opt-in`).
- Uma atividade só é publicada automaticamente quando o grupo permite o evento **e** o usuário o habilitou naquele grupo.
- Quando o compartilhamento automático está desativado, o usuário ainda pode escolher grupos permitidos no modal exibido após concluir a atividade.
- Um mesmo evento possui uma identidade de origem e não gera publicações duplicadas no mesmo grupo.
- Cancelar ou excluir a atividade original não apaga silenciosamente a interação social já ocorrida, mas impede recriar outra publicação para a mesma origem.

## Papéis e permissões

| Ação | Dono | Administrador | Moderador | Membro |
| --- | --- | --- | --- | --- |
| Editar grupo e tipos de evento | Sim | Sim | Não | Não |
| Desativar grupo | Sim | Não | Não | Não |
| Convidar e remover membros | Sim | Sim | Não | Não |
| Alterar papéis administrativos | Sim | Não | Não | Não |
| Transferir propriedade | Sim | Não | Não | Não |
| Consultar e resolver denúncias | Sim | Sim | Sim | Não |
| Publicar | Conforme configuração do grupo | Conforme configuração do grupo | Conforme configuração do grupo | Conforme configuração do grupo |
| Comentar e reagir | Sim | Sim | Sim | Sim |

O dono não pode sair sem antes transferir a propriedade. A API valida todas as permissões; esconder ações na interface não é usado como mecanismo de segurança.

## Eventos do feed

Os eventos configuráveis são:

- treino concluído;
- cardio concluído;
- meta semanal atingida;
- sequência de semanas mantida;
- entrada de membro no grupo.

Eventos automáticos exibem uma mensagem social curta e não expõem detalhes sensíveis do treino ou cardio. A publicação pontual também respeita os tipos aceitos pelo grupo.

## Privacidade e isolamento

- Apenas membros ativos acessam dados e mídia do grupo.
- O feed mostra somente conteúdo criado depois da entrada mais recente do membro. Sair, ser removido e voltar não restaura o histórico anterior.
- A foto é entregue por endpoint autenticado; não existe URL pública do arquivo.
- Fotos JPEG, PNG e WebP são validadas, reorientadas, redimensionadas para no máximo 1920 px, convertidas para WebP e regravadas sem metadados do arquivo original.
- Bloquear alguém oculta suas publicações para quem bloqueou.
- Conteúdo removido permanece como registro interno mínimo quando necessário para moderação e idempotência, mas deixa de aparecer no feed.

## Feed e interações

O feed é paginado em lotes de 30 publicações. Cada post pode conter texto, uma foto ou ambos. Há cinco reações: curtir, coração, força, fogo e aplausos. Comentários podem ser desabilitados para o grupo ou para uma publicação específica.

As notificações detalhadas são geradas para convite e comentário. As demais atividades sociais alimentam o contador de atualizações não vistas por grupo e o resumo da Home.

## Moderação

Membros podem denunciar publicações ou comentários visíveis por assédio, conteúdo ofensivo, spam, conteúdo sexual, privacidade, perigo ou outro motivo. Moderadores, administradores e o dono consultam a fila e podem dispensar a denúncia ou remover o conteúdo. Convites e operações de escrita social possuem limites de requisição.

## Principais endpoints

- `GET/POST /groups`: listar e criar grupos.
- `GET/PATCH /groups/:groupId`: detalhes e configuração do grupo.
- `GET /groups/invites` e `PATCH /groups/invites/:inviteId`: convites recebidos.
- `POST /groups/:groupId/invites`: convidar por nome de usuário.
- `GET/PATCH/DELETE /groups/:groupId/members`: membros e papéis.
- `GET/POST /groups/:groupId/posts`: feed e publicação.
- `PUT /groups/:groupId/posts/:postId/reaction`: criar, trocar ou retirar reação.
- `GET/POST /groups/:groupId/posts/:postId/comments`: comentários.
- `GET/PATCH /groups/notifications`: notificações internas.
- `POST/GET/PATCH /groups/:groupId/reports`: denúncias e resolução.
- `PUT /groups/:groupId/events`: tipos aceitos pelo grupo.
- `PUT /groups/:groupId/preferences`: consentimento individual por grupo.
- `POST /groups/share-activity`: compartilhamento pontual de uma atividade.

Os corpos e respostas são validados pelos schemas compartilhados de `packages/contracts` e consumidos pelo cliente tipado de `packages/api-client`.

## Persistência e testes

As migrations `016-create-groups-and-social-feed` e `017-preserve-group-timestamp-precision` criam o domínio e preservam precisão de microssegundos na fronteira temporal de acesso. O teste integrado `groups.integration.test.ts` cobre isolamento, entrada sem histórico retroativo, convite, papéis, consentimento, interações, denúncia e revogação de acesso.

## Compartilhamento após conclusão de treino

O app atual envia `shareAutomatically=false` ao concluir um treino e abre um modal sem grupo pré-selecionado. O usuário escolhe explicitamente os destinos. Consumidores antigos que omitem esse campo continuam usando preferências previamente autorizadas.

O conteúdo do modal é desmontado antes de limpar a atividade, evitando acesso a `activity.eventType` quando null. Uma falha social não transforma um treino já persistido em resposta de erro de conclusão. O compartilhamento manual valida propriedade da sessão e participação/permissão em todos os grupos dentro de uma transação; o índice único de origem/grupo existente impede publicações duplicadas por repetição e concorrência. Não há publicação parcial se um dos grupos selecionados não for autorizado.

## Leitura do feed no aplicativo

Ao abrir um grupo, as publicações começam logo abaixo de um cabeçalho compacto e fixo com nome, número de membros, retorno, Home e Configurações do feed. As configurações reutilizam a tela existente de preferências individuais, permissões de publicação/comentários, eventos aceitos, membros e convites, respeitando os papéis existentes. Apresentação, convite e formulário de escrita deixam de ocupar o início do feed.

Uma barra inferior oferece publicar texto ou foto. Ela se oculta ao descer e reaparece ao subir, com um limiar de movimento para evitar oscilações por pequenos gestos. Ao subir após afastar-se do início, aparece o atalho Ir para o topo; ele desaparece no início ou quando a leitura volta a descer. A barra respeita a área segura inferior e a lista reserva espaço para não cobrir a última publicação. Rolagem elástica não é interpretada como mudança de direção.

A escrita abre um editor separado, com estado de envio e erro recuperável. Fechar preserva o rascunho em memória enquanto a tela estiver montada; nenhuma cópia é persistida no dispositivo. Sucesso fecha o editor e leva ao começo do feed. Texto, fotos, comentários, reações, paginação e moderação continuam usando os contratos e endpoints reais existentes; não há mudança de visibilidade ou permissões. Membros sem permissão de publicação recebem uma mensagem em vez das ações de escrita.

## Confirmações, denúncias e papéis no aplicativo

- Ações destrutivas ou sociais pedem confirmação com rótulo verbo + objeto (ex.: "Remover publicação", "Excluir comentário", "Remover membro", "Transferir propriedade", "Sair do grupo", "Arquivar denúncia", "Remover conteúdo", "Recusar convite") pelo diálogo próprio do app (`showDialog`/`confirmAction`), que também funciona na web. Falhas viram aviso específico por tipo (sem conexão, sem permissão, já resolvido/não encontrado, limite de requisições) e nunca expõem detalhes internos.
- Ocultar um usuário pede confirmação, explica que a pessoa não é avisada e oferece "Desfazer" logo após a ação. Ainda não existe lista persistente de usuários ocultados para desfazer depois.
- Denunciar publicação ou comentário abre a folha "Denunciar" com os motivos aceitos pelo contrato (`groupReportReasonSchema`): assédio ou intimidação, conteúdo ofensivo, spam ou propaganda, conteúdo sexual, exposição de privacidade, conteúdo perigoso e outro motivo. O detalhe é opcional e limitado a 500 caracteres. A fila de moderação mostra o motivo traduzido e a data.
- Papéis aparecem como Proprietário, Administração, Moderação e Membro. A troca de função usa um seletor explícito com a descrição de cada papel e a função atual marcada; promover a Administração pede confirmação.
- Convite por @usuário explica o mínimo de 3 caracteres e diferencia usuário não encontrado (404), já membro/convite pendente (409), falta de permissão (403) e falta de conexão.
- Na aba Grupos, convites recebidos têm "Aceitar" e "Recusar" (com confirmação), ambos com indicador de envio e bloqueio de toque duplo; grupos inativos exibem o selo "Inativo"; erros ao criar grupo aparecem dentro do modal.
- Datas de publicações, comentários, notificações e denúncias usam `utils/dates` ("Hoje", "Ontem" ou dia abreviado + hora).

## Pessoas ocultadas

"Ocultar este usuário" grava em `user_blocks` e esconde publicações e comentários dessa pessoa nos feeds de quem ocultou; ela não é avisada. Em Configurações → Privacidade → Pessoas ocultadas (`app/blocked-users.tsx`), a pessoa revisa a lista e pode mostrar alguém novamente, com confirmação. `GET /users/blocked` é autenticado e devolve apenas as pessoas ocultadas pelo próprio usuário (identidade, nome público e avatar, nunca dados privados); `PUT /users/:userId/block` com `{ "blocked": false }` desfaz. A notificação de troca de função usa rótulos legíveis (Proprietário, Administração, Moderação, Membro), nunca o valor interno do papel.
