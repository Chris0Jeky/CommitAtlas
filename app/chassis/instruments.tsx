import type { CSSProperties, ReactNode } from "react";
import type { CiState } from "@commit-atlas/core";
import { CI_STATE_PRESENTATION } from "@/lib/health";
import { Ev } from "./evidence-ui";
import {
  densityGrid,
  densityLevelOpacity,
  gaugeReading,
  isEmptyDensityCell,
  momentumTrace,
  quarterMeter,
  reticle,
  type DensityCell,
} from "@/lib/instruments";

/**
 * The instrument fascia.
 *
 * Two rules govern every component in this file.
 *
 * **The number is printed.** Each instrument sits above a text reading, so the SVG is never the
 * only way to learn the value. That is what makes the motion safe to remove entirely under
 * `prefers-reduced-motion` without leaving a hole in the page.
 *
 * **Frame zero is complete.** Traces are pre-drawn beneath the animated stroke at low opacity, the
 * needle's inline transform *is* its settled angle, and the density cells carry their truthful
 * opacity inline. One-shot reveal keyframes begin from a transient state; looping effects only add
 * emphasis. Removing every animation therefore leaves the complete, accurate instrument.
 */

/**
 * The value/caption line every bay ends with.
 *
 * `evidenceId` is what turns the reading into a question. The four fascia readings are the most
 * prominent numbers on the site, so they are the ones that most need to be able to say where they
 * came from — a headline number with no drawer behind it is exactly the unexplained assertion this
 * layer exists to prevent.
 */
function BayRead({
  value,
  caption,
  evidenceId,
  meter,
}: {
  value: ReactNode;
  caption: ReactNode;
  evidenceId: string;
  /** Optional four-square shape encoding of the same reading. Redundant, and deliberately so. */
  meter?: number;
}) {
  return (
    <div className="bay-read">
      <span className="bay-value"><Ev id={evidenceId}>{value}</Ev></span>
      <span className="bay-caption">
        {meter === undefined ? null : (
          // The number beside it is the accessible reading; this is a visual aid for a reader who
          // cannot separate the arc from its track, so it is not announced twice.
          <>
            <span className="index-squares" aria-hidden="true">
              {"■ ".repeat(meter).trim()}{meter > 0 && meter < 4 ? " " : ""}{"□ ".repeat(4 - meter).trim()}
            </span>
            <br />
          </>
        )}
        {caption}
      </span>
    </div>
  );
}

export function MomentumPlotter({
  counts,
  total,
  change,
  label,
}: {
  counts: readonly number[];
  total: number;
  change: ReactNode;
  label: string;
}) {
  const trace = momentumTrace(counts);
  const penPath = { "--pen-path": `path("${trace.path}")` } as CSSProperties;

  return (
    <>
      <div className="bay-instrument">
        <svg viewBox={trace.viewBox} role="img" aria-label={label} preserveAspectRatio="none">
          {/* Pre-drawn at 22%: the plot is legible before, during, and without the animation. */}
          <path className="m1-ghost" d={trace.path} fill="none" stroke="var(--warm-line)" strokeOpacity="0.22" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <path
            className="m1-bloom"
            d={trace.path}
            pathLength={100}
            style={{ strokeDasharray: 100, strokeDashoffset: 0 }}
            fill="none"
            stroke="var(--warm-line)"
            strokeOpacity="0.2"
            strokeWidth="8"
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="m1-pen"
            d={trace.path}
            pathLength={100}
            style={{ strokeDasharray: 100, strokeDashoffset: 0 }}
            fill="none"
            stroke="var(--warm-line)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {trace.flat ? null : (
            <>
              <circle className="m1-dot m1-dot-halo" r="8" fill="var(--chrome)" fillOpacity="0.13" style={penPath} />
              <circle className="m1-dot m1-dot-core" r="3.5" fill="var(--chrome)" style={penPath} />
            </>
          )}
        </svg>
      </div>
      <BayRead value={total} caption={<>{change} vs prior 28d</>} evidenceId="momentum" />
    </>
  );
}

