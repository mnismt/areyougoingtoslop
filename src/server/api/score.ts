import { fetchUserActivity } from "../github";
import { computeSlopScore, type SlopScoreResult } from "../scoring";

export type ScoreUserOptions = {
  token?: string;
  fetcher?: typeof fetch;
  now?: Date;
};

export const scoreUser = async (
  username: string,
  options: ScoreUserOptions = {},
): Promise<SlopScoreResult> => {
  const effectiveNow = options.now ?? new Date();
  const events = await fetchUserActivity(username, {
    token: options.token,
    fetcher: options.fetcher,
    now: effectiveNow,
  });

  return computeSlopScore(events, undefined, effectiveNow);
};
