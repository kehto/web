/**
 * @kehto/conformance — runtime conformance suite for NIP-5D and advertised NAP domains.
 *
 * The `.` entry is browser-agnostic: the result model, the engine, the target
 * contract, the probe fixtures and the reporters. The first-party target lives
 * at `@kehto/conformance/kehto-target`, the self-contained browser bundle at
 * `@kehto/conformance/browser`, and the headless Node runner at
 * `@kehto/conformance/cli`.
 *
 * @module
 */
export type {
  AuthorityRef, CheckDefinition, CheckOutcome, CheckResult, CheckScope, CheckSeverity, CheckStatus,
  ConformanceProfile, ConformanceRun, DomainCoverage, OperationCoverage, OperationResult, RunOptions,
  RunSummary, ShellMode, TranscriptEntry, VariantResult, WireDirection,
} from './model.js';
export { pass, fail, skip, specGap } from './model.js';
export { runConformance, conformanceStatement, ConformanceHarnessError } from './engine.js';
export {
  AUTHORITY, authorityUrl, CORE_PACKAGE_VERSION, NAP_PACKAGE_VERSION, NAPS_MASTER, NIP5D_REF,
} from './authority.js';
export type {
  ConformanceTarget, FrameEvidence, ProbeEndpoint, ProbeRejection, ProbeSpec, RevocationEvidence,
  RogueEvidence, TargetSession, TargetVariant,
} from './target.js';
export type { AnchorDomain, Check, CollectContext, Scenario } from './scenario.js';
export { SCENARIOS } from './scenarios/index.js';
export { renderProbeArtifact, renderWireTap, COLLECTOR_FRAME_NAME, REPORT_FIELD, SIGNAL_FIELD, WIRE_HANDLE } from './probe/artifact.js';
export type { ProbeDeclarations, WireHold } from './probe/artifact.js';
export type {
  AssignStep, CallStep, CallbackArg, ExpectStep, HandleArg, InvokeStep, MarkStep, PlanArg, ProbePlan, ProbeReport,
  ProbeStep, QuietStep, ReadStep, RealmSnapshot, SendStep, SleepStep, SnapshotStep, StepRecord, StepState,
  WaitSignalStep, WindowPostStep,
} from './probe/plan.js';
export { formatReport, REPORTERS } from './reporters/index.js';
export type { ReporterName } from './reporters/index.js';
export { ENGINE_VERSION } from './version.js';
