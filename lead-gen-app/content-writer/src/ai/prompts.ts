/**
 * AI Prompt Templates for Content Generation
 * Structured prompts for consistent, high-quality content output
 */

import type {
  GenerateEmailParams,
  GenerateBlogParams,
  GenerateSocialParams,
  RewriteContentParams,
  GenerateHeadlinesParams,
  SummarizeContentParams,
  ExpandContentParams,
  GenerateKBArticleParams,
  ContentTone,
  EmailPurpose,
  SocialPlatform,
  RewriteGoal,
  HeadlineStyle,
  SummaryFormat,
  ExpandFormat,
  ContentLength,
  KBArticleFormat,
} from '../types/content.types.js';

/**
 * System prompts define the AI's role and expertise
 */
export const SYSTEM_PROMPTS = {
  email: `You are an expert email copywriter with 10+ years of experience in B2B and B2C communications.
You create compelling, conversion-focused emails that engage readers and drive action.
You understand email best practices: clear subject lines, scannable formatting, strong CTAs, and appropriate tone.
Always format output as valid JSON matching the requested schema exactly.`,

  blog: `You are a professional content writer specializing in blog posts and long-form content.
You create engaging, SEO-optimized articles that educate and retain readers.
You structure content with clear headings, natural flow, and reader value.
Your writing is original, well-researched, and tailored to the target audience.
Always format output as valid JSON matching the requested schema exactly.`,

  social: `You are a social media content strategist with expertise across all major platforms.
You create engaging, platform-optimized posts that drive engagement and reach.
You understand platform-specific best practices, character limits, and audience behavior.
Your content is authentic, timely, and conversion-focused.
Always format output as valid JSON matching the requested schema exactly.`,

  rewrite: `You are an expert editor and content optimizer.
You improve content clarity, readability, and impact while preserving the core message.
You understand grammar, style, and tone adjustment techniques.
You make strategic improvements that enhance content effectiveness.
Always format output as valid JSON matching the requested schema exactly.`,

  headlines: `You are a headline optimization expert specializing in A/B testing and conversion.
You create compelling, click-worthy headlines that drive engagement.
You understand headline psychology, power words, and platform-specific best practices.
Your headlines balance curiosity, clarity, and value proposition.
Always format output as valid JSON matching the requested schema exactly.`,

  summarize: `You are an expert at distilling complex content into clear, concise summaries.
You identify key points, main arguments, and critical takeaways.
You create summaries that capture the essence without losing important nuance.
Your summaries are accurate, well-structured, and reader-focused.
Always format output as valid JSON matching the requested schema exactly.`,

  expand: `You are a content development specialist who transforms brief ideas into comprehensive content.
You add depth, examples, context, and structure to expand core concepts.
You maintain clarity while developing ideas thoroughly.
Your expanded content is coherent, valuable, and well-organized.
Always format output as valid JSON matching the requested schema exactly.`,

  kb_article: `You are a knowledge base content specialist with expertise in creating clear, helpful articles.
You create comprehensive FAQ entries, how-to guides, and troubleshooting articles.
You understand information architecture and user needs for self-service support.
Your articles are well-structured, easy to follow, and provide complete solutions.
Always format output as valid JSON matching the requested schema exactly.`,
};

/**
 * Tone instructions for consistent voice
 */
