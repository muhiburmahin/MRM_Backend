export interface VisibilityInput {
  isVerified: boolean;
  evidenceNote: string | null;
  publishedAt: Date | null;
  clientId: string | null;
  clientApprovedAt: Date | null;
  translations: Array<{ locale: string; status: string }>;
}

export type Blocker =
  | 'NOT_VERIFIED' | 'EVIDENCE_NOTE_MISSING' | 'PUBLISH_DATE_MISSING' | 'PUBLISH_DATE_IN_FUTURE'
  | 'CLIENT_APPROVAL_MISSING' | 'NO_PUBLISHED_TRANSLATION';

/**
 * Mirrors the public query in ProjectsService.publicWhere(). Used to tell admins WHY a case study
 * is not (yet) visible. Keep the two in sync.
 */
export function visibility(cs: VisibilityInput, now: Date = new Date()) {
  const blockers: Blocker[] = [];
  if (!cs.isVerified) blockers.push('NOT_VERIFIED');
  if (!cs.evidenceNote || !cs.evidenceNote.trim()) blockers.push('EVIDENCE_NOTE_MISSING');
  if (!cs.publishedAt) blockers.push('PUBLISH_DATE_MISSING');
  else if (cs.publishedAt > now) blockers.push('PUBLISH_DATE_IN_FUTURE');
  if (cs.clientId && !cs.clientApprovedAt) blockers.push('CLIENT_APPROVAL_MISSING');
  const published = cs.translations.filter((t) => t.status === 'PUBLISHED').map((t) => t.locale).sort();
  if (!published.length) blockers.push('NO_PUBLISHED_TRANSLATION');
  return { isPublic: blockers.length === 0, locales: blockers.length === 0 ? published : [], blockers };
}
