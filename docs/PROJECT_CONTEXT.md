# PROJECT_CONTEXT — Super App de Saúde e Fitness

> Documento vivo de contexto de produto para planejamento, implementação e uso pelo Codex.
> Atualizado em 2026-10-25. Nome definitivo do produto **não definido**.
> **Ocean Fit é o nome da paleta visual, não o nome do aplicativo.**

## 1. Visão do produto

Construir inicialmente um aplicativo mobile **fitness social** para amigos e grupos registrarem treinos, compartilharem evolução, participarem de desafios e se motivarem. A visão de longo prazo é evoluir para um **super app de saúde, fitness e bem-estar**, reunindo treino, alimentação, acompanhamento corporal, medicamentos, suplementação, compromissos e relacionamento com profissionais.

**Princípios:**
- Metas personalizadas e justas: avaliar o cumprimento do plano individual, não exigir presença diária.
- Experiência social com **múltiplos grupos independentes**.
- Dados pessoais de saúde privados por padrão, compartilhados apenas com autorização específica.
- Construir um MVP enxuto sem impedir a expansão modular futura.
- Diferenciar claramente **decisão confirmada**, **proposta técnica** e **ideia futura**.

## 2. Escopo e prioridades

### MVP — núcleo do produto (direção atual)

1. Autenticação, cadastro e perfil de usuário.
2. Treinos: ficha/plano, registro de exercícios, séries, repetições, carga, finalização de treino e check-in.
3. Metas semanais **configuráveis**, progresso e alertas na Home.
4. Grupos de treinamento privados, convites, participação simultânea em vários grupos e alternância fácil de grupo ativo.
5. Feed **separado por grupo** com eventos automáticos de treino, publicações manuais de texto/foto, curtidas e comentários.
6. Progresso dos membros, desafios e ranking por grupo, respeitando metas individuais.
7. Home com cards de treino semanal, medicamentos do dia, suplementação do dia e alertas; os módulos completos de medicamentos/suplementos podem ser implementados por fases.
8. Notificações relevantes e controles básicos de privacidade.

**A avaliar na priorização do MVP:** registro básico de peso e medidas corporais. É desejável antecipá-lo se couber no cronograma.

### Roadmap futuro — não implementar automaticamente no MVP

- Gestão alimentar: refeições, alimentos, dietas, calorias e macronutrientes.
- Gestão de medicamentos: tratamentos cadastrados, tomadas previstas/realizadas, horários, histórico e lembretes.
- Suplementação: suplementos, doses previstas/realizadas e lembretes.
- Acompanhamento corporal avançado: composição corporal, fotos de evolução e comparações.
- Agenda genérica de compromissos, incluindo consultas, exames, reuniões e avaliações, com lembretes.
- Portal/perfil profissional: personal trainer, coach e, respeitadas as habilitações, nutricionista e outros profissionais.
- Relação profissional–aluno/paciente: prescrição/atribuição de planos dentro das competências legais, acompanhamento de treinos, adesão, dietas e evolução, com permissões explícitas.
- Personalização dos cards da Home; possíveis integrações externas.

## 3. Identidade visual — Ocean Fit (confirmada)

Estética moderna, limpa, esportiva, acolhedora e associada à saúde; evitar aparência hospitalar ou academia agressiva.

| Token | Valor |
| --- | --- |
| primary | `#0891B2` |
| secondary | `#67E8F9` |
| accent | `#14B8A6` |
| background.light | `#F2FAFC` |
| background.dark | `#101D27` |
| surface.light | `#FFFFFF` |
| text.light | `#16404B` |

Adotar tokens semânticos, suporte planejado a temas claro/escuro, contraste acessível, cards arredondados, ícones simples e gráficos legíveis. Inter ou Manrope são sugestões tipográficas, **não decisões finais**.

## 4. Home / Dashboard (confirmado conceitualmente)

A tela inicial deve apresentar, de forma clara:

- **Meta semanal de treinos:** por exemplo, `1/3`, barra de progresso, dias planejados e status.
- **Alertas de treino:** por exemplo, “Você está com 1 treino atrasado nesta semana”, sem tratar a semana como perdida antes de terminar.
- **Medicamentos:** card diário `0/5` = zero tomadas registradas de cinco previstas para hoje.
- **Suplementação:** card diário `1/3` = uma dose registrada de três previstas para hoje.
- **Próximos compromissos:** card reservado na visão do produto; módulo genérico de agenda é futuro.
- Acesso às configurações de metas por painel próprio.
- Navegação para treinos, grupos, feed e perfil; disposição exata ainda sujeita a UX.

