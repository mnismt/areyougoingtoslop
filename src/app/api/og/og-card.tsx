import type { ReactElement } from 'react'

type Confidence = 'low' | 'medium' | 'high'

export type OgCardVariant =
  | 'result'
  | 'organization'
  | 'not_found'
  | 'invalid_username'
  | 'rate_limited'
  | 'unavailable'

type OgResultViewModel = {
  variant: 'result'
  username: string
  avatarDataUri: string | null
  slopScore: number
  tier: string
  tierTagline: string
  confidence: Confidence
  scoringWindow: string
  stats: {
    commitsInspected: number
    reposRaided: number
    windowDays: number
    intelSources: number
  }
  topSignals: string[]
  statusLine?: string
}

type OgFallbackViewModel = {
  variant: Exclude<OgCardVariant, 'result'>
  username?: string
  avatarDataUri?: string | null
  title: string
  subtitle: string
  note?: string
}

export type OgCardViewModel = OgResultViewModel | OgFallbackViewModel

const COLORS = {
  bg: '#09090b',
  bgSecondary: '#111113',
  text: '#e5e5e5',
  muted: '#71717a',
  border: 'rgba(255,255,255,0.10)',
  softBorder: 'rgba(255,255,255,0.07)',
  green: '#34d399',
  yellow: '#fbbf24',
  rose: '#fb7185',
  lowBadgeBg: 'rgba(113,113,122,0.20)',
  lowBadgeText: '#a1a1aa',
  mediumBadgeBg: 'rgba(251,191,36,0.16)',
  mediumBadgeText: '#fbbf24',
  highBadgeBg: 'rgba(251,113,133,0.16)',
  highBadgeText: '#fb7185',
} as const

const scoreColor = (score: number) => {
  if (score <= 30) return COLORS.green
  if (score <= 70) return COLORS.yellow
  return COLORS.rose
}

const confidenceColor = (confidence: Confidence) => {
  if (confidence === 'low') {
    return {
      bg: COLORS.lowBadgeBg,
      text: COLORS.lowBadgeText,
    }
  }
  if (confidence === 'medium') {
    return {
      bg: COLORS.mediumBadgeBg,
      text: COLORS.mediumBadgeText,
    }
  }
  return {
    bg: COLORS.highBadgeBg,
    text: COLORS.highBadgeText,
  }
}

const renderAvatar = ({
  username,
  avatarDataUri,
}: {
  username: string
  avatarDataUri: string | null
}) => {
  if (avatarDataUri) {
    return (
      <img
        src={avatarDataUri}
        alt={`${username} avatar`}
        width={72}
        height={72}
        style={{
          borderRadius: '999px',
          border: `2px solid ${COLORS.border}`,
          objectFit: 'cover',
          width: '72px',
          height: '72px',
        }}
      />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '72px',
        height: '72px',
        borderRadius: '999px',
        border: `2px solid ${COLORS.border}`,
        alignItems: 'center',
        justifyContent: 'center',
        color: COLORS.text,
        fontSize: 26,
        fontWeight: 700,
        background: COLORS.bgSecondary,
        textTransform: 'uppercase',
        fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
      }}
    >
      {username.slice(0, 1)}
    </div>
  )
}

