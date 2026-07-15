/**
 * Stepped value control: ticks, −/+, number input.
 * Commits on pointer release / +/- / Enter — avoids layout thrash while dragging.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  onCommit: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  className?: string
}

export default function SteppedSlider({
  value,
  onCommit,
  min = 50,
  max = 200,
  step = 10,
  suffix = '',
  className,
}: Props) {
  const [draft, setDraft] = useState(value)
  const draftRef = useRef(value)
  const dragging = useRef(false)
  const trackId = useId()

  useEffect(() => {
    if (!dragging.current) {
      setDraft(value)
      draftRef.current = value
    }
  }, [value])

  const ticks: number[] = []
  for (let n = min; n <= max; n += step) ticks.push(n)

  function clamp(n: number): number {
    if (!Number.isFinite(n)) return min
    const snapped = Math.round(n / step) * step
    return Math.max(min, Math.min(max, snapped))
  }

  function commit(n: number) {
    const next = clamp(n)
    draftRef.current = next
    setDraft(next)
    onCommit(next)
  }

  function bump(delta: number) {
    commit(draftRef.current + delta)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Decrease"
        onClick={() => bump(-step)}
        disabled={draft <= min}
        className="shrink-0"
      >
        <Minus size={14} />
      </Button>

      <div className="relative flex-1 min-w-[8rem] pt-1 pb-3">
        <div className="absolute left-1 right-1 top-0 h-2 pointer-events-none flex justify-between px-0.5" aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className={cn(
                'w-px bg-[var(--fg-text-tertiary)]',
                t === min || t === max ? 'h-2 opacity-70' : 'h-1.5 opacity-40',
              )}
            />
          ))}
        </div>
        <input
          id={trackId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={draft}
          onPointerDown={() => { dragging.current = true }}
          onPointerUp={(e) => {
            dragging.current = false
            commit(Number((e.target as HTMLInputElement).value))
          }}
          onPointerCancel={(e) => {
            dragging.current = false
            commit(Number((e.target as HTMLInputElement).value))
          }}
          onChange={(e) => {
            const v = clamp(Number(e.target.value))
            draftRef.current = v
            setDraft(v)
          }}
          className="relative w-full h-1.5 mt-1 rounded-full appearance-none bg-[var(--fg-input-border)] cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--fg-accent)]
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--fg-card)]
            [&::-webkit-slider-thumb]:shadow-sm"
        />
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Increase"
        onClick={() => bump(step)}
        disabled={draft >= max}
        className="shrink-0"
      >
        <Plus size={14} />
      </Button>

      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => {
          const raw = Number(e.target.value)
          draftRef.current = raw
          setDraft(raw)
        }}
        onBlur={() => commit(draftRef.current)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        className="w-14 px-1.5 py-1 text-xs text-center border border-[var(--fg-input-border)] rounded bg-[var(--fg-input-bg)] text-[var(--fg-input-text)]"
      />
      {suffix && <span className="text-xs text-[var(--fg-text-tertiary)] min-w-[1.75rem]">{suffix}</span>}
    </div>
  )
}
