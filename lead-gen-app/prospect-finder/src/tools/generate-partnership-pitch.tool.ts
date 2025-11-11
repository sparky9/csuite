/**
 * generate_partnership_pitch tool implementation
 *
 * Create a co-marketing outreach template for partnership proposals.
 * Uses Anthropic API to generate personalized, professional partnership pitches.
 */

import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { PartnershipPitch } from '../types/prospect.types.js';

dotenv.config();

// Zod schema for input validation
const GeneratePartnershipPitchSchema = z.object({
  partnerCompany: z.string().min(2, 'partnerCompany must be at least 2 characters'),
  partnerIndustry: z.string().min(2, 'partnerIndustry must be at least 2 characters'),
  proposedCollaboration: z.string().min(5, 'proposedCollaboration must be at least 5 characters'),
});

/**
 * Initialize Anthropic client
 */
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY not set. Partnership pitch generation will fail.');
    return null;
  }

  return new Anthropic({ apiKey });
}

/**
 * Parse AI response to extract subject, body, and terms
 * Handles both JSON responses and markdown-fenced JSON responses
 */
function parseAIResponse(responseText: string): PartnershipPitch {
  // Strip markdown code fences and any surrounding text
  let cleanedText = responseText.trim();

  // Remove ```json and ``` fences
  const jsonFenceMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) {
    cleanedText = jsonFenceMatch[1].trim();
  } else {
    // Also try just ``` without json specifier
    const fenceMatch = cleanedText.match(/```\s*([\s\S]*?)\s*```/);
    if (fenceMatch) {
      cleanedText = fenceMatch[1].trim();
    }
  }

  // Try parsing the cleaned JSON
  try {
    const parsed = JSON.parse(cleanedText);

    // Validate required fields
    if (!parsed.subject || !parsed.emailBody) {
      throw new Error('Missing required fields: subject or emailBody');
    }

    return {
      subject: parsed.subject,
      emailBody: parsed.emailBody,
      proposedTerms: Array.isArray(parsed.proposedTerms)
        ? parsed.proposedTerms
        : []
    };
  } catch (error) {
    logger.error('Failed to parse AI response as JSON', { error, responseText: cleanedText });

    // Enhanced fallback parser for non-JSON text responses
    let subject = '';
    let emailBody = '';
    let proposedTerms: string[] = [];

    // Look for subject line (various formats)
    const subjectMatch = responseText.match(/(?:subject|Subject):\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
    }

    // Extract email body (between Subject and Terms, or after Subject)
    const bodyMatch = responseText.match(/(?:body|emailBody|Email):\s*([\s\S]+?)(?=proposed|terms|$)/i);
    if (bodyMatch) {
      emailBody = bodyMatch[1].trim();
    }

    // Extract proposed terms (look for bullet points or numbered lists)
    const termsMatch = responseText.match(/(?:proposed\s*terms|terms):\s*([\s\S]+)/i);
    if (termsMatch) {
      const termLines = termsMatch[1].split('\n');
      proposedTerms = termLines
        .filter(line => line.match(/^[\s]*[-*•\d.]/))
        .map(line => line.replace(/^[\s]*[-*•\d.]+\s*/, '').trim())
        .filter(term => term.length > 0);
    }

    if (!subject || !emailBody) {
      throw new Error('Failed to parse AI response: missing subject or emailBody');
    }

    return { subject, emailBody, proposedTerms };
  }
}

/**
 * Main tool handler
 */
export async function generatePartnershipPitchTool(args: unknown) {
  // Validate input
  const params = GeneratePartnershipPitchSchema.parse(args);

  logger.info('Generating partnership pitch', {
    partnerCompany: params.partnerCompany,
    partnerIndustry: params.partnerIndustry,
    proposedCollaboration: params.proposedCollaboration,
  });

  try {
    const anthropic = getAnthropicClient();

    if (!anthropic) {
      // Return mock data if API key not available
      logger.warn('Anthropic API not available, returning mock pitch');
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              subject: `Partnership opportunity: [Your Company] + ${params.partnerCompany}`,
              emailBody: `Hi [Name],

I hope this message finds you well. I came across ${params.partnerCompany} and was impressed by your work in ${params.partnerIndustry}.

I believe there's a strong synergy between our businesses. Many of our clients also need ${params.partnerIndustry} services, and I suspect your clients might benefit from what we offer as well.

I'd love to explore a ${params.proposedCollaboration} that could benefit both our businesses and provide additional value to our respective clients.

Would you be open to a brief call next week to discuss potential collaboration opportunities?

Best regards,
[Your Name]`,
              proposedTerms: [
                'Cross-referral agreement with commission structure',
                'Co-branded marketing materials',
                'Joint webinar or workshop series',
                'Preferred vendor status for each other\'s clients',
                'Regular coordination meetings',
              ],
              note: 'MOCK DATA - Set ANTHROPIC_API_KEY for AI-generated pitches',
            }, null, 2),
          },
        ],
      };
    }

    // Create AI prompt for partnership pitch generation
    const prompt = `You are an expert business development consultant specializing in partnership outreach.

Generate a professional, compelling partnership pitch email for the following scenario:

Partner Company: ${params.partnerCompany}
Partner Industry: ${params.partnerIndustry}
Proposed Collaboration Type: ${params.proposedCollaboration}

Create a partnership pitch that includes:

1. Subject Line: Compelling subject that mentions both companies and the partnership opportunity
2. Email Body: Professional, friendly email that:
   - Opens with a personalized greeting
   - Mentions what impressed you about their company
   - Explains the synergy between the businesses
   - Proposes the specific collaboration type
   - Focuses on mutual benefits (not just what you want)
   - Includes a clear call-to-action (suggest a call or meeting)
   - Keeps it concise (under 200 words)
3. Proposed Terms: 3-5 specific, actionable partnership terms or activities

Format your response as JSON with this structure:
{
  "subject": "the subject line",
  "emailBody": "the email body text",
  "proposedTerms": ["term 1", "term 2", "term 3"]
}

Make it professional but approachable, focusing on win-win outcomes.`;

    // Call Anthropic API
    logger.info('Calling Anthropic API for pitch generation');

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.7, // Higher temperature for creative writing
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract response text
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => ('text' in block ? block.text : ''))
      .join('\n');

    logger.info('Partnership pitch generated successfully', {
      responseLength: responseText.length,
    });

    // Parse the response
    const pitch = parseAIResponse(responseText);

    // Validate that we got meaningful content
    if (!pitch.subject || !pitch.emailBody) {
      throw new Error('Failed to generate complete partnership pitch');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(pitch, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error('Partnership pitch generation failed', { error });

    if (error instanceof Error && error.message.includes('API key')) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: ANTHROPIC_API_KEY not configured. Please set your Anthropic API key in the .env file.',
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
