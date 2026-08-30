export interface DingTalkBindingRedirect {
  bindResult: null | string;
  challengeId: null | string;
  cleanUrl: string;
  legacySuccess: null | string;
}

export function parseDingtalkBindingRedirect(
  href: string,
): DingTalkBindingRedirect {
  const url = new URL(href);
  const result = {
    bindResult: url.searchParams.get('bind_result'),
    challengeId: url.searchParams.get('bind_challenge_id'),
    cleanUrl: '',
    legacySuccess: url.searchParams.get('bind_success'),
  };
  url.searchParams.delete('bind_result');
  url.searchParams.delete('bind_challenge_id');
  url.searchParams.delete('bind_success');
  url.searchParams.delete('merge_challenge_id');
  result.cleanUrl = url.toString();
  return result;
}
