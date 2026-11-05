# Observabilidade — contexto de trabalho

Estado no repositório em 02/11/2026, ainda não publicado. Leia ao alterar métricas,
instrumentação ou retenção; atualize contratos e este arquivo. Atualize o contexto
portal apenas quando seu fluxo/acesso mudar.

Decisão explícita: **30 dias de eventos / 12 meses de agregados**, dashboard exclusivo
do admin ativo, sem serviços externos ou conteúdo de saúde. A entrega original não
autorizou build do app; distribuição/homologação física ficaram pendentes.

## Definições (não inferir contagens clínicas)

- Contas: `users` existentes, incluindo admin/profissionais; cadastros: `users.created_at`. Não reconstruir uso a partir de registros de saúde.
- Ativos: contas distintas com evento de uso/ação observada. DAU: hoje; WAU: hoje + 6 dias; MAU: hoje + 29. Nunca somar únicos diários para obter semanais/mensais.
- Em uso agora: evento de primeiro plano nos últimos 5 min; não presença instantânea nem polling de notificações.
- Sessão: UUID efêmero por conta/abertura ou retorno após 30 min fora. Retorno antes disso mantém sessão; diferente da sessão de auth.
- Telas: navegação autenticada por lista fechada, sem parâmetros/rerenders duplicados; áreas início, fitness, alimentação, rotina de saúde, corpo, bem-estar, grupos, acompanhamento e conta.
- Ações: mutações bem-sucedidas em rotas mapeadas pelo servidor. Repetições bem-sucedidas podem contar novamente. Exclui consultas, falhas e leitura automática do feed; não equivale a treinos/refeições únicos.
- Ranking: contas distintas por funcionalidade/telas/ações; adoção = contas da funcionalidade / ativos. Conta pode aparecer em várias funcionalidades/plataformas/versões.
- Recorrentes: presentes em ≥2 dias. Frequência DAU/MAU não mede tempo de permanência.
- Ativação: nova conta com ação principal em até 7 dias. D7: retorno no sétimo dia local após cadastro. Somente coortes com janela completa e cadastro após início da cobertura; denominador zero → “—”.
- Qualidade: requisições/4xx/5xx/latência média/p95 por buckets 100/300/1000/3000/10000/>10000 ms nas rotas permitidas. Exclui painel, telemetria, mídia e healthcheck; mede servidor, não rede/renderização/crash nativo.
- Histórico mensal soma sessões/telas/ações/requisições recentes + snapshots antigos; sem IDs ou únicos mensais inventados após expirar eventos. Comparações sem cobertura completa são suprimidas.

## Dados, acesso e retenção

- `analytics_events`: UUID evento, ID interno conta, UUID sessão, tipo/tela/funcionalidade permitidos, plataforma/versão/timestamps. Pseudônimo, não anônimo; FK remove ao excluir conta.
- Proibidos nomes/e-mails/IPs/textos/URLs completas/query strings/nomes de fichas ou grupos/fotos/nutrientes/doses/medicamentos específicos/humor/peso/stack traces.
- `analytics_daily`: dia/funcionalidade sem usuário/sessão. `analytics_requests_daily`: método/template estático/estatísticas sem parâmetros/IDs reais. Ambos com retenção agregada.
- Limpeza inicial e horária serializada no banco: snapshot de dias encerrados idempotente, eventos fora dos 30 dias locais removidos, agregados fora dos 12 meses removidos.
- `ANALYTICS_ENABLED=false` interrompe coleta, mantém consulta e limpeza.
- Conta derivada do token; payload não aceita `userId`, propriedades arbitrárias ou ações de negócio do cliente. Painel verifica papel/suspensão atuais no banco; `private, no-store`.

## Transporte e limites

- `POST /me/analytics/events`: autenticado, 1–20 eventos/lote, 12 KB, 30 req/min/conta; somente `session_start`, `screen_view`, `heartbeat`. Atraso ≤24 h; futuro ≤5 min limitado ao relógio do servidor; UUID idempotente para retry.
- App: fila em memória ≤100; primeiro plano, heartbeat/min, envio a cada 15 s com eventos, timeout 5 s, descarte após 1 h. Logout/troca de conta cancela envio e limpa fila. Sem persistência sensível.
- Transporte independente do cache/assinaturas de mutação; erro não renova/encerra auth nem bloqueia operação.
- Expo dev excluído por padrão; `EXPO_PUBLIC_ANALYTICS_ENABLED=true` permite teste isolado, `false` desativa. Ações no servidor dependem do ambiente/banco: QA nunca aponta para produção.
- API agrupa requisições/ações em memória; flush 15 s, limites 500 templates/dias e 5000 ações. Best effort: queda perde último lote; commit falho reutiliza UUIDs de ações, estatísticas ambíguas não são regravadas para evitar duplicação. Flush antes de fechar banco.
- UI: 7/30 dias. Contrato suporta 90 para política futura explícita, rejeitado se excede retenção e oculto na UI.
- Sem reconstrução de telas/sessões anteriores. Versão vem de `Constants.expoConfig.version`; OTA com mesma versão não se distingue por digest/build.

## Mapa e cuidado SQL

- `packages/contracts/src/observability.ts`: taxonomia/lote/query/dashboard; `packages/api-client/src/index.ts`: `recordAnalytics`.
- `apps/mobile/src/utils/usage-tracker.ts`: sessão/fila; `components/usage-observer.tsx`: Router/AppState/visibilidade dentro de AuthProvider.
- `apps/api/src/observability-{model,repository,routes,config}.ts`: rotas/ações/datas/p95; SQL/snapshots/retenção; auth/hooks/buffers; configuração.
- Migração 040: quatro tabelas isoladas, sem alterar saúde. `apps/web/src/analytics.ts` + `style.css`: painel; novos assets precisam de `apps/api/src/portal.ts`.
- **SQL:** Sequelize instalado substitui `Date` usando fuso do host mesmo com conexão UTC. Preserve serialização explícita UTC; dias em America/Bahia (UTC−3), sem tabelas de fuso MySQL.

## Verificação e publicação

- `npm run typecheck`; `npm test`; `npm run lint --workspace=@fit/mobile`.
- `RUN_DB_TESTS=1 node --import tsx --test apps/api/test/observability.integration.test.ts`: banco temporário próprio; retries, UTC/Bahia, papéis/suspensão, coortes, snapshots/expiração. Nunca purga banco compartilhado.
- `npm run test:e2e --workspace=@fit/web`: fontes em memória, métricas/retentativa/período/390px, sem dist/APK/OTA. Tracker/transporte: `apps/api/test/observability.test.ts` sem runtime nativo. Capturas: `artifacts/ux-review/analytics-admin-*.png` ignoradas.
- Em 02/11/2026: tipos, lint, suíte padrão, integração MySQL e navegador aprovados, incluindo expiração com coleta desligada. Registro histórico, não validação da próxima tarefa.
- Publicação pendente: API aplica migração 040 no início e habilita coleta pelos padrões aprovados; telas/sessões exigem distribuir app atualizado. Totais de contas vêm da base existente.

Referências: [Expo Router screen tracking](https://docs.expo.dev/router/reference/screen-tracking/),
[Fastify hooks](https://fastify.dev/docs/latest/Reference/Hooks/); versões efetivas nas dependências locais.
