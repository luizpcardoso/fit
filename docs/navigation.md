# Navegação e hubs

A navegação principal é uma dock flutuante (`components/navigation-dock.tsx`) com quatro destinos: Início, Fitness, Nutrição e Saúde. O Início vem primeiro. Ao lado da pílula, um botão circular **+** abre a folha Registrar (`QuickRegisterSheet`) a partir de qualquer aba. A regra é que a pílula leva a destinos e o + dispara ações. A interface usa "Início" (não "Home").

O item ativo vira uma pílula preenchida com ícone e nome, com animação de largura que respeita "reduzir movimento". Os demais mostram só o ícone, mas mantêm o nome como rótulo acessível (`role="tab"`, `aria-selected`). Enquanto houver treino aberto, ou resultado salvo aguardando sincronização, um mini-player (`components/workout-mini-player.tsx`) aparece acima da dock em todas as abas e leva de volta à execução. Ele substitui o antigo banner dentro das telas. A dock some com o teclado aberto.

A dock participa do layout e reserva sua altura fora da área rolável das abas, sem ficar sobreposta ao conteúdo. O fundo é o da página, para a pílula parecer flutuante. A dock incorpora o `bottom inset` da área segura, então os ícones ficam acima da navegação do sistema, inclusive em aparelhos com três botões. Em telas largas, ela fica centralizada com no máximo 480 px.

Social não é uma aba. O feed único dos grupos fica em `/groups`, na pilha raiz, e é aberto pelo botão de grupos no cabeçalho do Início, que exibe o contador de posts não lidos. A tela tem "‹ Início" no topo. O avatar do Início abre o menu da conta. O antigo botão de menu ("hambúrguer") foi removido.

O botão Voltar do Android, quando usado em qualquer destino da dock, retorna primeiro para o Início. Somente quando o Início já está aberto um novo Voltar pode encerrar o aplicativo. Telas de detalhe, formulários e outros fluxos empilhados preservam a navegação para a tela anterior.

Telas abertas fora das abas usam o cabeçalho padrão `ScreenHeader` (`apps/mobile/src/components/screen-header.tsx`): à esquerda, Voltar com o nome do destino (por exemplo, "Fichas" ou "Saúde"); à direita, ações da tela e um atalho para o Início. O antigo botão flutuante foi removido porque cobria o conteúdo do topo. Telas com dados ainda não salvos registram `useUnsavedChanges`; Voltar e Início pedem confirmação somente quando há algo a perder.

Confirmações, avisos e erros usam `showDialog`/`confirmAction` e o retorno rápido `showToast` (`components/app-dialog.tsx`). `Alert.alert` não deve ser usado: no React Native Web ele não faz nada, e ações como arquivar ou excluir deixariam de funcionar no navegador.

O menu da conta (avatar no topo do Início) reúne Editar perfil, Meus profissionais, Configurações, Feedback e Sair da conta. Sair pede confirmação.

As funcionalidades secundárias ficam organizadas dentro de hubs:

- Fitness: Fichas, Treinos e Cardio;
- Nutrição: Alimentação e Gasto calórico, além do resumo diário;
- Saúde: Corpo e medidas, Medicamentos, Suplementos, Injetáveis e Mente.

No hub Saúde, cada card abre uma tela dedicada. Medicamentos e Suplementos não expandem mais conteúdo no fim da página: suas telas concentram resumo do dia, cadastro, busca, filtros, registros e edição, seguindo o mesmo padrão de navegação usado em Injetáveis.

Mente abre o MVP privado de bem-estar emocional, com check-in diário, diário, visão semanal, lembrete opcional e caminhos de apoio. A área não oferece diagnósticos nem compartilha registros com grupos.

A Home oferece até quatro atalhos editáveis, privados e sincronizados com a conta. No topo, o resumo "Hoje" agrega os horários de medicamentos e suplementos, aplicações previstas, check-in da mente quando habilitado, com treino contado separadamente na meta semanal. Ele mostra o progresso dos checks e abre uma lista completa com acesso direto a cada registro. A ação Registrar não fica mais no Início: é o + global da dock.

O card Fitness da Home resume o planejamento semanal sem competir com as atividades do dia. Treino e cardio ficam reunidos nele: o usuário pode iniciar um treino, adicionar cardio ou abrir sua gestão completa. A dock representa destinos; o +, a folha Registrar e os atalhos representam ações.

Essa hierarquia segue a orientação de manter poucas seções principais na navegação inferior (quatro), preservar sua posição e expor categorias secundárias em telas internas. A separação entre destinos e uma ação primária segue apps como Strava, Google Fit e o padrão de abas com ação separada do iOS 26. Em telas maiores, a mesma lista de destinos pode futuramente adaptar-se para uma barra lateral.

Referências:

- [Apple Human Interface Guidelines — Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Android Developers — Adaptive navigation](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation)
- [Apple Saúde — categorias fixadas e navegação](https://support.apple.com/en-ae/guide/iphone/iphe3d379c32/27/ios/27)

## Atalhos de Saúde Mental

Saúde Mental faz parte dos atalhos padrão da Home e da folha de registro rápido. A migration 033 acrescenta o atalho uma única vez às preferências existentes, preservando a ordem anterior. O limite de personalização passou de quatro para cinco opções. O usuário continua podendo editar os atalhos depois da migração.

## Balanço calórico opcional no Início

Em Configurações → Tela inicial, ou pelo botão Ocultar do próprio card, a pessoa pode esconder o balanço calórico do Início. A preferência fica salva só neste aparelho (`utils/home-preferences.ts`), como o tema, e não altera nenhum registro: consumo e gasto continuam na aba Nutrição.

## Meta semanal não definida

Enquanto a meta semanal não é configurada, o card Fitness não mostra um alvo presumido (antes aparecia "0/3"). Ele convida a definir a meta e informa os treinos já realizados na semana. Sem ficha ativa, a ação principal passa de Treinar para Criar ficha.

O botão Social do Início abre o feed único dos grupos; Meus grupos, convites e preferências ficam acessíveis a partir do feed. Detalhes em `docs/groups.md`.

Telas longas (execução e detalhes de treino, Alimentação, Mente, Corpo e medidas, Suplementos/Medicamentos, Perfil, Configurações e outras) usam `FixedScreenHeader`, que mantém voltar e Início visíveis durante a rolagem. Subseções de Fitness (Fichas, Histórico, Cardio) usam o mesmo voltar nomeado “‹ Fitness”, sem o botão Início porque já estão numa aba.

Glossário de interface: “Iniciar treino” para começar e “Continuar treino X” quando há sessão aberta; “Pendências de hoje · X de Y feitas” no Início e no resumo do dia; “doses” para medicamentos e suplementos. Históricos que crescem (treinos, cardio, Mente, cadastros de saúde, medidas, notificações e alimentos) mostram blocos com “Carregar mais”/“Ver mais” e a contagem exibida, nunca um corte silencioso.
