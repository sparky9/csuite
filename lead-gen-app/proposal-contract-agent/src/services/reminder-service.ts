import { contractService } from './contract-service.js';
import { withTransaction } from '../db/client.js';
import type { Contract, SignatureContact } from '../types/entities.js';

interface ReminderPayload {
  contractId: string;
  contactId?: string;
  reminderType?: 'first' | 'second' | 'final';
  tone?: 'professional' | 'friendly' | 'firm';
}

interface ReminderResult {
  memo: string;
  contract: Contract;
  targetedContacts: SignatureContact[];
}

const tonePhrasing = {
  professional: {
    opener: 'This is a courteous reminder that your signature is still pending.',
    closer: 'Please let us know if you have any questions or if we can adjust anything before signing.',
  },
  friendly: {
    opener: 'Just checking in on the contract signature—once that is in, we can get moving right away.',
    closer: 'Appreciate you taking a moment to wrap this up. I’m here if you need anything at all.',
  },
  firm: {
    opener: 'This is a final reminder that your signature is outstanding and required to move forward.',
    closer: 'If we do not see the signature by the stated deadline, we will need to revisit the project timeline.',
  },
} as const;

export class ReminderService {
  async generateReminder(payload: ReminderPayload): Promise<ReminderResult> {
    const contract = await contractService.getContractById(payload.contractId);
    if (!contract) {
      throw new Error('Contract not found for reminder.');
    }

    const outstandingContacts = contract.contacts.filter((contact) => !contact.signedAt);
    if (outstandingContacts.length === 0) {
      throw new Error('All signers have already completed the contract.');
    }

    let targetedContacts = outstandingContacts;
    if (payload.contactId) {
      targetedContacts = outstandingContacts.filter((contact) => contact.id === payload.contactId);
      if (targetedContacts.length === 0) {
        throw new Error('Specified contact has already signed or does not exist.');
      }
    }

    await this.recordReminder(contract.id, targetedContacts, payload.reminderType);

    const memo = this.composeReminderMemo(contract, targetedContacts, payload);

    return {
      memo,
      contract,
      targetedContacts,
    };
  }

  private async recordReminder(contractId: string, contacts: SignatureContact[], reminderType?: string): Promise<void> {
    if (contacts.length === 0) {
      return;
    }

    const contactIds = contacts.map((contact) => contact.id);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE signature_contacts
         SET reminder_count = reminder_count + 1, updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [contactIds]
      );

      const description = `Reminder sent to ${contacts.length} recipient${contacts.length === 1 ? '' : 's'}`;

      await client.query(
        `INSERT INTO signature_events (contract_id, event_type, description, payload)
         VALUES ($1, 'reminder', $2, jsonb_build_object('contact_ids', $3::jsonb, 'reminder_type', $4::text))`,
        [contractId, description, JSON.stringify(contactIds), reminderType ?? null]
      );
    });
  }

  private composeReminderMemo(
    contract: Contract,
    contacts: SignatureContact[],
    payload: ReminderPayload
  ): string {
    const tone = payload.tone ?? 'professional';
    const phrasing = tonePhrasing[tone];
    const greeting = contacts.length === 1 ? `Hi ${contacts[0].fullName},` : 'Hi team,';
    const subject = `Reminder: ${contract.contractNumber} awaiting signature`;
    const deadlineText = contract.signatureDeadline
      ? `The signature deadline is ${contract.signatureDeadline}.`
      : 'There is no formal deadline recorded, but we would love to keep momentum on this engagement.';
    const signatureUrl = typeof contract.envelopeMetadata?.signature_url === 'string'
      ? contract.envelopeMetadata.signature_url as string
      : undefined;

    const contactSummary = contacts
      .map((contact) => `- ${contact.fullName} (${contact.role})`)
      .join('\n');

    const reminderLabel = payload.reminderType ? `${payload.reminderType} reminder` : 'signature reminder';

    const signatureLine = signatureUrl
      ? `Please sign here: ${signatureUrl}`
      : 'Please use the latest e-signature link you received to complete the process.';

    return `Subject: ${subject}

${greeting}

${phrasing.opener}

${signatureLine}

${deadlineText}

Outstanding signer(s):
${contactSummary}

This memo logs the ${reminderLabel} for contract ${contract.contractNumber}.

${phrasing.closer}
`;
  }
}

export const reminderService = new ReminderService();
