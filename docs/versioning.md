# Versionamento do aplicativo

O aplicativo mostra uma versão curta para o usuário e mantém uma versão técnica compatível com o ecossistema Expo/Android.

- Versão exibida: `1.07`.
- Versão técnica (SemVer): `1.0.7`.
- Android `versionCode`: `10`, sempre crescente a cada novo APK.

A versão exibida fica em `expo.extra.releaseName`; a versão técnica e o código ficam em `apps/mobile/app.json`. A tela Configurações → Sobre o app mostra os três valores disponíveis no binário.

O formato público segue `principal.revisão` com dois algarismos (`1.01`, `1.02`, ...). No SemVer, a revisão pública corresponde ao patch (`1.0.1`, `1.0.2`, ...). Uma mudança maior de produto pode iniciar uma nova série, documentada antes da publicação. Atualizações OTA compatíveis não alteram o código do APK; um novo APK sempre incrementa o `versionCode`.

O menu da Home também exibe a versão pública em texto pequeno e discreto, abaixo de “Sair da conta”, usando a mesma fonte `expo.extra.releaseName` e fallback para `expo.version`. Manter essa indicação sincronizada com Configurações, sem número fixo no componente.


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
