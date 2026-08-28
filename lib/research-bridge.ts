import rawSummary from "@/research-contracts/method-trial-summary/v1/wbc1.summary.json";
import { z } from "zod";

const MeasuredMetricSchema = z.object({
  status: z.literal("measured"),
  value: z.number().finite().min(0).max(1_000_000),
}).strict();

const PercentageMetricSchema = z.object({
  status: z.literal("measured"),
  value: z.number().finite().min(0).max(1),
}).strict();

const LimitationSchema = z.object({
  code: z.enum([
    "c0_synthetic_only",
    "bounded_three_case_selection",
    "missingness_and_confound",
    "thresholds_nonviable",
  ]),
  display_text: z.enum([
    "Evidence is limited to invented C0 weekly system series.",
    "Only three bounded representative windows are exported.",
    "Missing observations and instrumentation confounds are explicit.",
    "Both threshold selections are nonviable.",
  ]),
}).strict();

const UnsupportedClaimSchema = z.object({
  code: z.enum([
    "real_repository_validity",
    "person_level_inference",
    "model_promotion",
    "online_pelt_performance",
  ]),
  display_text: z.enum([
    "This result does not establish validity on real repositories.",
    "No person-level inference is supported or attempted.",
    "This rejected trial cannot promote a model.",
    "Offline PELT markers do not establish online performance.",
  ]),
}).strict();

const ProvenanceSchema = z.object({
  derivation: z.literal("MethodTrialViewSchema.parse"),
  public_url: z.literal("https://chris0jeky.github.io/developer-lens/?view=method-trial"),
  run_id: z.literal("wbc1_demo"),
  source_contract_schema_sha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  source_fixture_sha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  source_lab_commit: z.string().regex(/^[0-9a-f]{40}$/),
  source_product_contract_commit: z.string().regex(/^[0-9a-f]{40}$/),
}).strict();

export const DeveloperLensMethodTrialSummarySchema = z.object({
  classification: z.literal("C0"),
  limitations: z.array(LimitationSchema).length(4),
  methods: z.object({
    baseline: z.object({
      method_code: z.literal("rolling_median_mad"),
      display_name: z.literal("Rolling median and MAD"),
    }).strict(),
    candidate: z.object({
      method_code: z.literal("bocpd_gaussian"),
      display_name: z.literal("Gaussian BOCPD"),
    }).strict(),
  }).strict(),
  metrics: z.object({
    detection_rate: z.object({
      baseline: PercentageMetricSchema,
      candidate: PercentageMetricSchema,
    }).strict(),
    false_alerts_per_year: z.object({
      baseline: MeasuredMetricSchema,
      candidate: MeasuredMetricSchema,
    }).strict(),
  }).strict(),
  provenance: ProvenanceSchema,
  retained_fallback: z.object({
    method_code: z.literal("rolling_median_mad"),
    retained: z.literal(true),
  }).strict(),
  schema_version: z.literal("DeveloperLensMethodTrialSummary.v1"),
  threshold_viability: z.object({
    baseline: z.literal(false),
    candidate: z.literal(false),
  }).strict(),
  trial: z.object({
    question: z.literal("Can the BOCPD candidate reduce false alerts per year versus the rolling median and MAD baseline without worsening detection or calibration?"),
    title: z.literal("WB-C1 method trial: why the simple baseline won"),
    verdict: z.literal("reject"),
    verdict_summary: z.literal("The candidate is rejected because both selections are nonviable and false alerts are higher."),
  }).strict(),
  unsupported_claims: z.array(UnsupportedClaimSchema).length(4),
}).strict();

export type DeveloperLensMethodTrialSummary = z.infer<typeof DeveloperLensMethodTrialSummarySchema>;

/** The exact producer revision that emitted the pinned summary bytes. */
export const DEVELOPER_LENS_PRODUCER_COMMIT = "425708e03e7bbc3cf09f64e9c154938989647dbe";
/** Hash of the vendored JSON with LF line endings; line endings are normalized at the consumer boundary. */
export const DEVELOPER_LENS_SUMMARY_SHA256 =
  "sha256:1d4cc328f737afa84b984aaa59138c7d21659c05253dd6e98dc6fd384e9960c4";

export const developerLensMethodTrialSummary = DeveloperLensMethodTrialSummarySchema.parse(rawSummary);