const renderGauge = (score: number) => {
  const RADIUS = 120
  const CENTER_X = 150
  const CENTER_Y = 135
  const arcLength = Math.PI * RADIUS

  const angle = Math.PI - (score / 100) * Math.PI
  const nx = CENTER_X + 105 * Math.cos(angle)
  const ny = CENTER_Y - 105 * Math.sin(angle)

  const color = scoreColor(score)

  const ticks = [0, 25, 50, 75, 100].map((val) => {
    const a = Math.PI - (val / 100) * Math.PI
    return {
      outerX: CENTER_X + RADIUS * Math.cos(a),
      outerY: CENTER_Y - RADIUS * Math.sin(a),
      innerX: CENTER_X + (RADIUS - 10) * Math.cos(a),
      innerY: CENTER_Y - (RADIUS - 10) * Math.sin(a),
    }
  })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <svg width={300} height={180} viewBox="0 0 300 180">
        {/* Background arc */}
        <path
          d="M 30 135 A 120 120 0 1 1 270 135"
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={16}
          strokeLinecap="round"
        />
        {/* Colored arc */}
        <path
          d="M 30 135 A 120 120 0 1 1 270 135"
          fill="none"
          stroke={color}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={arcLength * (1 - score / 100)}
        />
        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <line
            key={i}
            x1={tick.outerX}
            y1={tick.outerY}
            x2={tick.innerX}
            y2={tick.innerY}
            stroke="rgba(255,255,255,0.20)"
            strokeWidth={2}
          />
        ))}
        {/* Needle */}
        <line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={nx}
          y2={ny}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={CENTER_X} cy={CENTER_Y} r={5} fill={color} />
      </svg>
      {/* Arc labels — outside SVG because Satori doesn't support <text> nodes */}
      <div
        style={{
          display: 'flex',
          width: '300px',
          justifyContent: 'space-between',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 10,
            color: COLORS.muted,
            fontFamily: '"JetBrains Mono", "Menlo", monospace',
          }}
        >
          artisan
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 10,
            color: COLORS.muted,
            fontFamily: '"JetBrains Mono", "Menlo", monospace',
          }}
        >
          slop machine
        </p>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 700,
          color,
          fontFamily: '"JetBrains Mono", "Menlo", monospace',
          lineHeight: 1,
        }}
      >
        {score}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: COLORS.muted,
          fontFamily: '"JetBrains Mono", "Menlo", monospace',
        }}
      >
        slop score
      </p>
    </div>
  )
}

