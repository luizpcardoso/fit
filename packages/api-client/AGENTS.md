# Cliente HTTP — complemento da raiz

`createApiClient()` centraliza transporte, serialização, auth, erros públicos, refresh deduplicado, cache curto de GETs e URLs `/media/…`. Tipos alinhados a `@fit/contracts`; negócio permanece na API. Não registre tokens/corpos sensíveis nem oculte erros de autorização/validação com defaults. Telemetria usa transporte independente, sem invalidar cache ou renovar/encerrar sessão em erro.
