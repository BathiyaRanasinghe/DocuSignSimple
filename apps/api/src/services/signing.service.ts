import { supabaseAdmin } from '../lib/supabase';
import { generateFinalPdf } from './pdf.service';
import type { SignaturePlacementInput, SigningSession } from '../types';

export async function getSession(token: string): Promise<SigningSession | null> {
  const { data: signer, error } = await supabaseAdmin
    .from('signers')
    .select('*, documents(*)')
    .eq('token', token)
    .single();

  if (error || !signer) return null;

  if (signer.status === 'signed') {
    return { alreadySigned: true } as unknown as SigningSession;
  }

  if (signer.documents?.status === 'completed') {
    return { alreadySigned: true } as unknown as SigningSession;
  }

  // Ordered signing: check if prior signers (lower sign_order) have signed
  if (signer.sign_order > 1) {
    const { data: prior } = await supabaseAdmin
      .from('signers')
      .select('id')
      .eq('document_id', signer.document_id)
      .lt('sign_order', signer.sign_order)
      .neq('status', 'signed');

    if (prior && prior.length > 0) {
      return { waitingForPrior: true } as unknown as SigningSession;
    }
  }

  // Generate short-lived signed URL for the PDF
  const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(signer.documents.storage_path, 3600);

  if (urlError || !signedUrlData?.signedUrl) {
    throw urlError ?? new Error('Failed to generate PDF URL');
  }

  // Mark signer as opened (only on first open)
  if (signer.status === 'pending') {
    await supabaseAdmin
      .from('signers')
      .update({ status: 'opened', opened_at: new Date().toISOString() })
      .eq('id', signer.id);
  }

  return {
    signer: { id: signer.id, name: signer.name, email: signer.email },
    document: {
      id: signer.document_id,
      title: signer.documents.title,
      page_count: signer.documents.page_count,
    },
    pdfUrl: signedUrlData.signedUrl,
  };
}

export async function submitSignature(
  token: string,
  placements: SignaturePlacementInput[]
): Promise<{ success: boolean; completed: boolean }> {
  const { data: signer, error } = await supabaseAdmin
    .from('signers')
    .select('*, documents(*)')
    .eq('token', token)
    .single();

  if (error || !signer) {
    throw Object.assign(new Error('Invalid signing link'), { status: 404 });
  }

  if (signer.status === 'signed') {
    throw Object.assign(new Error('Already signed'), { status: 409 });
  }

  // Insert all signature placements in one batch
  const rows = placements.map((p) => ({
    signer_id: signer.id,
    document_id: signer.document_id,
    page_number: p.page_number,
    x: p.x,
    y: p.y,
    width: p.width,
    height: p.height,
    signature_data_url: p.signature_data_url,
  }));

  const { error: placementError } = await supabaseAdmin
    .from('signature_placements')
    .insert(rows);

  if (placementError) throw placementError;

  // Mark signer as signed
  await supabaseAdmin
    .from('signers')
    .update({ status: 'signed', signed_at: new Date().toISOString() })
    .eq('id', signer.id);

  // Check if all signers for this document are now signed
  const { data: pending } = await supabaseAdmin
    .from('signers')
    .select('id')
    .eq('document_id', signer.document_id)
    .neq('status', 'signed');

  const allSigned = !pending || pending.length === 0;

  if (allSigned) {
    await generateFinalPdf(signer.document_id);
  }

  return { success: true, completed: allSigned };
}
