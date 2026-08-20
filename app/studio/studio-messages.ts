export function retainedPreviewNotice(reason: string, login: string): string {
  const sentence = reason.trim().replace(/[.!?]+$/, "");
  return `${sentence}. Existing preview @${login} remains visible and was not replaced.`;
}
