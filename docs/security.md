# Segurança da aplicação

## Modelo básico

O aplicativo é um cliente não confiável. Controles visuais melhoram a experiência, mas toda autorização e regra de negócio deve ser aplicada novamente na API.

## Dados e privacidade

- Classificar cada dado novo como público, compartilhado, privado ou sensível.
- Coletar e armazenar apenas o necessário para a funcionalidade.
- Definir quem pode acessar, alterar, compartilhar e excluir cada recurso.
- Metas, progresso, fotos, medidas e informações relacionadas à saúde são privadas por padrão.
- Compartilhamento deve ser uma ação explícita do usuário e expor somente os campos escolhidos.

## Autenticação e sessão

- A API deriva a identidade da sessão; identificadores enviados pelo cliente não provam identidade.
- Tokens não devem aparecer em logs, URLs ou mensagens de erro.
- No dispositivo, credenciais devem usar armazenamento seguro do sistema operacional.
- Logout deve invalidar ou encerrar a sessão conforme o mecanismo adotado e limpar dados privados locais.

## Autorização

Para cada endpoint protegido, testar pelo menos:

1. usuário não autenticado;
2. usuário autenticado e autorizado;
3. usuário autenticado tentando acessar recurso de outra pessoa;
4. usuário com papel insuficiente;
5. identificador inexistente ou inválido.

## Entrada, saída e erros

- Validar formato, tipo, intervalo, tamanho e campos desconhecidos.
- Retornar apenas os campos previstos no contrato público.
- Usar mensagens úteis ao usuário sem revelar implementação interna.
- Limitar paginação, upload e payloads para reduzir abuso e consumo excessivo.

## Dependências e configuração

- Versionar `.env.example`, nunca `.env` real.
- Revisar alertas de dependências antes de atualizar; não usar correções forçadas sem avaliar mudanças incompatíveis.
- Manter ambientes de desenvolvimento e produção separados.
- Usar HTTPS fora do ambiente local e nunca desabilitar validação de certificado como solução permanente.

## Revisão por funcionalidade

Toda funcionalidade deve responder:

- Quais dados entram e saem?
- Quem pode executar cada ação?
- Como a API comprova propriedade e permissão?
- O que acontece com entradas inválidas ou repetidas?
- Há dados pessoais ou sensíveis?
- O que pode aparecer em logs e métricas?
- Como o recurso é excluído ou deixa de ser compartilhado?

