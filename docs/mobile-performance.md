# Eficiência em aparelhos e conexões modestos

O feed e seus comentários usam FlatList, com renderização em janelas pequenas. O feed carrega páginas de 30 itens por demanda; o cursor combina timestamp com microssegundos e ID para não perder publicações criadas no mesmo instante.

As fotos são reduzidas antes do envio usando expo-image-manipulator: até 1600 px no maior lado para posts, 512 px para avatares e 1600 × 600 px para capas, JPEG com qualidade controlada. Só a versão reduzida é convertida para base64 para transporte; a original não é carregada como string JavaScript. O servidor valida, remove metadados e regrava em WebP. Downloads do feed e das imagens privadas de grupo usam cache em disco, com autorização revalidada pelo backend. As dimensões finais dos posts são devolvidas ao app para a prévia e o feed usarem a mesma proporção sem recorte.

Consultas simultâneas idênticas compartilham a mesma requisição. Respostas de leitura elegíveis ficam em cache por 15 segundos (até 50 entradas). Qualquer mutação invalida o cache. Isso reduz tráfego ao alternar telas, inclusive Home, saúde e grupos. Não é sincronização offline; alterações externas podem levar até 15 segundos para aparecer.

## Arquivos no servidor

Configure MEDIA_DIR com o caminho absoluto de uma pasta persistente, fora de diretórios temporários ou efêmeros do deploy. O padrão local é apps/api/storage/media, ignorado pelo Git. A API precisa de permissão de leitura/escrita. Ao mover de servidor, transfira **MySQL e essa pasta**; faça backup de ambos. Não exponha a pasta inteira por servidor estático: fotos de grupos passam pelas rotas autenticadas. Avatares possuem URLs com identificadores aleatórios e são tratados como fotos públicas de perfil.

Na inicialização, imagens antigas armazenadas no banco são movidas para arquivos em lotes. Uma publicação conjunta usa um único arquivo compartilhado pelos posts de destino. Ao expirar em 48h ou remover o post, a limpeza apaga a referência e só exclui o arquivo quando não há mais posts referenciando-o. Texto sem foto continua permanente. Trocar o avatar grava uma nova URL e remove o arquivo anterior.

As verificações automatizadas cobrem armazenamento, compartilhamento físico de arquivo, autorização do download, expiração, paginação e invalidação do cache de consultas. Medições de RAM, FPS e consumo real de rede ainda precisam de build de produção e aparelho intermediário; o Expo Go não representa a performance final.

## Observabilidade de uso

A coleta própria usa fila limitada em memória e lotes em primeiro plano, sem SDK externo. Heartbeat no máximo uma vez por minuto; enviar métricas não invalida o cache da API nem dispara recargas de dados. Troca de conta/logout cancela o tracker e limpa sua fila. Falhas de rede na telemetria não interrompem a interface. Desenvolvimento fica excluído por padrão. Consulte e mantenha `docs/observability-context.md` para a política escolhida de 30 dias de eventos e 12 meses de agregados, os limites e os testes sem build.

## Arquivos gerados pelo Android no Metro

`apps/mobile/metro.config.js` exclui saídas `android/build`, `android/app/build`, `.cxx` e `.gradle` da observação do Metro, preservando o blockList padrão. Gradle e Robolectric geram milhares de diretórios de recursos sem relação com o bundle JavaScript; observá-los pode esgotar inotify e impedir a abertura do app web. Fontes dos módulos nativos continuam disponíveis para fingerprint e compilação Android. Não é necessário alterar limites globais do sistema operacional.
