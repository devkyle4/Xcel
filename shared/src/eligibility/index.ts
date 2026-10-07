// Eligibility engine: a pure module (no I/O) that evaluates WASSCE results
// against an admission cycle's structured requirements.
export * from './catalogue';
export * from './describe';
export { EligibilityInputError, evaluateEligibility } from './evaluate';
export { getRuleType, RULE_TYPES, type RuleType } from './rules';
export * from './types';
export * from './validate';
