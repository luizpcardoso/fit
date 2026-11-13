# Imagens de exercícios sob demanda

Procedimento obrigatório para criar, revisar, salvar e publicar imagens de exercícios do Orami. Leia também [STYLE_GUIDE.md](STYLE_GUIDE.md). Trabalhe pela raiz do repositório. A criação de imagens não exige APK, OTA ou alteração da versão do app.

## Autorização e conclusão

Um pedido como “gere imagens para estes exercícios” ou “gere mais 10 imagens” autoriza o fluxo completo: gerar, inspecionar, corrigir, fazer backup e publicar em produção, sem aprovação intermediária por imagem. Respeite pedidos específicos de somente gerar ou aguardar aprovação. Não iniciar lotes por conta própria. Não substituir imagens existentes sem pedido explícito; não criar exercícios novos para resolver nomes ambíguos.

Cada item só está concluído quando tem original e prompt no backup externo, inspeção aprovada do original, vínculo confirmado em produção, WebP acessível e inspecionado, e conferência no app com conta de teste autorizada. Se o app não puder ser conferido, informar **publicado; validação no app pendente**. Não confundir upload bem-sucedido com aceite visual.

## 1. Selecionar e identificar

1. Consultar o catálogo de **produção**, conferindo ID, nome, variação, aparelho, escopo global, arquivamento e imagem atual. O manifesto é um controle local, não uma consulta ao servidor. Nunca deduzir um ID pelo nome ou usar o banco local como comprovação de produção.
2. Pedidos por nome prevalecem. Havendo variações igualmente plausíveis, perguntar qual; correspondência inexistente fica pendente de identificação/cadastro. Não vincular a um movimento semelhante.
3. Em pedidos genéricos, excluir exercícios com imagem em produção e conteúdo arquivado. Para cada candidato, aproveitar um original local já aprovado para a mesma variação; revisar novamente se houver dúvida.
4. Priorizar presença em mais fichas ativas (`is_active`), disponíveis e não vencidas. Contar uma vez cada ficha, mesmo com repetições em divisões. Desempatar pela lista ordenada do guia visual e depois pelo nome em pt-BR.

Use [selection.sql](selection.sql) em consulta **somente leitura**, no banco de produção explicitamente identificado, pelo acesso operacional documentado em `deploy/README.md`. A saída contém só ID/nome do exercício, imagem e contagem agregada; não exporte usuários, identificadores ou nomes das fichas. Salve os agregados em um arquivo de trabalho, fora do Git. Embrulhe o resultado assim:

```json
{
  "environment": "production",
  "apiUrl": "https://orami.com.br",
  "checkedAt": "2026-11-09T15:00:00Z",
  "usageAvailable": true,
  "exercises": [
    {"id": "ID real", "name": "Agachamento livre", "imageKey": null, "activePlanCount": 5}
  ]
}
```

```bash
node scripts/exercise-images.mjs --select /caminho/consulta.json 10
```

O seletor não consulta o servidor nem certifica a origem declarada do JSON; use uma consulta recente e reconfira cada exercício antes de gerar/publicar. Se não houver acesso às contagens, obter o catálogo atual pelo portal paginado, exportando só ID/nome/imagem/arquivamento; definir `usageAvailable: false`. O seletor ignora contagens e usa movimentos comuns; informar a limitação. Sem acesso ao catálogo de produção, preparar candidatos, mas não afirmar ausência de imagem ou publicar.

Adicionar ao manifesto exercícios elegíveis que ainda não estejam nele, mantendo IDs reais e slugs únicos. Os 72 itens históricos não limitam a coleção.

## 2. Gerar e salvar imediatamente