export function RhythmGauge({ score, caption }: { score: number; caption: ReactNode }) {
  const gauge = gaugeReading(score);
  const needle = { transformOrigin: "110px 110px", "--needle": `${gauge.angle}deg` } as CSSProperties;

  return (
    <>
      <div className="bay-instrument">
        <svg viewBox={gauge.viewBox} aria-hidden="true" focusable="false">
          <path d={gauge.arc} fill="none" stroke="color-mix(in srgb, var(--ink) 14%, transparent)" strokeWidth="3" />
          <path
            className="m2-charge"
            d={gauge.arc}
            pathLength={100}
            strokeDasharray={gauge.dash}
            fill="none"
            stroke="var(--chrome)"
            strokeOpacity="0.85"
            strokeWidth="3"
          />
          <g stroke="color-mix(in srgb, var(--ink) 30%, transparent)" strokeWidth="1.5">
            {gauge.ticks.map((tick, index) => (
              <line
                key={`${tick.x1},${tick.y1}`}
                className="m2-tick"
                style={{ "--tick-delay": `${180 + index * 70}ms` } as CSSProperties}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
              />
            ))}
          </g>
          <g fill="var(--muted)" fontFamily="var(--font-geist-mono), monospace" fontSize="9">
            <text x="14" y="120">0</text>
            <text x="104" y="16">50</text>
            <text x="184" y="120">100</text>
          </g>
          <g className="m2-needle" style={needle}>
            <line x1={gauge.centre.x} y1={gauge.centre.y} x2={gauge.centre.x} y2="34" stroke="var(--ink)" strokeWidth="2" />
          </g>
          <circle cx={gauge.centre.x} cy={gauge.centre.y} r="5" fill="var(--ground)" stroke="var(--ink)" strokeWidth="1.5" />
        </svg>
      </div>
      <BayRead value={<>{score}<small>/100</small></>} caption={caption} evidenceId="rhythm" meter={quarterMeter(score)} />
    </>
  );
}

