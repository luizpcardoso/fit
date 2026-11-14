# Navegação e hubs

A navegação principal é uma dock flutuante (`components/navigation-dock.tsx`) com quatro destinos: Início, Fitness, Nutrição e Saúde. O Início vem primeiro. Ao lado da pílula, um botão circular **+** abre a folha Registrar (`QuickRegisterSheet`) a partir de qualquer aba. A regra é que a pílula leva a destinos e o + dispara ações. A interface usa "Início" (não "Home").

Os quatro destinos mantêm ícone e nome visíveis em uma linha, com larguras estáveis e ampliação de fonte limitada para caber na pílula; o item ativo recebe fundo preenchido. A animação respeita "reduzir movimento". Enquanto houver treino aberto, ou resultado salvo aguardando sincronização, um mini-player (`components/workout-mini-player.tsx`) aparece acima da dock em todas as abas e leva de volta à execução. Ele substitui o antigo banner dentro das telas. A dock some com o teclado aberto.

A dock participa do layout e reserva sua altura fora da área rolável das abas, sem ficar sobreposta ao conteúdo. O fundo é o da página, para a pílula parecer flutuante. A dock incorpora o `bottom inset` da área segura, então os ícones ficam acima da navegação do sistema, inclusive em aparelhos com três botões. Em telas largas, ela fica centralizada com no máximo 480 px.

Social não é uma aba. O feed único dos grupos fica em `/groups`, na pilha raiz, e é aberto pela entrada identificada como Comunidade no cabeçalho do Início, que exibe o contador de posts não lidos, e pelo card Comunidade. A tela tem "‹ Início" no topo. O avatar do Início abre o menu da conta. O antigo botão de menu ("hambúrguer") foi removido.

O botão Voltar do Android, quando usado em qualquer destino da dock, retorna primeiro para o Início. Somente quando o Início já está aberto um novo Voltar pode encerrar o aplicativo. Em Fitness, Fichas, Histórico e Cardio são seções da própria aba: o Voltar retorna antes à visão geral de Fitness. Telas de detalhe, formulários e outros fluxos empilhados preservam a navegação para a tela anterior.

Transições: as telas da pilha entram deslizando da direita; a execução do treino e a nova publicação entram de baixo, como fluxos que se abrem sobre o app (a execução não fecha por gesto lateral, só pelo próprio voltar). As abas da dock trocam com fade. Dentro de Fitness, mudar de seção volta ao topo e faz um fade curto, com o “‹ Fitness” fixo fora da rolagem. Carregamentos de Fitness, detalhes da ficha e início do treino usam esqueletos (`components/skeleton.tsx`) com o formato do conteúdo, em vez de indicador giratório; a visão geral reserva o espaço do card da ficha para a grade não se deslocar. Animações decorativas respeitam “reduzir movimento”.

Telas abertas fora das abas usam o cabeçalho padrão `ScreenHeader` (`apps/mobile/src/components/screen-header.tsx`): à esquerda, Voltar com o nome do destino (por exemplo, "Fichas" ou "Saúde"); à direita, ações da tela e um atalho para o Início. O antigo botão flutuante foi removido porque cobria o conteúdo do topo. Telas com dados ainda não salvos registram `useUnsavedChanges`; Voltar e Início pedem confirmação somente quando há algo a perder.

Confirmações, avisos e erros usam `showDialog`/`confirmAction` e o retorno rápido `showToast` (`components/app-dialog.tsx`). `Alert.alert` não deve ser usado: no React Native Web ele não faz nada, e ações como arquivar ou excluir deixariam de funcionar no navegador.

O menu da conta (avatar no topo do Início) reúne Editar perfil, Meus profissionais, Configurações, Feedback e Sair da conta. Sair pede confirmação.

As funcionalidades secundárias ficam organizadas dentro de hubs:

- Fitness: Fichas, Treinos e Cardio;
- Nutrição: Alimentação e Gasto calórico, além do resumo diário;
- Saúde: Corpo e medidas, Medicamentos, Suplementos, Injetáveis e Mente.

No hub Saúde, cada card abre uma tela dedicada. Medicamentos e Suplementos não expandem mais conteúdo no fim da página: suas telas concentram resumo do dia, cadastro, busca, filtros, registros e edição, seguindo o mesmo padrão de navegação usado em Injetáveis.

Mente abre o MVP privado de bem-estar emocional, com check-in diário, diário, visão semanal, lembrete opcional e caminhos de apoio. A área não oferece diagnósticos nem compartilha registros com grupos.

O Início mantém a rotina de hoje acima do bloco “Seu acompanhamento”, com três painéis horizontais: Treino, Alimentação e Balanço (opcional). Seletores nomeados permitem ir diretamente a cada tema; o deslize atualiza a seleção. Uma parte do próximo painel indica continuidade; o último painel ocupa também esse espaço e fica alinhado aos seletores. Não há rotação automática; a ordem é estável e a seleção é preservada ao abrir detalhes e voltar. Na web, setas esquerda/direita, Home e End navegam pelos seletores. Só o painel selecionado expõe ações ao leitor de tela e ao teclado. Os três painéis permanecem montados e compartilham a altura do maior conteúdo, inclusive com texto ampliado: trocar de tema não redimensiona a faixa nem desloca a Comunidade. O conteúdo adapta a altura ao mudar os dados ou a largura, sem rolagem vertical interna. Superfície, cabeçalho, margens e ações seguem um padrão comum; os seletores usam um controle segmentado com áreas de toque estáveis. O encaixe horizontal considera a largura do painel e o intervalo, também na web. Os painéis inativos ficam inertes na web e ocultos das tecnologias assistivas no Android/iOS. A partir de 1000 px de janela (tablet e web) a coluna do Início passa a 1120 px e os três painéis ficam lado a lado, sem seletores nem deslize; abaixo disso vale o carrossel. As folhas “Rotina de hoje” e “Menu” ficam centralizadas com no máximo 560 px. Comunidade fica abaixo, em uma prévia compacta. Os atalhos editáveis foram retirados da tela e das configurações; preferências já persistidas não são apagadas. O + global abre “Ações rápidas”, com acesso às áreas de registro e acompanhamento.

