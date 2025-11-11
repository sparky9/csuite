/// <reference types="node" />
import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { proposalService } from '../src/services/proposal-service.js';
import { contractService } from '../src/services/contract-service.js';
import { pdfService } from '../src/services/pdf-service.js';
import { signatureService } from '../src/services/signature-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing. Add it to your .env file.');
  process.exit(1);
}

async function testESignatureWorkflow() {
  console.log('='.repeat(80));
  console.log('E-SIGNATURE WORKFLOW TEST');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Create a test proposal
    console.log('Step 1: Creating test proposal...');
    const proposal = await proposalService.generateProposal({
      client: {
        name: 'Jane Smith',
        company: 'Acme Corp',
        email: 'jane@acme.com',
      },
      proposalNumber: `TEST-ESIG-${Date.now()}`,
      summary: 'Complete website redesign with modern UX/UI',
      variables: {
        project_summary: 'Complete redesign of your corporate website',
        scope_outline: 'Modern responsive design, content migration, SEO optimization, and team training',
      },
      lineItems: [
        { description: 'Design & Development', quantity: 1, unitPrice: 15000 },
        { description: 'Content Migration', quantity: 1, unitPrice: 3000 },
        { description: 'SEO Setup', quantity: 1, unitPrice: 2000 },
      ],
      currency: 'USD',
    });
    console.log(`  ✓ Proposal created: ${proposal.proposalNumber}`);
    console.log(`  ✓ Client: ${proposal.clientName}`);
    console.log(`  ✓ Total: $${proposal.total?.toFixed(2)}`);
    console.log();

    // Step 2: Convert to contract
    console.log('Step 2: Converting proposal to contract...');
    const contract = await contractService.generateContract({
      proposalId: proposal.id,
      signatureDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days
      contacts: [
        {
          role: 'client',
          fullName: 'Jane Smith',
          email: 'jane@acme.com',
        },
        {
          role: 'provider',
          fullName: 'John Doe',
          email: 'john@yourcompany.com',
        },
      ],
    });
    console.log(`  ✓ Contract created: ${contract.contractNumber}`);
    console.log(`  ✓ Status: ${contract.status}`);
    console.log(`  ✓ Signature deadline: ${contract.signatureDeadline}`);
    console.log(`  ✓ Contacts: ${contract.contacts.length} signers`);
    console.log();

    // Step 3: Generate PDF
    console.log('Step 3: Generating PDF with signature fields...');
    const pdfBuffer = await pdfService.generateContractPdf({
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      contractBody: contract.body,
      clientName: proposal.clientName,
      includeSignatureField: true,
    });
    console.log(`  ✓ PDF generated: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    const storageResult = await pdfService.storePdf(contract.id, pdfBuffer, `contract-${contract.contractNumber}.pdf`);
    console.log(`  ✓ PDF stored in database`);
    console.log(`  ✓ Document ID: ${storageResult.documentId}`);
    console.log(`  ✓ Checksum: ${storageResult.checksum.substring(0, 16)}...`);
    console.log();

    // Step 4: Generate signing links
    console.log('Step 4: Generating signing links for all contacts...');
    const signingLinks = [];
    for (const contact of contract.contacts) {
      const { token, signingUrl, expiresAt } = await signatureService.generateSigningToken(contract.id, contact.id, 30);
      signingLinks.push({ contact, token, signingUrl, expiresAt });
      console.log(`  ✓ ${contact.role.toUpperCase()}: ${contact.fullName}`);
      console.log(`    Email: ${contact.email}`);
      console.log(`    Token: ${token.substring(0, 20)}...`);
      console.log(`    URL: ${signingUrl}`);
      console.log(`    Expires: ${expiresAt.toISOString().split('T')[0]}`);
      console.log();
    }

    // Step 5: Simulate client signing
    console.log('Step 5: Simulating client signature...');
    const clientLink = signingLinks[0];
    const tokenValidation = await signatureService.validateToken(
      clientLink.token,
      '192.168.1.100',
      'Mozilla/5.0 (Test Browser)'
    );

    if (tokenValidation.valid) {
      console.log(`  ✓ Token validated successfully`);

      // Simulate typed signature (base64 encoded text image)
      const typedSignature = Buffer.from('Jane Smith').toString('base64');

      const { signatureId, timestamp } = await signatureService.captureSignature({
        contactId: clientLink.contact.id,
        signatureType: 'typed',
        signatureData: typedSignature,
        signatureFormat: 'text',
        fontFamily: 'Brush Script MT',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test Browser)',
      });

      console.log(`  ✓ Signature captured: ${signatureId}`);
      console.log(`  ✓ Timestamp: ${timestamp.toISOString()}`);
      console.log(`  ✓ Type: typed`);
    } else {
      console.log(`  ✗ Token validation failed: ${tokenValidation.reason}`);
    }
    console.log();

    // Step 6: Check signature status
    console.log('Step 6: Checking signature status...');
    const status = await signatureService.getSignatureStatus(contract.id);
    console.log(`  ✓ Total signers: ${status.totalSigners}`);
    console.log(`  ✓ Signed: ${status.signedCount}`);
    console.log(`  ✓ Progress: ${((status.signedCount / status.totalSigners) * 100).toFixed(0)}%`);
    console.log(`  ✓ Fully signed: ${status.isFullySigned ? 'Yes' : 'No'}`);
    console.log();

    console.log('  Signer Details:');
    for (const signer of status.pendingSigners) {
      const signedIcon = signer.signedAt ? '✓' : '○';
      console.log(`    ${signedIcon} ${signer.fullName} (${signer.role})`);
      console.log(`      Email: ${signer.email}`);
      console.log(`      Status: ${signer.signedAt ? `Signed on ${signer.signedAt}` : 'Pending'}`);
      if (!signer.signedAt && signer.tokenExpired) {
        console.log(`      ⚠ Token expired - generate new link`);
      }
      console.log();
    }

    // Step 7: Retrieve signed PDF
    console.log('Step 7: Retrieving PDF from database...');
    const retrievedPdf = await pdfService.getPdfByContractId(contract.id);
    if (retrievedPdf) {
      console.log(`  ✓ PDF retrieved: ${retrievedPdf.fileName}`);
      console.log(`  ✓ Size: ${(retrievedPdf.buffer.length / 1024).toFixed(2)} KB`);
      console.log(`  ✓ Checksum: ${retrievedPdf.checksum.substring(0, 16)}...`);

      const isValid = pdfService.verifyPdfIntegrity(retrievedPdf.buffer, retrievedPdf.checksum);
      console.log(`  ✓ Integrity verified: ${isValid ? 'PASSED' : 'FAILED'}`);
    } else {
      console.log(`  ✗ PDF not found`);
    }
    console.log();

    console.log('='.repeat(80));
    console.log('E-SIGNATURE WORKFLOW TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log();

    console.log('Summary:');
    console.log(`  • Proposal: ${proposal.proposalNumber}`);
    console.log(`  • Contract: ${contract.contractNumber}`);
    console.log(`  • PDF Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`  • Signers: ${status.signedCount}/${status.totalSigners} signed`);
    console.log(`  • Status: ${status.isFullySigned ? 'Fully Signed' : 'Awaiting Signatures'}`);
    console.log();

    return {
      success: true,
      proposal,
      contract,
      pdfSize: pdfBuffer.length,
      signatureStatus: status,
    };
  } catch (error: any) {
    console.error('');
    console.error('='.repeat(80));
    console.error('TEST FAILED');
    console.error('='.repeat(80));
    console.error();
    console.error('Error:', error.message);
    if (error.stack) {
      console.error();
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exitCode = 1;
    return { success: false, error: error.message };
  }
}

// Run test
testESignatureWorkflow()
  .then((result) => {
    if (result.success) {
      console.log('Test data IDs (for cleanup):');
      console.log(`  Proposal ID: ${result.proposal?.id}`);
      console.log(`  Contract ID: ${result.contract?.id}`);
      console.log();
      console.log('Run cleanup script to remove test data if needed.');
    }
  })
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exitCode = 1;
  });
