# Imagens instrucionais dos exercícios

`manifest.json` é a fonte de controle dos 71 exercícios solicitados. `CHECKLIST.md` é a visualização gerada, com nomes, IDs, status e links. Os originais ficam em `images/`, versionados junto do manifesto; não são empacotados no app.

Os 69 vínculos preenchidos foram consultados no banco configurado em `apps/api/.env` em 05/11/2026. IDs não foram inferidos dos nomes nem criados novamente. O ambiente consultado não comprova o estado do servidor de produção. Nomes genéricos receberam uma variação explícita em `catalogName`/`mappingNote`; use essa variação ao gerar a imagem. Não vincular a variações próximas de aparelho ou movimento apenas para preencher o campo.

Pendências de identificação: **Abdução de quadril na polia** e **Extensão lombar no banco**. Confirmar se já existem com outro nome ou cadastrar pelo portal e preencher o ID real. Não reutilizar imagens de abdução na máquina ou extensão de quadril como correspondências automáticas.

## Fluxo de trabalho

1. Gerar cada exercício como imagem independente com a ferramenta integrada `image_gen`, usando `catalogName` como movimento e a rosca martelo como referência visual. Salvar no `imagePath` previsto e manter o prompt ao lado.
2. Mudar `imageStatus` de `pending` para `generated`. Conferir movimento, aparelho, mãos, início/fim, músculos e legibilidade; depois marcar `ready`.
3. Rodar `node scripts/exercise-images.mjs --check` na raiz do repositório para validar caminhos/status e atualizar a checklist. O check da lista representa publicação; imagem gerada e imagem publicada têm estados diferentes.
4. Publicar pelo portal administrativo ou, para atualizar também o recibo local, definir `ORAMI_API_URL` e `ORAMI_ADMIN_TOKEN` no ambiente e executar `node scripts/exercise-images.mjs --publish rosca-martelo`. Não guardar tokens neste diretório ou em comandos versionados. Substituir o slug para os demais exercícios. A sessão deve pertencer a um administrador.

O comando publica somente um item revisado por execução, valida ID/nome/escopo no ambiente de destino e usa a rota existente `PUT /portal/content/:id/image`. A API verifica o papel admin, converte para WebP, salva na mídia, registra auditoria e atualiza `exercises.image_url`. O manifesto recebe a URL devolvida e o hash do original. Uma repetição confirma o vínculo sem publicar outra cópia. O comando recusa substituir uma imagem existente: fazer isso conscientemente pelo portal. Em resposta perdida ou erro após o upload, conferir o portal antes de repetir ou reconciliar o recibo.

Não gravar caminhos locais em `exercises.image_url`: esse campo contém uma chave como `<uuid>.webp`; a API monta `/media/exercises/<uuid>.webp`. `imagePath` é somente o original no projeto e `imageUrl` é a URL publicada. Não guardar base64 no banco nem criar outra tabela para este controle.

## Compatibilidade

O catálogo e as sugestões leem a imagem atual do exercício. Fichas existentes guardam `workout_plan_exercises.image_url` como snapshot; publicar no catálogo **não atualiza automaticamente essas fichas**. Não executar atualização em massa ou reescrever históricos neste fluxo. Fichas novas capturam a imagem publicada ao inserir o exercício. A imagem do exercício também é independente das ilustrações de grupo muscular dos treinos A/B/C.

## Estado da coleção

30 exercícios da checklist foram gerados com a ferramenta integrada image_gen e publicados no banco configurado em apps/api/.env, usando o serviço administrativo existente com validação e auditoria. Os WebPs estão na mídia local da API; isso não representa implantação no servidor de produção. A rosca martelo anterior permanece em generated. O manifesto e a checklist registram o estado por item. Os prompts estão junto de cada original. Fichas antigas não foram modificadas.

## Backup da coleção

Na raiz do repositório, execute `node scripts/backup-exercise-images.mjs` ao terminar cada lote. O comando cria um arquivo datado em `artifacts/exercise-image-backups/*.tar.gz`, com a coleção completa (originais, prompts, manifesto e checklist), os vínculos atuais do catálogo, WebPs publicados e hashes SHA-256. Inclui instruções de restauração em `RESTORE.md`. Não inclui credenciais, dados pessoais, fichas nem um dump completo do banco. Execute sem uploads simultâneos. Copie o arquivo para outro disco ou armazenamento de backup para proteção contra perda deste computador.
