import { escapeXml, themes } from '../index.js';
import { compileSceneMotion, sceneClassName, sceneElementId, sceneLensDescription, sceneUnavailable } from '../scene.js';
import type { RenderContext, SceneDefinition, SceneInputs, SceneLensProjection, SceneUnavailable } from '../scene.js';
import type { MotionApplication } from '../motion/types.js';
import { frame } from '../primitives/index.js';
import { DNA_AXES } from '../primitives/geometric.js';

const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
const SANS = "ui-sans-serif,system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
type AxisKey = typeof DNA_AXES[number];
interface Axis { readonly key: AxisKey; readonly value: number }
interface SignatureModel {
  readonly axes: readonly Axis[];
  readonly strongest: readonly Axis[];
  readonly archetype: SceneLensProjection['archetype'];
  readonly rangeLabel: string;
  readonly generatedAt: string;
  readonly lens: Pick<SceneLensProjection, 'coverage' | 'privacyNote' | 'freshness'>;
}
interface TextBlock { readonly svg: string; readonly bottom: number }
const labels: Readonly<Record<AxisKey, string>> = {
  focus: 'Focus', shipping: 'Shipping', collaboration: 'Collaboration',
  consistency: 'Consistency', breadth: 'Breadth', stewardship: 'Stewardship',
};
const n = (value: number) => String(Number(value.toFixed(3)));

function buildSignature({ lens }: SceneInputs): SignatureModel | SceneUnavailable {
  if (!lens || !('schemaVersion' in lens)) return sceneUnavailable('A complete validated synthetic Lens projection is unavailable.');
  const axes: Axis[] = [];
  for (const key of DNA_AXES) {
    const axis = lens.dna.find(entry => entry.key === key);
    if (!axis || !Number.isFinite(axis.value) || axis.value < 0 || axis.value > 1) return sceneUnavailable('The six supplied signature dimensions are unavailable.');
    axes.push({ key, value: axis.value });
  }
  return {
    axes,
    strongest: [...axes].sort((a, b) => b.value - a.value || DNA_AXES.indexOf(a.key) - DNA_AXES.indexOf(b.key)).slice(0, 2),
    archetype: lens.archetype, rangeLabel: lens.rangeLabel, generatedAt: lens.generatedAt,
    lens: { coverage: lens.coverage, privacyNote: lens.privacyNote, freshness: lens.freshness },
  };
}

function accessibility(model: SignatureModel): { title: string; description: string } {
  return {
    title: 'Developer signature',
    description: `DERIVED SIGNATURE · SYNTHETIC SHOWCASE · not a productivity score. ${model.rangeLabel}. ` +
      `${model.archetype.name}. ${model.archetype.description} ` +
      `Clockwise from the top, the six axes are ${model.axes.map(axis => `${axis.key} ${axis.value}`).join(', ')}. ` +
      `Strongest dimensions: ${model.strongest.map(axis => `${labels[axis.key]} ${axis.value}`).join(' and ')}; ties retain axis order. ` +
      'Radial distance and the six stationary bars use the supplied normalized values from 0 to 1. Numbered axes match the printed readings. The radar fill is decorative, not an overall score. ' +
      'The plotting highlight and rotating calibration marks are decorative; readings and the base outline stay visible. Historical projections stay still. ' +
      `The neutral coverage track shows the producer's derived score, not an observed-count fraction. ${model.lens.coverage.warnings.length} ${model.lens.coverage.warnings.length === 1 ? 'warning' : 'warnings'}. ` +
      `Projection generated ${model.generatedAt}. ${sceneLensDescription(model.lens)}`,
  };
}

