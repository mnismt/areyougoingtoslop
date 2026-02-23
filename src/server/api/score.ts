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
  const events = await fetchUserActivity(username, {
    token: options.token,
    fetcher: options.fetcher,
    now: options.now,
  });

  return computeSlopScore(events, undefined, options.now);
};

