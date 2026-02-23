import type { ReactElement } from "react";

type OgCardProps = {
  title: string;
  subtitle: string;
  score?: number;
  tier?: string;
  confidence?: string;
  username?: string;
};

export const renderOgCard = ({
  title,
  subtitle,
  score,
  tier,
  confidence,
  username,
}: OgCardProps): ReactElement => {
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background:
          "linear-gradient(135deg, rgba(11,10,8,1) 0%, rgba(21,18,15,1) 50%, rgba(11,10,8,1) 100%)",
        color: "#f7f1e6",
        fontFamily:
          '"Iowan Old Style","Palatino Linotype","Book Antiqua","Spectral",serif',
        padding: "56px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p
            style={{
              fontSize: 20,
              letterSpacing: "0.35em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              margin: 0,
            }}
          >
            areyougoingslop
          </p>
          <h1 style={{ fontSize: 58, margin: 0, lineHeight: 1.1 }}>
            {title}
          </h1>
          <p style={{ fontSize: 24, margin: 0, color: "rgba(255,255,255,0.7)" }}>
            {subtitle}
          </p>
        </div>
        {username ? (
          <div
            style={{
              display: "flex",
              gap: "16px",
              alignItems: "center",
              fontSize: 22,
              color: "rgba(255,255,255,0.65)",
            }}
          >
            @{username}
          </div>
        ) : null}
      </div>
      <div
        style={{
          width: "320px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "16px",
          borderRadius: "32px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <p
          style={{
            fontSize: 18,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
            margin: 0,
          }}
        >
          Slop Score
        </p>
        <p style={{ fontSize: 76, margin: 0, color: "#f15a29" }}>
          {score ?? "--"}
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            alignItems: "center",
            padding: "0 24px 24px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 20,
              color: "rgba(255,255,255,0.75)",
              textAlign: "center",
            }}
          >
            {tier ?? "Playful heuristic"}
          </p>
          {confidence ? (
            <p
              style={{
                margin: 0,
                fontSize: 16,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              {confidence} confidence
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};