**Importante:** metas de treino são **semanais**; contadores de medicamentos e suplementos são **diários**. Não confundir quantidade de produtos com quantidade de tomadas/doses previstas. Estados vazios devem existir quando o usuário não cadastrar medicamentos ou suplementos.

## 5. Regras de negócio — Meta semanal flexível (confirmadas)

### Configuração

- Usuário escolhe a **quantidade-alvo de treinos por semana** (ex.: 3 ou 6).
- Usuário seleciona **dias planejados** (ex.: segunda, quarta e quinta).
- Ciclo padrão: **segunda-feira a domingo**; parametrização futura pode ser avaliada.
- Haverá **painel de configurações** dedicado.
- Inicialmente a meta é configurada pelo próprio usuário; no futuro, coach autorizado poderá configurá-la ou sugeri-la, com regras de permissão.
- Preservar histórico/snapshot das metas por semana; mudar a meta atual não deve reescrever resultados de semanas anteriores.

### Atrasos, compensação e conclusão

1. Um dia planejado sem treino concluído gera **alerta de atraso**, não reprovação imediata.
2. Treinos feitos em outros dias da **mesma semana** contam para a meta semanal, mesmo fora do planejamento.
3. Exemplo: meta 3 treinos planejados para seg/ter/qua; usuário não treina nesses dias, mas treina sex/sáb/dom. **Meta semanal cumprida**.
4. A meta é considerada atingida quando o número de sessões válidas concluídas na semana for **maior ou igual ao alvo**.
5. A semana só é considerada **não cumprida após seu encerramento**, se o total for inferior ao alvo.
6. Na segunda-feira inicia novo ciclo, mantendo histórico do anterior.
7. Sequência/streak principal: **semanas consecutivas com meta atingida**, não dias consecutivos de academia.
8. Notificações devem informar quantos treinos faltam e quais dias planejados estão atrasados, sem linguagem punitiva.

**Detalhes a definir antes de codificar:** fuso horário do usuário, edição de metas durante a semana, o que conta como sessão válida, duplicidade de check-ins, treinos lançados retroativamente e exceções (pausa/lesão/férias).

## 6. Grupos de treinamento e isolamento de contexto (confirmado)

Um mesmo usuário pode participar de **vários grupos simultaneamente**, como:
- Grupo dos amigos;
- Grupo do trabalho;
- Grupo de alunos do Coach X.

Cada grupo deve ter **seus próprios** membros, administradores, feed, desafios, rankings e contexto. A interface deve ter **seletor visível para trocar o grupo ativo** rapidamente.

- Grupos privados por padrão, com convites.
- Relação usuário–grupo **muitos-para-muitos**, com papel de membro/administrador.
- Acesso a conteúdo de grupo exige participação/permissão.
- A ação de publicar deve indicar claramente o **grupo de destino**.
- Nunca replicar automaticamente conteúdo pessoal em todos os grupos.
- O treino é um registro **do usuário**, não uma cópia por grupo; ele escolhe se e onde compartilhá-lo.
- Rankings e desafios são específicos do grupo e devem considerar que pessoas podem ter metas semanais diferentes.
- Feed geral agregando grupos é **ideia a avaliar**, não substitui feeds isolados.

## 7. Feed social (confirmado como experimento central do MVP)

### Tipos de conteúdo

- **Eventos automáticos:** treino concluído, meta semanal atingida, conquista/marco; publicação condicionada às preferências de compartilhamento.
- **Posts manuais:** texto, foto ou combinação dos dois.
- **Interações:** curtidas e comentários.

Requisitos:
- Publicações vinculadas a um grupo específico e autor.
- Feed de cada grupo independente.
- Controles de visibilidade e exclusão/edição conforme regras a definir.
- Eventos automáticos devem referenciar o evento original, evitando duplicação de dados de treino.
- Planejar moderação/denúncia e proteção contra abuso antes de escala.

## 8. Acompanhamento corporal (desejado; fase a definir)

- Histórico de **peso** com data, metas e gráficos.
- **Medidas corporais:** cintura, abdômen, quadril, tórax, braços, coxas e panturrilhas; permitir lados quando fizer sentido.
- **Composição corporal:** percentual de gordura, massa gorda e massa magra estimadas, com método de avaliação.
- **Fotos de evolução:** histórico e comparação, privadas por padrão.
- Compartilhamento seletivo com profissional autorizado.

