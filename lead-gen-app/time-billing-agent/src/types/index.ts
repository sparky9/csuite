export interface TimeEntry {
  id: string;
  userId: string;
  clientId: string;
  projectName: string;
  taskDescription: string;
  durationMinutes: number;
  startTime: string | null;
  endTime: string | null;
  billable: boolean;
  invoiced: boolean;
  invoiceId: string | null;
  hourlyRate: number | null;
  calculatedAmount: number | null;
  notes: string | null;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface RateCard {
  id: string;
  userId: string;
  clientId: string | null;
  projectName: string | null;
  hourlyRate: number;
  currency: string;
  effectiveDate: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  userId: string;
  invoiceNumber: string;
  clientId: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  notes: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  deliveryMethod: string | null;
  recipientEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  userId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  invoiceId: string;
  userId: string;
  tone: string;
  subject: string;
  messageBody: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}
