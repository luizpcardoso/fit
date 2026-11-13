# Padrão visual e revisão das imagens

Leia junto com [WORKFLOW.md](WORKFLOW.md). Use as imagens como referência de aparência; a execução do novo exercício precisa ser conferida independentemente.

## Referências e composição

- [Rosca martelo](images/rosca-martelo.png): referência principal de desenho anatômico, paleta e composição.
- [Supino reto com barra](images/supino-reto-com-barra.png): exemplo de movimento com banco e equipamento amplo.
- Mesmo modelo adulto atlético nas duas posições, musculatura desenhada em cinza, shorts pretos, músculos principais em laranja quente. Fundo branco, aparelho em cinza/preto, traços nítidos.
- Duas posições lado a lado, na mesma escala, esquerda “Início” e direita “Fim”, com rótulos pequenos em azul-marinho e texto branco. Uma seta curva laranja coerente com a direção do movimento. Sem logotipo, marca d'água ou anotações extras.
- Mostrar corpo e equipamento relevante por inteiro, com margens. Escolher perspectiva que torne apoios e pegada compreensíveis; não impor a câmera da rosca a todos os exercícios. Preservar proporção, sem esticar/cortar para caber no quadro 3:2 do app.
- Preferir formato horizontal se favorecer o movimento. A composição deve continuar legível na conversão WebP de até 900 × 700 e na prévia ampliada. Não aumentar artificialmente o arquivo apenas para atingir uma dimensão.
- “Início” e “Fim” correspondem ao movimento especificado, geralmente início/fim da fase concêntrica; confirmar por exercício. Para isometria, mostrar posição correta e detalhe/segunda vista coerente, sem inventar amplitude ou seta de deslocamento; registrar a exceção no prompt/revisão.

## Modelo de prompt por exercício

Preencher cada campo com a variação exata. Não carregar instruções sobre outros exercícios no mesmo prompt.

```text
Use case: scientific-educational.
Asset type: imagem instrucional original para o app Orami.
Input images: referências de estilo e composição; não copiar a pose se não corresponder ao exercício.
Primary request: [nome exato, variação e equipamento]. Uma única imagem com duas posições.
Execution: esquerda [posição inicial detalhada]; direita [posição final detalhada].
Biomechanics: [apoios, alinhamento, pegada, amplitude, articulações e trajeto do peso/cabo].
Equipment: [banco/aparelho, ajustes e acessórios exatos, perspectiva consistente].
Style: mesmo modelo anatômico adulto em cinza nas duas vistas, shorts pretos,
  músculos [nomes conferidos] em laranja; fundo branco e desenho profissional nítido.
Composition: vistas na mesma escala, corpo e equipamento relevante inteiros,
  margens, seta curva laranja coerente, sem elementos sobrepostos às mãos.
Text (verbatim): "Início" e "Fim", em pequenas etiquetas azul-marinho com texto branco.
Constraints: anatomia e mecânica plausíveis, mãos segurando corretamente os objetos,
  continuidade entre vistas, ausência de membros extras e interpenetrações.
Avoid: deformidades, aparelho impossível, perspectiva inconsistente, cortes, texto extra,
  marcas, logotipos e marca d'água.
```

Consultar fontes confiáveis para detalhes incertos, preferindo organizações de educação física, guias técnicos e fabricantes do aparelho específico. Registrar URLs e data; se fontes divergirem, esclarecer a variação em vez de misturar execuções. Não copiar erros percebidos nas referências existentes.

## Inspeção visual obrigatória

Abrir a imagem real, examinar a composição inteira e ampliar os detalhes. Não aprovar apenas pelo prompt, nome do arquivo ou resultado da ferramenta.

| Conferência | Critério de aprovação |
| --- | --- |
| Identidade do exercício | Mesmo movimento, pegada e aparelho do ID escolhido. |
| Anatomia | Membros completos, articulações e proporções plausíveis, sem duplicações. |
| Mãos/pés | Dedos plausíveis quando visíveis, contato real com peso/aparelho/chão, pegada contínua. |
| Execução | Apoios, coluna, ombros, joelhos e amplitude coerentes; sem posturas impossíveis. |
| Equipamento | Banco, pesos, cabos e polias com estrutura e trajeto funcionais; sem atravessar o corpo. |
| Duas vistas | Mesmo modelo/aparelho/carga, escala compatível e transição compreensível. |
| Anatomia destacada | Músculos ativos coerentes, sem destaques inventados para preencher espaço. |
| Comunicação | Seta coerente, rótulos corretos, margens e legibilidade após conversão. |

Qualquer erro relevante reprova a tentativa. Registrar o problema, corrigir com instrução específica e revisar novamente a imagem inteira. Se não conseguir avaliar um detalhe essencial, não publicar até resolver. Repetir a inspeção no WebP público; registrar a avaliação como feita pelo assistente.

## Desempate por movimentos comuns

Lista ordenada por **nome exato do catálogo**. Atualizar aqui ao confirmar nomes no servidor; o seletor lê este bloco. Contagens de fichas ativas prevalecem sobre esta ordem. Exercícios já ilustrados continuam excluídos.

<!-- priority:start -->
1. Agachamento livre
2. Leg press 45 graus
3. Cadeira extensora
4. Mesa flexora
5. Cadeira flexora
6. Supino reto com barra
7. Puxada frontal aberta
8. Remada baixa triangulo
9. Desenvolvimento com halteres sentado
10. Elevação lateral com halteres
11. Rosca direta com barra
12. Tríceps na polia corda
13. Elevação pélvica
14. Stiff com barra
15. Levantamento terra convencional
16. Afundo búlgaro
17. Cadeira abdutora
18. Cadeira adutora
19. Panturrilha em pé máquina
20. Abdominal crunch
21. Prancha frontal
22. Agachamento Smith
23. Hack squat
24. Afundo peso corporal
25. Passada caminhando
26. Glúteo no cabo
27. Panturrilha sentado máquina
28. Abdominal máquina
29. Crunch no cabo
30. Abdominal infra no solo
31. Elevação de joelhos na barra
32. Prancha lateral
33. Ab wheel
34. Hiperextensão lombar máquina
35. Tríceps francês sentado
36. Caminhada leve
37. Corrida contínua
38. Bicicleta vertical
<!-- priority:end -->

Esta lista orienta seleção, não cria correspondências por aproximação. Os IDs sempre vêm da consulta atual do catálogo.