const TONE_INSTRUCTIONS: Record<ContentTone, string> = {
  professional: 'Use a polished, business-appropriate tone. Clear, confident, and competent. Avoid slang or overly casual language.',
  friendly: 'Use a warm, approachable tone. Conversational but still professional. Like talking to a colleague you respect.',
  casual: 'Use a relaxed, informal tone. Natural language, contractions welcome. Like chatting with a friend.',
  formal: 'Use a highly professional, traditional business tone. Precise language, proper grammar. Suitable for corporate or academic settings.',
  persuasive: 'Use a compelling, action-oriented tone. Focus on benefits, urgency, and emotional connection. Drive the reader to act.',
  conversational: 'Use a natural, dialogue-like tone. Easy to read, relatable. Like having a one-on-one conversation.',
  technical: 'Use a precise, detail-oriented tone. Clarity over style. Explain complex concepts accurately.',
  storytelling: 'Use a narrative, engaging tone. Create interest through story structure. Build connection through narrative arc.',
  inspirational: 'Use an uplifting, motivational tone. Focus on possibility, growth, and positive outcomes. Energize and encourage.',
  humorous: 'Use a light, entertaining tone. Appropriate humor that enhances rather than distracts. Keep it tasteful.',
  educational: 'Use a clear, instructive tone. Focus on teaching and helping readers understand. Patient and thorough.',
};

/**
 * Email generation prompt
 */
export function buildEmailPrompt(params: GenerateEmailParams): string {
  const toneInstruction = TONE_INSTRUCTIONS[params.tone];
  const purposeContext = getEmailPurposeContext(params.purpose);
  const lengthGuidance = getLengthGuidance('email', params.length);

  return `Generate a ${params.purpose} email about: ${params.topic}

TARGET AUDIENCE: ${params.audience}

KEY POINTS TO COVER:
${params.key_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}

${params.call_to_action ? `CALL TO ACTION: ${params.call_to_action}` : ''}

${params.context ? `ADDITIONAL CONTEXT: ${params.context}` : ''}

TONE REQUIREMENTS:
${toneInstruction}

${purposeContext}

LENGTH: ${lengthGuidance}

FORMAT REQUIREMENTS:
- Subject line: Clear, compelling, under 60 characters
- Preview text: First 100 characters that appear in inbox preview
- Body HTML: Proper HTML formatting with <p>, <strong>, <a> tags as needed
- Body Plain: Clean plain text version without HTML tags

Return ONLY a valid JSON object with this exact structure:
{
  "subject_line": "string",
  "preview_text": "string",
  "body_html": "string",
  "body_plain": "string"
}`;
}

/**
 * Blog post generation prompt
 */
