import { z } from 'zod';
import { registerTool } from './tooling.js';
import { recordPayment } from '../services/payments.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use YYYY-MM-DD format for paymentDate.');

const schema = z.object({
  invoiceId: z.string().uuid('invoiceId must be a valid UUID.'),
  amount: z.number().positive('amount must be greater than zero.'),
  paymentDate: isoDate,
  paymentMethod: z.enum(['check', 'ach', 'credit_card', 'wire', 'paypal', 'stripe']),
  transactionId: z.string().max(100).optional(),
  notes: z.string().max(2000).optional()
});

export const billingRecordPaymentTool = registerTool({
  name: 'billing_record_payment',
  description: 'Record a payment against an invoice and update balances automatically.',
  schema,
  execute: async (input) => {
    const result = await recordPayment({
      invoiceId: input.invoiceId,
      amount: input.amount,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      transactionId: input.transactionId,
      notes: input.notes
    });

    return {
      message: 'Payment recorded successfully.',
      payment: {
        paymentId: result.paymentId,
        invoiceId: result.invoiceId,
        amountPaid: result.amountPaid,
        remainingBalance: result.remainingBalance,
        invoiceStatus: result.invoiceStatus,
        paidAt: result.paidAt
      }
    };
  }
});