Possíveis entidades conceituais: `body_measurements`, `body_composition`, `progress_photos`, `body_goals`. **Não é schema Prisma final**.

## 9. Saúde, alimentação e profissionais (visão futura)

### Medicamentos e suplementos

- Cadastro de itens, posologia/planejamento, horários, lembretes, tomadas/doses concluídas e histórico.
- Cards na Home refletem adesão **do dia**, não recomendam dosagem nem substituem prescrição médica.
- Diferenciar medicamentos de suplementos no domínio, ainda que compartilhem componentes de UX.

### Alimentação

- Registro de refeições/alimentos, metas de calorias e macros, dietas e acompanhamento de adesão.
- Profissional habilitado poderá acompanhar o plano alimentar mediante consentimento.

### Profissionais

- Possíveis papéis: usuário comum, personal, coach, nutricionista, outros profissionais e administrador.
- Um usuário pode ser aluno de um profissional e membro de vários grupos ao mesmo tempo.
- Profissional acompanha alunos, treinos, dietas e evolução **apenas no escopo autorizado**.
- Permissões granulares, revogáveis e auditáveis; respeitar LGPD e competências profissionais.
- Evitar criar apps separados para aluno/profissional sem necessidade; preferir plataforma com papéis/permissões.

## 10. Agenda e compromissos (backlog futuro)

Módulo **genérico**, não apenas consultas:
- Título, descrição, data, horário, local, tipo/categoria e status.
- Exemplos de tipos: consulta, exame, reunião, avaliação física, sessão com personal, compromisso pessoal.
- Tipos extensíveis; lembretes e notificações configuráveis.
- Próximos compromissos na Home; histórico de realizados/cancelados.
- Preferir entidade genérica de compromisso + categoria, em vez de estruturas isoladas por tipo.

## 11. Stack e fluxo de desenvolvimento (planejados, sujeitos a validação)

- **Mobile:** React Native + Expo + TypeScript; foco inicial Android.
- **API:** NestJS + TypeScript.
- **Persistência:** PostgreSQL + Prisma.
- **Infra local:** Docker Compose; Redis apenas se houver necessidade real.
- **Desenvolvimento:** Ubuntu, OpenAI Codex CLI, Git/GitHub.
- **Operação remota desejada:** usar celular para acessar máquina Ubuntu por SSH/Tailscale, manter sessões tmux, dar instruções ao Codex e testar app com Expo Go.
- Para desenvolvimento remoto, avaliar Expo tunnel e acessibilidade da API na rede privada; não expor SSH publicamente nem colocar segredos em variáveis `EXPO_PUBLIC_*`.
- Hospedagem inicial pode ser local; arquitetura deve permitir migração posterior.

## 12. Diretrizes para implementação pelo Codex

1. **Não implementar todo o roadmap** por conta própria; executar apenas a fatia solicitada.
2. Preservar separação entre **dados pessoais** (treinos, medidas, saúde) e **dados de grupo** (feed, ranking, desafios).
3. Aplicar autorização no backend, não apenas esconder conteúdo na interface.
4. Garantir que contadores e metas tenham regras de período explícitas.
5. Manter datas em formato consistente, considerar fuso horário e ciclos semanais.
6. Projetar entidades para expansão, mas evitar abstrações e microserviços prematuros.
7. Criar migrações, testes de regras de meta semanal e isolamento de grupo.
8. Evitar expor dados sensíveis de saúde em feed, logs, analytics e notificações sem consentimento.
9. Em caso de ambiguidade de produto, pedir decisão em vez de presumir.

## 13. Decisões em aberto

- Nome comercial do aplicativo.
- Escopo exato da primeira release e ordem das telas.
- Política de alterações de metas durante semana em andamento.
- Quais eventos sociais são compartilhados por padrão (recomendação: opt-in).
- Critérios de ranking justos entre metas diferentes.
- UX final da navegação e do seletor de grupos.
- Regras de notificações, lembretes e permissões de coach.
- Inclusão de peso/medidas já no MVP.
- Implantação e estratégia de autenticação.

---

**Origem:** decisões e ideias fornecidas pelo idealizador em conversa de planejamento. Este documento registra intenção de produto, não significa que funcionalidades já estejam implementadas.
