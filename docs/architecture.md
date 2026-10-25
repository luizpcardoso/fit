# Arquitetura

## Organização inicial

O projeto é um monorepo com aplicativo e API implantáveis separadamente.

## Fluxo de uma funcionalidade

```text
necessidade do usuário
  -> fluxo e tela do app
  -> estados da interface
  -> contrato de dados
  -> endpoint da API
  -> integração e testes
```

O aplicativo não importa modelos do banco. Contratos compartilhados representam apenas a fronteira pública da API.

Uma funcionalidade de produto só termina após a integração real entre tela e endpoint. Dados simulados podem apoiar a construção inicial da interface, mas não constituem a entrega final.

Alterações puramente visuais não geram endpoints sem propósito. Toda operação real de leitura ou mutação introduzida por uma funcionalidade deve possuir contrato e endpoint correspondentes.

## Limite de confiança

```text
aplicativo não confiável
  -> validação do contrato
  -> autenticação
  -> autorização do recurso
  -> regra de negócio na API
  -> persistência
```

A API nunca assume que ocultar um botão no aplicativo impede uma ação. Identidade, permissão, propriedade e regras de negócio são verificadas no servidor.

