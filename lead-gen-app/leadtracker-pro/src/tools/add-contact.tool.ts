/**
 * Add Contact Tool
 * Create a new contact for a prospect
 */

import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type { AddContactInput, Contact } from '../types/leadtracker.types.js';

// Zod schema for input validation
const AddContactSchema = z.object({
  prospect_id: z.string().uuid('Invalid prospect ID'),
  full_name: z.string().min(1, 'Contact name is required'),
  title: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  is_primary: z.boolean().optional(),
  prospect_finder_decision_maker_id: z.string().uuid().optional(),
});

export async function addContactTool(args: any, _dbConnected?: boolean, userId?: string) {
  try {
    // Validate input
    const input = AddContactSchema.parse(args) as AddContactInput;

    logger.info('Adding new contact', {
      prospect_id: input.prospect_id,
      contact_name: input.full_name,
      userId,
    });

    // Verify prospect exists (filter by userId if provided)
    const prospectQuery = userId
      ? 'SELECT id, company_name FROM prospects WHERE id = $1 AND user_id = $2'
      : 'SELECT id, company_name FROM prospects WHERE id = $1';
    const prospectParams = userId ? [input.prospect_id, userId] : [input.prospect_id];

    const prospectExists = await db.queryOne(prospectQuery, prospectParams);

    if (!prospectExists) {
      throw new Error(`Prospect not found: ${input.prospect_id}`);
    }

    // If this is primary contact, unset existing primary
    if (input.is_primary) {
      await db.query(
        'UPDATE contacts SET is_primary = FALSE WHERE prospect_id = $1',
        [input.prospect_id]
      );
    }

    // Insert contact (with userId if provided)
    const insertQuery = userId
      ? `INSERT INTO contacts (
        prospect_id, full_name, title, phone, email,
        linkedin_url, is_primary, prospect_finder_decision_maker_id, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`
      : `INSERT INTO contacts (
        prospect_id, full_name, title, phone, email,
        linkedin_url, is_primary, prospect_finder_decision_maker_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`;

    const insertParams = userId
      ? [
          input.prospect_id,
          input.full_name,
          input.title || null,
          input.phone || null,
          input.email || null,
          input.linkedin_url || null,
          input.is_primary || false,
          input.prospect_finder_decision_maker_id || null,
          userId,
        ]
      : [
          input.prospect_id,
          input.full_name,
          input.title || null,
          input.phone || null,
          input.email || null,
          input.linkedin_url || null,
          input.is_primary || false,
          input.prospect_finder_decision_maker_id || null,
        ];

    const contact = await db.queryOne<Contact>(insertQuery, insertParams);

    if (!contact) {
      throw new Error('Failed to create contact');
    }

    logger.info('Contact added successfully', {
      contact_id: contact.id,
      prospect_id: contact.prospect_id,
      contact_name: contact.full_name,
    });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Contact created successfully!

**${contact.full_name}**${contact.title ? ` - ${contact.title}` : ''}
Contact ID: ${contact.id}
Prospect: ${prospectExists.company_name}
${contact.phone ? `Phone: ${contact.phone}` : ''}
${contact.email ? `Email: ${contact.email}` : ''}
${contact.linkedin_url ? `LinkedIn: ${contact.linkedin_url}` : ''}
${contact.is_primary ? '⭐ Primary Contact' : ''}

Added at: ${new Date(contact.created_at).toLocaleString()}`,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to add contact', { error, args });

    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation error: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error adding contact: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
