import 'dotenv/config';
import { initializeRetentionDb, shutdownRetentionDb, withTransaction } from '../src/db/client.js';
import { ingestSignals, type HealthSignalInput } from '../src/services/health-service.js';

interface SeedAccount {
  accountName: string;
  externalAccountId: string;
  customerSegment: string;
  contractValue: number;
  renewalDate: string;
  renewalTerm: string;
  ownerId: string;
  ownerName: string;
  renewalProbability: number;
}

const SEED_ACCOUNTS: SeedAccount[] = [
  {
    accountName: 'Acme Analytics',
    externalAccountId: 'acct_acme_analytics',
    customerSegment: 'scale-up',
    contractValue: 48000,
    renewalDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    renewalTerm: 'annual',
    ownerId: 'csm_taylor',
    ownerName: 'Taylor Reed',
    renewalProbability: 0.78,
  },
  {
    accountName: 'Brightside Retail Group',
    externalAccountId: 'acct_brightside',
    customerSegment: 'smb',
    contractValue: 18000,
    renewalDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    renewalTerm: 'annual',
    ownerId: 'csm_avery',
    ownerName: 'Avery Chen',
    renewalProbability: 0.42,
  },
  {
    accountName: 'Northwind Systems',
    externalAccountId: 'acct_northwind',
    customerSegment: 'enterprise',
    contractValue: 96000,
    renewalDate: new Date(Date.now() + 72 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    renewalTerm: 'multi-year',
    ownerId: 'csm_jordan',
    ownerName: 'Jordan Blake',
    renewalProbability: 0.86,
  },
];

async function upsertAccounts(): Promise<Record<string, string>> {
  const accountIdByName: Record<string, string> = {};

  await withTransaction(async (client) => {
    for (const account of SEED_ACCOUNTS) {
      const existing = await client.query(
        `SELECT id FROM renewal_accounts WHERE account_name = $1`,
        [account.accountName]
      );

      if (existing.rowCount && existing.rows[0]?.id) {
        accountIdByName[account.accountName] = existing.rows[0].id;

        await client.query(
          `UPDATE renewal_accounts
             SET external_account_id = $2,
                 customer_segment = $3,
                 contract_value = $4,
                 renewal_date = $5::DATE,
                 renewal_term = $6,
                 owner_id = $7,
                 owner_name = $8,
                 renewal_probability = $9,
                 status = 'active',
                 updated_at = NOW()
           WHERE id = $1`,
          [
            existing.rows[0].id,
            account.externalAccountId,
            account.customerSegment,
            account.contractValue,
            account.renewalDate,
            account.renewalTerm,
            account.ownerId,
            account.ownerName,
            account.renewalProbability,
          ]
        );
      } else {
        const inserted = await client.query(
          `INSERT INTO renewal_accounts (
             account_name,
             external_account_id,
             customer_segment,
             contract_value,
             renewal_date,
             renewal_term,
             owner_id,
             owner_name,
             renewal_probability,
             status
           ) VALUES ($1, $2, $3, $4, $5::DATE, $6, $7, $8, $9, 'active')
           RETURNING id`,
          [
            account.accountName,
            account.externalAccountId,
            account.customerSegment,
            account.contractValue,
            account.renewalDate,
            account.renewalTerm,
            account.ownerId,
            account.ownerName,
            account.renewalProbability,
          ]
        );

        accountIdByName[account.accountName] = inserted.rows[0].id;
      }
    }
  });

  return accountIdByName;
}

function buildSampleSignals(accountIdMap: Record<string, string>): HealthSignalInput[] {
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  return [
    // Acme Analytics
    {
      accountId: accountIdMap['Acme Analytics'],
      source: 'usage',
      capturedAt: new Date(now.getTime() - oneDay).toISOString(),
      payload: { score: 88 },
    },
    {
      accountId: accountIdMap['Acme Analytics'],
      source: 'support',
      capturedAt: now.toISOString(),
      payload: { csat: 0.94 },
    },
    {
      accountId: accountIdMap['Acme Analytics'],
      source: 'nps',
      capturedAt: now.toISOString(),
      payload: { rating: 8 },
    },
    // Brightside Retail Group
    {
      accountId: accountIdMap['Brightside Retail Group'],
      source: 'usage',
      capturedAt: new Date(now.getTime() - 2 * oneDay).toISOString(),
      payload: { score: 52 },
    },
    {
      accountId: accountIdMap['Brightside Retail Group'],
      source: 'support',
      capturedAt: now.toISOString(),
      payload: { csat: 0.58 },
    },
    {
      accountId: accountIdMap['Brightside Retail Group'],
      source: 'nps',
      capturedAt: now.toISOString(),
      payload: { rating: -1 },
    },
    // Northwind Systems
    {
      accountId: accountIdMap['Northwind Systems'],
      source: 'usage',
      capturedAt: new Date(now.getTime() - oneDay).toISOString(),
      payload: { score: 79 },
    },
    {
      accountId: accountIdMap['Northwind Systems'],
      source: 'support',
      capturedAt: now.toISOString(),
      payload: { csat: 0.88 },
    },
    {
      accountId: accountIdMap['Northwind Systems'],
      source: 'nps',
      capturedAt: now.toISOString(),
      payload: { rating: 9 },
    },
  ].filter((signal) => Boolean(signal.accountId)) as HealthSignalInput[];
}

async function seed(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL must be set to seed retention data');
  }

  await initializeRetentionDb();

  try {
    const accountIds = await upsertAccounts();
    const signals = buildSampleSignals(accountIds);

    if (signals.length > 0) {
      await ingestSignals(signals);
    }

    console.log('Retention seed data applied.');
  } finally {
    await shutdownRetentionDb();
  }
}

seed().catch((error) => {
  console.error('Failed to seed retention data:', error);
  process.exitCode = 1;
});