export function buildBlogPrompt(params: GenerateBlogParams): string {
  const toneInstruction = TONE_INSTRUCTIONS[params.tone];
  const lengthGuidance = getLengthGuidance('blog', params.length);
  const outlineSection = params.outline
    ? `\nSUGGESTED OUTLINE:\n${params.outline.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
    : '';

  return `Write a comprehensive blog post about: ${params.topic}

TARGET AUDIENCE: ${params.audience}

SEO KEYWORDS (naturally incorporate):
${params.keywords.map((k, i) => `${i + 1}. ${k}`).join('\n')}

TONE REQUIREMENTS:
${toneInstruction}

LENGTH: ${lengthGuidance}

STRUCTURE REQUIREMENTS:
${params.include_intro !== false ? '- Include an engaging introduction that hooks the reader' : ''}
${params.include_conclusion !== false ? '- Include a strong conclusion with key takeaways' : ''}
- Use clear section headings (H2, H3)
- Include specific examples and actionable insights
- Format for readability: short paragraphs, bullet points where appropriate

${outlineSection}

Return ONLY a valid JSON object with this exact structure:
{
  "title": "string (compelling, SEO-friendly, under 70 chars)",
  "meta_description": "string (150-160 chars for SEO)",
  "content_html": "string (full HTML with proper tags)",
  "content_markdown": "string (same content in Markdown format)",
  "word_count": number,
  "reading_time_minutes": number (estimate at 200 words/min)
}`;
}

/**
 * Social media post generation prompt
 */
export function buildSocialPrompt(params: GenerateSocialParams): string {
  const toneInstruction = TONE_INSTRUCTIONS[params.tone];
  const platformContext = getPlatformContext(params.platform);
  const maxLength = params.max_length || platformContext.defaultMaxLength;

  return `Create a ${params.platform} post about: ${params.topic}

CORE MESSAGE: ${params.message}

PLATFORM: ${params.platform}
${platformContext.guidance}

TONE REQUIREMENTS:
${toneInstruction}

REQUIREMENTS:
- Maximum ${maxLength} characters
${params.include_hashtags !== false ? `- Include relevant hashtags (${platformContext.hashtagCount})` : '- No hashtags'}
${params.include_emojis ? '- Use appropriate emojis to enhance engagement' : '- No emojis'}
${params.call_to_action ? `- Include call to action: ${params.call_to_action}` : ''}

Return ONLY a valid JSON object with this exact structure:
{
  "post_text": "string",
  "hashtags": ["array", "of", "strings"],
  "character_count": number,
  "suggested_image_description": "string (optional, only if image would enhance post)"
}`;
}

/**
 * Content rewriting prompt
 */
export function buildRewritePrompt(params: RewriteContentParams): string {
  const goalInstruction = getRewriteGoalInstruction(params.goal);
  const toneInstruction = params.tone ? TONE_INSTRUCTIONS[params.tone] : '';

  return `Rewrite the following content with this goal: ${params.goal}

ORIGINAL CONTENT:
${params.content}

REWRITE GOAL:
${goalInstruction}

${params.tone ? `TARGET TONE:\n${toneInstruction}` : ''}

${params.preserve_meaning !== false ? 'IMPORTANT: Preserve the core meaning and key information.' : ''}

${params.target_length ? `TARGET LENGTH: Approximately ${params.target_length} words` : ''}

Return ONLY a valid JSON object with this exact structure:
{
  "rewritten_content": "string",
  "original_word_count": number,
  "new_word_count": number,
  "changes_summary": "string (brief description of what was changed and why)"
}`;
}

/**
 * Headline generation prompt
 */
export function buildHeadlinesPrompt(params: GenerateHeadlinesParams): string {
  const styleInstruction = getHeadlineStyleInstruction(params.style);
  const count = params.count || 5;

  return `Generate ${count} headline variations for: ${params.topic}

CONTENT TYPE: ${params.content_type}

STYLE REQUIREMENTS:
${styleInstruction}

REQUIREMENTS:
${params.max_length ? `- Maximum ${params.max_length} characters per headline` : '- Keep under 70 characters for optimal display'}
${params.include_numbers ? '- Include numbers or statistics where compelling' : ''}
- Each headline should be unique in approach
- Focus on clarity, benefit, and intrigue

Return ONLY a valid JSON object with this exact structure:
{
  "headlines": [
    {"text": "string", "character_count": number},
    ... (${count} total)
  ],
  "best_pick": {
    "headline": "string (your top recommendation)",
    "reasoning": "string (why this is the best choice)"
  }
}`;
}

/**
 * Content summarization prompt
 */
export function buildSummarizePrompt(params: SummarizeContentParams): string {
  const formatInstruction = getSummaryFormatInstruction(params.format);
  const lengthGuidance = getLengthGuidance('summary', params.length);

  return `Summarize the following content:

CONTENT TO SUMMARIZE:
${params.content}

LENGTH: ${lengthGuidance}

FORMAT:
${formatInstruction}

${params.focus ? `FOCUS AREA: Emphasize information related to: ${params.focus}` : 'FOCUS: Capture the most important overall points'}

Return ONLY a valid JSON object with this exact structure:
{
  "summary": "string (the formatted summary)",
  "key_points": ["array", "of", "key", "takeaways"],
  "original_word_count": number,
  "summary_word_count": number
}`;
}

/**
 * Content expansion prompt
 */
export function buildExpandPrompt(params: ExpandContentParams): string {
  const toneInstruction = TONE_INSTRUCTIONS[params.tone];
  const formatInstruction = getExpandFormatInstruction(params.target_format);
  const lengthGuidance = getLengthGuidance('expand', params.target_length);

  return `Expand the following brief content into a comprehensive ${params.target_format}:

BRIEF CONTENT:
${params.brief_content}

TARGET FORMAT:
${formatInstruction}

TONE REQUIREMENTS:
${toneInstruction}

LENGTH: ${lengthGuidance}

REQUIREMENTS:
${params.add_examples !== false ? '- Include relevant examples to illustrate points' : ''}
- Add depth, context, and supporting details
- Maintain coherence and logical flow
- Develop ideas thoroughly while staying focused

Return ONLY a valid JSON object with this exact structure:
{
  "expanded_content": "string",
  "word_count": number,
  "structure": "string (description of how the content is organized)"
}`;
}

/**
 * Helper functions for context-specific instructions
 */

function getEmailPurposeContext(purpose: EmailPurpose): string {
  const contexts: Record<EmailPurpose, string> = {
    newsletter: 'This is a newsletter email. Focus on value delivery, interesting updates, and maintaining subscriber engagement. Include clear sections and scannable content.',
    announcement: 'This is an announcement email. Lead with the news clearly, explain impact/benefits, and include next steps if applicable.',
    promotion: 'This is a promotional email. Highlight benefits and value proposition. Create urgency and include a strong call-to-action.',
    transactional: 'This is a transactional email. Be clear, concise, and informative. Provide all necessary details and next steps.',
    cold_outreach: 'This is cold outreach. Personalize, demonstrate research, lead with value for recipient. Be respectful of their time.',
    follow_up: 'This is a follow-up email. Reference previous interaction, add new value, and make next steps clear and easy.',
  };
  return contexts[purpose];
}

function getPlatformContext(platform: SocialPlatform) {
  const contexts = {
    linkedin: {
      guidance: 'Professional network. Focus on industry insights, professional value, thought leadership. Longer-form acceptable.',
      defaultMaxLength: 3000,
      hashtagCount: '3-5 relevant professional hashtags',
    },
    twitter: {
      guidance: 'Fast-paced, concise. Lead with impact, make every word count. Conversational and engaging.',
      defaultMaxLength: 280,
      hashtagCount: '1-2 highly relevant hashtags',
    },
    facebook: {
      guidance: 'Community-focused. Encourage engagement, foster discussion. More personal and relatable.',
      defaultMaxLength: 500,
      hashtagCount: '2-4 hashtags',
    },
    instagram: {
      guidance: 'Visual-first platform. Create compelling narrative that complements imagery. Authentic and engaging.',
      defaultMaxLength: 2200,
      hashtagCount: '5-10 relevant hashtags',
    },
  };
  return contexts[platform];
}

function getRewriteGoalInstruction(goal: RewriteGoal): string {
  const instructions: Record<RewriteGoal, string> = {
    improve_clarity: 'Make the content clearer and easier to understand. Remove ambiguity, simplify complex sentences, improve structure.',
    shorten: 'Reduce length while preserving key information. Remove redundancy, tighten language, focus on essentials.',
    lengthen: 'Expand the content with additional detail, examples, and context. Develop ideas more thoroughly.',
    simplify: 'Make the content more accessible. Use simpler words, shorter sentences, clearer explanations.',
    professionalize: 'Elevate the tone to be more professional and polished. Remove casual language, improve formality.',
    casualize: 'Make the tone more relaxed and approachable. Use conversational language, contractions, natural voice.',
    fix_grammar: 'Correct grammatical errors, improve sentence structure, fix punctuation and spelling while maintaining voice.',
  };
  return instructions[goal];
}

function getHeadlineStyleInstruction(style: HeadlineStyle): string {
  const instructions: Record<HeadlineStyle, string> = {
    clickworthy: 'Create curiosity and emotional appeal. Use power words, create information gap, promise value. Balance intrigue with honesty.',
    professional: 'Clear, direct, authoritative. Focus on credibility and value. Suitable for business and professional contexts.',
    seo_optimized: 'Include target keywords naturally. Front-load important terms. Clear benefit or topic. Good for search visibility.',
    curiosity_driven: 'Create strong curiosity gap. Promise interesting information. Make readers want to learn more. Use intrigue strategically.',
  };
  return instructions[style];
}

function getSummaryFormatInstruction(format: SummaryFormat): string {
  const instructions: Record<SummaryFormat, string> = {
    paragraph: 'Create a flowing paragraph summary that reads naturally. Connect ideas smoothly.',
    bullet_points: 'Format as clear bullet points. Each point should be concise and standalone.',
    key_takeaways: 'Present as "Key Takeaways" with the most important insights. Action-oriented where applicable.',
  };
  return instructions[format];
}

function getExpandFormatInstruction(format: ExpandFormat): string {
  const instructions: Record<ExpandFormat, string> = {
    paragraph: 'Expand into well-structured paragraphs with smooth transitions. Develop ideas cohesively.',
    article: 'Create a full article with introduction, body sections with headings, and conclusion. Journalistic structure.',
    script: 'Expand into a script format with clear speaking points, transitions, and natural dialogue flow.',
    outline: 'Create a detailed outline with main points and sub-points. Hierarchical structure with clear organization.',
  };
  return instructions[format];
}

function getLengthGuidance(type: 'email' | 'blog' | 'summary' | 'expand', length: ContentLength | 'one_sentence'): string {
  if (length === 'one_sentence') {
    return '15-30 words in a single, well-crafted sentence';
  }

  const ranges = {
    email: {
      short: '100-200 words (concise, scannable)',
      medium: '200-400 words (balanced depth and brevity)',
      long: '400-600 words (comprehensive, detailed)',
    },
    blog: {
      short: '500-800 words (quick read, focused topic)',
      medium: '800-1500 words (standard blog post length)',
      long: '1500-2500 words (comprehensive, authoritative)',
    },
    summary: {
      short: '50-100 words (brief overview)',
      medium: '100-200 words (balanced summary)',
      long: '200-300 words (detailed summary)',
    },
    expand: {
      short: '200-400 words (modest expansion)',
      medium: '400-800 words (substantial development)',
      long: '800-1500 words (comprehensive expansion)',
    },
  };

  return ranges[type][length as ContentLength];
}

/**
 * KB Article generation prompt
 */
export function buildKBArticlePrompt(params: GenerateKBArticleParams): string {
  const formatInstruction = getKBArticleFormatInstruction(params.format || 'faq');

  return `Create a knowledge base article to answer this question: ${params.question}

${params.context ? `ADDITIONAL CONTEXT:\n${params.context}\n` : ''}
ARTICLE FORMAT: ${params.format || 'faq'}

FORMAT REQUIREMENTS:
${formatInstruction}

CONTENT REQUIREMENTS:
- Provide a clear, comprehensive answer
- Use practical examples where helpful
- Structure content for easy scanning
- Include step-by-step instructions if applicable
- Aim for 300-500 words
- Use Markdown formatting for the content

Return ONLY a valid JSON object with this exact structure:
{
  "articleId": "string (generate a UUID)",
  "title": "string (clear, descriptive title derived from the question)",
  "content": "string (full article in Markdown format)",
  "format": "string (${params.format || 'faq'})",
  "wordCount": number (actual word count of the content),
  "readingTime": number (estimate at 200 words/min, rounded up)
}`;
}

function getKBArticleFormatInstruction(format: KBArticleFormat): string {
  const instructions: Record<KBArticleFormat, string> = {
    faq: 'Create a FAQ-style article with a clear question as the title and a comprehensive answer. Include related common questions if relevant.',
    howto: 'Create a how-to guide with step-by-step instructions. Use numbered steps, clear headings, and provide explanations for each step.',
    troubleshooting: 'Create a troubleshooting guide that identifies the problem, explains possible causes, and provides solutions in order of likelihood. Include a "What to try" section.',
  };
  return instructions[format];
}
