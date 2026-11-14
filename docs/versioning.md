# Versionamento do aplicativo

A versão pública segue `MAIOR.INSTALAÇÃO.OTA`, com duas casas nos dois últimos grupos. A versão atual é `1.08.00`.

- Mudança compatível com atualização automática: incrementar o último grupo, por exemplo `1.07.09`.
- Mudança que exige reinstalação: incrementar o grupo de instalação e zerar o último, por exemplo `1.08.00`; incrementar também `android.versionCode`.
- O primeiro grupo só muda por decisão explícita do usuário, por exemplo `2.00.00`.

A versão pública do bundle fica em `apps/mobile/src/constants/release-version.ts` e aparece na Home e em Configurações. Manter `expo.extra.releaseName`, `expo.version` e o runtime nativo do APK instalado durante OTA: alterar a configuração nativa mudaria o fingerprint. Em novo APK, a versão técnica SemVer usa os mesmos números sem zeros à esquerda (ex.: `1.8.0`) e o código Android cresce. Republicar em APK uma atualização que já pode ser instalada por OTA mantém a versão pública e incrementa `versionCode`; o runtime do APK continua independente da versão pública do bundle.


## Distribuição versionada

O nome público do APK segue `orami-<SemVer>-android.apk`, por exemplo `orami-1.0.5-android.apk`. A versão curta continua 1.05 na interface. O site lê `/downloads/release.json` sem cache para apresentar versão/tamanho e apontar para o binário publicado; não inferir disponibilidade a partir da versão do código web. Falha ao obter o manifesto bloqueia o download e oferece orientação para tentar novamente.

Após compilar, executar `FIT_API_URL=https://orami.com.br FIT_PREVIOUS_APK=<apk-anterior> node scripts/prepare-android-download.mjs`. O script verifica assinatura, compatibilidade com a chave anterior, package, versionCode, versão e fingerprint embutidos no APK; gera manifesto e SHA-256 a partir do arquivo real. Publicar o binário versionado antes de ativar `release.json` por renomeação atômica. Conservar `/downloads/fit.apk` como compatibilidade e arquivos de runtimes OTA anteriores. Atualizar este contexto a cada release.

### Estado publicado em 02/11/2026

- APK ativo: `orami-1.0.2-android.apk` (versão pública `1.02`, `versionCode` 5).
- Tamanho: `107637485` bytes.
- SHA-256: `f9d12081951670920672204d52a578ddf90eb3fffd1499e9dfc4c1284890e2b6`.
- Runtime: `ba6eb55f9480c0d44f5c53593d08b7fcb077d92c`.
- A assinatura foi comparada com a 1.01; o download integral pelo domínio público reproduziu o mesmo SHA-256.
- `/downloads/release.json`, o link versionado e o alias legado `/downloads/fit.apk` apontam para a 1.02. O site exibe a versão e o tamanho vindos do manifesto.
- Backup anterior à publicação: `/home/luizserver/apps/fit/deploy/backups/release-1.0.2-20261102T150702Z` no servidor (privado).

## Conteúdo da 1.03

Execução guiada de treino com sessão persistente, recuperação offline, séries individuais, pausa, descanso e conclusão completa/parcial. O módulo Android inclui controles na notificação e aviso de descanso. Imagens de exercícios são gerenciadas exclusivamente pelo admin; ausência ou falha de imagem usa ilustração genérica. Treinos têm contagem própria, sem alterar os checks/check-in da rotina.

A API requer a migração `041-create-workout-runs`, aplicada pelo migrador na inicialização. A alteração nativa exige APK novo; a assinatura anterior é preservada para permitir atualização sobre a instalação existente.

### Estado publicado em 03/11/2026

- APK ativo: `orami-1.0.3-android.apk` (versão pública `1.03`, `versionCode` 6).
- Tamanho: `107706601` bytes.
- SHA-256: `4be46311feaefb4c024a1dca24adc87d830acf4c98e095e8c9f229698315023e`.
- Runtime: `8ebc914cfde29813bc302d73dde36607713212b3`.
- Assinatura conferida com o APK 1.02; pacote Android preservado para instalação por atualização. O download integral pelo domínio público reproduziu o SHA-256 local, e o navegador confirmou a versão/links do site.
- API atualizada e saudável, com migração `041-create-workout-runs` aplicada. O site público apresenta a 1.03 e seus links versionados; o alias `/downloads/fit.apk` também foi atualizado.
- Backup privado anterior: `/home/luizserver/apps/fit/deploy/backups/release-1.0.3-20261104T011321Z` (timestamp UTC), com cópia do banco/imagens/fontes em `~/.local/share/fit/deployment-backups/release-1.0.3-20261104T011321Z` no computador de desenvolvimento. APKs e runtimes anteriores foram mantidos.
- Homologação física dos novos controles de treino no Android continua pendente; a compilação e os testes automatizados não substituem o teste em aparelho.