const renderResultCard = (model: OgResultViewModel) => {
  const badge = confidenceColor(model.confidence)
  const score = Math.max(0, Math.min(100, model.slopScore))

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: '42px',
        background:
          'radial-gradient(circle at 82% 15%, rgba(251,113,133,0.08), transparent 45%), linear-gradient(180deg, #0b0b0d 0%, #09090b 100%)',
        color: COLORS.text,
        boxSizing: 'border-box',
        flexDirection: 'column',
        fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          areyougoingslop
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          borderRadius: '22px',
          border: `1px solid ${COLORS.softBorder}`,
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          padding: '32px',
          flexDirection: 'row',
          gap: '32px',
        }}
      >
        {/* Left column */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Avatar + username/tier/tagline */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
            }}
          >
            {renderAvatar({
              username: model.username,
              avatarDataUri: model.avatarDataUri,
            })}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 44,
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                @{model.username}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 24,
                  color: COLORS.text,
                  lineHeight: 1.1,
                }}
              >
                {model.tier}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  color: COLORS.muted,
                  lineHeight: 1.2,
                }}
              >
                {model.tierTagline}
              </p>
            </div>
          </div>

          {/* Stats strip */}
          <div
            style={{
              display: 'flex',
              borderRadius: '14px',
              border: `1px solid ${COLORS.softBorder}`,
              overflow: 'hidden',
            }}
          >
            {[
              {
                label: 'commits inspected',
                value: model.stats.commitsInspected,
              },
              {
                label: 'repos raided',
                value: model.stats.reposRaided,
              },
              {
                label: 'crime window',
                value: `${model.stats.windowDays}d`,
              },
              {
                label: 'intel sources',
                value: model.stats.intelSources,
              },
            ].map((stat, index) => (
              <div
                key={stat.label}
                style={{
                  display: 'flex',
                  flex: 1,
                  flexDirection: 'column',
                  padding: '16px 14px',
                  borderLeft:
                    index === 0 ? 'none' : `1px solid ${COLORS.softBorder}`,
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 26,
                    fontWeight: 700,
                    fontFamily: '"JetBrains Mono", "Menlo", monospace',
                  }}
                >
                  {stat.value}
                </p>
                <p
                  style={{
                    margin: 0,
                    color: COLORS.muted,
                    fontSize: 11,
                    fontFamily: '"JetBrains Mono", "Menlo", monospace',
                  }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* Signals chips */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            {model.topSignals.slice(0, 3).map((signal) => (
              <div
                key={signal}
                style={{
                  display: 'flex',
                  borderRadius: '12px',
                  border: `1px solid ${COLORS.softBorder}`,
                  background: 'rgba(255,255,255,0.02)',
                  padding: '9px 12px',
                  color: COLORS.muted,
                  fontSize: 13,
                  maxWidth: '340px',
                }}
              >
                {signal}
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div
          style={{
            display: 'flex',
            width: '380px',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {renderGauge(score)}

          {/* Confidence + window badges */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                borderRadius: '999px',
                padding: '6px 12px',
                background: badge.bg,
                color: badge.text,
                fontSize: 14,
                fontFamily: '"JetBrains Mono", "Menlo", monospace',
              }}
            >
              {model.confidence} confidence
            </div>
            <div
              style={{
                display: 'flex',
                borderRadius: '999px',
                padding: '6px 12px',
                border: `1px solid ${COLORS.softBorder}`,
                color: COLORS.muted,
                fontSize: 14,
                fontFamily: '"JetBrains Mono", "Menlo", monospace',
              }}
            >
              {model.scoringWindow}
            </div>
          </div>

          {model.statusLine ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: COLORS.muted,
                textAlign: 'center',
              }}
            >
              {model.statusLine}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const renderFallbackCard = (model: OgFallbackViewModel) => {
  const username = model.username?.trim() ?? ''
  const hasUser = username.length > 0

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: '42px',
        background:
          'radial-gradient(circle at 82% 15%, rgba(251,113,133,0.08), transparent 45%), linear-gradient(180deg, #0b0b0d 0%, #09090b 100%)',
        color: COLORS.text,
        boxSizing: 'border-box',
        flexDirection: 'column',
        fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          areyougoingslop
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: COLORS.muted,
            fontFamily: '"JetBrains Mono", "Menlo", monospace',
          }}
        >
          satire, not a factual detector
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          flex: 1,
          borderRadius: '22px',
          border: `1px solid ${COLORS.softBorder}`,
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
          padding: '30px',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '28px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '720px',
          }}
        >
          {hasUser ? (
            <p
              style={{
                margin: 0,
                color: COLORS.muted,
                fontSize: 20,
                fontFamily: '"JetBrains Mono", "Menlo", monospace',
              }}
            >
              @{username}
            </p>
          ) : null}
          <p
            style={{
              margin: 0,
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {model.title}
          </p>
          <p
            style={{
              margin: 0,
              color: COLORS.muted,
              fontSize: 26,
              lineHeight: 1.25,
              maxWidth: '660px',
            }}
          >
            {model.subtitle}
          </p>
          {model.note ? (
            <p
              style={{
                margin: 0,
                color: COLORS.muted,
                fontSize: 16,
                fontFamily: '"JetBrains Mono", "Menlo", monospace',
              }}
            >
              {model.note}
            </p>
          ) : null}
        </div>

        {hasUser ? (
          <div
            style={{
              display: 'flex',
            }}
          >
            {renderAvatar({
              username,
              avatarDataUri: model.avatarDataUri ?? null,
            })}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              width: '98px',
              height: '98px',
              borderRadius: '22px',
              border: `1px solid ${COLORS.softBorder}`,
              alignItems: 'center',
              justifyContent: 'center',
              color: COLORS.rose,
              fontSize: 48,
              background: 'rgba(251,113,133,0.08)',
            }}
          >
            ?
          </div>
        )}
      </div>
    </div>
  )
}

export const renderOgCard = (model: OgCardViewModel): ReactElement => {
  if (model.variant === 'result') {
    return renderResultCard(model)
  }

  return renderFallbackCard(model)
}
