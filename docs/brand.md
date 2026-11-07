# Identidade da Orami

## Essência

Orami é uma marca de cuidado cotidiano. Reúne movimento, alimentação, saúde e bem-estar sem cobrar perfeição: a evolução acontece no ritmo de cada pessoa.

**Assinatura:** Seu cuidado, no seu ritmo.

**Personalidade:** acolhedora, clara, ativa e confiável. A comunicação orienta sem julgar, celebra constância em vez de intensidade e evita promessas clínicas.

## Símbolo (Onda)

Um disco em degradê (teal → verde-água, com brilho ciano no alto à esquerda) com uma linha branca contínua: o batimento termina numa onda calma. O pulso representa vitalidade e acompanhamento; a onda, o bem-estar no ritmo de cada pessoa.

- Fonte vetorial: `design/brand/mark.mjs` (símbolo, ícone, versão de uma cor, nome "orami" e assinatura TRACK • TRAIN • THRIVE já convertidos em contornos de Noto Sans Display, sem depender de fonte instalada).
- Arquivos gerados: `design/orami-mark.svg`, `orami-mark-mono.svg`, `orami-icon.svg`, `orami-logo.svg` (fundo claro), `orami-logo-white.svg` (fundo escuro), `orami-logo-stacked.svg` (vertical com assinatura).
- Regenerar ícones, splash e PNGs do app: `node scripts/generate-brand-assets.mjs` (mudanças de ícone/splash exigem novo APK).
- No ícone do app o degradê ocupa o quadro inteiro e só o pulso branco aparece; no ícone adaptativo do Android o pulso fica dentro da zona segura e a versão monocromática usa o mesmo traço.
- Não girar, distorcer, acrescentar contornos ou trocar as cores do símbolo. O nome é escrito em minúsculas no logotipo ("orami") e com inicial maiúscula no texto corrido (Orami).

## Cores (Ocean Fit)

| Papel | Cor | Uso |
| --- | --- | --- |
| Primária da marca | `#0891B2` | símbolo, ícone, ilustrações |
| Ação (primary) | `#0B7E9C` | botões e controles; mais escura que a da marca para manter 4,5:1 com texto branco |
| Secundária | `#67E8F9` | progresso, links no tema escuro, acentos |
| Acento | `#14B8A6` | gradientes e ilustrações |
| Fundo claro | `#F2FAFC` | fundo do tema claro e da splash |
| Fundo escuro | `#101D27` | fundo do tema escuro |
| Texto | `#16404B` | texto no tema claro e cartões de destaque |

Os tokens semânticos ficam em `design/palette.json` (`npm run theme`). Ciano (`#67E8F9`) não deve ser usado para texto sobre fundo claro.

## Tipografia

Proposta: Inter (ou sans moderna similar). O app usa a fonte do sistema (Roboto no Android, muito próxima da Inter); o portal web já declara Inter com fallback.

## Ilustrações

Cenas vetoriais em `design/scenes/*.svg`, geradas por `node scripts/generate-scenes.mjs` e exportadas como WebP em resolução 3x (~12–30 KB), já recortadas no formato de cada uso em `apps/mobile/assets/images/scenes/`. Use pelo componente `components/scene.tsx`:

- `SceneBanner`: faixa decorativa com texto curto, colocada **depois** dos dados principais da tela (antes das seções/atalhos), nunca no lugar de uma ação.
- `SceneBackdrop`: fundo de cartões de destaque escuros (meta semanal no Início, ficha ativa, check-in de Mente). Use `dim` quando o texto ocupa a largura inteira.
- `FeatureCategoryGrid` com `scene`: cartões das áreas nas abas Saúde, Nutrição e Fitness. A cena `card*` cobre o cartão; título, descrição e chevron ficam brancos na base. Sem `scene` o cartão volta ao ícone sobre superfície clara.

Os cartões usam canvas próprio (600×520, exportado com 720 px de largura): o objeto fica no alto, à direita, perto do centro vertical para sobreviver ao corte em cartões largos, e o véu escurece de baixo para cima. Para regenerar só os cartões, use `node scripts/generate-scenes.mjs --cards-only`.
- `SceneThumb`: miniatura quadrada `thumb*` de tamanho fixo (não encolhe em linhas apertadas). Usada nos atalhos do Início, na folha “O que deseja registrar?”, no editor de atalhos (40–42 px) e nos estados vazios de primeiro uso (72–88 px). O gerador mede os pixels do desenho do cartão e o recentraliza num quadrado com brilho ao fundo, então o objeto nunca fica deslocado nem encosta na borda arredondada; os pontinhos decorativos ficam de fora.

Regras: imagens são decorativas (`aria-hidden`), o assunto fica à direita e o lado do texto (esquerda nas faixas, base nos cartões) já vem escurecido para o texto branco; pessoas aparecem como pictogramas, sem rosto nem corpo idealizado (evita comparação corporal).

| Cena | Onde |
| --- | --- |
| `sunrise` | login e cadastro |
| `pulseTall` (recorte vertical de `pulse`) | cartão Fitness no Início |
| `workoutSquare` / `workout` | ficha ativa / faixa do Fitness sem ficha ativa |
| `mind` | check-in de Mente |
| `health` | aba Saúde |
| `nutrition` | aba Nutrição |
| `groups` | aba Grupos; convite “Crie seu primeiro grupo” no Início |
| `cardBody`, `cardMedication`, `cardSupplement`, `cardInjectable`, `cardMind` | cartões das áreas da aba Saúde |
| `cardFood`, `cardDiet` | cartões Alimentação e Minha dieta |
| `cardPlans`, `cardHistory`, `cardCardio` | cartões Fichas, Histórico e Cardio do Fitness |
| `thumbMind`, `thumbPlans`, `thumbFood`, `thumbCardio`, `thumbBody`, `thumbMedication`, `thumbSupplement`, `thumbInjectable` | atalhos, folha Registrar, editor de atalhos e estado vazio da área correspondente |
| `thumbDiet`, `thumbGroups`, `thumbProfessional` | estados vazios de Minha dieta, Grupos/feed e Meus profissionais |

## Nome e voz

- Escrever sempre **Orami**, com inicial maiúscula.
- Preferir frases curtas, diretas e humanas.
- Usar “você” e verbos de apoio: acompanhar, cuidar, organizar, escolher e evoluir.
- Evitar culpa, urgência artificial, comparação corporal e linguagem como “fracasso”, “sem desculpas” ou “projeto verão”.
- Em contextos de saúde, deixar claro que o app registra e organiza; não diagnostica, prescreve ou substitui profissionais.
