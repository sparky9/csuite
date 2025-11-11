/**
 * Template variable substitution engine
 * Handles basic {{variable}} replacements without AI
 */

import type { ProspectData, CompanyData } from '../types/email.types.js';

/**
 * Substitute variables in template
 */
export function substituteVariables(
  template: string,
  prospect?: ProspectData,
  company?: CompanyData,
  customVars?: Record<string, string>
): string {
  let output = template;

  // Prospect variables
  if (prospect) {
    const prospectVars: Record<string, string> = {
      '{{name}}': prospect.name || '',
      '{{first_name}}': prospect.name?.split(' ')[0] || '',
      '{{last_name}}': prospect.name?.split(' ').slice(1).join(' ') || '',
      '{{email}}': prospect.email || '',
      '{{company}}': prospect.company_name || '',
      '{{company_name}}': prospect.company_name || '',
      '{{job_title}}': prospect.job_title || '',
      '{{title}}': prospect.job_title || '',
      '{{industry}}': prospect.industry || '',
      '{{location}}': prospect.location || '',
      '{{phone}}': prospect.phone || '',
      '{{linkedin}}': prospect.linkedin_url || '',
      '{{company_size}}': prospect.company_size || '',
    };

    for (const [variable, value] of Object.entries(prospectVars)) {
      output = output.replace(new RegExp(variable, 'gi'), value);
    }
  }

  // Company variables
  if (company) {
    const companyVars: Record<string, string> = {
      '{{our_company}}': company.name || '',
      '{{our_website}}': company.website || '',
      '{{our_industry}}': company.industry || '',
    };

    for (const [variable, value] of Object.entries(companyVars)) {
      output = output.replace(new RegExp(variable, 'gi'), value);
    }
  }

  // Custom variables
  if (customVars) {
    for (const [key, value] of Object.entries(customVars)) {
      const variable = key.startsWith('{{') ? key : `{{${key}}}`;
      output = output.replace(new RegExp(variable, 'gi'), value);
    }
  }

  return output;
}

/**
 * Extract variables from template
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    const variable = match[1].trim();
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }

  return variables;
}

/**
 * Validate template has all required variables filled
 */
export function validateTemplate(template: string): {
  valid: boolean;
  missing_variables: string[];
} {
  const variables = extractVariables(template);
  const requiredVars = ['name', 'email', 'company'];

  const missingRequired = requiredVars.filter((req) =>
    variables.some((v) => v.toLowerCase().includes(req))
  );

  return {
    valid: missingRequired.length === 0,
    missing_variables: variables,
  };
}

/**
 * Build default template
 */
export function getDefaultTemplate(category: string): {
  subject: string;
  body: string;
} {
  const templates: Record<
    string,
    {
      subject: string;
      body: string;
    }
  > = {
    introduction: {
      subject: 'Quick question about {{company}}',
      body: `Hi {{first_name}},

I noticed that {{company}} is {{industry}}-focused, and I thought you might be interested in how we help companies like yours improve their operations.

Would you be open to a quick 15-minute call to discuss?

Best regards`,
    },
    follow_up: {
      subject: 'Following up - {{company}}',
      body: `Hi {{first_name}},

I wanted to follow up on my previous email about helping {{company}} with [value proposition].

Are you available for a brief call this week?

Thanks,`,
    },
    value_proposition: {
      subject: 'Help {{company}} achieve [specific goal]',
      body: `Hi {{first_name}},

I work with {{industry}} companies to help them [specific benefit]. I noticed {{company}} might benefit from this approach.

Would you like to see how this could work for your team?

Best,`,
    },
  };

  return (
    templates[category] || {
      subject: 'Reaching out about {{company}}',
      body: `Hi {{first_name}},\n\n[Your message here]\n\nBest regards,`,
    }
  );
}