### Atualização automática de layout — 04/11/2026

- Update ID: `53dec75c-f502-4f1f-bc7b-b774cbe76f14`, compatível com o runtime `8ebc914cfde29813bc302d73dde36607713212b3` do APK 1.03.
- A barra inferior passou a reservar sua altura no layout das cinco abas, incluindo a área segura inferior. Home, Fitness, Nutrição, Saúde e feed Social removem as compensações fixas de espaço para uma barra sobreposta. O texto final continua acessível em telas pequenas e com navegação de três botões.
- Typecheck/lint mobile e Playwright aprovados: larguras de 320, 339 e 390 px, simulação de áreas inferiores de 0, 24 e 48 px, posição do texto acima da barra e navegação nas cinco abas. Sem aparelho Android conectado nesta verificação.
- Atualização assinada publicada; assinatura da resposta e SHA-256 do bundle público conferidos. O APK de download permanece na 1.03 e consulta a atualização ao iniciar. Nenhum reinício automático durante treino/formulário.

## Conteúdo da 1.04

Confirmação do treino antes de iniciar, troca do planejado por qualquer treino disponível, contador com botão único e desfazer, cronômetros de tempo total e descanso simultâneos e estrutura estável dos cards. O rodapé mantém registro de séries e pausa acessíveis dentro da área segura. A notificação opcional passa a controlar exercício, séries, anterior/próximo e pausa/retomada; começa desligada e pode ser configurada antes/durante o treino ou em Configurações. Progresso e meta de treino continuam separados dos checks.

A mudança nativa exige APK novo (`versionCode` 7). Nenhum endpoint ou migração adicional é necessário nesta revisão. Os runtimes/APKs antigos permanecem disponíveis, sem receber código incompatível.

### Estado publicado em 04/11/2026

- APK ativo: `orami-1.0.4-android.apk` (versão pública `1.04`, `versionCode` 7).
- Tamanho: `107733409` bytes.
- SHA-256: `a3a268067943fc8ee77450824ba3a26c6d766871ef4bad9e3bb1f4d87168252a`.
- Runtime: `dc1bbac2b2ca88ce34e6c887b06d58f0f622ca02`.
- Assinatura comparada com o APK 1.03: certificado SHA-256 `8ca4c75ce8113cf0186a0fe63a0a0daad4aef0d64769cd27fae0c10428d559d4`. Pacote preservado para instalar por atualização.
- Download integral pelo domínio público conferido por tamanho/SHA-256. Navegador confirmou a versão 1.04 e os dois links do site; o alias `/downloads/fit.apk` tem o mesmo checksum. Manifesto ativado atomicamente após validar o APK no servidor.
- API saudável e sem alteração adicional nesta publicação. O runtime novo responde 204 sem OTA: o app usa o bundle embutido. Runtimes/APKs anteriores foram mantidos; esta mudança nativa não foi enviada por OTA para a 1.03.
- Backup privado dos metadados anteriores: `/home/luizserver/apps/fit/deploy/backups/release-1.0.4-20261104T112506Z`, com cópia em `~/.local/share/fit/deployment-backups/release-1.0.4-20261104T112506Z` no computador de desenvolvimento. O APK anterior permanece no servidor. Banco e imagens não foram alterados nesta publicação.
- Typecheck, lint mobile, testes de contratos/persistência, testes Android e Playwright dos fluxos parcial/completo em temas claro/escuro aprovados. Bancos e servidores locais de testes foram removidos/encerrados. A homologação física dos controles na notificação e das políticas de energia/permissão continua pendente; compilação e Robolectric não substituem esse teste.

## Conteúdo da 1.05

Capas ilustrativas de fichas: oito opções WebP 16:9 incluídas no app, seleção exclusiva do admin no portal, sem upload. Cópias e atribuições mantêm a capa de origem; fichas existentes recebem uma escolha pelo nome/objetivo e público explícito do programa, sem consultar o perfil pessoal nem alterar prescrições. Galeria e prompts em `design/plan-covers/README.md`.

