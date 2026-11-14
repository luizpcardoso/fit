import { apiErrorMessage } from '@/utils/api-errors';
import type { GroupReportReason, GroupRole, GroupUser, SocialPost } from '@fit/contracts';
import { localDate } from '@/utils/dates';

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

/**
 * People (other than the viewer) whose workout or cardio was shared today in the viewer's groups, newest first.
 * Derived only from activity posts the viewer can already read; nothing private is consulted.
 */
export function trainedToday(posts: SocialPost[], viewerId: string | undefined, today = localDate()) {
  const seen = new Set<string>(), people: { user: GroupUser; post: SocialPost }[] = [];
  for (const post of posts) {
    if (post.kind !== 'event' || (post.eventType !== 'workout_completed' && post.eventType !== 'cardio_completed')) continue;
    if (post.author.id === viewerId || seen.has(post.author.id) || localDate(new Date(post.createdAt)) !== today) continue;
    seen.add(post.author.id); people.push({ user: post.author, post });
  }
  return people;
}
/** "Ana", "Ana e Bruno", "Ana, Bruno e mais 2". */
export function peopleSummary(names: string[]) {
  const first = names.map(name => name.trim().split(/\s+/)[0]);
  if (first.length <= 1) return first[0] ?? '';
  if (first.length === 2) return `${first[0]} e ${first[1]}`;
  return `${first[0]}, ${first[1]} e mais ${first.length - 2}`;
}
