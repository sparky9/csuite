export interface ProposalTemplate {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  category: string | null;
  body: string;
  requiredTokens: string[];
  optionalTokens: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalLineItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Proposal {
  id: string;
  userId: string | null;
  templateId: string | null;
  proposalNumber: string;
  clientName: string;
  clientCompany: string | null;
  clientEmail: string | null;
  status: string;
  currency: string;
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  total: number | null;
  summary: string | null;
  body: string;
  variables: Record<string, unknown>;
  sentAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: ProposalLineItem[];
}

export interface SignatureContact {
  id: string;
  contractId: string;
  role: string;
  fullName: string;
  email: string;
  signedAt: string | null;
  reminderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureEvent {
  id: string;
  contractId: string;
  eventType: string;
  description: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface Contract {
  id: string;
  userId: string | null;
  proposalId: string | null;
  contractNumber: string;
  status: string;
  signatureDeadline: string | null;
  body: string;
  envelopeMetadata: Record<string, unknown>;
  sentAt: string | null;
  signedAt: string | null;
  countersignedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contacts: SignatureContact[];
  events: SignatureEvent[];
}
