import crypto from 'crypto';

export function generateProposalNumber(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PROP-${timestamp}-${suffix}`;
}

export function generateContractNumber(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CONT-${timestamp}-${suffix}`;
}
