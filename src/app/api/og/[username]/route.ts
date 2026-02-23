import { ImageResponse } from "next/og";
import { renderOgCard } from "../og-card";
import { scoreUser } from "../../../../server/api/score";
import {
  GitHubNotFoundError,
  GitHubRateLimitError,
} from "../../../../server/github";

export const runtime = "edge";
type Params = {
  params: Promise<{ username: string }>;
};

export const GET = async (_request: Request, { params }: Params) => {
  const { username } = await params;
  try {
    const score = await scoreUser(username);
    return new ImageResponse(
      renderOgCard({
        title: score.tier,
        subtitle: "Satirical heuristic. Roast the code, not the coder.",
        score: score.slop_score,
        tier: score.tier,
        confidence: score.confidence,
        username,
      }),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (error) {
    const subtitle =
      error instanceof GitHubNotFoundError
        ? "GitHub user not found."
        : error instanceof GitHubRateLimitError
          ? "Rate limited. Try again soon."
          : "Score unavailable right now.";
    return new ImageResponse(
      renderOgCard({
        title: "Score unavailable",
        subtitle,
        username,
      }),
      {
        width: 1200,
        height: 630,
      },
    );
  }
};
