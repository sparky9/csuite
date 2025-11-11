import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
  onboardingTemplateListTool,
  onboardingTemplateSaveTool,
  handleOnboardingTemplateList,
  handleOnboardingTemplateSave,
} from './template-tools.js';
import {
  onboardingPlanGenerateTool,
  onboardingPlanListTool,
  onboardingPlanStatusTool,
  handleOnboardingPlanGenerate,
  handleOnboardingPlanList,
  handleOnboardingPlanStatus,
} from './plan-tools.js';
import {
  onboardingIntakeSummaryTool,
  handleOnboardingIntakeSummary,
} from './intake-tools.js';
import {
  onboardingKickoffScheduleTool,
  handleOnboardingKickoffSchedule,
} from './kickoff-tools.js';
import {
  onboardingWelcomeSequenceTool,
  handleOnboardingWelcomeSequence,
} from './welcome-tools.js';
import {
  onboardingProgressDigestTool,
  handleOnboardingProgressDigest,
} from './digest-tools.js';
import {
  onboardingSyncUpdateTool,
  handleOnboardingSyncUpdate,
} from './sync-tools.js';
import {
  onboardingStepCompleteTool,
  onboardingIntakeSubmitTool,
  handleOnboardingStepComplete,
  handleOnboardingIntakeSubmit,
} from './step-complete-tools.js';

export const ALL_ONBOARDING_TOOLS: Tool[] = [
  onboardingTemplateListTool,
  onboardingTemplateSaveTool,
  onboardingPlanGenerateTool,
  onboardingPlanListTool,
  onboardingPlanStatusTool,
  onboardingIntakeSummaryTool,
  onboardingKickoffScheduleTool,
  onboardingWelcomeSequenceTool,
  onboardingProgressDigestTool,
  onboardingSyncUpdateTool,
  onboardingStepCompleteTool,
  onboardingIntakeSubmitTool,
];

export const ONBOARDING_TOOL_HANDLERS: Record<string, (args: unknown) => Promise<any>> = {
  [onboardingTemplateListTool.name]: handleOnboardingTemplateList,
  [onboardingTemplateSaveTool.name]: handleOnboardingTemplateSave,
  [onboardingPlanGenerateTool.name]: handleOnboardingPlanGenerate,
  [onboardingPlanListTool.name]: handleOnboardingPlanList,
  [onboardingPlanStatusTool.name]: handleOnboardingPlanStatus,
  [onboardingIntakeSummaryTool.name]: handleOnboardingIntakeSummary,
  [onboardingKickoffScheduleTool.name]: handleOnboardingKickoffSchedule,
  [onboardingWelcomeSequenceTool.name]: handleOnboardingWelcomeSequence,
  [onboardingProgressDigestTool.name]: handleOnboardingProgressDigest,
  [onboardingSyncUpdateTool.name]: handleOnboardingSyncUpdate,
  [onboardingStepCompleteTool.name]: handleOnboardingStepComplete,
  [onboardingIntakeSubmitTool.name]: handleOnboardingIntakeSubmit,
};
