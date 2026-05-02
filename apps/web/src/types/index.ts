export type DocumentStatus = 'draft' | 'sent' | 'in_progress' | 'completed';
export type SignerStatus = 'pending' | 'opened' | 'signed';

export interface Document {
  id: string;
  owner_id: string;
  title: string;
  status: DocumentStatus;
  storage_path: string;
  final_path: string | null;
  page_count: number;
  created_at: string;
  updated_at: string;
  signers?: Signer[];
}

export interface Signer {
  id: string;
  document_id: string;
  name: string;
  email: string;
  sign_order: number;
  status: SignerStatus;
  token: string;
  signed_at: string | null;
  opened_at: string | null;
  created_at: string;
}

export interface SignerInput {
  name: string;
  email: string;
  sign_order: number;
}

export interface SigningSession {
  signer: { id: string; name: string; email: string };
  document: { id: string; title: string; page_count: number };
  pdfUrl: string;
  alreadySigned?: boolean;
  waitingForPrior?: boolean;
}

export interface SignaturePayload {
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signature_data_url: string;
}
