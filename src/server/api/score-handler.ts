import { NextRequest, NextResponse } from "next/server";
import { scoreUser } from "./score";
import { upsertLeaderboardEntry } from "../leaderboard";
import {
  GitHubNotFoundError,
  GitHubRateLimitError,
  GitHubValidationError,
  isValidGitHubUsername,
} from "../github";

export type ScoreHandler = (
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
) => Promise<NextResponse>;

export type ScoreHandlerOptions = {
  recordLeaderboard?: boolean;
};

export const createScoreHandler =
  (
    scorer: typeof scoreUser = scoreUser,
    options: ScoreHandlerOptions = {},
  ): ScoreHandler =>
  async (_request, context) => {
    const { username } = await context.params;
    if (!isValidGitHubUsername(username)) {
      return NextResponse.json(
        { error: "invalid_username", message: "Invalid GitHub username." },
        { status: 400 },
      );
    }

    try {
      const result = await scorer(username);
      if (options.recordLeaderboard !== false) {
        await upsertLeaderboardEntry({
          username,
          slop_score: result.slop_score,
          tier: result.tier,
          confidence: result.confidence,
          last_scored_at: new Date().toISOString(),
        });
      }
      return NextResponse.json(result, { status: 200 });
    } catch (error) {
      if (error instanceof GitHubNotFoundError) {
        return NextResponse.json(
          { error: "not_found", message: "GitHub user not found." },
          { status: 404 },
        );
      }
      if (error instanceof GitHubRateLimitError) {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: "GitHub API rate limit exceeded.",
            reset_at: error.resetAt,
          },
          { status: 429 },
        );
      }
      if (error instanceof GitHubValidationError) {
        return NextResponse.json(
          { error: "invalid_username", message: error.message },
          { status: 400 },
        );
      }
      return NextResponse.json(
        {
          error: "server_error",
          message: "Unable to compute score right now.",
        },
        { status: 500 },
      );
    }
  };