A rotina de hoje agrega medicamentos, suplementos, aplicações e check-in da mente quando habilitado; treino tem meta semanal separada. O card mostra o contador “feitas/total”, a próxima dose pendente com horário (“Próxima: 06:30 · …”, ou “Atrasada: …” quando o horário já passou) e quantas restam. Sem rotina, mostra “Nada programado” e explica onde as atividades aparecerão, sem dizer que tudo foi concluído. Falha de carregamento nunca é apresentada como dia vazio ou pendente: sem nenhum dado, o card vira “Não foi possível atualizar” e o toque tenta de novo; com dados parciais, avisa que parte da rotina não foi atualizada e a folha oferece “Tentar novamente”. Um check-in da Mente que não pôde ser verificado continua listado, mas fica fora da contagem.

O card Fitness mantém calendário semanal, meta e iniciar/continuar treino; detalhes e registro de cardio ficam em Fitness. Com meta planejada, uma linha nomeia o treino de hoje (“Hoje: Treino C · Pernas completo”) ou o próximo, e dias planejados que passaram sem treino ficam com borda tracejada e são lidos como “não realizado”. O botão principal só aparece quando as fichas foram carregadas: durante o carregamento há um indicador no lugar e, em erro, a nova tentativa fica no aviso.

O card Alimentação mostra kcal consumidas, proteínas, carboidratos e gorduras do dia, a contagem de refeições e a mais recente. Puxar o Início para baixo atualiza rotina, meta, alimentação, notificações e comunidade (no aplicativo; a web não tem o gesto).

A prévia Comunidade mostra o nome do grupo e quem enviou o primeiro convite pendente (abre `/social-groups`), junto de até dois grupos com publicações não lidas (abrem `/group-detail?id=...`). Convites não escondem novidades. “Ver tudo” abre o feed geral (`/groups`), onde ficam as ações de publicar. Sem novidades, mostra uma linha com acesso aos grupos; sem participação, uma apresentação curta. Carregamento e erro com nova tentativa não são tratados como ausência de grupos; falhas preservam novidades já carregadas sem afirmar que tudo está em dia. A prévia consulta somente grupos e convites: não busca posts nem marca publicações como lidas. Nenhum registro privado é publicado automaticamente.

Essa hierarquia segue a orientação de manter poucas seções principais na navegação inferior (quatro), preservar sua posição e expor categorias secundárias em telas internas. A separação entre destinos e uma ação primária segue apps como Strava, Google Fit e o padrão de abas com ação separada do iOS 26. Em telas maiores, a mesma lista de destinos pode futuramente adaptar-se para uma barra lateral.

Referências:

- [Apple Human Interface Guidelines — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Android Developers — Adaptive navigation](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation)
- [Apple Saúde — categorias fixadas e navegação](https://support.apple.com/en-ae/guide/iphone/iphe3d379c32/27/ios/27)

## Acesso à Saúde Mental

Mente continua disponível em Saúde e na folha Ações rápidas. As preferências históricas de atalhos são preservadas na conta, sem exibir uma seção duplicada no Início.

## Balanço calórico opcional no Início

Em Configurações → Tela inicial, ou pelo botão Ocultar do próprio card, a pessoa pode esconder o painel Balanço do Início. Alimentação continua disponível no acompanhamento, sem exibir calorias. Ocultar o painel selecionado retorna ao Treino. A preferência fica salva só neste aparelho (`utils/home-preferences.ts`), como o tema, e não altera nenhum registro: consumo e gasto continuam na aba Nutrição. Alimentação e Balanço usam o mesmo resumo do dia e refletem os registros salvos neste aparelho; o formulário e o estado de sincronização ficam fora da rolagem horizontal. O painel Alimentação mostra a contagem de refeições e a de horário mais recente, e permite registrar rapidamente, escolher alimentos ou usar a dieta. O painel Balanço compara consumo e gasto e abre os detalhes em Nutrição.

## Meta semanal não definida

Enquanto a meta semanal não é configurada, o card Fitness não mostra um alvo presumido (antes aparecia "0/3"). Ele convida a definir a meta e informa os treinos já realizados na semana. Sem ficha ativa, a ação principal passa de Treinar para Criar ficha.

O botão Social do Início abre o feed único dos grupos; Meus grupos, convites e preferências ficam acessíveis a partir do feed. Detalhes em `docs/groups.md`.

Telas longas (execução e detalhes de treino, Alimentação, Mente, Corpo e medidas, Suplementos/Medicamentos, Perfil, Configurações e outras) usam `FixedScreenHeader`, que mantém voltar e Início visíveis durante a rolagem. Subseções de Fitness (Fichas, Histórico, Cardio) usam o mesmo voltar nomeado “‹ Fitness”, sem o botão Início porque já estão numa aba.

Glossário de interface: “Iniciar treino” para começar e “Continuar treino X” quando há sessão aberta; “Rotina de hoje” no Início, com “X de Y feitas” para leitores de tela, e “X de Y feitas” no resumo do dia; “doses” para medicamentos e suplementos. Históricos que crescem (treinos, cardio, Mente, cadastros de saúde, medidas, notificações e alimentos) mostram blocos com “Carregar mais”/“Ver mais” e a contagem exibida, nunca um corte silencioso.
