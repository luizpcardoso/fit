# Injetáveis — MVP

## Objetivo

Organizar, de forma privada, os dias prescritos para medicamentos injetáveis, registrar aplicações e exibir uma estimativa educativa da quantidade remanescente pelo tempo de meia-vida.

O recurso não prescreve medicamentos, não recomenda doses ou frequências e não mede concentração sanguínea.

## Fluxo

- Saúde > Injetáveis abre a agenda, cadastros, histórico e estimativa. O gráfico tem um único nome em toda a interface, **Quantidade estimada no organismo**, com subtítulo explicando que é uma estimativa matemática pela meia-vida, não medição no sangue. A leitura acessível do gráfico informa o valor de hoje, o pico do período e a próxima aplicação prevista.
- O cadastro recebe nome, dose, unidade, dias da semana, meia-vida e observações opcionais.
- A Home mostra injetáveis previstos no dia junto de Medicamentos e Suplementos.
- Uma aplicação prevista pode ser marcada ou desfeita pela Home ou pela tela de Injetáveis.
- Cada aplicação preserva um snapshot da dose e unidade vigentes.

As unidades aceitas são mg, mL, UI, cliques e outra unidade textual. Não há conversão entre unidades.

## Estimativa

Para cada aplicação compatível com a unidade atual, a quantidade remanescente é calculada por:

`dose × 0,5 ^ (tempo decorrido / meia-vida)`

As contribuições das aplicações são somadas. Aplicações registradas em outra unidade não são somadas e essa exclusão é informada na interface.

## Privacidade e API

Todos os endpoints exigem autenticação e derivam o proprietário da sessão:

- `GET/POST /injectables`
- `PUT/DELETE /injectables/:id`
- `GET /injectables/today?date=AAAA-MM-DD`
- `POST/DELETE /injectables/:id/applications`
- `GET /injectables/:id/estimate?days=30`

Injetáveis e aplicações são privados e nunca aparecem em grupos.

## Referências de segurança

- [FDA — bula aprovada de tirzepatida (2026)](https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/215866Orig1s052lbl.pdf): administração semanal e meia-vida aproximada de cinco dias.
- [Anvisa — nova indicação do Mounjaro](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/novos-medicamentos-e-indicacoes/mounjaro-r-tirzepatida-nova-indicacao): uso semanal e progressão de dose sob orientação.
- [Anvisa — alerta sobre uso indevido de canetas emagrecedoras](https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/2026/anvisa-emite-alerta-para-risco-de-pancreatite-aguda-associada-ao-uso-indevido-de-canetas-emagrecedoras): necessidade de prescrição e acompanhamento profissional.
# Meia-vida opcional e curva

A meia-vida pode ser omitida ou removida do cadastro. Sem esse dado, aplicações continuam disponíveis e a estimativa não é calculada. Quando informada, a curva de quantidade remanescente usa pontos a cada 12 horas nos últimos 30 dias. Trata-se de decaimento matemático das doses registradas, não de concentração sanguínea medida.