Inclui ilustrações dos treinos A/B/C, treino ativo fixo na Home, conclusão do exercício inteiro, categorias e horários de refeições, salvamento local de refeições e sincronização agrupada de alimentação/treinos. Migrações 042–045 aplicadas pelo migrador da API.

### Estado publicado em 04/11/2026 — 1.05

- APK ativo: `orami-1.0.5-android.apk` (versão pública `1.05`, `versionCode` 8).
- Tamanho: `108364250` bytes.
- SHA-256: `a884b2812ba6795ee367cd05e3723096799e32cb704c644d7cd70c99c360d686`.
- Runtime: `f7e839017dc90323e4768f89b1b96a6e67ed760f`.
- Assinatura comparada com o APK 1.04: certificado SHA-256 `8ca4c75ce8113cf0186a0fe63a0a0daad4aef0d64769cd27fae0c10428d559d4`. Pacote preservado para atualizar a instalação existente.
- Manifesto ativado atomicamente após conferir o checksum no servidor; alias `/downloads/fit.apk` atualizado. APKs e runtimes anteriores preservados.
- API saudável; catálogo público e oito assets conferidos por SHA-256. As 10 fichas e os 10 modelos existentes têm capa. Migração validada primeiro em cópia isolada do banco de produção; hash das prescrições preservado.
- Backup privado de banco, mídia, fontes e metadados: `/home/luizserver/apps/fit/deploy/backups/release-1.0.5-20261104T205003Z`, com cópia em `~/.local/share/fit/deployment-backups/release-1.0.5-20261104T205003Z`. Dump adicional imediatamente antes da ativação; imagem anterior da API preservada.
- Testes de contrato/permissões e integração MySQL isolada, suíte padrão, typecheck, lint mobile, build web e APK aprovados. Validação visual no portal e app web em larguras de 320/390 px, com seleção e persistência reais. Homologação em aparelho Android continua pendente.

Download integral da 1.05 pelo domínio público conferido: tamanho e SHA-256 idênticos ao APK local assinado. As oito capas também foram localizadas no APK por hash de conteúdo.

## Versão 1.06 — 04/11/2026

Capas escolhidas pelo usuário em fichas próprias; Fitness sem figura decorativa adicional; fundos de treino renovados; horário de refeição editável diretamente; controles de séries sem quebra; modos de alimentação com descrições; estabilidade de reações, comentários, fotos e balanço da Home.

- APK: `orami-1.0.6-android.apk`, versionCode 9, 108375998 bytes.
- SHA-256: `731ecddf1d1e0227fc426620c9dde39bda4e6ee7e75fc49db8461615fc510d6e`.
- Runtime: `1cca6928d341c640121d6fc43cb043189b83357f`.
- Assinatura comparada com a 1.05 e preservada. API atualizada, sem nova migração. Backup privado em `deploy/backups/release-1.0.6` no servidor e em `~/.local/share/fit/deployment-backups/release-1.0.6` local; imagem anterior `fit-server-api:before-1.0.6` preservada.
- Typecheck, lint, testes gerais, integração MySQL e onze cenários E2E aprovados. Build Android concluído. Validação em aparelho físico permanece pendente.

Publicação concluída: manifesto ativado atomicamente, alias legado atualizado, download integral pelo domínio público com SHA-256 idêntico ao APK local e API `/health` saudável. APKs e runtimes anteriores mantidos.


## Versão 1.07 — 05/11/2026

Revisão de UX com séries individuais, carga/repetições e valores do treino anterior, descanso fixo e controles atualizados na notificação Android. Históricos de treino/cardio, cadastros e diário usam paginação; navegação, cabeçalhos, rodapés e números pt-BR seguem os padrões revisados. A API limita requisições por conta autenticada e preserva erros 4xx sem expor dados sensíveis nos logs.

A atualização do módulo nativo exige novo APK (`versionCode` 10). Não publicar o bundle por OTA para runtimes anteriores. As migrações de banco são as mesmas da 1.06.

