# Ilustrações dos treinos

Coleção original gerada com a ferramenta integrada `image_gen`, usando a referência fornecida como direção de estilo, sem copiar marcas, textos ou logotipos. A imagem de costas serviu como referência visual para as demais, mantendo frente/costas, enquadramento e cores consistentes. Os prompts finais estão em [prompts.json](prompts.json); a [galeria](catalog.html) permite visualizar e baixar cada arquivo.

Os 13 arquivos finais ficam em `apps/mobile/assets/images/workout-groups`. Cada um tem 512 × 384 px, proporção 4:3, WebP com alpha preservado. Total da coleção: 414.076 bytes. A conversão usou Sharp somente para redimensionar com `fit: contain` e codificar WebP (quality 80, alphaQuality 100), sem recortar corpos ou redesenhar regiões. Os PNGs originais da ferramenta não são dependências do aplicativo.

| Grupo | Arquivo |
| --- | --- |
| Peito | `chest.webp` |
| Costas | `back.webp` |
| Pernas | `legs.webp` |
| Ombros | `shoulders.webp` |
| Braços | `arms.webp` |
| Abdômen | `core.webp` |
| Glúteos | `glutes.webp` |
| Corpo inteiro | `full-body.webp` |
| Costas + ombros | `back-shoulders.webp` |
| Peito + ombros | `chest-shoulders.webp` |
| Peito + tríceps | `chest-triceps.webp` |
| Costas + bíceps | `back-biceps.webp` |
| Pernas + glúteos | `legs-glutes.webp` |

## Uso no aplicativo

- A escolha é opcional e pertence a cada treino A/B/C dentro da ficha, conforme confirmado pelo usuário. “Sem ilustração” remove a escolha.
- São imagens de identificação do treino, independentes das fotos instrucionais dos exercícios. Escolher uma imagem não adiciona exercícios, altera prescrições ou renomeia o treino.
- O catálogo tem grupos individuais e combinações, com nomes externos à arte e seleção acessível. Não existe upload.
- `WorkoutIllustration` preserva o corpo inteiro com `contentFit="contain"`, proporção 4:3 e fundo branco do token do tema para o desenho. IDs ausentes/desconhecidos ou falha de imagem têm alternativa local.
- Exibição no formulário de criação/edição, nos detalhes e na confirmação de início. A troca no formulário só persiste ao salvar a ficha; mudanças pendentes incluem a ilustração.
- O catálogo usa referências estáticas do Metro, disponíveis offline no aplicativo nativo. Nenhum servidor de imagens ou endpoint de upload foi adicionado.

## Persistência e distribuição

`illustrationId` aceita somente IDs do catálogo ou `null`. A migração `042-workout-division-illustration` acrescenta `workout_divisions.illustration_id`, nullable. Campos omitidos em uma edição de cliente anterior preservam a escolha do treino mantido pelo ID; `null` remove explicitamente. Propriedade e bloqueio de fichas recebidas do profissional continuam nas mesmas rotas/repositório. Histórico, sessões abertas e imagens de exercícios não foram alterados.

Entrega distribuída no APK 1.05, com assets incluídos no cliente e migração aplicada pelo fluxo normal da API no servidor. O catálogo e os IDs precisam permanecer estáveis para preservar escolhas existentes.

Verificações: typecheck, lint mobile, contratos e integração MySQL em banco exclusivo, além de Playwright real (criação, seleção separada em A/B, remoção, salvamento, edição, detalhes e confirmação; claro/escuro; 320 e 390 px). Não há nova dependência nativa.
