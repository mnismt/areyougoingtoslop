'use client'

import { AnimatePresence, motion } from 'motion/react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { AnalyzedCommit } from './score-live-view'
import {
  buildHeatmapGrid,
  dateKeyToTime,
  formatDate,
  getFilterStartTime,
  MONTH_NAMES,
  toDateKey,
} from './slop-heatmap-helpers'

type DayBucket = { total: number; flagged: number }
type FilterRange = '6m' | '3m' | '1m' | '1w'

const FILTER_DAYS: Record<FilterRange, number> = {
  '6m': 180,
  '3m': 90,
  '1m': 30,
  '1w': 7,
}

const GAP = 3
const LEFT_PAD = 32
const TOP_PAD = 18
const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const
const ENTRANCE_STAGGER = 0.012
const WAVE_STEP_MS = 22
const DAY_LABELS = ['Mon', 'Wed', 'Fri'] as const
const DAY_LABEL_ROWS = [0, 2, 4] as const

function useAnimatedNumber(target: number, duration = 320): number {
  const [display, setDisplay] = useState(target)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef({ value: target, time: 0 })

  useEffect(() => {
    const from = display
    if (from === target) return
    startRef.current = { value: from, time: performance.now() }

    const tick = (now: number) => {
      const elapsed = now - startRef.current.time
      const progress = Math.min(elapsed / duration, 1)
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      const current = Math.round(from + (target - from) * eased)
      setDisplay(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])

  return display
}

function slopLevel(bucket: DayBucket | undefined): number {
  if (!bucket || bucket.total === 0) return 0
  if (bucket.flagged === 0) return 1
  const ratio = bucket.flagged / bucket.total
  if (ratio <= 0.5) return 2
  if (ratio <= 0.8) return 3
  return 4
}

const LEVEL_COLORS = [
  'var(--heatmap-empty)',
  'var(--slop-green)',
  'var(--heatmap-low)',
  'var(--heatmap-mid)',
  'var(--slop-red)',
]

function buildInRangeKeys(
  dateTimes: Map<string, number>,
  filterDays: number,
  windowDays: number,
): Set<string> | null {
  if (filterDays >= windowDays) return null

  const filterStartTime = getFilterStartTime(filterDays)
  const next = new Set<string>()

  for (const [dateKey, time] of dateTimes) {
    if (time >= filterStartTime) next.add(dateKey)
  }

  return next
}

function isDateKeyInRange(
  dateKey: string,
  inRangeKeys: Set<string> | null,
): boolean {
  return inRangeKeys === null || inRangeKeys.has(dateKey)
}

interface HeatmapCellProps {
  dateKey: string
  x: number
  y: number
  cellSize: number
  color: string
  dimmed: boolean
  isPulsing: boolean
  hasEntered: boolean
  entranceDelay: number
  bucket: DayBucket | undefined
}

const HeatmapCell = React.memo(function HeatmapCell({
  dateKey,
  x,
  y,
  cellSize,
  color,
  dimmed,
  isPulsing,
  hasEntered,
  entranceDelay,
  bucket,
}: HeatmapCellProps) {
  const hasActivity = Boolean(bucket && bucket.total > 0)
  const interactiveBucket =
    bucket && bucket.total > 0 && !dimmed ? bucket : null
  const isInteractive = interactiveBucket !== null
  const overlayOpacity = dimmed ? 0.2 : 1
  const overlayScale = dimmed ? 0.86 : 1
  const ariaLabel = isInteractive
    ? `${formatDate(dateKey)}: ${interactiveBucket.total} commit${interactiveBucket.total !== 1 ? 's' : ''}${interactiveBucket.flagged > 0 ? `, ${interactiveBucket.flagged} flagged` : ''}`
    : undefined
  const baseRect = (
    <rect
      x={x}
      y={y}
      width={cellSize}
      height={cellSize}
      rx={2.5}
      fill="var(--heatmap-empty)"
    />
  )
  const overlayRect = hasActivity ? (
    <motion.rect
      x={x}
      y={y}
      width={cellSize}
      height={cellSize}
      rx={2.5}
      initial={{ opacity: 0, scale: 0.72, fill: color }}
      animate={{
        opacity: overlayOpacity,
        scale: overlayScale,
        fill: color,
      }}
      transition={{
        opacity: {
          duration: hasEntered ? 0.22 : 0.42,
          ease: PREMIUM_EASE,
          delay: hasEntered ? 0 : entranceDelay,
        },
        scale: hasEntered
          ? {
              duration: 0.28,
              ease: PREMIUM_EASE,
            }
          : {
              type: 'spring',
              stiffness: 220,
              damping: 22,
              mass: 0.85,
              delay: entranceDelay,
            },
        fill: {
          duration: 0.36,
          ease: PREMIUM_EASE,
        },
      }}
      whileHover={isInteractive ? { scale: 1.08, opacity: 1 } : undefined}
      whileFocus={isInteractive ? { scale: 1.08, opacity: 1 } : undefined}
      style={{
        transformOrigin: `${x + cellSize / 2}px ${y + cellSize / 2}px`,
        willChange: 'transform, opacity, fill',
      }}
      className={[
        dimmed ? '' : 'hover:brightness-125',
        isPulsing ? 'heatmap-cell-pulse' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...(isInteractive
        ? {
            tabIndex: 0,
            role: 'button',
            'aria-label': ariaLabel,
          }
        : {})}
    />
  ) : null

  if (!overlayRect) {
    return <g>{baseRect}</g>
  }

  if (!interactiveBucket) {
    return (
      <g>
        {baseRect}
        {overlayRect}
      </g>
    )
  }

  const cleanShare =
    ((interactiveBucket.total - interactiveBucket.flagged) /
      interactiveBucket.total) *
    100
  const flaggedShare =
    (interactiveBucket.flagged / interactiveBucket.total) * 100
  const vibeLabel =
    interactiveBucket.flagged === 0
      ? 'nothing worth subpoenaing'
      : flaggedShare <= 50
        ? 'light prompt residue'
        : flaggedShare <= 80
          ? 'human presence not independently verified'
          : 'operator appears to have left the building'

  return (
    <Tooltip>
      <TooltipTrigger asChild>{overlayRect}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        <div className="font-mono text-[11px] leading-relaxed">
          <span className="opacity-70">{formatDate(dateKey)}</span>
          <div className="flex items-center gap-1.5 mt-1.5 mb-1">
            <div className="flex h-1 flex-1 rounded-full overflow-hidden bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${cleanShare}%`,
                  backgroundColor: 'var(--slop-green)',
                }}
              />
              {interactiveBucket.flagged > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${flaggedShare}%`,
                    backgroundColor: 'var(--slop-red)',
                  }}
                />
              )}
            </div>
            <span className="text-[10px] tabular-nums opacity-60">
              {interactiveBucket.flagged}/{interactiveBucket.total}
            </span>
          </div>
          <span className="text-[10px] opacity-50">{vibeLabel}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
})

function AnimatedStats({
  activeDays,
  flaggedPct,
}: {
  activeDays: number
  flaggedPct: number | null
}) {
  const displayDays = useAnimatedNumber(activeDays)
  const displayPct = useAnimatedNumber(flaggedPct ?? 0)

  return (
    <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums">
      {displayDays} active day{activeDays !== 1 ? 's' : ''}
      {flaggedPct !== null && (
        <>
          {' '}
          · {displayPct}% flagged
        </>
      )}
    </span>
  )
}

export default function SlopHeatmap({
  commits,
  windowDays,
}: {
  commits: AnalyzedCommit[]
  windowDays: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [filter, setFilter] = useState<FilterRange>('6m')

  // Animated filter days — steps incrementally to create the column wave
  const [visibleFilterDays, setVisibleFilterDays] = useState(
    Math.min(FILTER_DAYS['6m'], windowDays),
  )
  const waveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveTargetRef = useRef(Math.min(FILTER_DAYS['6m'], windowDays))

  // Track whether entrance animation has finished
  const [hasEntered, setHasEntered] = useState(false)

  // Track previous bucket levels to detect changes from progressive data
  const prevLevelsRef = useRef<Map<string, number>>(new Map())
  const [pulsing, setPulsing] = useState<Set<string>>(new Set())
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasSnapshotRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(
    () => () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current)
    },
    [],
  )

  const bucketMap = useMemo(() => {
    const map = new Map<string, DayBucket>()
    for (const c of commits) {
      const key = toDateKey(new Date(c.occurred_at))
      const existing = map.get(key) ?? { total: 0, flagged: 0 }
      existing.total++
      if (c.flags.length > 0) existing.flagged++
      map.set(key, existing)
    }
    return map
  }, [commits])

  // Detect changed cells for pulse animation on progressive data arrival
  useEffect(() => {
    if (!hasSnapshotRef.current) {
      // First data — snapshot levels without pulsing
      const levels = new Map<string, number>()
      for (const [key, bucket] of bucketMap) {
        levels.set(key, slopLevel(bucket))
      }
      prevLevelsRef.current = levels
      hasSnapshotRef.current = true
      return
    }

    const newPulsing = new Set<string>()
    for (const [key, bucket] of bucketMap) {
      const currentLevel = slopLevel(bucket)
      const prevLevel = prevLevelsRef.current.get(key) ?? 0
      if (currentLevel !== prevLevel) {
        newPulsing.add(key)
      }
    }

    // Update prev levels
    const nextLevels = new Map<string, number>()
    for (const [key, bucket] of bucketMap) {
      nextLevels.set(key, slopLevel(bucket))
    }
    prevLevelsRef.current = nextLevels

    if (newPulsing.size > 0) {
      setPulsing(newPulsing)
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = setTimeout(() => setPulsing(new Set()), 720)
    }
  }, [bucketMap])

  const { weeks, monthLabels } = useMemo(
    () => buildHeatmapGrid(windowDays),
    [windowDays],
  )

  const filterDays = Math.min(FILTER_DAYS[filter], windowDays)

  const dateTimes = useMemo(() => {
    const map = new Map<string, number>()
    for (const week of weeks) {
      for (const dateKey of week) {
        if (dateKey) map.set(dateKey, dateKeyToTime(dateKey))
      }
    }
    return map
  }, [weeks])

  // inRangeKeys uses the final filter (for stats/insight line)
  const inRangeKeys = useMemo(
    () => buildInRangeKeys(dateTimes, filterDays, windowDays),
    [dateTimes, filterDays, windowDays],
  )

  // visibleInRangeKeys uses the animated filter (for cell dimming)
  const visibleInRangeKeys = useMemo(
    () =>
      buildInRangeKeys(
        dateTimes,
        Math.min(visibleFilterDays, windowDays),
        windowDays,
      ),
    [dateTimes, visibleFilterDays, windowDays],
  )

  // Entrance animation flag — set after initial stagger completes
  useEffect(() => {
    const timer = setTimeout(
      () => setHasEntered(true),
      weeks.length * ENTRANCE_STAGGER * 1000 + 600,
    )
    return () => clearTimeout(timer)
  }, [weeks.length])

  const handleFilterChange = useCallback(
    (nextFilter: FilterRange) => {
      if (nextFilter === filter) return

      if (waveIntervalRef.current) clearInterval(waveIntervalRef.current)

      const targetDays = Math.min(FILTER_DAYS[nextFilter], windowDays)
      setFilter(nextFilter)
      waveTargetRef.current = targetDays

      waveIntervalRef.current = setInterval(() => {
        setVisibleFilterDays((prev) => {
          const target = waveTargetRef.current
          if (prev === target) {
            clearInterval(waveIntervalRef.current!)
            return prev
          }
          const step = target > prev ? 7 : -7
          const next = prev + step
          if ((step > 0 && next >= target) || (step < 0 && next <= target)) {
            clearInterval(waveIntervalRef.current!)
            return target
          }
          return next
        })
      }, WAVE_STEP_MS)
    },
    [filter, windowDays],
  )

  // Count active days and flagged days in the current filter range
  const { activeDaysInRange, flaggedDaysInRange } = useMemo(() => {
    let active = 0
    let flagged = 0
    for (const [key, bucket] of bucketMap) {
      if (isDateKeyInRange(key, inRangeKeys)) {
        active++
        if (bucket.flagged > 0) flagged++
      }
    }
    return { activeDaysInRange: active, flaggedDaysInRange: flagged }
  }, [bucketMap, inRangeKeys])

  // Compute snarky insight line
  const insightLine = useMemo(() => {
    const daysInRange: { key: string; flagged: number }[] = []
    const monthFlagged = new Map<number, number>()

    for (const [key, bucket] of bucketMap) {
      if (!isDateKeyInRange(key, inRangeKeys)) continue
      daysInRange.push({ key, flagged: bucket.flagged })
      const month = Number(key.slice(5, 7)) - 1
      monthFlagged.set(month, (monthFlagged.get(month) ?? 0) + bucket.flagged)
    }

    daysInRange.sort((a, b) => a.key.localeCompare(b.key))
    let longestSlopStreak = 0
    let currentStreak = 0
    let prevTime: number | null = null
    for (const { key, flagged } of daysInRange) {
      const time = dateTimes.get(key) ?? dateKeyToTime(key)
      if (flagged > 0) {
        if (prevTime !== null && time - prevTime === 86400000) {
          currentStreak++
        } else {
          currentStreak = 1
        }
        longestSlopStreak = Math.max(longestSlopStreak, currentStreak)
        prevTime = time
      } else {
        currentStreak = 0
        prevTime = null
      }
    }

    const slopPercentInRange =
      activeDaysInRange > 0
        ? Math.round((flaggedDaysInRange / activeDaysInRange) * 100)
        : 0

    let hottestMonth = ''
    let hottestCount = 0
    for (const [month, count] of monthFlagged) {
      if (count > hottestCount) {
        hottestCount = count
        hottestMonth = MONTH_NAMES[month]
      }
    }

    if (longestSlopStreak >= 5) {
      return `${longestSlopStreak}-day slop streak. couldn't even take a break from the machine.`
    }
    if (slopPercentInRange >= 70) {
      return `${hottestMonth.toLowerCase()} was ${slopPercentInRange}% machine-assisted. we have the receipts.`
    }
    if (slopPercentInRange === 0 && activeDaysInRange > 0) {
      return "zero flags on the board. either you're legit or you're good at hiding."
    }
    if (slopPercentInRange > 0 && slopPercentInRange < 30) {
      return 'mostly human. but we see those outliers.'
    }
    if (hottestMonth && hottestCount > 0) {
      return `${hottestMonth.toLowerCase()} raised some flags. just saying.`
    }
    return null
  }, [bucketMap, dateTimes, inRangeKeys, activeDaysInRange, flaggedDaysInRange])

  // Cell size to fill container
  const cellSize = useMemo(() => {
    if (!containerWidth || weeks.length === 0) return 12
    const available = containerWidth - LEFT_PAD
    return Math.max(6, available / weeks.length - GAP)
  }, [containerWidth, weeks.length])

  const svgWidth = containerWidth || LEFT_PAD + weeks.length * (cellSize + GAP)
  const svgHeight = TOP_PAD + 7 * (cellSize + GAP) + 4

  if (commits.length === 0) return null

  return (
    <section className="rounded-xl border border-border border-t-2 border-t-primary/15 bg-card p-4 sm:p-6 animate-rise animate-delay-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-xs text-muted-foreground tracking-wide">
          slop calendar
        </h3>
        <div className="flex items-center gap-1">
          {(Object.keys(FILTER_DAYS) as FilterRange[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleFilterChange(key)}
              className={`
                font-mono text-[10px] px-2 py-0.5 rounded-md transition-all duration-200 active:scale-[0.96]
                ${
                  filter === key
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
                }
              `}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* Insight line with crossfade — fixed height to prevent layout shift */}
      <div className="relative h-5 mb-3 overflow-hidden">
        <AnimatePresence initial={false}>
          {insightLine && (
            <motion.p
              key={insightLine}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: PREMIUM_EASE }}
              className="absolute inset-x-0 font-mono text-[11px] text-muted-foreground/70"
            >
              {insightLine}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Heatmap — always full grid, filter dims out-of-range cells */}
      <div ref={containerRef} className="w-full overflow-x-auto min-h-[140px]">
        {containerWidth > 0 && (
          <TooltipProvider>
            <svg
              width={svgWidth}
              height={svgHeight}
              className="block select-none"
              style={{ minWidth: svgWidth }}
            >
              <title>Slop activity heatmap</title>

              {/* Day-of-week labels */}
              {DAY_LABELS.map((label, i) => (
                <text
                  key={label}
                  x={LEFT_PAD - 6}
                  y={
                    TOP_PAD +
                    DAY_LABEL_ROWS[i] * (cellSize + GAP) +
                    cellSize / 2
                  }
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-muted-foreground"
                  style={{ fontSize: 9, fontFamily: 'var(--font-mono-stack)' }}
                >
                  {label}
                </text>
              ))}

              {/* Month labels */}
              {monthLabels.map(({ week, label }) => (
                <text
                  key={`${week}-${label}`}
                  x={LEFT_PAD + week * (cellSize + GAP)}
                  y={10}
                  textAnchor="start"
                  className="fill-muted-foreground"
                  style={{ fontSize: 9, fontFamily: 'var(--font-mono-stack)' }}
                >
                  {label}
                </text>
              ))}

              {/* Grid cells */}
              {weeks.map((week, wIdx) =>
                week.map((dateKey, dIdx) => {
                  if (!dateKey) return null

                  const bucket = bucketMap.get(dateKey)
                  const level = slopLevel(bucket)
                  const x = LEFT_PAD + wIdx * (cellSize + GAP)
                  const y = TOP_PAD + dIdx * (cellSize + GAP)
                  const color = LEVEL_COLORS[level]
                  const dimmed = !isDateKeyInRange(
                    dateKey,
                    visibleInRangeKeys,
                  )

                  return (
                    <HeatmapCell
                      key={dateKey}
                      dateKey={dateKey}
                      x={x}
                      y={y}
                      cellSize={cellSize}
                      color={color}
                      dimmed={dimmed}
                      isPulsing={pulsing.has(dateKey)}
                      hasEntered={hasEntered}
                      entranceDelay={wIdx * ENTRANCE_STAGGER}
                      bucket={bucket}
                    />
                  )
                }),
              )}
            </svg>
          </TooltipProvider>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span>clean</span>
          <div className="flex items-center gap-1.5">
            {LEVEL_COLORS.slice(1).map((color) => (
              <span
                key={color}
                className="inline-block rounded-[2px]"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: color,
                }}
              />
            ))}
          </div>
          <span>pure slop</span>
        </div>
        <AnimatedStats
          activeDays={activeDaysInRange}
          flaggedPct={
            flaggedDaysInRange > 0 && activeDaysInRange > 0
              ? Math.round((flaggedDaysInRange / activeDaysInRange) * 100)
              : null
          }
        />
      </div>
    </section>
  )
}