- APK: `orami-1.0.7-android.apk`, versão pública `1.07`, `versionCode` 10, 108442334 bytes.
- SHA-256: `6b498e3f8b148367407ad4cbe043519f0b8453bd3eeca7c552880c9806fd370e`.
- Runtime: `2ba246dc9393399f3e8794010784b4ccf724497c`.
- Assinatura comparada com a 1.06 e preservada: certificado SHA-256 `8ca4c75ce8113cf0186a0fe63a0a0daad4aef0d64769cd27fae0c10428d559d4`. URL HTTPS de produção conferida no bundle.
- APK versionado e alias `/downloads/fit.apk` publicados; manifesto ativado atomicamente após verificar SHA-256 no servidor. APKs e runtimes anteriores mantidos.
- Site/API atualizados e saudáveis; home e portal respondem 200, acesso sem sessão e login inválido respondem 401. O runtime novo usa o bundle embutido (sem OTA).
- Backup privado de banco, mídia, fontes e manifesto anterior em `/home/luizserver/apps/fit/deploy/backups/release-1.0.7` e `~/.local/share/fit/deployment-backups/release-1.0.7`; imagem anterior preservada como `fit-server-api:before-1.0.7`.
- Typecheck, lint mobile, suíte da API com todas as integrações MySQL em banco dedicado, E2E do portal e build Android aprovados. Banco dedicado removido após a suíte. Validação em aparelho físico permanece pendente: nenhum dispositivo Android estava conectado.

Downloads integrais de `orami-1.0.7-android.apk` e do alias `/downloads/fit.apk` pelo domínio público conferidos: tamanho e SHA-256 idênticos ao APK local assinado.

### Atualização automática da 1.07 — 07/11/2026

- Update ID: `f8d0e770-2b88-41a8-aa32-23a83b49fece`, compatível com o runtime `2ba246dc9393399f3e8794010784b4ccf724497c` do APK 1.07. Sem novo APK e sem mudança de versão: `expo.extra.releaseName` entra no fingerprint, então alterá-lo em um OTA quebraria a compatibilidade com o APK instalado.
- Conteúdo: dock flutuante com Registrar global e mini-player de treino, rotina de hoje com dispensas, preferências de refeição e lembretes por dia da semana, ilustrações nos cartões das áreas/atalhos/estados vazios e cabeçalho da Início em dois níveis para telas estreitas.
- API atualizada antes do OTA (o bundle depende de `/me/preferences` e das dispensas), com migrações `046-health-item-schedule`, `047-daily-dismissals` e `048-user-preferences` aplicadas pelo migrador; contagens de usuários e suplementos preservadas. `/health`, home e portal respondem 200; rotas novas sem sessão e login inválido respondem 401.
- Backup privado de banco, mídia, fontes e manifesto em `/home/luizserver/apps/fit/deploy/backups/ota-1.07-20261107T025020Z` e `~/.local/share/fit/deployment-backups/ota-1.07-20261107T025020Z`; imagem anterior da API preservada como `fit-server-api:before-ota-1.07-20261107T025020Z`.
- Manifesto público conferido com os cabeçalhos de um aparelho 1.07: assinatura verificada com `certs/updates.pem` e SHA-256 do bundle idêntico ao manifesto. Typecheck, lint mobile e `npm test` aprovados; cabeçalho validado no app web em 320/360/412 px. Validação em aparelho físico pendente.

### Atualização automática da 1.07 — 09/11/2026

- Update ID: `5f26669f-d71b-43e4-9c88-5db37dda9aaa`, runtime `2ba246dc9393399f3e8794010784b4ccf724497c`. Galeria de ilustrações para medicamentos e suplementos, tomadas eventuais independentes da rotina e alinhamento da gaveta Registrar.
- API atualizada antes do OTA; migração `049-health-occasional-intakes` aplicada. API saudável, `/health` responde 200 e a rota eventual sem sessão responde 401.
- Backup privado do banco, mídia, fontes anteriores e manifesto em `/home/luizserver/apps/fit/deploy/backups/occasional-20261109`; imagem anterior preservada como `fit-server-api:before-occasional-20261109`.
- Manifesto público verificado com o certificado do app; hash do bundle público corresponde ao manifesto. Testes de API/MySQL, typecheck, lint e fluxo web aprovados. Validação visual nativa Android permanece pendente: emulador travou na inicialização.

### Atualização automática 1.07.08 — 09/11/2026

