export interface DingtalkRobotCredentialInput {
  accessToken: string;
  keyword: string;
}

export function normalizeDingtalkRobotCredentialInput(
  accessTokenInput: string,
  keywordInput = '',
): DingtalkRobotCredentialInput {
  const accessToken = accessTokenInput.trim();
  const keyword = keywordInput.trim();
  if (!/^https?:\/\//i.test(accessToken)) {
    return { accessToken, keyword };
  }
  const webhook = new URL(accessToken);
  const token = webhook.searchParams.get('access_token')?.trim() ?? '';
  const urlKeyword =
    webhook.searchParams.get('keyword')?.trim() ||
    webhook.searchParams.get('keywords')?.trim() ||
    '';
  return {
    accessToken: token || accessToken,
    keyword: keyword || urlKeyword,
  };
}
