import type {APIRequestContext} from '@playwright/test';

/** Give each integration flow a full real rate-limit window without weakening the API. */
export async function waitForApiBudget(request: APIRequestContext, apiURL: string) {
  const response=await request.get(apiURL+'/health');
  const headers=response.headers();
  const remaining=Number(headers['x-ratelimit-remaining'] ?? 120);
  if(remaining>=100 && response.status()!==429) return;
  const delay=Number(headers['retry-after'] ?? headers['x-ratelimit-reset'] ?? 60)*1000+250;
  if(delay>0) await new Promise(resolve=>setTimeout(resolve,Math.min(delay,60250)));
}