- Update ID `eb859564-f182-499f-89ef-07e69540bc3c`, runtime `2ba246dc9393399f3e8794010784b4ccf724497c`; versão pública do bundle `1.07.08`, sem alterar o APK ou seu fingerprint.
- Inclui seleção de imagens para injetáveis e galerias com cards alinhados. API atualizada com migration `050-injectable-illustration` antes da ativação.
- Manifesto público e hash do bundle conferidos; backup privado do banco, fontes da API e manifesto anterior em `deploy/backups/version-10107-20261109` no servidor. A imagem anterior da API foi preservada. A validação visual Android nativa permanece pendente.

### Instalador 1.07.08 — 09/11/2026

- APK público `orami-1.7.8-android.apk`, versionCode 11, 108754173 bytes, SHA-256 `c5744b73a1094dcfd8897f4c4eb5cb8c4d78308403d8656b38872d234fb6f6d2`, runtime `6f677f016200b2d40fa1ba0c8867c668e0c75249`.
- Contém os ajustes já distribuídos por OTA, incluindo as onze ilustrações para injetáveis e os cards alinhados. A assinatura foi comparada com o APK 1.07. O site lê a versão e o tamanho do novo manifesto; o arquivo antigo e seu manifesto OTA continuam disponíveis.
- É uma republicação do conteúdo existente no instalador: usuários que já receberam 1.07.08 por OTA não precisam reinstalar. O runtime deste APK é distinto do anterior; preservar os manifestos para ambos ao preparar atualizações compatíveis futuras.
- Backup privado dos metadados e do código web anterior em `deploy/backups/apk-10708-20261109` no servidor; imagem anterior da API preservada em `fit-server-api:before-apk-10708`.

### Atualização automática 1.07.09 — 09/11/2026

- Update ID `4217e755-3967-4376-bb79-c1cf0ca0e256`, runtime `6f677f016200b2d40fa1ba0c8867c668e0c75249`, compatível com o instalador 1.07.08. Versão pública do bundle `1.07.09`; sem mudança nativa.
- Início reorganizado em rotina, treino compacto, comunidade e balanço opcional. Atalhos duplicados removidos da Home/configurações; preferências históricas preservadas. Comunidade apresenta convites, grupos e publicações não lidas, com acesso ao feed e publicação explícita. Abas mantêm rótulos visíveis e larguras estáveis; o + abre Ações rápidas.
- Typecheck e lint mobile aprovados. Build Android e web aprovados; Playwright com API real em banco isolado validou navegação, comunidade vazia, falha/repetição, convites, publicação e novidades. Layout web verificado em 320/390/412 px, temas claro/escuro e áreas seguras inferiores simuladas. Sem validação em aparelho Android físico nesta entrega.
- Backup anterior em `deploy/backups/home-10709-20261109` no servidor, com fontes mobile e manifestos anteriores. Publicação atômica; manifesto público assinado e hash do bundle verificados. API e dados de produção sem alteração nesta entrega. Runtimes anteriores preservados.

### Atualização automática 1.07.10 — 10/11/2026

- Update ID `e29288d4-ce11-4fcf-806a-3436534a3592`, runtime `6f677f016200b2d40fa1ba0c8867c668e0c75249`, compatível com o instalador 1.07.08. Respostas a comentários com apenas um nível e cinco reações em comentários/respostas. Sem mudança nativa ou novo APK.
- Manifesto público, assinatura e SHA-256 do bundle conferidos após a ativação atômica. API atualizada antes do OTA; migration `051-comment-replies-and-reactions` aplicada e `/health` saudável. Backup privado de banco, fontes e manifestos em `deploy/backups/comments-10710-20261110` no servidor, com cópia local em `~/.local/share/fit/deployment-backups/comments-10710-20261110`. Imagem anterior preservada como `fit-server-api:before-comments-10710`.
- Typecheck, lint mobile e integração MySQL em banco temporário aprovados. A suíte padrão tem falha no teste antigo `versioning.test.ts`, que ainda exige a configuração nativa 1.0.7/versionCode 10. E2E ampliado, mas não executado nesta entrega; validação física Android pendente.

### Atualização automática 1.07.11 — 10/11/2026

