/**
 * Test script to verify the enhanced parseAIResponse handles markdown fences
 */

// Simulate the parseAIResponse function
function parseAIResponse(responseText: string): { subject: string; emailBody: string; proposedTerms: string[] } {
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
    console.error('Failed to parse AI response as JSON', { error, responseText: cleanedText });

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

// Test cases
console.log('\n' + '='.repeat(80));
console.log('PARSER TEST - Testing markdown fence handling');
console.log('='.repeat(80) + '\n');

// Test 1: JSON with ```json fence
console.log('Test 1: JSON with ```json fence');
console.log('-'.repeat(80));
const test1 = `Here's the partnership pitch:

\`\`\`json
{
  "subject": "Partnership Opportunity: WebDesign Co + Hosting Solutions",
  "emailBody": "Hi there,\\n\\nI'd love to collaborate...",
  "proposedTerms": ["Cross-referral agreement", "Co-marketing campaigns"]
}
\`\`\`

Let me know if you need changes!`;

try {
  const result1 = parseAIResponse(test1);
  console.log('✅ SUCCESS');
  console.log('Subject:', result1.subject);
  console.log('Email Body:', result1.emailBody.substring(0, 50) + '...');
  console.log('Terms:', result1.proposedTerms.length);
} catch (error) {
  console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
}
console.log('');

// Test 2: JSON with ``` fence (no json specifier)
console.log('Test 2: JSON with ``` fence (no json specifier)');
console.log('-'.repeat(80));
const test2 = `\`\`\`
{
  "subject": "Let's Partner Up!",
  "emailBody": "Great opportunity here...",
  "proposedTerms": ["Referral program", "Joint webinars"]
}
\`\`\``;

try {
  const result2 = parseAIResponse(test2);
  console.log('✅ SUCCESS');
  console.log('Subject:', result2.subject);
  console.log('Email Body:', result2.emailBody.substring(0, 50) + '...');
  console.log('Terms:', result2.proposedTerms.length);
} catch (error) {
  console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
}
console.log('');

// Test 3: Raw JSON (no fence)
console.log('Test 3: Raw JSON (no fence)');
console.log('-'.repeat(80));
const test3 = `{
  "subject": "Partnership Proposal",
  "emailBody": "I noticed your company...",
  "proposedTerms": ["Commission structure", "Marketing support"]
}`;

try {
  const result3 = parseAIResponse(test3);
  console.log('✅ SUCCESS');
  console.log('Subject:', result3.subject);
  console.log('Email Body:', result3.emailBody.substring(0, 50) + '...');
  console.log('Terms:', result3.proposedTerms.length);
} catch (error) {
  console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
}
console.log('');

// Test 4: Text format (fallback parser)
console.log('Test 4: Text format (fallback parser)');
console.log('-'.repeat(80));
const test4 = `Subject: Collaboration Opportunity

Body: I'm reaching out to explore a potential partnership between our companies.

Proposed Terms:
- Revenue sharing model
- Co-branded content
- Quarterly business reviews`;

try {
  const result4 = parseAIResponse(test4);
  console.log('✅ SUCCESS');
  console.log('Subject:', result4.subject);
  console.log('Email Body:', result4.emailBody.substring(0, 50) + '...');
  console.log('Terms:', result4.proposedTerms.length);
} catch (error) {
  console.log('❌ FAILED:', error instanceof Error ? error.message : String(error));
}
console.log('');

console.log('='.repeat(80));
console.log('PARSER TESTS COMPLETED');
console.log('='.repeat(80) + '\n');
