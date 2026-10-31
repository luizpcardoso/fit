# Eficiência em aparelhos e conexões modestos

O feed e seus comentários usam FlatList, com renderização em janelas pequenas. O feed carrega páginas de 30 itens por demanda; o cursor combina timestamp com microssegundos e ID para não perder publicações criadas no mesmo instante.

As fotos são reduzidas antes do envio usando expo-image-manipulator: até 1600 px no maior lado para posts e 512 px para avatares, JPEG com qualidade 80%. Só a versão reduzida é convertida para base64 para transporte; a original não é carregada como string JavaScript. O servidor valida, remove metadados e regrava em WebP. Downloads do feed usam expo-image e cache em disco, com chave estável e sem conversão do download para base64. O acesso continua autenticado e revalidado pelo backend.

Consultas simultâneas idênticas compartilham a mesma requisição. Respostas de leitura elegíveis ficam em cache por 15 segundos (até 50 entradas). Qualquer mutação invalida o cache. Isso reduz tráfego ao alternar telas, inclusive Home, saúde e grupos. Não é sincronização offline; alterações externas podem levar até 15 segundos para aparecer.

## Arquivos no servidor

Configure MEDIA_DIR com o caminho absoluto de uma pasta persistente, fora de diretórios temporários ou efêmeros do deploy. O padrão local é apps/api/storage/media, ignorado pelo Git. A API precisa de permissão de leitura/escrita. Ao mover de servidor, transfira **MySQL e essa pasta**; faça backup de ambos. Não exponha a pasta inteira por servidor estático: fotos de grupos passam pelas rotas autenticadas. Avatares possuem URLs com identificadores aleatórios e são tratados como fotos públicas de perfil.

Na inicialização, imagens antigas armazenadas no banco são movidas para arquivos em lotes. Uma publicação conjunta usa um único arquivo compartilhado pelos posts de destino. Ao expirar em 48h ou remover o post, a limpeza apaga a referência e só exclui o arquivo quando não há mais posts referenciando-o. Texto sem foto continua permanente. Trocar o avatar grava uma nova URL e remove o arquivo anterior.

As verificações automatizadas cobrem armazenamento, compartilhamento físico de arquivo, autorização do download, expiração, paginação e invalidação do cache de consultas. Medições de RAM, FPS e consumo real de rede ainda precisam de build de produção e aparelho intermediário; o Expo Go não representa a performance final.
