// Both surfaces display the balance supplied by the daily summary API.
export function formatEnergyBalance(value: number | null) {
  if (value == null) return '— kcal';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toLocaleString('pt-BR')} kcal`;
}

/** Plain-language explanation shown first; technical details live in energyBalanceDetails. */
export const energyBalanceInformation = [
  'O balanço compara o que você registrou de comida com uma estimativa de quanto seu corpo gasta no dia inteiro. Negativo quer dizer que você comeu menos do que o gasto estimado; positivo, mais. Enquanto o dia não termina, o resultado é parcial: refeições ainda não registradas mudam o número.',
  'A estimativa automática usa idade, altura, o peso mais recente e a base para estimativas do seu perfil, considerando uma rotina leve no dia a dia. O nível de atividade do perfil não entra nessa conta. Treinos concluídos e cardios registrados no dia são somados por cima. Se você ajustar o gasto (personalizando a estimativa ou informando o valor de outro aparelho), esse valor passa a valer para a data e nada é somado a ele.',
  'São médias para acompanhar tendências, não medições do seu corpo nem uma meta alimentar. Evite registrar a mesma atividade duas vezes, por exemplo como treino e como cardio.',
] as const;

export const energyBalanceDetails = [
  'Gasto em repouso: equação de Mifflin–St Jeor (10 × peso + 6,25 × altura − 5 × idade, com +5 na base masculina ou −161 na feminina), multiplicada por 1,2 para cobrir uma rotina básica. Disponível de 19 a 78 anos, faixa do estudo original. Usamos o último peso registrado até a data consultada.',
  'Treinos de força: como o app ainda não mede a duração, cada treino concluído usa uma hipótese de 45 minutos a 3,5 MET (esforço moderado). MET compara o esforço de uma atividade com o gasto em repouso. Essa duração é uma referência do app, não uma medição do seu treino.',
  'Cardios estimados usam valores MET do Compêndio de Atividades Físicas (2024). Descontamos 1 MET de repouso, que já está na base diária. Cardios informados como calorias totais (com duração) também têm o repouso do período descontado; calorias ativas entram inteiras.',
  'Na estimativa personalizada, você escolhe a rotina do dia a dia (fatores de 1,2 a 1,6, sem exercício formal) e informa as calorias dos exercícios daquele dia.',
  'Referências: Mifflin et al. (1990) e Compêndio de Atividades Físicas (2024).',
] as const;
