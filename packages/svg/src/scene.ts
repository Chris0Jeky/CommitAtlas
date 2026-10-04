import { evidenceCoverageScene } from "./scenes/evidence-coverage.js";
import type { PortfolioSnapshot } from "@commit-atlas/github";
import type { ThemeName } from "./index.js";
import { createIdentityConfig, isIdentityConfig, type IdentityConfig } from "./identity.js";
export type { IdentityConfig } from "./identity.js";
import { MotionPlan } from "./motion/compiler.js";
import { MOTION_BUDGETS } from "./motion/profile.js";
import type { MotionBackend, MotionBudgetClass, MotionProfile, MotionTarget } from "./motion/profile.js";
import type { CompiledMotionPlan, MotionApplication } from "./motion/types.js";
import { canonicalJson, stableHash } from "./seed.js";
import { parseSceneXml, sceneEscapeXml, sceneSafeText, sceneVisibleText, sceneXmlText, validateSceneSvg } from "./scene-svg.js";

export type ScenePack = "orbital" | "survey" | "spectral" | "terminal";
export type BudgetClass = MotionBudgetClass;
declare const lensBrand: unique symbol;
declare const findingBrand: unique symbol;
export interface PublicDemoCoverage {
  readonly complete: number; readonly partial: number; readonly unavailable: number; readonly total: number;
  readonly warnings: readonly string[];
}
/** Consumer-only synthetic common context; not a PublicLensProjection.v1 artifact reader. */
export interface PublicLensProjection {
  readonly [lensBrand]: true;
  readonly dataClass: "C0"; readonly scope: "public-demo";
  readonly coverage: PublicDemoCoverage; readonly privacyNote: string;
}
export interface ResearchFindingProjection { readonly [findingBrand]: true }
export interface SceneInputs {
  readonly snapshot: PortfolioSnapshot;
  readonly lens?: PublicLensProjection;
  readonly findings?: readonly ResearchFindingProjection[];
  readonly identity?: IdentityConfig;
}
export interface RenderContext {
  readonly theme: ThemeName;
  readonly pack: ScenePack;
  readonly motion: MotionProfile;
  readonly backend: MotionBackend;
  readonly layout: "wide" | "compact";
  readonly instanceNamespace: string;
  readonly seed: string;
}
export interface SceneUnavailable { readonly state: "unavailable"; readonly reason: string }
export interface SceneDefinition<Model> {
  readonly id: string;
  readonly family: "instrument" | "map" | "signature" | "scene" | "finding";
  readonly supportedPacks: readonly ScenePack[];
  readonly supportedMotion: readonly MotionProfile[];
  readonly budget: BudgetClass;
  buildModel(inputs: SceneInputs): Model | SceneUnavailable;
  render(model: Model, context: RenderContext): string;
  /** Optional static unavailable composition, with engine-owned naming and no source inputs. */
  renderUnavailable?(state: SceneUnavailable, context: RenderContext, accessibility: Readonly<{ title: string; description: string }>): string;
  accessibility(model: Model): { title: string; description: string };
}
export interface SceneRenderResult {
  readonly svg: string; readonly seed: string;
  readonly counters: { readonly bytes: number; readonly animatedElements: number; readonly loopingGroups: number };
  readonly unavailable: boolean; readonly inlineStyles: boolean;
  readonly reducedMotion: CompiledMotionPlan["reducedMotion"];
}
const registry = new Map<string, SceneDefinition<unknown>>();
const authenticLensContexts = new WeakSet<object>();
interface RenderSession { readonly unavailable: boolean; readonly definition: SceneDefinition<unknown>; compiled?: CompiledMotionPlan }
const sessions = new WeakMap<RenderContext, RenderSession>();
const PACKS = ["orbital", "survey", "spectral", "terminal"];
const PROFILES = ["none", "subtle", "ambient", "cinematic"];

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error(`${label} must be a plain object`);
  const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !keys.includes(key)) throw new Error(`unknown ${label} field`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor)) throw new Error(`${label} accessors are forbidden`);
    result[key] = descriptor.value;
  }
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function own<T>(value: T): T { return freeze(JSON.parse(canonicalJson(value)) as T); }
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== "string" || value.length > max || value.trim() === "") throw new Error(`invalid ${label}`);
  return value;
}
function key(value: unknown): string {
  if (typeof value !== "string" || value.length > 64 || !/^[A-Za-z][A-Za-z0-9_-]*$/u.test(value)) throw new Error("invalid scene element key");
  return value;
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000) throw new Error("invalid coverage count");
  return value;
}
export function createPublicDemoLensContext(input: {
  readonly dataClass: "C0"; readonly scope: "public-demo"; readonly coverage: PublicDemoCoverage; readonly privacyNote: string;
}): PublicLensProjection {
  const data = record(input, ["dataClass", "scope", "coverage", "privacyNote"], "public demo lens context");
  if (data.dataClass !== "C0" || data.scope !== "public-demo") throw new Error("only C0 public-demo consumer lens context is supported");
  const coverage = record(data.coverage, ["complete", "partial", "unavailable", "total", "warnings"], "coverage");
  const complete = count(coverage.complete), partial = count(coverage.partial), unavailable = count(coverage.unavailable), total = count(coverage.total);
  if (complete + partial + unavailable !== total) throw new Error("coverage counts must sum to total");
  if (!Array.isArray(coverage.warnings) || coverage.warnings.length > 8) throw new Error("invalid coverage warnings");
  const warnings = own(coverage.warnings).map(item => text(item, 240, "coverage warning"));
  const result = own({ dataClass: "C0", scope: "public-demo", coverage: { complete, partial, unavailable, total, warnings }, privacyNote: text(data.privacyNote, 240, "privacy note") }) as unknown as PublicLensProjection;
  authenticLensContexts.add(result);
  return result;
}
export function sceneLensDescription(lens: Pick<PublicLensProjection, "coverage" | "privacyNote">): string {
  const data = record(lens, ["coverage", "privacyNote", "dataClass", "scope"], "lens common context");
  if (data.dataClass !== undefined && data.dataClass !== "C0" || data.scope !== undefined && data.scope !== "public-demo") throw new Error("only synthetic lens common context is supported");
  const validated = createPublicDemoLensContext({ dataClass: "C0", scope: "public-demo", coverage: data.coverage as PublicDemoCoverage, privacyNote: data.privacyNote as string });
  const c = validated.coverage;
  return `Coverage: ${c.complete} complete, ${c.partial} partial, ${c.unavailable} unavailable, ${c.total} total. Privacy: ${validated.privacyNote}` +
    (c.warnings.length ? ` Warnings: ${c.warnings.join("; ")}.` : "");
}
export function sceneUnavailable(reason: string): SceneUnavailable {
  return Object.freeze({ state: "unavailable", reason: text(reason, 240, "unavailable reason") });
}
function definitionSnapshot<Model>(input: SceneDefinition<Model>): SceneDefinition<Model> {
  const data = record(input, ["id", "family", "supportedPacks", "supportedMotion", "budget", "buildModel", "render", "accessibility", "renderUnavailable"], "scene definition");
  if (typeof data.id !== "string" || data.id.length > 48 || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(data.id)) throw new Error("invalid scene id");
  if (!["instrument", "map", "signature", "scene", "finding"].includes(data.family as string)) throw new Error("invalid scene family");
  if (typeof data.budget !== "string" || !Object.hasOwn(MOTION_BUDGETS, data.budget)) throw new Error("invalid scene budget class");
  for (const [name, choices] of [["supportedPacks", PACKS], ["supportedMotion", PROFILES]] as const) {
    const list = data[name];
    if (!Array.isArray(list) || list.length === 0 || list.length > choices.length || new Set(list).size !== list.length || list.some(value => !choices.includes(value))) throw new Error(`invalid ${name}`);
  }
  for (const callback of ["buildModel", "render", "accessibility"]) if (typeof data[callback] !== "function") throw new Error(`invalid scene ${callback}`);
  if (data.renderUnavailable !== undefined && typeof data.renderUnavailable !== "function") throw new Error("invalid scene renderUnavailable");
  new MotionPlan({ instanceNamespace: "validation", sceneId: data.id, family: data.family as SceneDefinition<Model>["family"], profile: "none", target: "web", backend: "css", budgetClass: data.budget as BudgetClass });
  return Object.freeze({ ...input, supportedPacks: Object.freeze([...input.supportedPacks]), supportedMotion: Object.freeze([...input.supportedMotion]) });
}
let builtinsLoaded = false;
function loadBuiltins(): void {
  if (builtinsLoaded) return;
  const builtin = definitionSnapshot(evidenceCoverageScene) as SceneDefinition<unknown>;
  registry.set(builtin.id, builtin);
  builtinsLoaded = true;
}
export function registerScene<Model>(definition: SceneDefinition<Model>): void {
  loadBuiltins();
  const snapshot = definitionSnapshot(definition);
  if (registry.has(snapshot.id)) throw new Error(`duplicate scene id: ${snapshot.id}`);
  registry.set(snapshot.id, snapshot as unknown as SceneDefinition<unknown>);
}
export function getScene(id: string): SceneDefinition<unknown> | undefined { loadBuiltins(); return registry.get(id); }
export function listScenes(): readonly SceneDefinition<unknown>[] { loadBuiltins(); return Object.freeze([...registry.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); }
function validateContext(input: RenderContext, definition: SceneDefinition<unknown>): RenderContext {
  const data = record(input, ["theme", "pack", "motion", "backend", "layout", "instanceNamespace", "seed"], "render context");
  if (!["ember", "aurora", "midnight", "paper"].includes(data.theme as string) || !PACKS.includes(data.pack as string) || !PROFILES.includes(data.motion as string) || !["css", "smil"].includes(data.backend as string) || !["wide", "compact"].includes(data.layout as string) || typeof data.seed !== "string") throw new Error("invalid render context enum or seed");
  if (!definition.supportedPacks.includes(input.pack) || !definition.supportedMotion.includes(input.motion)) throw new Error("unsupported scene pack or motion");
  new MotionPlan({ instanceNamespace: input.instanceNamespace, sceneId: definition.id, family: definition.family, profile: input.motion, backend: input.backend, target: "web", budgetClass: definition.budget });
  return own(input);
}
function session(context: RenderContext): RenderSession {
  const result = sessions.get(context);
  if (!result) throw new Error("scene helper requires an active render context");
  return result;
}
function prefix(context: RenderContext, definition: SceneDefinition<unknown>): string {
  return `ca-${context.instanceNamespace.length}-${context.instanceNamespace}-${definition.id.length}-${definition.id}`;
}
export function sceneElementId(context: RenderContext, name: string): string {
  return `${prefix(context, session(context).definition)}-element-${key(name)}`;
}
export function sceneClassName(context: RenderContext, name: string): string {
  return `${prefix(context, session(context).definition)}-target-${key(name)}`;
}
export function compileSceneMotion(context: RenderContext, applications: readonly MotionApplication[], options: { readonly target: MotionTarget }): CompiledMotionPlan {
  const active = session(context);
  if (active.compiled) throw new Error("only one scene motion plan may compile per render");
  if (active.unavailable && (!Array.isArray(applications) || applications.length > 0)) throw new Error("unavailable scenes cannot request motion");
  const args = record(options, ["target"], "scene motion options");
  const builder = new MotionPlan({ instanceNamespace: context.instanceNamespace, sceneId: active.definition.id, family: active.definition.family,
    profile: context.motion, backend: context.backend, target: args.target as MotionTarget, budgetClass: active.definition.budget });
  if (!Array.isArray(applications)) throw new Error("scene motion applications must be an array");
  for (const application of applications) builder.add(application);
  const compiled = freeze(builder.compile());
  active.compiled = compiled;
  return compiled;
}
export function renderScene(id: string, inputs: SceneInputs, context: RenderContext): string {
  const definition = getScene(id);
  if (!definition) throw new Error(`unknown scene: ${id}`);
  return renderSceneDefinition(definition, inputs, context).svg;
}
export function renderSceneDefinition<Model>(source: SceneDefinition<Model>, inputs: SceneInputs, inputContext: RenderContext): SceneRenderResult {
  const definition = definitionSnapshot(source) as unknown as SceneDefinition<unknown>;
  const validatedContext = validateContext(inputContext, definition);
  const data = record(inputs, ["snapshot", "lens", "findings", "identity"], "scene inputs");
  if (!data.snapshot || typeof data.snapshot !== "object") throw new Error("scene snapshot is required");
  let unavailableReason: string | undefined;
  if (data.findings !== undefined) unavailableReason = "Finding projection schema adapter is unavailable.";
  if (data.identity !== undefined && !isIdentityConfig(data.identity)) unavailableReason = "Validated static identity is unavailable.";
  if (data.lens !== undefined && (!data.lens || typeof data.lens !== "object" || !authenticLensContexts.has(data.lens))) unavailableReason = "Validated synthetic lens context is unavailable.";
  if (definition.family === "signature" && data.lens === undefined) unavailableReason = "Validated lens coverage and privacy context is unavailable.";
  // Optional fields are omitted rather than allowing undefined into canonical JSON.
  const supplied = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
  const copiedInputs = own(supplied) as unknown as SceneInputs;
  const ownedInputs: SceneInputs = Object.freeze({
    ...copiedInputs,
    ...(!unavailableReason && copiedInputs.identity ? { identity: createIdentityConfig(copiedInputs.identity) } : {}),
  });
  if (!unavailableReason && ownedInputs.lens) authenticLensContexts.add(ownedInputs.lens);
  const model = own(unavailableReason ? sceneUnavailable(unavailableReason) : definition.buildModel(ownedInputs));
  const unavailable = !!model && typeof model === "object" && Object.hasOwn(model, "state") && (model as SceneUnavailable).state === "unavailable";
  if (unavailable) record(model, ["state", "reason"], "unavailable model");
  const seed = stableHash(canonicalJson(model));
  const context = Object.freeze({ ...validatedContext, seed });
  const active: RenderSession = { definition, unavailable };
  let output: string;
  let accessibility: { title: string; description: string };
  sessions.set(context, active);
  try {
    if (unavailable) {
      const reason = text((model as SceneUnavailable).reason, 240, "unavailable reason");
      accessibility = Object.freeze({ title: `${definition.id}: unavailable`, description: `Scene unavailable. ${reason}` });
      output = definition.renderUnavailable ? definition.renderUnavailable(model as SceneUnavailable, context, accessibility) : `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${sceneEscapeXml(accessibility.title)}" viewBox="0 0 640 120"><title>${sceneEscapeXml(accessibility.title)}</title><desc>${sceneEscapeXml(accessibility.description)}</desc><rect width="640" height="120" fill="#11110f"/><text x="24" y="42" fill="#edf0e2">UNAVAILABLE</text><text x="24" y="76" fill="#edf0e2">${sceneEscapeXml(reason)}</text></svg>`;
    } else {
      accessibility = definition.accessibility(model);
      record(accessibility, ["title", "description"], "scene accessibility");
      text(accessibility.title, 240, "scene title"); text(accessibility.description, 4000, "scene description");
      if (definition.family === "signature") {
        const signature = model as { lens?: { coverage?: unknown; privacyNote?: unknown } };
        if (!signature?.lens || canonicalJson(signature.lens.coverage) !== canonicalJson(ownedInputs.lens!.coverage) || signature.lens.privacyNote !== ownedInputs.lens!.privacyNote) throw new Error("signature model must preserve lens coverage and privacy context");
      }
      output = definition.render(model, context);
    }
  } finally { sessions.delete(context); }
  if (typeof output !== "string") throw new Error("scene renderer must return SVG string");
  let document = parseSceneXml(output);
  if (document.root.attrs["data-scene-seed"] !== undefined && document.root.attrs["data-scene-seed"] !== seed) throw new Error("scene seed marker does not match model");
  if (document.root.attrs["data-scene-seed"] === undefined) {
    const open = document.root.openEnd - 1;
    output = `${output.slice(0, open)} data-scene-seed="${seed}"${output.slice(open)}`;
    document = parseSceneXml(output);
  }
  validateSceneSvg(document, prefix(context, definition), active.compiled);
  const titles = document.root.children.filter(node => node.name === "title");
  const descriptions = document.root.children.filter(node => node.name === "desc");
  if (titles.length !== 1 || descriptions.length !== 1 || sceneXmlText(titles[0]!) !== sceneSafeText(accessibility.title) || sceneXmlText(descriptions[0]!) !== sceneSafeText(accessibility.description)) throw new Error("scene title and description must match accessibility contract");
  if (document.root.attrs["aria-label"] !== sceneSafeText(accessibility.title)) throw new Error("scene root accessible name must match accessibility title");
  for (const [attribute, node] of [["aria-labelledby", titles[0]!], ["aria-describedby", descriptions[0]!]] as const) {
    const reference = document.root.attrs[attribute];
    if (reference !== undefined && reference.trim() !== node.attrs.id) throw new Error("scene root accessibility references must identify its title and description");
  }
  if (!unavailable && definition.family === "signature") {
    const common = sceneSafeText(sceneLensDescription(ownedInputs.lens!));
    const visible = sceneVisibleText(document.root);
    if (!visible.includes(common) || !sceneXmlText(descriptions[0]!).includes(common)) throw new Error("signature must visibly and accessibly include lens coverage and privacy context");
  }
  if (unavailable && !sceneVisibleText(document.root).includes("UNAVAILABLE")) throw new Error("unavailable scenes must visibly display UNAVAILABLE");
  const bytes = new TextEncoder().encode(output).length;
  const budget = MOTION_BUDGETS[definition.budget];
  const counters = { bytes, animatedElements: active.compiled?.counters.animatedElements ?? 0, loopingGroups: active.compiled?.counters.loopingGroups ?? 0 };
  if (bytes > budget.bytes || definition.budget === "instrument" && bytes === budget.bytes) throw new Error("scene byte budget exceeded");
  if (counters.animatedElements > budget.animatedElements || counters.loopingGroups > budget.loopingGroups) throw new Error("scene animation budget exceeded");
  return freeze({ svg: output, seed, counters, unavailable, inlineStyles: active.compiled?.inlineStyles ?? false, reducedMotion: active.compiled?.reducedMotion ?? "not-needed" });
}
