export function retainedPreviewNotice(reason: string, login: string): string {
  const sentence = reason.trim().replace(/[.!?]+$/, "");
  return `${sentence}. Existing preview @${login} remains visible and was not replaced.`;
}

export function contributionUnavailableNotice(): string {
  return "Available public signals loaded. Streak and Activity are unavailable for this preview and were omitted from README Markdown; no value was guessed.";
}
