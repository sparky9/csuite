import { initializeProposalContractDb, getDbPool, shutdownProposalContractDb } from '../src/db/client.js';

const SMOKE_TEMPLATE_PREFIX = 'Integration Smoke Template';
const SMOKE_TEMPLATE_CATEGORY = 'smoke_test';
const SMOKE_PROPOSAL_SUMMARY = 'Automated smoke test proposal for integration validation.';
const SMOKE_SIGNATURE_URL = 'https://example.com/sign/contract';

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

async function cleanupSmokeData(): Promise<void> {
  await initializeProposalContractDb();
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const templateQuery = await client.query<{ id: string }>(
      `SELECT id FROM proposal_templates WHERE name LIKE $1 OR category = $2`,
      [`${SMOKE_TEMPLATE_PREFIX}%`, SMOKE_TEMPLATE_CATEGORY]
    );
    const templateIds = templateQuery.rows.map((row) => row.id);

    const proposalIdSet = new Set<string>();

    const proposalBySummary = await client.query<{ id: string }>(
      `SELECT id FROM proposals WHERE summary = $1`,
      [SMOKE_PROPOSAL_SUMMARY]
    );
    proposalBySummary.rows.forEach((row) => proposalIdSet.add(row.id));

    if (templateIds.length > 0) {
      const proposalByTemplate = await client.query<{ id: string }>(
        `SELECT id FROM proposals WHERE template_id = ANY($1::uuid[])`,
        [templateIds]
      );
      proposalByTemplate.rows.forEach((row) => proposalIdSet.add(row.id));
    }

    const proposalIds = unique(Array.from(proposalIdSet));
    const contractIdSet = new Set<string>();

    if (proposalIds.length > 0) {
      const contractByProposal = await client.query<{ id: string }>(
        `SELECT id FROM contracts WHERE proposal_id = ANY($1::uuid[])`,
        [proposalIds]
      );
      contractByProposal.rows.forEach((row) => contractIdSet.add(row.id));
    }

    const contractsByUrl = await client.query<{ id: string }>(
      `SELECT id FROM contracts WHERE envelope_metadata->>'signature_url' = $1`,
      [SMOKE_SIGNATURE_URL]
    );
    contractsByUrl.rows.forEach((row) => contractIdSet.add(row.id));

    const contractIds = unique(Array.from(contractIdSet));

    const results = {
      signatureEvents: 0,
      signatureAuditLog: 0,
      signatureTokens: 0,
      signatureVerifications: 0,
      signatureData: 0,
      signatureDocuments: 0,
      signatureContacts: 0,
      contracts: 0,
      proposalLineItems: 0,
      proposalAttachments: 0,
      proposals: 0,
      templates: 0,
    };

    if (contractIds.length > 0) {
      const signatureContacts = await client.query<{ id: string }>(
        `SELECT id FROM signature_contacts WHERE contract_id = ANY($1::uuid[])`,
        [contractIds]
      );
      const contactIds = unique(signatureContacts.rows.map((row) => row.id));

      const deleteAudit = await client.query(
        `DELETE FROM signature_audit_log WHERE contract_id = ANY($1::uuid[])`,
        [contractIds]
      );
      results.signatureAuditLog = deleteAudit.rowCount ?? 0;

      const deleteDocuments = await client.query(
        `DELETE FROM contract_documents WHERE contract_id = ANY($1::uuid[])`,
        [contractIds]
      );
      results.signatureDocuments = deleteDocuments.rowCount ?? 0;

      const deleteTokensByContract = await client.query(
        `DELETE FROM signature_tokens WHERE contract_id = ANY($1::uuid[])`,
        [contractIds]
      );
      results.signatureTokens += deleteTokensByContract.rowCount ?? 0;

      if (contactIds.length > 0) {
        const deleteTokens = await client.query(
          `DELETE FROM signature_tokens WHERE contact_id = ANY($1::uuid[])`,
          [contactIds]
        );
        results.signatureTokens += deleteTokens.rowCount ?? 0;

        const deleteVerifications = await client.query(
          `DELETE FROM signature_verifications WHERE contact_id = ANY($1::uuid[])`,
          [contactIds]
        );
        results.signatureVerifications = deleteVerifications.rowCount ?? 0;

        const deleteSignatureData = await client.query(
          `DELETE FROM signature_data WHERE contact_id = ANY($1::uuid[])`,
          [contactIds]
        );
        results.signatureData = deleteSignatureData.rowCount ?? 0;
      }

      const deleteEvents = await client.query(
        `DELETE FROM signature_events WHERE contract_id = ANY($1::uuid[])`,
        [contractIds]
      );
      results.signatureEvents = deleteEvents.rowCount ?? 0;

      const deleteContacts = await client.query(
        `DELETE FROM signature_contacts WHERE contract_id = ANY($1::uuid[])`,
        [contractIds]
      );
      results.signatureContacts = deleteContacts.rowCount ?? 0;

      const deleteContracts = await client.query(
        `DELETE FROM contracts WHERE id = ANY($1::uuid[])`,
        [contractIds]
      );
      results.contracts = deleteContracts.rowCount ?? 0;
    }

    if (proposalIds.length > 0) {
      const deleteAttachments = await client.query(
        `DELETE FROM proposal_attachments WHERE proposal_id = ANY($1::uuid[])`,
        [proposalIds]
      );
      results.proposalAttachments = deleteAttachments.rowCount ?? 0;

      const deleteLineItems = await client.query(
        `DELETE FROM proposal_line_items WHERE proposal_id = ANY($1::uuid[])`,
        [proposalIds]
      );
      results.proposalLineItems = deleteLineItems.rowCount ?? 0;

      const deleteProposals = await client.query(
        `DELETE FROM proposals WHERE id = ANY($1::uuid[])`,
        [proposalIds]
      );
      results.proposals = deleteProposals.rowCount ?? 0;
    }

    if (templateIds.length > 0) {
      const deleteTemplates = await client.query(
        `DELETE FROM proposal_templates WHERE id = ANY($1::uuid[])`,
        [templateIds]
      );
      results.templates = deleteTemplates.rowCount ?? 0;
    }

    await client.query('COMMIT');

    console.log('Smoke data cleanup complete:', results);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Failed to clean smoke test data:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await shutdownProposalContractDb();
  }
}

cleanupSmokeData().catch((error) => {
  console.error('Cleanup script failed:', error);
  process.exitCode = 1;
});
