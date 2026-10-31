import { ApiClientError } from '@fit/api-client';

export type ApiFailure = 'network' | 'auth' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited' | 'invalid' | 'server';
/** Classifica falhas sem expor detalhes internos: o cliente lança ApiClientError para respostas HTTP e erros nativos para falta de conexão. */
export function apiFailure(error: unknown): ApiFailure {
  if (!(error instanceof ApiClientError)) return 'network';
  if (error.status === 401) return 'auth';
  if (error.status === 403) return 'forbidden';
  if (error.status === 404) return 'not_found';
  if (error.status === 409) return 'conflict';
  if (error.status === 429) return 'rate_limited';
  if (error.status === 400 || error.status === 413 || error.status === 422) return 'invalid';
  return 'server';
}
const defaults: Record<ApiFailure, string> = {
  network: 'Sem conexão com o servidor. Confira a internet e tente novamente.',
  auth: 'Sua sessão expirou. Entre novamente para continuar.',
  forbidden: 'Você não tem permissão para esta ação.',
  not_found: 'Este conteúdo não está mais disponível.',
  conflict: 'Esta ação já foi realizada ou não está mais disponível.',
  rate_limited: 'Muitas tentativas seguidas. Aguarde um minuto e tente novamente.',
  invalid: 'Confira os dados informados e tente novamente.',
  server: 'Não foi possível concluir agora. Tente novamente em instantes.',
};
/** Mensagem segura em pt-BR por tipo de falha, com textos específicos opcionais por tela. */
export function apiErrorMessage(error: unknown, overrides: Partial<Record<ApiFailure, string>> = {}) {
  const kind = apiFailure(error);
  return overrides[kind] ?? defaults[kind];
}