- Update ID `26a62122-bcba-42ea-be3a-f27ab71f6827`, runtime `6f677f016200b2d40fa1ba0c8867c668e0c75249`, compatível com o instalador 1.07.08. Comentários e respostas exibem fotos dos autores; avatares de posts/comentários/respostas abrem a imagem ampliada, com carregamento, erro recuperável e fechamento sem perder a conversa. Inicial quando não há foto ou a miniatura falha.
- Sem alteração na API, nas permissões ou no banco. Backup privado das fontes mobile e manifestos anteriores em `deploy/backups/avatars-10711-20261110` no servidor e em `~/.local/share/fit/deployment-backups/avatars-10711-20261110` local.
- Typecheck, lint mobile e E2E `social-feed.spec.ts` aprovados com uploads, contas e comentários reais em banco efêmero isolado, incluindo respostas, reações, ampliação/fechamento e larguras de 320/390 px. Banco e servidores locais de teste encerrados após a validação. Homologação física Android pendente.
- Publicação atômica; manifesto público, assinatura e SHA-256 do bundle conferidos. API pública saudável; APK e runtimes anteriores preservados.

### Versão final consolidada 1.07.10 — 10/11/2026

- Por solicitação explícita do usuário, a versão pública final deste conjunto é `1.07.10`, substituindo a identificação intermediária `1.07.11`. Preserva respostas com apenas um nível, reações em comentários, fotos dos autores e ampliação dos avatares; acrescenta abertura da conversa ao tocar no contador de comentários. Conversas existentes continuam acessíveis quando novos comentários estão desativados, com aviso no lugar do editor.
- Update ID `4e6242aa-b954-4937-8fc6-654b57195a49`, runtime `6f677f016200b2d40fa1ba0c8867c668e0c75249`. Novo manifesto assinado com ID/data posteriores: aparelhos que receberam a identificação intermediária também recebem esta atualização. Configuração nativa, APK e banco sem alterações nesta publicação.
- Typecheck, lint mobile e E2E social aprovados com API real/banco temporário: contadores singular/plural, leitura com comentários desativados, respostas, reações e fotos ampliadas. Banco e servidores de teste encerrados. Validação física Android permanece pendente.
- Backup privado das fontes/manifestos anteriores em `deploy/backups/final-social-10710-20261110` no servidor, com cópia local em `~/.local/share/fit/deployment-backups/final-social-10710-20261110`. Manifesto ativado atomicamente; assinatura e hash do bundle público conferidos, API saudável. Histórico de publicações anteriores preservado acima para rastreabilidade.

### Início horizontal e instalador 1.07.11 — 10/11/2026

- Início com rotina acima do acompanhamento horizontal de Treino, Alimentação e Balanço opcional; navegação por toque, deslize e teclado, prévia lateral, altura adaptável e tema restaurado ao voltar de detalhes. Comunidade compacta reúne convites identificados e grupos com publicações não lidas, sem marcar leitura na prévia. Resumos refletem refeições salvas localmente e sincronizadas.
- APK público `orami-1.7.11-android.apk`, versão técnica `1.7.11`, pública `1.07.11`, `versionCode` 12, 108774325 bytes, SHA-256 `eaa134d720c209d65b2a545d65ea84b61befe661761a101811ecd831d764ed81` e runtime `6c4df187a53c5646b0970f3264af70b913235018`. Assinatura comparada com o instalador 1.07.08 e preservada. A renovação dos metadados do instalador mantém o ciclo de instalação 07; não há funcionalidade nativa nova.
- Atualização automática assinada `c33b5c23-5900-4174-b48e-f38fb8db6be2` para o runtime `6f677f016200b2d40fa1ba0c8867c668e0c75249` do instalador 1.07.08, com o mesmo conteúdo da nova versão. Manifestos de outros runtimes preservados; o novo APK usa o bundle embutido até existir uma atualização para seu runtime.
- Typecheck de todos os workspaces, lint mobile, suíte padrão e teste de consistência das versões aprovados. Os fluxos da home, comunidade, navegação e refeições foram validados com API/banco isolados; temas claro/escuro, 320/390/720 px, teclado, toque horizontal/vertical no navegador e refeições offline. APK de produção compilado; API HTTPS e versão conferidas no bundle. Validação em aparelho Android físico permanece pendente.
- Publicação por renomeação atômica. Download público integral conferido por tamanho/SHA-256; assinatura e hash do bundle OTA públicos verificados. Alias `/downloads/fit.apk`, checksum e manifesto apontam para o novo APK. Os dois botões do site foram conferidos em 390 px e mostram a 1.07.11. API saudável e acesso sem sessão à alimentação retorna 401.
- Backup privado anterior em `deploy/backups/home-carousel-10711-20261110` no servidor e `~/.local/share/fit/deployment-backups/home-carousel-10711-20261110` local, com fontes mobile e índices de atualizações/download anteriores. API e contratos já coincidiam com produção; nenhuma migração ou reinício de serviço foi necessário. APKs e atualizações anteriores mantidos.


