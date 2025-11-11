/**
 * AI-powered email personalization using Claude
 * Generates contextual, personalized emails from templates
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import { htmlToPlainText } from '../utils/compliance.js';
import type { PersonalizationContext, PersonalizedEmail } from '../types/email.types.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate personalized email using Claude
 */
export async function generatePersonalizedEmail(
  context: PersonalizationContext
): Promise<PersonalizedEmail> {
  try {
    const { prospect, company, template, instructions, subject_line } = context;

    // Build context for Claude
    const prospectInfo = prospect
      ? `
PROSPECT INFORMATION:
- Name: ${prospect.name || 'N/A'}
- Email: ${prospect.email}
- Job Title: ${prospect.job_title || 'N/A'}
- Company: ${prospect.company_name || 'N/A'}
- Industry: ${prospect.industry || 'N/A'}
- Location: ${prospect.location || 'N/A'}
- LinkedIn: ${prospect.linkedin_url || 'N/A'}
${prospect.notes ? `- Notes: ${prospect.notes}` : ''}
${prospect.tags && prospect.tags.length > 0 ? `- Tags: ${prospect.tags.join(', ')}` : ''}
`
      : 'No prospect information available';

    const companyInfo = company
      ? `
YOUR COMPANY INFORMATION:
- Name: ${company.name}
- Website: ${company.website || 'N/A'}
- Industry: ${company.industry || 'N/A'}
- Description: ${company.description || 'N/A'}
`
      : '';

    const customInstructions = instructions
      ? `
PERSONALIZATION INSTRUCTIONS:
${instructions}
`
      : '';

    const prompt = `You are an expert B2B email copywriter. Your task is to personalize an email template for a specific prospect.

${prospectInfo}
${companyInfo}
${customInstructions}

EMAIL TEMPLATE:
Subject: ${subject_line}

Body:
${template}

INSTRUCTIONS:
1. Replace any {{variable}} placeholders with actual prospect information
2. Personalize the email to be relevant to this specific prospect
3. Keep the core message and structure of the template
4. Make it sound natural and conversational, not robotic
5. If there's specific information about the prospect (job title, company, industry), reference it naturally
6. Keep the email concise and focused on value
7. Maintain professional business tone
8. DO NOT add a signature (that will be added automatically)
9. Return ONLY the personalized email body in HTML format
10. Use proper HTML formatting with <p> tags, <br> for line breaks, etc.

Return the personalized email as valid HTML. Do not include explanations, just the HTML email body.`;

    const message = await anthropic.messages.create({
      model: process.env.AI_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    let bodyHtml = '';
    for (const block of message.content) {
      if (block.type === 'text') {
        bodyHtml += block.text;
      }
    }

    // Clean up the HTML (remove markdown code blocks if present)
    bodyHtml = bodyHtml
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Ensure proper HTML structure
    if (!bodyHtml.includes('<p>') && !bodyHtml.includes('<div>')) {
      // Wrap plain text in paragraphs
      bodyHtml = bodyHtml
        .split('\n\n')
        .filter((p) => p.trim())
        .map((p) => `<p>${p.trim()}</p>`)
        .join('\n');
    }

    // Personalize subject line with prospect data
    const personalizedSubject = personalizeSubjectLine(subject_line, prospect);

    const bodyPlain = htmlToPlainText(bodyHtml);

    logger.info('Email personalized with AI', {
      prospect_id: prospect?.id,
      template_length: template.length,
      output_length: bodyHtml.length,
    });

    return {
      subject: personalizedSubject,
      body_html: bodyHtml,
      body_plain: bodyPlain,
    };
  } catch (error: any) {
    logger.error('AI personalization failed', {
      error: error.message,
      prospect_id: context.prospect?.id,
    });

    // Fallback: basic template variable substitution
    logger.warn('Falling back to basic template substitution');
    return fallbackPersonalization(context);
  }
}

/**
 * Personalize subject line with variable substitution
 */
function personalizeSubjectLine(
  subjectTemplate: string,
  prospect: PersonalizationContext['prospect']
): string {
  if (!prospect) return subjectTemplate;

  let subject = subjectTemplate;

  // Replace common variables
  const replacements: Record<string, string> = {
    '{{name}}': prospect.name || 'there',
    '{{first_name}}': prospect.name?.split(' ')[0] || 'there',
    '{{company}}': prospect.company_name || 'your company',
    '{{job_title}}': prospect.job_title || 'your role',
    '{{industry}}': prospect.industry || 'your industry',
  };

  for (const [variable, value] of Object.entries(replacements)) {
    subject = subject.replace(new RegExp(variable, 'gi'), value);
  }

  return subject;
}

/**
 * Fallback personalization using simple template variable substitution
 */
function fallbackPersonalization(context: PersonalizationContext): PersonalizedEmail {
  const { prospect, template, subject_line } = context;

  let bodyHtml = template;
  let subject = subject_line;

  if (prospect) {
    const replacements: Record<string, string> = {
      '{{name}}': prospect.name || 'there',
      '{{first_name}}': prospect.name?.split(' ')[0] || 'there',
      '{{last_name}}': prospect.name?.split(' ').slice(1).join(' ') || '',
      '{{email}}': prospect.email,
      '{{company}}': prospect.company_name || 'your company',
      '{{job_title}}': prospect.job_title || 'your role',
      '{{industry}}': prospect.industry || 'your industry',
      '{{location}}': prospect.location || '',
      '{{phone}}': prospect.phone || '',
    };

    for (const [variable, value] of Object.entries(replacements)) {
      const regex = new RegExp(variable, 'gi');
      bodyHtml = bodyHtml.replace(regex, value);
      subject = subject.replace(regex, value);
    }
  }

  // Ensure HTML formatting
  if (!bodyHtml.includes('<p>') && !bodyHtml.includes('<div>')) {
    bodyHtml = bodyHtml
      .split('\n\n')
      .filter((p) => p.trim())
      .map((p) => `<p>${p.trim()}</p>`)
      .join('\n');
  }

  return {
    subject,
    body_html: bodyHtml,
    body_plain: htmlToPlainText(bodyHtml),
  };
}

/**
 * Generate subject line variants for A/B testing
 */
export async function generateSubjectVariants(
  baseSubject: string,
  count: number = 3
): Promise<string[]> {
  try {
    const prompt = `Generate ${count} alternative subject lines for this email subject:

"${baseSubject}"

Requirements:
- Keep them concise (under 60 characters)
- Maintain the same core message
- Make them compelling and click-worthy
- Use different angles or hooks
- Professional B2B tone

Return ONLY the subject lines, one per line, without numbering or explanations.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    let variants: string[] = [];
    for (const block of message.content) {
      if (block.type === 'text') {
        variants = block.text
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && line.length <= 100);
      }
    }

    return variants.slice(0, count);
  } catch (error) {
    logger.error('Failed to generate subject variants', { error });
    return [baseSubject];
  }
}