/** Explicit text lengths bound font substitution; non-Latin characters keep a wider advance. */
function advance(character: string, size: number, sans: boolean): number {
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(character)) return size * 1.3;
  if (character.codePointAt(0)! > 0x024f) return size * 1.05;
  if (!sans) return size * 0.62;
  return size * (/\s/u.test(character) ? 0.33 : /[MW@]/u.test(character) ? 0.92 : /[A-Z]/u.test(character) ? 0.7 : /[il.,'!:;]/u.test(character) ? 0.32 : 0.6);
}
function textWidth(value: string, size: number, sans = false): number {
  return [...value].reduce((sum, character) => sum + advance(character, size, sans), 0);
}
/** Preserve every character, including the spaces at a soft break, for common-context equality. */
function lines(value: string, width: number, size: number, sans: boolean, wrapWords: boolean): string[] {
  const characters = [...value];
  const result: string[] = [];
  for (let start = 0; start < characters.length;) {
    let end = start, used = 0;
    while (end < characters.length && used + advance(characters[end]!, size, sans) <= width) {
      used += advance(characters[end]!, size, sans); end += 1;
    }
    if (end === start) throw new Error('signature text column is too narrow');
    if (wrapWords && end < characters.length) {
      for (let boundary = end - 1; boundary > start + (end - start) / 2; boundary -= 1) {
        if (characters[boundary] === ' ') { end = boundary + 1; break; }
      }
    }
    result.push(characters.slice(start, end).join('')); start = end;
  }
  return result;
}
function textBlock(value: string, x: number, y: number, width: number, ink: string, size = 11, lineHeight = 15, sans = false, wrapWords = true): TextBlock {
  const rows = lines(value, width, size, sans, wrapWords);
  return {
    svg: `<text fill="${ink}" font-family="${sans ? SANS : MONO}" font-size="${size}">${rows.map((row, index) =>
      `<tspan x="${x}" y="${y + index * lineHeight}" textLength="${n(textWidth(row, size, sans))}" lengthAdjust="spacingAndGlyphs">${escapeXml(row)}</tspan>`).join('')}</text>`,
    bottom: y + Math.max(0, rows.length - 1) * lineHeight,
  };
}
function point(cx: number, cy: number, radius: number, index: number): readonly [number, number] {
  const angle = -Math.PI / 2 + index * Math.PI / 3;
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
}
function polygon(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'}${n(x)} ${n(y)}`).join('') + 'Z';
}
function perimeter(points: readonly (readonly [number, number])[]): number {
  return points.reduce((sum, [x, y], index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + Math.hypot(next[0] - x, next[1] - y);
  }, 0);
}

/** Keep normal spacing unless complete admitted text requires the bounded dense composition. */
function signatureLayout(model: SignatureModel, context: RenderContext, dense = false) {
  const theme = themes[context.theme], compact = context.layout === 'compact';
  const width = compact ? 480 : 860;
  const range = textBlock(model.rangeLabel, 24, 118, width - 48, theme.muted, 11, 15, false, !dense);
  const introX = compact ? 24 : 478, introWidth = width - introX - 24;
  const introTop = range.bottom + 22;
  const nameSize = compact ? dense ? 22 : 26 : dense ? 26 : 28;
  const nameStride = compact ? dense ? 28 : 30 : dense ? 34 : 36;
  const name = textBlock(model.archetype.name, introX, introTop + 31, introWidth, theme.text, nameSize, nameStride, true, !dense);
  const explanation = textBlock(model.archetype.description, introX, name.bottom + 21, introWidth, theme.muted, 11, 15, false, !dense);
  const strengthsTop = explanation.bottom + 22;
  const strengths = textBlock(model.strongest.map(axis => `${labels[axis.key]} ${axis.value}`).join(' · '), introX, strengthsTop + 18, introWidth, theme.text, 11, 14);
  const chartTop = compact ? strengths.bottom + 24 : introTop;
  const chartHeight = compact ? dense ? 196 : 230 : 386;
  const cx = compact ? 140 : 238, cy = chartTop + chartHeight / 2;
  const radius = compact ? dense ? 72 : 89 : 142;
  const ledgerX = compact ? 276 : introX, ledgerWidth = width - ledgerX - 24;
  const ledgerTop = compact ? chartTop + 15 : strengths.bottom + 35;
  const ledgerBottom = ledgerTop + 5 * 35 + 25;
  const scaleBaseline = chartTop + chartHeight + (compact ? 28 : -4);
  const bodyBottom = Math.max(chartTop + chartHeight, ledgerBottom, scaleBaseline + 4);
  const coverageTop = bodyBottom + (dense ? 24 : 28);
  const common = textBlock(sceneLensDescription(model.lens), 24, coverageTop + (dense ? 60 : 66), width - 48, theme.muted, 10, 13, false, !dense);
  const height = Math.max(640, common.bottom + (dense ? 36 : 40));
  return { width, range, introX, introWidth, introTop, name, explanation, strengthsTop, strengths, cx, cy, radius,
    ledgerX, ledgerWidth, ledgerTop, scaleBaseline, coverageTop, common, height };
}

function renderSignature(model: SignatureModel, context: RenderContext): string {
  const theme = themes[context.theme];
  const historical = model.lens.freshness.status !== 'fresh';
  const signatureInk = historical ? theme.muted : theme.chrome;
  const regular = signatureLayout(model, context);
  // Dense output preserves the disclosure and reading sizes. Only the display title,
  // decorative radar, whitespace and long-word packing change; no supplied text is dropped.
  const { width, range, introX, introWidth, introTop, name, explanation, strengthsTop, strengths, cx, cy, radius,
    ledgerX, ledgerWidth, ledgerTop, scaleBaseline, coverageTop, common, height } = regular.height <= 1000 ? regular : signatureLayout(model, context, true);
  const a = accessibility(model);
  const points = model.axes.map((axis, index) => point(cx, cy, radius * axis.value, index));
  const outline = polygon(points), length = Math.max(1, perimeter(points));
  const applications: MotionApplication[] = historical ? [] : [
    { primitive: 'plot', target: 'outline-trace', decorative: true, loopGroup: 'signature-plot', params: { length, durationMs: 9_000 } },
    { primitive: 'rotate', target: 'calibration', decorative: true, loopGroup: 'signature-calibration', params: { cx, cy, durationMs: 20_000 } },
  ];
  const motion = compileSceneMotion(context, applications, { target: 'github-readme' });
  const wrap = (target: string, body: string) => `<g id="${sceneElementId(context, target)}" class="${sceneClassName(context, target)}" aria-hidden="true">${body}${motion.bindings.find(binding => binding.target === target)?.children ?? ''}</g>`;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(a.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(a.title)}</title><desc>${escapeXml(a.description)}</desc>${motion.style}`;
  out += frame(context, { title: a.title, ref: 'LENS / 01', family: 'signature', width, height });
  out += textBlock('SYNTHETIC SHOWCASE', 24, 99, width - 48, theme.text, 10).svg + range.svg;
  out += textBlock('ARCHETYPE · DERIVED', introX, introTop, introWidth, theme.muted, 10).svg + name.svg + explanation.svg;
  out += textBlock('STRONGEST DIMENSIONS', introX, strengthsTop, introWidth, theme.muted, 10).svg + strengths.svg;

  // Static radial geometry is the complete reading; only the independent overdraw is animated.
  out += `<g id="${sceneElementId(context, 'radar')}">`;
  for (const scale of [0.25, 0.5, 0.75, 1]) out += `<path d="${polygon(model.axes.map((_, index) => point(cx, cy, radius * scale, index)))}" fill="none" stroke="${theme.border}"/>`;
  model.axes.forEach((_, index) => {
    const [x, y] = point(cx, cy, radius, index);
    out += `<path d="M${cx} ${n(cy)}L${n(x)} ${n(y)}" fill="none" stroke="${theme.border}"/>`;
    const [labelX, labelY] = point(cx, cy, radius + 29, index);
    out += `<text x="${n(labelX)}" y="${n(labelY + 4)}" text-anchor="middle" fill="${theme.muted}" font-family="${MONO}" font-size="10">${index + 1}</text>`;
  });
  out += `<path d="${outline}" fill="${theme.density[0]}" fill-opacity="0.28" stroke="${signatureInk}" stroke-width="1.4"/>`;
  points.forEach(([x, y]) => { out += `<circle cx="${n(x)}" cy="${n(y)}" r="3" fill="${theme.background}" stroke="${signatureInk}" stroke-width="1.5"/>`; });
  out += '</g>';
  out += wrap('outline-trace', `<path d="${outline}" fill="none" stroke="${signatureInk}" stroke-width="2" stroke-dasharray="${n(length)} ${n(length)}"/>`);
  const ringRadius = radius + 15;
  let calibration = `<circle cx="${cx}" cy="${n(cy)}" r="${ringRadius}" fill="none" stroke="${theme.muted}" stroke-opacity="0.42" stroke-dasharray="3 11"/>`;
  for (const angle of [0.12, 1.8, 4.35]) {
    const x1 = cx + Math.cos(angle) * (ringRadius - 3), y1 = cy + Math.sin(angle) * (ringRadius - 3);
    const x2 = cx + Math.cos(angle) * (ringRadius + 5), y2 = cy + Math.sin(angle) * (ringRadius + 5);
    calibration += `<path d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}" stroke="${signatureInk}" stroke-width="2"/>`;
  }
  out += wrap('calibration', calibration);
  out += `<circle cx="${cx}" cy="${n(cy)}" r="2" fill="${theme.muted}"/>`;
  out += textBlock('SCALE 0–1', cx - textWidth('SCALE 0–1', 9) / 2, scaleBaseline, 110, theme.muted, 9).svg;
  model.axes.forEach((axis, index) => {
    const y = ledgerTop + index * 35;
    out += textBlock(`${index + 1}  ${labels[axis.key]}`, ledgerX, y, ledgerWidth, theme.muted, 10).svg;
    out += textBlock(String(axis.value), ledgerX, y + 15, ledgerWidth, theme.text, 12).svg;
    out += `<path d="M${ledgerX} ${y + 23}h${ledgerWidth}" stroke="${theme.border}" stroke-width="2"/>`;
    if (axis.value > 0) out += `<path d="M${ledgerX} ${y + 23}h${n(ledgerWidth * axis.value)}" stroke="${signatureInk}" stroke-width="2"/>`;
  });
  out += `<path d="M24 ${coverageTop - 12}H${width - 24}" stroke="${theme.border}"/>`;
  out += textBlock(`${historical ? 'LAST ' : ''}DERIVED COVERAGE`, 24, coverageTop + 6, width - 48, theme.muted, 10).svg;
  const warnings = model.lens.coverage.warnings.length;
  out += textBlock(`${model.lens.coverage.scorePercent}% · ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`, 24, coverageTop + 25, width - 48, theme.text, 14).svg;
  out += `<path d="M24 ${coverageTop + 39}H${width - 24}" stroke="${theme.border}" stroke-width="3"/>`;
  if (model.lens.coverage.scorePercent > 0) out += `<path d="M24 ${coverageTop + 39}h${n((width - 48) * model.lens.coverage.scorePercent / 100)}" stroke="${theme.muted}" stroke-width="3"/>`;
  out += `<g id="${sceneElementId(context, 'projection-context')}">${common.svg}</g>`;
  return `${out}</svg>`;
}

export const signatureScene: SceneDefinition<SignatureModel> = {
  id: 'signature', family: 'signature', budget: 'map',
  supportedPacks: ['survey'], supportedMotion: ['none', 'ambient'],
  buildModel: buildSignature, accessibility, render: renderSignature,
  renderUnavailable: (state, context, a) => {
    const width = context.layout === 'compact' ? 480 : 860, theme = themes[context.theme];
    const reason = textBlock(state.reason, 24, 145, width - 48, theme.muted, 12, 16);
    const height = Math.max(220, reason.bottom + 48);
    return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(a.title)}" viewBox="0 0 ${width} ${height}"><title>${escapeXml(a.title)}</title><desc>${escapeXml(a.description)}</desc>${frame(context, { title: 'Developer signature', ref: 'LENS / 01', family: 'signature', width, height })}${textBlock('SIGNATURE UNAVAILABLE', 24, 111, width - 48, theme.text, 13).svg}${reason.svg}</svg>`;
  },
};