### Correção de crash Android 1.07.12 — 10/11/2026

- A home da 1.07.11 usava `accessibilityRole="tabpanel"`. A enumeração Android `ReactAccessibilityDelegate.AccessibilityRole` não aceita esse valor e `fromValue` lança `IllegalArgumentException`. O painel usa agora `role="tabpanel"`, aceito pela enumeração nativa `Role`, mantendo a semântica na web. A validação anterior pelo navegador não cobria essa incompatibilidade.
- Teste de regressão `native-accessibility.test.ts` confronta os papéis literais de todos os componentes com a enumeração do Android da dependência instalada. Typecheck mobile/API, lint, teste de versão e regressão aprovados; APK release compilado. Nenhum aparelho físico estava conectado para homologação.
- Atualizações assinadas corretivas: `63ec147c-3823-4dce-bbbc-fd0b96d3133a` para runtime `6c4df187a53c5646b0970f3264af70b913235018`; `a9178ade-874b-4284-a8a6-ae46105f809b` para runtime `6f677f016200b2d40fa1ba0c8867c668e0c75249`. Assinaturas públicas conferidas. O APK defeituoso 1.07.11 foi retirado do download público e conservado no backup; durante o build, o site apontou temporariamente ao instalador anterior.
- Novo APK `orami-1.7.12-android.apk`, versão pública `1.07.12`, `versionCode` 13, 108774629 bytes, SHA-256 `4740a223b4a48bbcde2b38d6d0bf483e0ba274ce4b538b9c1ca78a4dfc9e5e16`. Assinatura anterior preservada. O build incremental mantém o runtime `6c4df187a53c5646b0970f3264af70b913235018`; esse é o runtime efetivamente embutido e publicado, a conferir antes de futuras OTAs. Bundle embutido conferido com a versão corrigida.
- Backup do incidente em `deploy/backups/crash-home-10712-20261110`, no servidor; a versão retirada e os índices anteriores permanecem preservados. API e banco sem mudança.

### Instalador 1.07.13 — 13/11/2026

- APK público `orami-1.7.13-android.apk`, versão técnica `1.7.13`, pública `1.07.13`, `versionCode` 14, 108795588 bytes e SHA-256 `2d72e3a1b6f5be24ef4ab97727e6689aa9cd20f48d909c1d5f4f8b4bc9ac71f4`. Runtime embutido e resolvido: `a126f4cba79af52c114ce47cde695bad7d968e2e`. Assinatura comparada com o instalador 1.07.08 e preservada.
- Recompilado com os fontes atuais: acompanhamento horizontal mantém a altura dos cartões, restaura a seleção ao voltar dos detalhes e preserva a correção de acessibilidade Android. Versão e API HTTPS conferidas dentro do bundle do APK.
- Typecheck dos workspaces, lint mobile e suíte padrão aprovados. E2E da Home aprovado com API real e MySQL local isolado: temas claro/escuro, 320/390/720 px, texto ampliado, teclado, navegação, refeição salva/sincronizada e balanço opcional. A primeira execução atingiu o limite de tempo; a repetição com limite ampliado concluiu sem falhas. Banco temporário removido e serviços locais encerrados. Homologação em aparelho Android físico permanece pendente.
- Manifesto ativado atomicamente após validar tamanho e hash no servidor; link versionado, alias `/downloads/fit.apk` e checksum atualizados. Os dois downloads públicos integrais reproduziram o tamanho e SHA-256 locais. Home, portal e `/health` respondem 200; alimentação sem sessão e login inválido respondem 401.
- API e contratos já coincidiam com produção; nenhuma migração ou reinicialização foi necessária. Esta publicação distribui um novo APK; manifestos OTA anteriores foram preservados, sem nova atualização automática para seus runtimes.
- Backup privado dos metadados, fontes mobile e manifestos anteriores em `deploy/backups/release-10713-20261113`, no servidor, e `~/.local/share/fit/deployment-backups/release-10713-20261113`, localmente. APKs anteriores mantidos.

### Versão 1.07.14 — 13/11/2026

