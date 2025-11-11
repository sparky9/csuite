import { initializeProposalContractDb, shutdownProposalContractDb } from '../src/db/client.js';
import { handleTemplateSave, handleTemplateList } from '../src/tools/template-tools.js';
import { handleProposalGenerate, handleProposalSend, handleProposalStatus } from '../src/tools/proposal-tools.js';
import { handleContractGenerate, handleContractSend, handleContractStatus } from '../src/tools/contract-tools.js';
import { handleSignatureRemind } from '../src/tools/reminder-tools.js';

function divider(title: string): void {
  const line = '='.repeat(72);
  console.log(`\n${line}`);
  console.log(title.toUpperCase());
  console.log(line);
}

function unwrap(result: any): any {
  const payload = result?.content?.[0]?.text;
  if (!payload) {
    return {};
  }
  try {
    return JSON.parse(payload);
  } catch (error) {
    return { raw: payload };
  }
}

async function main(): Promise<void> {
  await initializeProposalContractDb();

  const suffix = Date.now();
  const templateName = `Integration Smoke Template ${suffix}`;

  divider('Save template');
  const savedTemplate = unwrap(
    await handleTemplateSave({
      name: templateName,
      description: 'Smoke test template created by test script',
      category: 'smoke_test',
      body: 'Hello {{client_name}}! Total investment: {{total_value}} {{currency}}.',
      requiredTokens: ['client_name', 'total_value', 'currency'],
      optionalTokens: ['timeline_notes'],
    })
  );
  console.log(savedTemplate);

  divider('List templates');
  const templateList = unwrap(await handleTemplateList({ search: 'smoke test' }));
  console.log({ count: templateList.count, latestNames: templateList.templates?.slice(0, 3)?.map((t: any) => t.name) });

  const templateId = savedTemplate?.template?.id;
  if (!templateId) {
    throw new Error('Template creation failed during smoke test.');
  }

  divider('Generate proposal');
  const proposal = unwrap(
    await handleProposalGenerate({
      templateId,
      client: {
        name: 'Smoke Test Client',
        company: 'Example Co',
        email: 'client@example.com',
      },
      summary: 'Automated smoke test proposal for integration validation.',
      variables: {
        total_value: '2500',
        currency: 'USD',
      },
      lineItems: [
        { description: 'Discovery Workshop', quantity: 1, unitPrice: 500 },
        { description: 'Implementation Sprint', quantity: 2, unitPrice: 1000 },
      ],
    })
  );
  console.log({ proposalNumber: proposal.proposal?.proposalNumber, total: proposal.proposal?.total });

  const proposalId = proposal?.proposal?.id;
  if (!proposalId) {
    throw new Error('Proposal generation failed during smoke test.');
  }

  divider('Send proposal');
  const sentProposal = unwrap(
    await handleProposalSend({ proposalId, note: 'Sent via smoke test harness.' })
  );
  console.log({ status: sentProposal.proposal?.status, sentAt: sentProposal.proposal?.sentAt });

  divider('Proposal status');
  const proposalStatus = unwrap(await handleProposalStatus({ proposalId }));
  console.log({ status: proposalStatus.proposal?.status, lineItems: proposalStatus.proposal?.lineItems?.length });

  divider('Generate contract');
  const contract = unwrap(
    await handleContractGenerate({
      proposalId,
      signatureDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      contacts: [
        {
          role: 'client_signer',
          fullName: 'Smoke Test Client',
          email: 'client@example.com',
        },
      ],
    })
  );
  console.log({ contractNumber: contract.contract?.contractNumber, status: contract.contract?.status });

  const contractId = contract?.contract?.id;
  if (!contractId) {
    throw new Error('Contract generation failed during smoke test.');
  }

  divider('Send contract');
  const sentContract = unwrap(
    await handleContractSend({
      contractId,
      signatureUrl: 'https://example.com/sign/contract',
      contacts: [
        {
          role: 'client_signer',
          fullName: 'Smoke Test Client',
          email: 'client@example.com',
        },
      ],
    })
  );
  console.log({ status: sentContract.contract?.status, sentAt: sentContract.contract?.sentAt });

  divider('Contract status');
  const contractStatus = unwrap(await handleContractStatus({ contractId }));
  console.log({
    contacts: contractStatus.contract?.contacts?.map((c: any) => ({ role: c.role, reminderCount: c.reminderCount })),
    sentAt: contractStatus.contract?.sentAt,
  });

  divider('Signature reminder');
  const reminder = unwrap(
    await handleSignatureRemind({
      contractId,
      tone: 'professional',
      reminderType: 'first',
    })
  );
  console.log({ memoPreview: reminder.memo?.split('\n').slice(0, 6).join('\n') });

  await shutdownProposalContractDb();
  console.log('\nSmoke test completed successfully.');
}

main().catch(async (error) => {
  console.error('Smoke test failed:', error);
  await shutdownProposalContractDb();
  process.exitCode = 1;
});
