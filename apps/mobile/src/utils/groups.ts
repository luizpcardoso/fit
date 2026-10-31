import { apiErrorMessage } from '@/utils/api-errors';
import type { GroupReportReason, GroupRole } from '@fit/contracts';

/** Rótulos neutros e consistentes para os papéis do grupo. */
export const groupRoleLabels: Record<GroupRole, string> = { owner: 'Proprietário', admin: 'Administração', moderator: 'Moderação', member: 'Membro' };
export const groupRoleDescriptions: Record<GroupRole, string> = {
  owner: 'Controle total do grupo, incluindo papéis e desativação.',
  admin: 'Edita o grupo, convida e remove membros e resolve denúncias.',
  moderator: 'Analisa denúncias e remove conteúdo impróprio.',
  member: 'Publica conforme as regras do grupo, comenta e reage.',
};
export const roleLabel = (role: string) => groupRoleLabels[role as GroupRole] ?? 'Membro';

export const groupReportReasons: { key: GroupReportReason; label: string; description: string }[] = [
  { key: 'harassment', label: 'Assédio ou intimidação', description: 'Ataques, ameaças ou perseguição a alguém.' },
  { key: 'offensive', label: 'Conteúdo ofensivo', description: 'Discurso de ódio, insultos ou preconceito.' },
  { key: 'spam', label: 'Spam ou propaganda', description: 'Mensagens repetidas, golpes ou divulgação indesejada.' },
  { key: 'sexual', label: 'Conteúdo sexual', description: 'Nudez ou conteúdo sexual explícito.' },
  { key: 'privacy', label: 'Exposição de privacidade', description: 'Dados pessoais, fotos ou informações de alguém sem permissão.' },
  { key: 'dangerous', label: 'Conteúdo perigoso', description: 'Incentivo a autolesão, práticas arriscadas ou violência.' },
  { key: 'other', label: 'Outro motivo', description: 'Algo que não se encaixa nas opções acima.' },
];
export const reportReasonLabel = (reason: string) => groupReportReasons.find(item => item.key === reason)?.label ?? 'Outro motivo';

/** Mesmo mapeamento genérico, com textos específicos de grupos passados por cada tela. */
export const groupErrorMessage = apiErrorMessage;