export function DensitySurvey({
  days,
  density,
  caption,
  label,
}: {
  days: readonly { date: string; count: number; level?: number }[];
  density: number;
  caption: ReactNode;
  label: string;
}) {
  const grid = densityGrid(days);
  const columns: DensityCell[][] = [];
  for (const cell of grid.cells) (columns[cell.column] ??= []).push(cell);

  return (
    <>
      <div className="bay-instrument">
        <svg viewBox={grid.viewBox} role="img" aria-label={label} preserveAspectRatio="xMinYMid meet">
          {grid.columns > 1 ? (
            <rect
              className="m3-scan"
              x={4}
              y={0}
              width={1}
              height={34}
              fill="var(--chrome)"
              opacity={0}
              style={{
                "--density-travel": `${(grid.columns - 1) * 5}px`,
                "--density-steps": grid.columns - 1,
              } as CSSProperties}
            />
          ) : null}
          <g fill="var(--warm-line)">
            {columns.map((column, index) => (
              // Staggered by week column, so the fill sweeps in date order rather than at random.
              // Each cell keeps its own final opacity, and `cellIn` declares only `from`.
              <g
                key={column[0]?.date ?? index}
                className="m3-column"
                style={{
                  "--column-delay": `${index * 14}ms`,
                } as CSSProperties}
              >
                {column.map((cell) => isEmptyDensityCell(cell.level, cell.count) ? (
                  <rect key={cell.date} x={cell.x} y={cell.y} width={grid.cell} height={grid.cell} fill="var(--socket)" />
                ) : (
                  <rect
                    key={cell.date}
                    x={cell.x}
                    y={cell.y}
                    width={grid.cell}
                    height={grid.cell}
                    opacity={densityLevelOpacity(cell.level)}
                  />
                ))}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <BayRead value={`${density}%`} caption={caption} evidenceId="density" />
    </>
  );
}

/**
 * The portfolio reticle: one lamp per declared project, on a ring that keeps breathing.
 *
 * An instrument that vanishes when it has nothing to report teaches a reader that no news means no
 * instrument. This one stays lit with empty sockets, which says the true thing instead: nothing was
 * declared, so nothing is claimed.
 */
export function PortfolioReticle({
  states,
  passing,
  caption,
}: {
  states: readonly CiState[];
  passing: number;
  caption: ReactNode;
}) {
  const ring = reticle(states.length);
  const iris = { transformOrigin: `${ring.centre.x}px ${ring.centre.y}px` } as CSSProperties;

  return (
    <>
      <div className="bay-instrument">
        <svg viewBox={ring.viewBox} aria-hidden="true" focusable="false">
          <g className="m4-iris" style={iris} fill="none" stroke="color-mix(in srgb, var(--ink) 18%, transparent)">
            {ring.rings.map((radius, index) => (
              <circle
                key={radius}
                cx={ring.centre.x}
                cy={ring.centre.y}
                r={radius}
                strokeDasharray={index === 0 ? "3 4" : undefined}
              />
            ))}
            <line x1={ring.centre.x - ring.radius - 8} y1={ring.centre.y} x2={ring.centre.x - ring.radius + 4} y2={ring.centre.y} />
            <line x1={ring.centre.x + ring.radius - 4} y1={ring.centre.y} x2={ring.centre.x + ring.radius + 8} y2={ring.centre.y} />
            <line x1={ring.centre.x} y1={ring.centre.y - ring.radius - 8} x2={ring.centre.x} y2={ring.centre.y - ring.radius + 4} />
            <line x1={ring.centre.x} y1={ring.centre.y + ring.radius - 4} x2={ring.centre.x} y2={ring.centre.y + ring.radius + 8} />
          </g>
          {ring.lamps.map((lamp) => (
            <LampGlyph key={lamp.index} state={states[lamp.index]!} cx={lamp.x} cy={lamp.y} />
          ))}
          {states.length === 0 ? (
            <text
              x={ring.centre.x}
              y={ring.centre.y + 4}
              textAnchor="middle"
              fill="color-mix(in srgb, var(--ink) 60%, transparent)"
              fontFamily="var(--font-geist-mono), monospace"
              fontSize="9"
              letterSpacing="1.5"
            >
              NO PROBE FITTED
            </text>
          ) : null}
        </svg>
      </div>
      <BayRead value={<>{passing}<small>/{states.length}</small></>} caption={caption} evidenceId="ci-passing" />
    </>
  );
}

/**
 * One CI state as a shape, at reticle scale.
 *
 * Shape carries the state before colour does, so the reticle is still readable in greyscale and the
 * two "nothing was observed" states are drawn in ink rather than tinted with a status colour they
 * have not earned.
 */
function LampGlyph({ state, cx, cy }: { state: CiState; cx: number; cy: number }) {
  const presentation = CI_STATE_PRESENTATION[state];
  const stroke = presentation.cssVar;

  switch (presentation.lamp) {
    case "disc":
      return <circle cx={cx} cy={cy} r="5" fill={stroke} />;
    case "diamond":
      return <rect x={cx - 4.5} y={cy - 4.5} width="9" height="9" fill={stroke} transform={`rotate(45 ${cx} ${cy})`} />;
    case "half-disc":
      return (
        <g className="m5-pulse">
          <circle cx={cx} cy={cy} r="5" fill="none" stroke={stroke} strokeWidth="1.5" />
          <path d={`M${cx},${cy - 5} A5,5 0 0 1 ${cx},${cy + 5} Z`} fill={stroke} />
        </g>
      );
    case "frozen-clock":
      return (
        <g fill="none" stroke={stroke} strokeWidth="1.5">
          <circle cx={cx} cy={cy} r="5.5" strokeDasharray="3 2.5" />
          <line x1={cx} y1={cy} x2={cx} y2={cy - 3.5} />
        </g>
      );
    case "socket":
      return <rect x={cx - 5} y={cy - 5} width="10" height="10" fill="none" stroke={stroke} strokeWidth="1.5" strokeDasharray="3 2.5" />;
    case "plate":
    default:
      return <rect x={cx - 6} y={cy - 1.5} width="12" height="3" fill="color-mix(in srgb, var(--ink) 35%, transparent)" />;
  }
}

/** The rack's lamp, at bay scale. Pure presentation; the state word is printed beside it. */
export function RackLamp({ state }: { state: CiState }) {
  const presentation = CI_STATE_PRESENTATION[state];
  switch (presentation.lamp) {
    case "plate":
      return <span className="lamp-plate">NO SIGNAL</span>;
    case "socket":
      return <span className="lamp-socket" />;
    case "frozen-clock":
      return (
        <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">
          <circle cx="20" cy="20" r="16" fill="none" stroke="var(--stale-ink)" strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="20" y1="20" x2="20" y2="9" stroke="var(--stale-ink)" strokeWidth="1.5" />
          <line x1="20" y1="20" x2="29" y2="24" stroke="var(--stale-ink)" strokeWidth="1.5" />
        </svg>
      );
    case "disc":
      return <span className="lamp-disc" />;
    case "diamond":
      return <span className="lamp-diamond" />;
    case "half-disc":
    default:
      return <span className="lamp-half m5-pulse" />;
  }
}

/** The rack's trace. Every state's stroke pattern differs, so the row reads in greyscale. */
export function RackTrace({ state }: { state: CiState }) {
  const { trace, cssVar: stroke } = CI_STATE_PRESENTATION[state];
  return (
    <svg className="rack-trace" viewBox="0 0 160 18" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {trace.path === null ? (
        <line x1="0" y1="9" x2="160" y2="9" stroke={stroke} strokeOpacity={trace.opacity ?? 1} strokeWidth="1.5" strokeDasharray={trace.dash} />
      ) : (
        <path d={trace.path} fill="none" stroke={stroke} strokeOpacity={trace.opacity ?? 1} strokeWidth="1.5" strokeDasharray={trace.dash} />
      )}
      {trace.tail ? (
        <path d={trace.tail.path} fill="none" stroke={stroke} strokeOpacity={trace.tail.opacity} strokeWidth="1.5" strokeDasharray={trace.tail.dash} />
      ) : null}
    </svg>
  );
}

/**
 * M7 — how a gauge fails honestly.
 *
 * The needle hunts for a reading, stutters, and falls back to its rest stop; the lamp never lights.
 * The plate reads NO SIGNAL from frame zero, so the motion is theatre about a fact already stated
 * rather than the only way to learn it.
 */
export function AcquisitionGauge() {
  const gauge = gaugeReading(0);
  return (
    <svg
      viewBox={gauge.viewBox}
      width="190"
      height="105"
      role="img"
      aria-label="A gauge failing to acquire a signal: the needle hunts, falls back to rest, and the lamp never lights."
    >
      <path d={gauge.arc} fill="none" stroke="color-mix(in srgb, var(--ink) 14%, transparent)" strokeWidth="3" />
      <g stroke="color-mix(in srgb, var(--ink) 30%, transparent)" strokeWidth="1.5">
        <line x1="24" y1="110" x2="32" y2="110" />
        <line x1="110" y1="24" x2="110" y2="32" />
        <line x1="196" y1="110" x2="188" y2="110" />
      </g>
      <g className="m7-needle" style={{ transformOrigin: "110px 110px" }}>
        <line x1="110" y1="110" x2="110" y2="34" stroke="var(--ink)" strokeOpacity="0.8" strokeWidth="2" />
      </g>
      <circle cx="110" cy="110" r="5" fill="var(--ground)" stroke="var(--ink)" strokeWidth="1.5" />
      <text
        x="138"
        y="116"
        fill="color-mix(in srgb, var(--ink) 60%, transparent)"
        fontFamily="var(--font-geist-mono), monospace"
        fontSize="9"
        letterSpacing="1.5"
      >
        NO SIGNAL
      </text>
    </svg>
  );
}
