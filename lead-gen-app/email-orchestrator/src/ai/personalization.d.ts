/**
 * AI-powered email personalization using Claude
 * Generates contextual, personalized emails from templates
 */
import type { PersonalizationContext, PersonalizedEmail } from '../types/email.types.js';
/**
 * Generate personalized email using Claude
 */
export declare function generatePersonalizedEmail(context: PersonalizationContext): Promise<PersonalizedEmail>;
/**
 * Generate subject line variants for A/B testing
 */
export declare function generateSubjectVariants(baseSubject: string, count?: number): Promise<string[]>;
//# sourceMappingURL=personalization.d.ts.map