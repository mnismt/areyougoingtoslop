import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const RADIUS = 80
const STROKE = 12
const CENTER_X = 100
const CENTER_Y = 90
const START_ANGLE = Math.PI
const END_ANGLE = 0

const polarToCartesian = (angle: number) => ({
  x: CENTER_X + RADIUS * Math.cos(angle),
  y: CENTER_Y - RADIUS * Math.sin(angle),
})

const describeArc = (startAngle: number, endAngle: number) => {
  const start = polarToCartesian(startAngle)
  const end = polarToCartesian(endAngle)
  const largeArc = startAngle - endAngle > Math.PI ? 1 : 0
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

const TICKS = [0, 25, 50, 75, 100]

const scoreColor = (score: number) => {
  if (score <= 30) return 'var(--slop-green)'
  if (score <= 70) return 'var(--slop-yellow)'
  return 'var(--slop-red)'
}

const formatNumber = (value: number) => {
  const rounded = Math.round(value * 10) / 10
  if (Number.isInteger(rounded)) {
    return rounded.toFixed(0)
  }
  return rounded.toFixed(1)
}

export default function SlopGauge({
  score,
  signalBreakdown,
}: {
  score: number
  signalBreakdown?: Array<{
    key: string
    label: string
    score: number
    contribution: number
  }>
}) {
  const clamped = Math.max(0, Math.min(100, score))
  const arcLength = Math.PI * RADIUS

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 200 120"
        className="w-44 sm:w-56"
        role="img"
        aria-label={`Slop score gauge showing ${score} out of 100`}
      >
        <title>Slop score: {score} out of 100</title>
        <defs>
          <linearGradient id="arc-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--slop-green)" />
            <stop offset="50%" stopColor="var(--slop-yellow)" />
            <stop offset="100%" stopColor="var(--slop-red)" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d={describeArc(START_ANGLE, END_ANGLE)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Colored arc */}
        <path
          d={describeArc(START_ANGLE, END_ANGLE)}
          fill="none"
          stroke="url(#arc-gradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          style={
            {
              strokeDasharray: arcLength,
              strokeDashoffset: 'var(--target-offset)',
              animation: 'fill-arc 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              '--target-offset': arcLength - arcLength * (clamped / 100),
            } as React.CSSProperties
          }
        />

        {/* Tick marks */}
        {TICKS.map((tick) => {
          const angle = Math.PI - (tick / 100) * Math.PI
          const inner = {
            x: CENTER_X + (RADIUS - STROKE / 2 - 4) * Math.cos(angle),
            y: CENTER_Y - (RADIUS - STROKE / 2 - 4) * Math.sin(angle),
          }
          const outer = {
            x: CENTER_X + (RADIUS + STROKE / 2 + 4) * Math.cos(angle),
            y: CENTER_Y - (RADIUS + STROKE / 2 + 4) * Math.sin(angle),
          }
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--border)"
              strokeWidth="1.5"
            />
          )
        })}

        {/* Needle */}
        <line
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={CENTER_X - RADIUS}
          y2={CENTER_Y}
          stroke={scoreColor(clamped)}
          strokeWidth="2.5"
          strokeLinecap="round"
          style={
            {
              transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
              animation: 'sweep 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              '--target-angle': `${180 * (clamped / 100)}deg`,
            } as React.CSSProperties
          }
        />
        <circle cx={CENTER_X} cy={CENTER_Y} r="4" fill={scoreColor(clamped)} />

        {/* Labels */}
        <text
          x={CENTER_X - RADIUS - 2}
          y={CENTER_Y + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: '7px', fontFamily: 'var(--font-mono-stack)' }}
        >
          artisan
        </text>
        <text
          x={CENTER_X + RADIUS - 4}
          y={CENTER_Y + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: '7px', fontFamily: 'var(--font-mono-stack)' }}
        >
          slop machine
        </text>
      </svg>

      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center -mt-2 cursor-help group">
              <span
                className="font-mono text-4xl font-bold"
                style={{ color: scoreColor(clamped) }}
              >
                {score}
              </span>
              <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                slop score
                <svg
                  className="h-3 w-3 shrink-0 text-muted-foreground/50"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 16v-4M12 8h.01"
                  />
                </svg>
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="w-[300px] border border-border bg-card p-4 shadow-lg"
            sideOffset={8}
          >
            {signalBreakdown && signalBreakdown.length > 0 ? (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  signal breakdown
                </p>
                <div className="space-y-1.5">
                  {signalBreakdown
                    .filter((s) => s.contribution > 0)
                    .map((signal) => (
                      <div
                        key={signal.key}
                        className="grid items-center gap-x-3"
                        style={{ gridTemplateColumns: '1fr auto auto' }}
                      >
                        <span className="text-[11px] text-muted-foreground">
                          {signal.label}
                        </span>
                        <span className="whitespace-nowrap font-mono text-[11px] text-foreground tabular-nums">
                          +{formatNumber(signal.contribution)} pts
                        </span>
                        <span className="w-10 whitespace-nowrap text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                          ({Math.round(signal.score)}%)
                        </span>
                      </div>
                    ))}
                </div>
                <div className="border-t border-border pt-2">
                  <div
                    className="grid items-center gap-x-3"
                    style={{ gridTemplateColumns: '1fr auto' }}
                  >
                    <span className="text-[11px] font-medium text-foreground">
                      total
                    </span>
                    <span
                      className="whitespace-nowrap font-mono text-[11px] font-bold tabular-nums"
                      style={{ color: scoreColor(clamped) }}
                    >
                      {score} / 100
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="font-mono text-[11px] text-muted-foreground">
                no signal data available
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
