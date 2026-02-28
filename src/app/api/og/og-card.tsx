import type { ReactElement } from 'react'
import { COLORS } from '@/lib/colors'

type OgCardProps = {
  title: string
  subtitle: string
  score?: number
  tier?: string
  confidence?: string
  username?: string
}

const scoreColor = (score: number) => {
  if (score <= 30) return COLORS.slopGreen
  if (score <= 70) return COLORS.slopYellow
  return COLORS.slopRed
}

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
        display: 'flex',
        height: '100%',
        width: '100%',
        background: `linear-gradient(135deg, ${COLORS.background} 0%, #f5f5f4 50%, ${COLORS.background} 100%)`,
        color: COLORS.foreground,
        fontFamily: '"Inter","Helvetica Neue","Arial",sans-serif',
        padding: '56px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p
            style={{
              fontSize: 18,
              color: COLORS.muted,
              margin: 0,
              fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
            }}
          >
            areyougoingslop
          </p>
          <h1
            style={{
              fontSize: 54,
              margin: 0,
              lineHeight: 1.1,
              fontWeight: 700,
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 22, margin: 0, color: COLORS.muted }}>
            {subtitle}
          </p>
        </div>
        {username ? (
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              fontSize: 20,
              color: COLORS.muted,
            }}
          >
            @{username}
          </div>
        ) : null}
      </div>
      <div
        style={{
          width: '300px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          borderRadius: '20px',
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: COLORS.muted,
            margin: 0,
            fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
          }}
        >
          slop score
        </p>
        <p
          style={{
            fontSize: 72,
            margin: 0,
            color: score != null ? scoreColor(score) : COLORS.primary,
            fontWeight: 700,
            fontFamily: '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
          }}
        >
          {score ?? '--'}
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            alignItems: 'center',
            padding: '0 24px 24px',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 18,
              color: COLORS.foreground,
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            {tier ?? 'Playful heuristic'}
          </p>
          {confidence ? (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: COLORS.muted,
                fontFamily:
                  '"JetBrains Mono","SFMono-Regular","Menlo",monospace',
              }}
            >
              {confidence} confidence
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
