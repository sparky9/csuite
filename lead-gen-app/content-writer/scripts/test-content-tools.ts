#!/usr/bin/env tsx

/**
 * Content Writer MCP Tools Tester
 *
 * Manual testing script for all 7 content generation tools.
 * Run to verify each tool works correctly before deployment.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Import tool handlers
import {
  handleGenerateEmail,
  handleGenerateBlog,
  handleGenerateSocial,
  handleRewriteContent,
  handleGenerateHeadlines,
  handleSummarizeContent,
  handleExpandContent,
  handleGenerateKBArticle,
  handleSaveBrandVoice,
  handleListContentTemplates,
} from '../src/tools/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Test helper functions
 */
function log(testName: string, status: 'START' | 'PASS' | 'FAIL', message?: string) {
  const timestamp = new Date().toISOString().substring(11, 23);
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[34m';
  const reset = '\x1b[0m';
  console.log(`${timestamp} ${color}[${status}]${reset} ${testName}${message ? ': ' + message : ''}`);
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function logResult(testName: string, result: any) {
  if (result?.content?.[0]?.text) {
    const resultData = JSON.parse(result.content[0].text);
    if (resultData.success) {
      console.log(`  ✓ Tool executed successfully`);

      // Log key results
      if (resultData.email) {
        console.log(`    Email: "${resultData.email.subject_line?.substring(0, 50)}..."`);
      } else if (resultData.blog) {
        console.log(`    Blog: "${resultData.blog.title?.substring(0, 50)}..." (${resultData.blog.word_count} words)`);
      } else if (resultData.post) {
        console.log(`    Post: "${resultData.post.post_text?.substring(0, 50)}..." (${resultData.post.character_count} chars)`);
      } else if (resultData.rewrite) {
        console.log(`    Rewrite: ${resultData.rewrite.original_word_count} → ${resultData.rewrite.new_word_count} words`);
      } else if (resultData.headlines) {
        console.log(`    Headlines: Generated ${resultData.headlines.headlines?.length || 0} variations`);
      } else if (resultData.summary) {
        console.log(`    Summary: ${resultData.summary.original_word_count} → ${resultData.summary.summary_word_count} words`);
      } else if (resultData.expansion) {
        console.log(`    Expansion: ${resultData.expansion.word_count} words (${resultData.expansion.expansion_ratio?.toFixed(1)}x)`);
      } else if (resultData.article) {
        console.log(`    KB Article: "${resultData.article.title?.substring(0, 50)}..." (${resultData.article.wordCount} words, ${resultData.article.readingTime} min)`);
      } else if (resultData.brandVoice) {
        console.log(`    Brand Voice: "${resultData.brandVoice.voiceName}" (${resultData.brandVoice.tone}) - ID: ${resultData.brandVoice.voiceProfileId}`);
      } else if (resultData.templates) {
        console.log(`    Templates: Found ${resultData.templates.length} templates`);
      }

      if (resultData.metadata) {
        console.log(`    Duration: ${resultData.metadata.generation_time_ms}ms`);
      }
    } else {
      console.log(`  ✗ Tool failed: ${resultData.error}`);
    }
  } else {
    console.log(`  ✗ Unexpected result format:`, result);
  }
}

function validateKBArticleSchema(result: any) {
  const resultData = JSON.parse(result.content[0].text);
  assert(resultData.success === true, 'result should be successful');
  assert(resultData.article !== undefined, 'article should exist');

  const article = resultData.article;
  assert(typeof article.articleId === 'string', 'articleId should be string');
  assert(article.articleId.length > 0, 'articleId should not be empty');
  assert(typeof article.title === 'string', 'title should be string');
  assert(article.title.length > 0, 'title should not be empty');
  assert(typeof article.content === 'string', 'content should be string');
  assert(article.content.length > 0, 'content should not be empty');
  assert(typeof article.wordCount === 'number', 'wordCount should be number');
  assert(!isNaN(article.wordCount), 'wordCount should not be NaN');
  assert(article.wordCount > 0, 'wordCount should be positive');
  assert(typeof article.readingTime === 'number', 'readingTime should be number');
  assert(!isNaN(article.readingTime), 'readingTime should not be NaN');
  assert(article.readingTime > 0, 'readingTime should be positive');
  assert(article.readingTime >= 1, 'readingTime should be at least 1 minute');

  console.log(`    ✓ Schema validation passed`);
}

function validateBrandVoiceSchema(result: any, expectedClientId: string) {
  const resultData = JSON.parse(result.content[0].text);
  assert(resultData.success === true, 'result should be successful');
  assert(resultData.brandVoice !== undefined, 'brandVoice should exist');

  const brandVoice = resultData.brandVoice;
  assert(typeof brandVoice.voiceProfileId === 'string', 'voiceProfileId should be string');
  assert(brandVoice.voiceProfileId.length > 0, 'voiceProfileId should not be empty');
  assert(brandVoice.clientId === expectedClientId, `clientId should match expected: ${expectedClientId}`);
  assert(brandVoice.created === true, 'created should be true');
  assert(typeof brandVoice.voiceName === 'string', 'voiceName should be string');
  assert(typeof brandVoice.tone === 'string', 'tone should be string');

  console.log(`    ✓ Schema validation passed`);
}

function validateTemplatesSchema(result: any, expectedType?: string) {
  const resultData = JSON.parse(result.content[0].text);
  assert(resultData.success === true, 'result should be successful');
  assert(resultData.templates !== undefined, 'templates should exist');
  assert(Array.isArray(resultData.templates), 'templates should be array');
  assert(resultData.templates.length > 0, 'should have at least one template');

  const template = resultData.templates[0];
  assert(typeof template.id === 'string', 'template id should be string');
  assert(typeof template.name === 'string', 'template name should be string');
  assert(typeof template.type === 'string', 'template type should be string');
  assert(Array.isArray(template.variables), 'variables should be array');
  assert(typeof template.usageCount === 'number', 'usageCount should be number');

  if (expectedType) {
    assert(
      resultData.templates.every((t: any) => t.type === expectedType),
      `all templates should have type: ${expectedType}`
    );
  }

  console.log(`    ✓ Schema validation passed (${resultData.templates.length} templates)`);
}

/**
 * Test cases for each tool
 */
const testCases = [
  {
    name: 'Generate Email (Cold Outreach)',
    tool: handleGenerateEmail,
    params: {
      purpose: 'cold_outreach',
      audience: 'Small business owners in HVAC industry',
      topic: 'Professional HVAC maintenance services',
      key_points: [
        'Comprehensive maintenance packages',
        'Certified technicians',
        'Flexible scheduling',
        'Competitive pricing'
      ],
      tone: 'professional',
      length: 'medium',
      call_to_action: 'Schedule a free consultation'
    }
  },

  {
    name: 'Generate Email (Newsletter)',
    tool: handleGenerateEmail,
    params: {
      purpose: 'newsletter',
      audience: 'Existing service customers',
      topic: 'Seasonal maintenance tips',
      key_points: [
        'Prepare for winter heating season',
        'Save money with regular maintenance',
        'Prevent costly repairs',
        'Service specials this month'
      ],
      tone: 'friendly',
      length: 'short'
    }
  },

  {
    name: 'Generate Blog Post (Medium Length)',
    tool: handleGenerateBlog,
    params: {
      topic: 'The Future of AI in Content Marketing',
      keywords: ['AI content marketing', 'automated writing', 'content strategy', 'SEO optimization'],
      audience: 'Content marketers and marketing managers',
      tone: 'professional',
      length: 'medium',
      include_intro: true,
      include_conclusion: true
    }
  },

  {
    name: 'Generate Social Post (LinkedIn)',
    tool: handleGenerateSocial,
    params: {
      platform: 'linkedin',
      topic: 'Digital transformation in B2B sales',
      message: 'How AI tools are revolutionizing the way sales teams connect with prospects',
      tone: 'professional',
      include_hashtags: true,
      call_to_action: 'Share your experience in comments'
    }
  },

  {
    name: 'Generate Social Post (Twitter)',
    tool: handleGenerateSocial,
    params: {
      platform: 'twitter',
      topic: 'Quick content marketing tip',
      message: 'AI-generated content works best when it starts with human insight',
      tone: 'casual',
      include_hashtags: true,
      include_emojis: true
    }
  },

  {
    name: 'Rewrite Content (Improve Clarity)',
    tool: handleRewriteContent,
    params: {
      content: 'Our company helps businesses generate more leads using advanced AI technology. The software is really good at finding prospects and creating marketing content automatically.',
      goal: 'improve_clarity',
      tone: 'professional',
      preserve_meaning: true
    }
  },

  {
    name: 'Rewrite Content (Casualize)',
    tool: handleRewriteContent,
    params: {
      content: 'Pursuant to our organizational objectives, we have implemented a comprehensive strategic initiative focused on optimizing operational efficiency and enhancing customer value proposition.',
      goal: 'casualize',
      preserve_meaning: true
    }
  },

  {
    name: 'Generate Headlines (SEO Optimized)',
    tool: handleGenerateHeadlines,
    params: {
      topic: 'How to Choose the Best CRM Software for Small Businesses',
      content_type: 'blog',
      style: 'seo_optimized',
      count: 3,
      include_numbers: false
    }
  },

  {
    name: 'Generate Headlines (Clickworthy)',
    tool: handleGenerateHeadlines,
    params: {
      topic: 'Hidden Productivity Hacks That Actually Work',
      content_type: 'blog',
      style: 'clickworthy',
      count: 3,
      include_numbers: true
    }
  },

  {
    name: 'Summarize Content (Medium Length)',
    tool: handleSummarizeContent,
    params: {
      content: `Technology continues to reshape the business landscape at an unprecedented pace. From artificial intelligence to automation tools, companies that embrace innovation are finding themselves ahead of the competition.

      The key to successful technology adoption lies not just in choosing the right tools, but in understanding how they integrate with existing processes. Many organizations struggle with implementation because they fail to consider the human element - how teams will adapt and use these new capabilities.

      Forward-thinking companies are investing in training and change management alongside technology investment. They recognize that technology is an enabler, not a replacement for human insight and expertise.

      Looking ahead, the companies that thrive will be those that use technology to augment human capabilities, not replace them. The future belongs to organizations that can balance technological innovation with human-centered approaches.`,
      length: 'medium',
      format: 'paragraph',
      focus: 'technology adoption strategies'
    }
  },

  {
    name: 'Summarize Content (Key Takeaways)',
    tool: handleSummarizeContent,
    params: {
      content: `Seven proven strategies for business growth:

      1. Focus on customer retention before acquisition - it's cheaper and more profitable.
      2. Build systems and processes that scale with your business.
      3. Invest in people and culture as much as products.
      4. Use data-driven decision making, not intuition alone.
      5. Create multiple revenue streams to reduce risk.
      6. Embrace continuous learning and adaptation.
      7. Build strong partnerships and networks.

      These strategies work across industries and company sizes.`,
      length: 'short',
      format: 'key_takeaways'
    }
  },

  {
    name: 'Expand Content (Short to Medium)',
    tool: handleExpandContent,
    params: {
      brief_content: 'AI marketing tools: content creation, email automation, prospect generation',
      target_format: 'article',
      target_length: 'medium',
      tone: 'professional',
      add_examples: true
    }
  },

  {
    name: 'Expand Content (Notes to Outline)',
    tool: handleExpandContent,
    params: {
      brief_content: 'Website optimization: speed, mobile responsive, SEO basics, user experience',
      target_format: 'outline',
      target_length: 'short',
      tone: 'technical'
    }
  },

  // Enhancement #4: New Tools Tests

  {
    name: 'Generate KB Article (FAQ Format)',
    tool: handleGenerateKBArticle,
    params: {
      user_id: 'test-user-123',
      question: 'How do I reset my password?',
      context: 'Our application uses email-based password reset with a secure token link',
      format: 'faq'
    },
    validate: (result: any) => validateKBArticleSchema(result)
  },

  {
    name: 'Generate KB Article (How-To Format)',
    tool: handleGenerateKBArticle,
    params: {
      user_id: 'test-user-123',
      question: 'How do I export my data?',
      context: 'Users can export data in CSV or JSON format from the dashboard',
      format: 'howto'
    },
    validate: (result: any) => validateKBArticleSchema(result)
  },

  {
    name: 'Save Brand Voice (Professional Tone)',
    tool: handleSaveBrandVoice,
    params: {
      user_id: 'test-user-123',
      client_id: 'test-client-456',
      voice_name: 'Test Brand Voice Professional',
      tone: 'professional',
      vocabulary_preferences: ['innovative', 'cutting-edge', 'solutions'],
      avoid_words: ['cheap', 'budget', 'discount']
    },
    validate: (result: any) => validateBrandVoiceSchema(result, 'test-client-456')
  },

  {
    name: 'Save Brand Voice (Casual Tone)',
    tool: handleSaveBrandVoice,
    params: {
      user_id: 'test-user-123',
      client_id: 'test-client-789',
      voice_name: 'Test Brand Voice Casual',
      tone: 'casual',
      vocabulary_preferences: ['awesome', 'easy', 'simple'],
      avoid_words: ['difficult', 'complex']
    },
    validate: (result: any) => validateBrandVoiceSchema(result, 'test-client-789')
  },

  {
    name: 'List Content Templates (All)',
    tool: handleListContentTemplates,
    params: {
      user_id: 'test-user-123'
    },
    validate: (result: any) => validateTemplatesSchema(result)
  },

  {
    name: 'List Content Templates (Email Only)',
    tool: handleListContentTemplates,
    params: {
      user_id: 'test-user-123',
      template_type: 'email'
    },
    validate: (result: any) => validateTemplatesSchema(result, 'email')
  },

  {
    name: 'List Content Templates (Social Only)',
    tool: handleListContentTemplates,
    params: {
      user_id: 'test-user-123',
      template_type: 'social'
    },
    validate: (result: any) => validateTemplatesSchema(result, 'social')
  },
];

/**
 * Run tests
 */
async function runTests() {
  console.log('🚀 Content Writer MCP Tools Tester\n');
  console.log('='.repeat(50));

  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    log(testCase.name, 'START');

    try {
      const result = await testCase.tool(testCase.params);
      logResult(testCase.name, result);

      // Run validation if provided
      if (testCase.validate) {
        testCase.validate(result);
      }

      log(testCase.name, 'PASS');
      passCount++;
    } catch (error: any) {
      log(testCase.name, 'FAIL', error.message);
      failCount++;
    }

    console.log(); // Blank line between tests
  }

  // Summary
  console.log('='.repeat(50));
  console.log(`📊 Test Results: ${passCount} passed, ${failCount} failed`);
  console.log(`Total: ${passCount + failCount} tests`);

  if (failCount === 0) {
    console.log('🎉 All tests passed! Ready for deployment.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above.');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check for .env file
  const envPath = join(__dirname, '..', '.env');
  try {
    await readFile(envPath);
    console.log('✓ Found .env file with ANTHROPIC_API_KEY');
  } catch {
    console.error('✗ Missing .env file. Please create .env with ANTHROPIC_API_KEY');
    process.exit(1);
  }

  runTests().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}
