import { ImageResponse } from "next/og";
import { renderOgCard } from "../og-card";

export const runtime = "edge";
export const GET = async () => {
  return new ImageResponse(
    renderOgCard({
      title: "Playful slop score",
      subtitle: "We scan public GitHub activity and deliver a fun roast.",
    }),
    {
      width: 1200,
      height: 630,
    },
  );
};
