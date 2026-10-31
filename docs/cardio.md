# Registro de cardio

## Experiência inicial

O mesmo resumo de cardio aparece na Home e em Treinos. O usuário pode registrar uma sessão de duas formas:

- estimativa por atividade, intensidade, duração e peso;
- valor manual informado por relógio, aplicativo ou equipamento, com identificação da fonte e a escolha explícita **Calorias totais (inclui repouso)** ou **Calorias ativas**.

O contrato da API não mudou: um valor manual **com** `durationMinutes` é tratado como total da sessão (o balanço desconta `peso × duração / 60` de repouso) e **sem** duração como calorias ativas. O app mapeia a escolha para o payload: em *Calorias totais* a duração é obrigatória e enviada; em *Calorias ativas* o campo de duração é ocultado e `durationMinutes` vai `null`. Consequência documentada: sessões manuais em calorias ativas não somam minutos ao resumo de cardio. Registrar também os minutos dessas sessões exigiria um campo explícito no contrato (por exemplo `caloriesKind`), ainda não implementado.

Os registros são privados, pertencem ao usuário autenticado e podem ser excluídos apenas pelo proprietário. Para evitar dupla contagem, o app orienta a não registrar a mesma sessão nos dois modos. O histórico alimenta a estimativa automática do balanço na Home, descontando o repouso quando há duração. Um gasto diário informado em Alimentação substitui a estimativa automática e não recebe cardio novamente.

## Cálculo

A API é a autoridade do cálculo e usa:

`calorias = MET × peso em kg × duração em minutos ÷ 60`

Os valores iniciais foram selecionados a partir do Compêndio de Atividades Físicas para Adultos de 2024:

| Atividade | Leve | Moderada | Intensa |
| --- | ---: | ---: | ---: |
| Caminhada | 2,8 | 3,8 | 4,8 |
| Corrida | 6,5 | 8,5 | 11,0 |
| Bicicleta | 4,3 | 7,0 | 9,0 |
| Escada | 4,5 | 6,8 | 9,3 |
| Spinning | 4,0 | 6,8 | 9,0 |

Esses valores representam atividades ou ritmos próximos descritos no compêndio. O resultado é uma estimativa populacional, não uma medição individual. O app comunica que velocidade, inclinação, resistência, condicionamento e outros fatores podem alterar o gasto real.

## Referências

- [2024 Adult Compendium of Physical Activities](https://pacompendium.com/adult-compendium/)
- [Walking](https://pacompendium.com/walking/)
- [Running](https://pacompendium.com/running/)
- [Bicycling e spinning](https://pacompendium.com/bicycling/)
- [Artigo metodológico do Compêndio de 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/)
