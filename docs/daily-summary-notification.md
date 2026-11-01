# Resumo do dia nas notificações (Android)

Em Configurações → Resumo nas notificações, a pessoa pode ativar um card silencioso. A opção começa desligada e é salva no armazenamento seguro, por conta e aparelho. A ativação solicita a permissão do Android e informa que checks e calorias poderão aparecer na tela bloqueada, conforme a configuração do sistema. Não aparecem nomes de medicamentos, suplementos, aplicações, refeições, notas ou humor.

O card mostra checks concluídos/total, consumo e meta alimentar (quando definida), balanço estimado parcial, pendência genérica, data e horário da atualização. Tocar abre os checks do Início. Sem refeições ou dados suficientes, o balanço fica indisponível; não se transforma ausência de dados em déficit.

`GET /me/daily-summary?date=AAAA-MM-DD` exige sessão válida, deriva o usuário do token, valida a data e rejeita parâmetros extras. Agrega as rotinas, aplicações previstas, check-in e treino planejado pelos mesmos repositórios usados nas telas. O check-in conta como uma atividade diária; o treino entra apenas quando planejado para o dia. A resposta contém somente contadores, números nutricionais e categorias fixas, sem nomes, IDs de recursos ou conteúdo pessoal. Não é armazenada em cache HTTP.

O app atualiza o mesmo identificador de notificação ao ativar, depois de uma escrita bem-sucedida na API, ao navegar, voltar ao primeiro plano e na virada do dia enquanto estiver ativo. Não mantém serviço em primeiro plano nem consulta a API continuamente. Sem conexão, preserva o último resumo datado e mostra erro/tentativa em Configurações. Não há armazenamento local adicional do resumo. Desativar, sair ou perder a sessão remove o card e seu agendamento; uma resposta atrasada não pode republicá-lo.

Com o app fechado, os dados permanecem na última atualização. Uma notificação local com o mesmo identificador substitui os valores por “O dia mudou. Abra a Orami…” na próxima meia-noite. O agendamento usa o comportamento padrão do Android e pode atrasar por economia de energia; por isso o card sempre inclui sua data. Ao reabrir, a data local atual é consultada. Atualização remota enquanto o app está fechado não faz parte desta versão.

O canal “Resumo do dia” tem importância baixa, sem som, vibração ou badge. Android 14+ permite dispensar notificações `ongoing`; “Atualizar card” volta a exibi-la. O recurso usa notificações locais, disponíveis no Expo Go Android. A interface usa o layout nativo do sistema (expanda a notificação para ler todas as linhas).

Validação: testes da rota cobrem autenticação, sessão revogada, separação de contas, datas inválidas, parâmetros extras e ausência de conteúdo pessoal; testes do conteúdo verificam meta versus balanço, ausência de registros e virada de data. O comportamento visual, permissão e interação precisam ser conferidos no Android físico/Expo Go.
