# Navegação e hubs

O menu inferior mantém cinco destinos estáveis: Fitness, Grupos, Início, Nutrição e Saúde. O Início permanece central e visualmente destacado. A interface usa "Início" (não "Home").

No Android, a barra inferior incorpora o `bottom inset` da área segura. Assim, ícones e rótulos permanecem acima da navegação do sistema, inclusive nos aparelhos configurados com os três botões, enquanto o fundo da barra ocupa a área até a borda da tela.

O botão Voltar do Android, quando usado em qualquer destino principal da barra inferior, retorna primeiro para o Início. Somente quando o Início já está aberto um novo Voltar pode encerrar o aplicativo. Telas de detalhe, formulários e outros fluxos empilhados preservam a navegação para a tela anterior.

Telas abertas fora das abas usam o cabeçalho padrão `ScreenHeader` (`apps/mobile/src/components/screen-header.tsx`): à esquerda, Voltar com o nome do destino (por exemplo, "Fichas" ou "Saúde"); à direita, ações da tela e um atalho para o Início. O antigo botão flutuante foi removido porque cobria o conteúdo do topo. Telas com dados ainda não salvos registram `useUnsavedChanges`; Voltar e Início pedem confirmação somente quando há algo a perder.

Confirmações, avisos e erros usam `showDialog`/`confirmAction` e o retorno rápido `showToast` (`components/app-dialog.tsx`). `Alert.alert` não deve ser usado: no React Native Web ele não faz nada, e ações como arquivar ou excluir deixariam de funcionar no navegador.

O menu do Início (ícone no topo) reúne Editar perfil, Meus profissionais, Configurações, Feedback e Sair da conta. Sair pede confirmação.

As funcionalidades secundárias ficam organizadas dentro de hubs:

- Fitness: Fichas, Treinos e Cardio;
- Nutrição: Alimentação e Gasto calórico, além do resumo diário;
- Saúde: Corpo e medidas, Medicamentos, Suplementos, Injetáveis e Mente.

No hub Saúde, cada card abre uma tela dedicada. Medicamentos e Suplementos não expandem mais conteúdo no fim da página: suas telas concentram resumo do dia, cadastro, busca, filtros, registros e edição, seguindo o mesmo padrão de navegação usado em Injetáveis.

Mente abre o MVP privado de bem-estar emocional, com check-in diário, diário, visão semanal, lembrete opcional e caminhos de apoio. A área não oferece diagnósticos nem compartilha registros com grupos.

A Home oferece até quatro atalhos editáveis, privados e sincronizados com a conta. No topo, o resumo "Hoje" agrega os horários de medicamentos e suplementos, aplicações previstas, check-in da mente e treino planejado. Ele mostra o progresso total e abre uma lista completa com acesso direto a cada registro. A ação Registrar ocupa um espaço secundário e abre uma folha inferior com as ações frequentes.

O card Fitness da Home resume o planejamento semanal sem competir com as atividades do dia. Treino e cardio ficam reunidos nele: o usuário pode iniciar um treino, adicionar cardio ou abrir sua gestão completa. O menu inferior representa destinos; a folha e os atalhos representam ações.

Essa hierarquia segue a orientação de manter poucas seções principais no menu inferior, preservar sua posição e expor categorias secundárias em telas internas. Em telas maiores, a mesma lista de destinos pode futuramente adaptar-se para uma barra lateral.

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
