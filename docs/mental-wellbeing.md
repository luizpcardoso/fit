# Mente — MVP de bem-estar emocional

## Objetivo

Oferecer um espaço privado para o usuário registrar como se sentiu, guardar uma reflexão opcional e observar o próprio histórico. A funcionalidade não diagnostica condições e não substitui atendimento profissional.

## Fluxo

Na aba Saúde, o card Mente abre uma tela com:

- check-in de hoje e edição do registro;
- cinco estados emocionais textuais e acessíveis;
- emoções, influências e anotação opcionais;
- gráfico descritivo dos últimos sete dias;
- diário com edição e exclusão;
- lembrete diário local e opcional;
- contatos de apoio, incluindo CVV 188 e SAMU 192, com botões de ligar (`tel:`) e, quando o aparelho não consegue discar, um aviso com o número.

Quando o check-in de hoje é “Muito mal”, o card de apoio sobe para logo abaixo do resumo, com o botão “Ver formas de apoio” que rola até ele. No formulário, escolher “Muito mal” mostra o atalho para ligar ao CVV e o botão “Ver formas de apoio”, que fecha o check-in e leva ao card. Emoções e textos usam formas neutras de gênero (“Com calma”, “Com motivação”, “Você não precisa passar por isso sem apoio”). Cada dia do gráfico tem leitura acessível com data e humor (ou “sem registro”).

Existe no máximo um check-in por usuário e data. Um novo envio para a mesma data substitui o registro daquele dia.

## Privacidade e segurança

Os registros são sensíveis e privados por padrão. A identidade é obtida da sessão autenticada, todas as consultas são limitadas ao proprietário e não há compartilhamento com grupos. O conteúdo do diário não é colocado em notificações nem usado para diagnóstico ou detecção automática de risco.

O lembrete é agendado localmente no aparelho. Sua mensagem é neutra e ele pode ser desligado a qualquer momento.

## API

- `GET /mental-check-ins?from=AAAA-MM-DD&to=AAAA-MM-DD`
- `POST /mental-check-ins`
- `PUT /mental-check-ins/:id`
- `DELETE /mental-check-ins/:id`

O período retorna no máximo cem registros. O texto do diário tem limite de 2.000 caracteres.