- Abrir as referências visuais existentes e ler o guia. Usar a ferramenta integrada `image_gen`, uma chamada por exercício; lote não autoriza troca para API paga/CLI. Se indisponível, informar e aguardar a escolha do usuário sobre o fallback.
- Conferir a execução exata. Se necessário, pesquisar referências confiáveis na internet, registrar URLs/data e descrever postura, apoios, pegada, posição inicial/final e equipamento no prompt. Usar fontes para entender o movimento, sem copiar sua arte.
- Salvar cada resultado assim que gerado, antes de passar ao próximo, em `/home/luiz/Área de trabalho/fit/exercise-image-backups/attempts/<data-hora-do-lote>/<slug>/v001.png`, com `v001.prompt.txt` e `v001.review.json`. Criar diretórios antes de copiar do caminho retornado pela ferramenta; usar cópia exclusiva, sem sobrescrever. Incrementar a versão para correções. Não depender apenas do histórico do chat ou da pasta interna do gerador.
- Registrar no arquivo de revisão o resultado (`approved`/`rejected`), data, SHA-256, observações e fontes. Manter as tentativas reprovadas nesse diretório externo.
- Abrir e inspecionar cada resultado inteiro e em detalhes. Corrigir/regenerar até aprovação, preservando versões. Se a fidelidade continuar insuficiente, deixar pendente; não publicar para completar a quantidade.
- Copiar a versão aprovada para `imagePath` no repositório e seu prompt para `<slug>.prompt.txt`; usar `promptPath` se o nome for diferente. Não sobrescrever um original existente sem solicitação de substituição.

## 3. Registrar revisão e conferir backup

Estados existentes: `pending` → `generated` → `ready` → `published`. `ready` exige identificação e inspeção visual. `published` significa publicação registrada em algum ambiente; não comprova aceite ou produção. Registros antigos continuam preservados.

Registrar no item do manifesto, após inspeção real:

```json
"review": {
  "result": "approved",
  "reviewer": "assistant",
  "reviewedAt": "2026-11-09T15:00:00Z",
  "sha256": "SHA-256 do original aprovado",
  "notes": "Descrever movimento, anatomia, mãos, equipamento e legibilidade conferidos.",
  "sources": [{"url": "https://fonte-consultada/", "checkedAt": "2026-11-09"}]
}
```

Usar `sources: []` quando nenhuma fonte externa foi necessária. A revisão é inspeção visual do assistente; nunca declarar revisão humana ou profissional sem que tenha ocorrido. Alterar o original invalida a revisão pelo hash.

```bash
node scripts/exercise-images.mjs --check
node scripts/backup-exercise-images.mjs --item agachamento-livre
```

Sem `--item`, salvar toda a coleção existente. O backup não carrega `.env`, não precisa do banco e fica, por padrão, em `/home/luiz/Área de trabalho/fit/exercise-image-backups/<data-hora-id>/` e `.tar.gz`. `ORAMI_IMAGE_BACKUP_DIR` permite outro destino externo. O script recusa destino dentro do repositório, inclusive por link simbólico, e links na coleção.

O lote contém a coleção completa (incluindo guias, prompts, revisões e recibos do manifesto), `receipt.json`, inventário SHA-256 e `RESTORE.md`. O script só registra `backup` no manifesto após copiar, conferir e arquivar os originais. Pastas `.partial` são incompletas. O publicador confere os bytes do original e da cópia externa; backup ausente ou divergente bloqueia o envio. Não editar lotes finalizados. O manifesto dentro do arquivo é um snapshot anterior ao registro do próprio backup; não o restaurar cegamente.

Imagens legadas sem prompt também são preservadas no backup, com `promptFile: null` no recibo. Não inventar o prompt histórico: esse item continua impedido de nova publicação até dispor do prompt real e de revisão atual. A coleção recebida inclui “Puxada atrás da nuca” nessa condição, também sem ID identificado.

## 4. Publicar e retomar

Configurar no ambiente, sem colar tokens no chat, nos MDs ou em comandos versionados:

- `ORAMI_API_URL=https://orami.com.br`
- `ORAMI_IMAGE_ENV=production` (outros destinos: `local` ou `staging`)
- `ORAMI_ADMIN_TOKEN`: sessão administrativa válida obtida pelo fluxo de autenticação existente.

```bash
node scripts/exercise-images.mjs --publish agachamento-livre cadeira-extensora
```

