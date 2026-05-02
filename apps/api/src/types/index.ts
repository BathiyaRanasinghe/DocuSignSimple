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

export interface SignaturePlacement {
  id: string;
  signer_id: string;
  document_id: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signature_data_url: string;
  created_at: string;
}

export interface SignerInput {
  name: string;
  email: string;
  sign_order: number;
}

export interface SignaturePlacementInput {
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signature_data_url: string;
}

export interface SubmitSignatureBody {
  placements: SignaturePlacementInput[];
}

export interface SigningSession {
  signer: Pick<Signer, 'id' | 'name' | 'email'>;
  document: Pick<Document, 'id' | 'title' | 'page_count'>;
  pdfUrl: string;
  alreadySigned?: boolean;
  waitingForPrior?: boolean;
}