- Fontes da `main` no commit `777a1b0`, com incremento dos metadados de release. Inclui ajustes da Home para telas largas, alinhamento dos cartões, comunidade e atualização dos resumos de alimentação após mudanças no perfil, peso e atividades.
- APK público `orami-1.7.14-android.apk`, versão técnica `1.7.14`, pública `1.07.14`, `versionCode` 15, 108801552 bytes e SHA-256 `ca75700e338175b7869d282d60202dc9e77a6a1d1b13670fffbd2761fc123710`. Runtime embutido e resolvido: `9a8b9fdb7df7ab105131824ab868f53e7cd2610f`. Assinatura comparada com a 1.07.13 e preservada; versão e API HTTPS conferidas dentro do bundle.
- Manifesto de download ativado atomicamente após conferir o arquivo no servidor; alias `/downloads/fit.apk` e checksums atualizados. Os dois downloads públicos integrais reproduziram o tamanho e SHA-256 locais. Home, portal e `/health` respondem 200; alimentação sem sessão e login inválido respondem 401. APKs anteriores preservados.
- Atualização automática assinada `83568fe6-2302-49f9-96c5-1f7ce061fdbe`, para runtime `a126f4cba79af52c114ce47cde695bad7d968e2e` do instalador 1.07.13. Manifesto ativado atomicamente após enviar assets; assinatura, SHA-256 do bundle público e versão 1.07.14 conferidos. Manifestos de outros runtimes preservados.
- Typecheck dos workspaces, lint mobile, suíte padrão, teste de consistência de versões e E2E da Home com API real/MySQL local isolado aprovados. Banco temporário removido e serviços de teste encerrados. Nenhum aparelho Android físico conectado para homologação.
- API, contratos e site já coincidiam com produção; nenhuma migração ou reinicialização foi necessária. Backup privado dos fontes e metadados anteriores em `deploy/backups/release-10714-20261113`, no servidor, e `~/.local/share/fit/deployment-backups/release-10714-20261113`, localmente.


### Versão 1.08.00 — 14/11/2026

- Fontes da `main` no commit `bcb94dc`, com atualização dos metadados de release. Inclui tela acesa e retorno tátil no treino, controles e fichas revisados, transições, reações e notificações agrupadas, semana do grupo com adesão individual ao placar e entrada por código sujeita à aprovação. Números de conquistas dependem da permissão do grupo e da escolha da pessoa.
- O novo módulo nativo `expo-keep-awake` exige instalação do APK; o ciclo de instalação passa de 07 para 08. Não distribuir este bundle por OTA aos runtimes anteriores.
- APK público `orami-1.8.0-android.apk`, versão técnica `1.8.0`, pública `1.08.00`, `versionCode` 16, 108881644 bytes e SHA-256 `924334fba72e64295085d829d35bbc09c55e3580b8498b41720b26e265ebc952`. Runtime embutido e resolvido: `c554649282e9ad3f8ad0b5527e5a11264342372e`. Assinatura comparada com a 1.07.14 e preservada; versão, API HTTPS de produção e módulo de tela acesa conferidos no bundle.
- API/site recompilados e API saudável. Migrações `052-reaction-notification-type`, `053-group-ranking-opt-in` e `054-activity-stats-and-join-links` aplicadas. Antes da ativação, foram validadas duas execuções do migrador em uma cópia isolada de produção: contagens das 57 tabelas existentes preservadas, novas preferências de compartilhamento e placar desligadas.
- Typecheck dos workspaces, lint mobile, suíte padrão, quatro integrações MySQL da comunidade e dois E2E de download aprovados. APK release compilado e assinatura validada. Nenhum aparelho Android físico conectado para homologação.
- Manifesto de download ativado por renomeação atômica após conferir tamanho e hash no servidor; alias `/downloads/fit.apk` e checksums atualizados. Os downloads públicos integrais do APK versionado e do alias reproduziram tamanho/SHA-256 locais; os dois botões do site mostram a 1.08.00 e apontam ao novo APK. Home, portal e `/health` respondem 200; grupos sem sessão e login inválido respondem 401.
- Backup privado do banco, mídia, fontes e metadados anteriores em `deploy/backups/release-10800-20261114`, no servidor, e `~/.local/share/fit/deployment-backups/release-10800-20261114`, localmente. Imagem anterior da API preservada como `fit-server-api:before-10800-20261114`. APKs e manifestos OTA anteriores mantidos. Contêiner MySQL temporário de validação removido.