Uploads são sequenciais, espaçados para respeitar o limite da rota. O comando exige revisão e backup, consulta ID/nome/escopo/arquivamento e recusa imagem já existente sem recibo correspondente. A rota `PUT /portal/content/:id/image` converte para WebP, salva a mídia, vincula e audita; não gravar SQL direto nem subir um arquivo avulso sem vínculo. Não publicar simultaneamente pelo portal/outros computadores: a checagem prévia do script não é um bloqueio global do servidor.

Novos recibos ficam em `publications[origemDaAPI]`, com ambiente, URL, hash original, data e verificação da mídia. Campos legados não são reatribuídos a outro ambiente. O comando repete a leitura do vínculo e verifica a resposta WebP pública sem enviar o token à rota de mídia. Reexecutar um recibo confirmado valida o vínculo sem reenviar a imagem. Erros por item ficam em `lastPublicationError`; os demais itens do lote continuam.

Antes do PUT, `publicationAttempts[origemDaAPI]` recebe `state: uncertain`. Se faltar resposta ou o processo cair, **não repetir cegamente**. Consultar portal/auditoria e verificar a mídia. Se confirmar que o envio ocorreu e corresponde à versão revisada, reconciliar manualmente o recibo por ambiente (URL real, SHA original, data e evidência) e marcar a tentativa confirmada. Se confirmar que não ocorreu, limpar a tentativa incerta documentando a verificação; só então repetir. Não fabricar recibos por semelhança de nome. Recibo existente com vínculo remoto ausente também exige investigação.

Os scripts usam um lock em `artifacts/exercise-image-backups/collection.lock`. Depois de uma queda, remover esse lock apenas após confirmar que não existe operação em execução. Não editar o manifesto manualmente durante backup/publicação.

## 5. Aceitar, arquivar e informar

1. Abrir o WebP real servido em produção; revisar novamente movimento, deformidades, textos e legibilidade após conversão (a API limita a 900 × 700, preservando proporção). Usar a prévia ampliada e o tamanho de exibição do app.
2. Com conta de teste autorizada, conferir a busca/seleção e o uso do exercício numa ficha. Conferir ficha antiga sem imagem e início de uma nova execução após atualizar os dados. Nunca modificar fichas de usuários reais para testar.
3. Registrar no recibo `acceptance` com `sha256` do original, `mediaSha256`, `reviewedAt`, `reviewer: assistant`, `notes` da inspeção do WebP, `appCheckedAt` e `appNotes`. Não preencher o aceite completo se a conferência do app ficou pendente. A checklist só exibe aceite registrado com hashes e campos de revisão/app válidos; o registro depende de inspeção real.
4. Rodar `--check` e fazer backup final, incluindo a mídia publicada se houver acesso administrativo:

```bash
node scripts/exercise-images.mjs --check
node scripts/backup-exercise-images.mjs --published
```

`--published` primeiro protege os originais, depois consulta a API explicitamente configurada e guarda apenas vínculos globais e WebPs em `published/`, com origem/data. Falha remota preserva o backup dos originais e pode deixar `published.partial`; o processo retorna erro e essa cópia remota não deve ser considerada completa. Executar sem uploads simultâneos: não é snapshot transacional do servidor. Não apagar backups antigos automaticamente.

Fichas novas capturam a imagem atual; fichas antigas sem snapshot usam a imagem do catálogo após atualizar dados online. Fichas com snapshot, exercícios manuais sem ID e execuções já iniciadas não são reescritos. Cache/offline não recebe uma atualização imediata por push. Não prometer alteração retroativa de históricos.

Ao concluir, informar exercícios publicados, pendências e motivos, pasta/arquivo do backup e quais verificações ocorreram. Backup no mesmo computador não protege contra perda do equipamento; uma cópia em outro disco pode ser feita pelo usuário.

## Manutenção

Validar mudanças nestes scripts com `node --test scripts/test/exercise-images.test.mjs` e `node --check` nos scripts alterados. Não usar produção para testes automatizados. Nenhuma regra aqui dispensa as instruções gerais de segurança do projeto.
