# Servidor caseiro

Endereço público do site e da API: https://rasheeda-disillusive-riotously.ngrok-free.dev

O APK usa esse mesmo endereço HTTPS. O celular não precisa de Tailscale. O servidor precisa permanecer ligado, conectado à internet e ao ngrok. O navegador pode mostrar a confirmação inicial do plano gratuito do ngrok.

## Operação

SSH: `ssh luizserver@100.86.240.40`. Projeto: `/home/luizserver/apps/fit`.

Na pasta do projeto no servidor:

```sh
docker compose --env-file deploy/runtime.env -f compose.server.yaml up -d
docker compose --env-file ~/.config/fit/ngrok-web.env -f deploy/compose.public.yaml up -d
```

Os contêineres reiniciam automaticamente com o Docker. O proxy encaminha o site e a API ao serviço `api`; o banco não tem porta pública. A identidade histórica do projeto do proxy é `fit_web_preview`. Não usar mais `compose.web-preview.yaml`: ele serve somente a prévia estática sem API.

Credenciais privadas: `deploy/runtime.env` e `~/.config/fit/ngrok-web.env` no servidor. Não versionar nem compartilhar esses arquivos. O domínio do ngrok está no compose público e na configuração de CORS.

## Dados

Banco ativo MySQL 9.7.4 LTS no volume `fit_server_mysql_data_lts`; imagens em `deploy/data/media`. O volume anterior `fit_server_mysql_data` foi preservado para recuperação da migração de 30/10/2026 e não é o banco em uso. A migração inicial foi preservada em `deploy/backups/initial` no servidor e em `~/.local/share/fit/deployment-backups` no computador de desenvolvimento. Sete tabelas foram conferidas após a importação. Não reimportar a cópia inicial sobre o banco em uso. Não executar `docker compose down -v`.

Para uma nova cópia do banco em uso no servidor, executar um dump consistente com o cliente MySQL do contêiner e arquivar também `deploy/data/media`. Guardar cópias privadas fora do servidor. O script `deploy/backup-current.mjs` copia o banco local original, não o banco remoto.

## Android e download

Na raiz do repositório de desenvolvimento, com Java e Android SDK instalados:

```sh
FIT_API_URL=https://rasheeda-disillusive-riotously.ngrok-free.dev node scripts/build-android-release.mjs
```

Saída: `artifacts/android/fit-0.1.0.apk`. A chave de assinatura e suas credenciais ficam em `~/.local/share/fit/android-signing` no computador de desenvolvimento. Preservar uma cópia privada: atualizações precisam da mesma chave. Incrementar `android.versionCode` para futuras versões.

Após validar a assinatura e o endereço no bundle, enviar o APK para `downloads/fit.apk.pending` no servidor e renomear para `downloads/fit.apk`. Publicar também `downloads/fit.apk.sha256`. O botão da home aponta para `/downloads/fit.apk`. Não hospedar chaves, credenciais ou backups nessa pasta.

Para atualizar o site/API no servidor após sincronizar o código:

```sh
docker compose --env-file deploy/runtime.env -f compose.server.yaml build api
docker compose --env-file deploy/runtime.env -f compose.server.yaml up -d api
```

Verificar `/health`, login e download após cada publicação. O limite de transferência e a disponibilidade do plano contratado do ngrok também se aplicam aos downloads do APK.

## Atualizações automáticas do Android (versão 0.2.0 em diante)

O APK a partir do código de versão 2 inclui `expo-updates`, consulta `/updates/manifest` ao iniciar e verifica a assinatura com o certificado público em `apps/mobile/certs/updates.pem`. A chave privada fica **somente no computador de desenvolvimento**, em `~/.local/share/fit/update-signing/private-key.pem` (permissão 600). Preservar uma cópia privada junto com a assinatura do APK. Nunca enviar essas chaves ao servidor ou para `downloads/`.

O aplicativo espera até cinco segundos por uma atualização na inicialização. Se a rede estiver lenta ou indisponível, usa a cópia instalada/em cache; uma atualização baixada depois fica disponível na próxima inicialização. Não reiniciar automaticamente durante um treino ou formulário preenchido. O mecanismo de recuperação de falhas do Expo permanece habilitado.

Para publicar uma mudança de telas, lógica ou assets compatível com o APK instalado:

```sh
FIT_API_URL=https://rasheeda-disillusive-riotously.ngrok-free.dev \
FIT_DEPLOY_HOST=luizserver@100.86.240.40 \
node scripts/publish-android-update.mjs
```

O script valida a finalidade Digital Signature/Code Signing do certificado, exporta o bundle, calcula o fingerprint do código nativo (incluindo explicitamente o certificado), assina o manifesto localmente, verifica a assinatura e compara o runtime com `/downloads/release.json`. Se forem diferentes, interrompe a publicação e exige um novo APK. Os assets são enviados antes do manifesto; a ativação ocorre por renomeação atômica. Sem `FIT_DEPLOY_HOST`, apenas prepara os artefatos locais em `artifacts/ota/publish`.

Mudanças no Expo SDK, em bibliotecas/configuração nativa ou no certificado de assinatura exigem um novo APK. O fingerprint impede que um aparelho receba código incompatível. A partir dessa instalação, correções compatíveis não exigem baixar/reinstalar o APK.

O servidor armazena assets identificados por SHA-256 e envelopes assinados em `deploy/data/updates`; os dois serviços montam esse diretório somente para leitura. Não existe endpoint HTTP para publicar atualizações. O manifesto é público e não contém dados de usuários. Publicar requer a chave SSH e a chave privada de assinatura local. Manter releases antigos para aparelhos que ainda utilizam runtimes anteriores.

Para rollback de código, republicar o bundle anterior com novo ID/data e assinatura válida. Apenas restaurar um manifesto com data antiga não força downgrade em aparelhos que já executaram uma versão mais nova.

Antes de ativar alterações no proxy, validar sem interromper o serviço:

```sh
docker compose --env-file ~/.config/fit/ngrok-web.env -f deploy/compose.public.yaml run --rm --no-deps --entrypoint nginx web -t
```

Referências: [Expo Updates](https://docs.expo.dev/versions/latest/sdk/updates/), [protocolo de atualização](https://docs.expo.dev/technical-specs/expo-updates-1/) e [assinatura de código](https://docs.expo.dev/eas-update/code-signing/).

## Migração MySQL LTS de 30/10/2026

A origem MySQL 9.4 foi migrada por dump lógico para um volume separado em MySQL 9.7.4 LTS, com imagem fixada por digest. As onze integrações passaram na cópia antes da troca. Na parada breve da API foi feito um novo dump, os hashes lógicos foram comparados e as contagens das 47 tabelas (1.492 linhas no momento da troca) foram preservadas. O volume original continua disponível; não o montar simultaneamente em dois servidores nem removê-lo com limpeza de volumes.

O arquivo `deploy/backups/pre-update-20261030/compose-before-lts.yaml` e os dumps privados registram a origem. Não fazer downgrade de arquivos de dados LTS. Depois de novas gravações no banco atual, um rollback precisa preservar e reconciliar essas gravações; não basta voltar ao volume antigo. O container descartável de validação e suas permissões de banco de teste foram removidos.

Referências: [releases MySQL de outubro de 2026](https://blogs.oracle.com/mysql/mysql-october-2026-ga-releases-now-available) e [caminhos de upgrade suportados](https://dev.mysql.com/doc/refman/9.7/en/upgrade-paths.html).
