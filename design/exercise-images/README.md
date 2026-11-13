# Imagens instrucionais dos exercícios

`manifest.json` é a fonte de controle dos 72 exercícios registrados. `CHECKLIST.md` é a visualização gerada, com nomes, IDs, status e links. Os originais ficam em `images/`, versionados junto do manifesto; não são empacotados no app.

Os 69 vínculos preenchidos foram consultados no banco configurado em `apps/api/.env` em 05/11/2026. IDs não foram inferidos dos nomes nem criados novamente. O ambiente consultado não comprova o estado do servidor de produção. Nomes genéricos receberam uma variação explícita em `catalogName`/`mappingNote`; use essa variação ao gerar a imagem. Não vincular a variações próximas de aparelho ou movimento apenas para preencher o campo.

Pendências de identificação: **Abdução de quadril na polia** e **Extensão lombar no banco**. Confirmar se já existem com outro nome ou cadastrar pelo portal e preencher o ID real. Não reutilizar imagens de abdução na máquina ou extensão de quadril como correspondências automáticas.

## Fluxo obrigatório

Pedidos por nome ou por quantidade devem seguir [WORKFLOW.md](WORKFLOW.md) e [STYLE_GUIDE.md](STYLE_GUIDE.md): selecionar no catálogo de produção, gerar com a ferramenta integrada, salvar cada tentativa fora do repositório, inspecionar visualmente, fazer backup conferido e publicar pela API administrativa. O pedido autoriza publicação após revisão do assistente, salvo instrução específica do usuário.

O manifesto continua sendo o controle por exercício; novos itens podem ser adicionados além da seleção histórica. Revisão é vinculada ao hash original. `backup` guarda o recibo externo; `publications` separa recibos por origem da API; `publicationAttempts` impede repetir cegamente um envio sem resposta. Campos históricos são preservados. A checklist não é prova do estado atual de produção e distingue publicação de aceite visual/no app.

```bash
node scripts/exercise-images.mjs --check
node scripts/backup-exercise-images.mjs --item agachamento-livre
node scripts/exercise-images.mjs --publish agachamento-livre cadeira-extensora
```

Publicar exige `ORAMI_API_URL`, `ORAMI_IMAGE_ENV` e uma sessão em `ORAMI_ADMIN_TOKEN`, além do original revisado e backup válido. Não registrar credenciais. A rota existente `PUT /portal/content/:id/image` converte para WebP, salva, audita e atualiza o vínculo. O script recusa substituições automáticas. Conferir o WebP público e o fluxo no app antes de declarar conclusão.

Não gravar caminhos locais em `exercises.image_url`: esse campo contém uma chave como `<uuid>.webp`; a API monta `/media/exercises/<uuid>.webp`. Não guardar base64 no banco nem criar outra tabela para o controle operacional.

## Compatibilidade

O catálogo e as sugestões leem a imagem atual do exercício. Fichas guardam `workout_plan_exercises.image_url` como snapshot. Quando o snapshot está vazio, a API exibe a imagem atual do catálogo; por isso fichas antigas passam a mostrar imagens recém-publicadas sem alteração de dados. Substituir uma imagem não altera fichas que já têm snapshot. Não executar atualização em massa ou reescrever históricos neste fluxo. Fichas novas capturam a imagem publicada ao inserir o exercício. A imagem do exercício também é independente das ilustrações de grupo muscular dos treinos A/B/C.

## Estado da coleção

31 exercícios da checklist foram gerados com a ferramenta integrada image_gen e publicados no banco local (apps/api/.env) **e em produção** (orami.com.br, 05/11/2026). Os dois ambientes usam a mesma chave de mídia, então `imageUrl` no manifesto vale para ambos. Em produção, os WebPs ficam em `deploy/data/media`, cada vínculo foi feito em uma única transação (conferindo ID, nome, `source='catalog'` e ausência de imagem anterior) e auditado como `exercise.image.updated`. Os vínculos e a mídia de antes da publicação estão em `~/apps/fit/deploy/backups/exercise-images-<data>` no servidor (ver `productionBackup` no manifesto). O manifesto e a checklist registram o estado por item. Os prompts estão junto de cada original. Fichas antigas não foram modificadas.

**Puxada atrás da nuca** veio no lote de imagens mas não existe no catálogo local nem no de produção. A imagem está em `images/` com status `generated` e sem vínculo. Cadastrar o exercício pelo portal e preencher o ID real antes de publicar.

Cache: a rota `/media/exercises/:key` serve o WebP com `cache-control: immutable` (Cloudflare guarda por 24 h). Chave inexistente responde 404 com `no-store`, que não fica em cache. Antes da correção de 05/11/2026, a resposta de erro era 500 com `immutable` e ficava em cache; por isso a imagem do supino reto com barra recebeu outra chave.

## Backup da coleção

O destino padrão agora é `/home/luiz/Área de trabalho/fit/exercise-image-backups`, **fora do repositório**. Os arquivos antigos em `artifacts/exercise-image-backups/` continuam preservados, mas não atendem ao requisito de cópia externa para novas publicações.

`node scripts/backup-exercise-images.mjs` salva a coleção e o inventário SHA-256 sem banco nem credenciais. O recibo registrado no manifesto é conferido antes de qualquer publicação. `--published` adiciona vínculos e WebPs da API explicitamente configurada, identificando origem e data; a cópia dos originais é independente dessa coleta remota. Prompts, revisões e recibos acompanham a coleção. Cada lote inclui `RESTORE.md`; não inclui dados de usuários nem dump completo do banco.

Leia o workflow para comandos, tentativas versionadas, retomada, conferência no app e aceite. Não executar publicações simultâneas. Copiar para outro disco é necessário para proteção contra perda deste computador.
