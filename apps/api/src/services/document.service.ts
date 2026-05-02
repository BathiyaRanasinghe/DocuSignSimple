import { PDFDocument } from 'pdf-lib';
import { supabaseAdmin } from '../lib/supabase';
import type { Document, SignerInput } from '../types';

export async function upload(params: {
  ownerId: string;
  title: string;
  buffer: Buffer;
}): Promise<Document> {
  const pdfDoc = await PDFDocument.load(params.buffer);
  const pageCount = pdfDoc.getPageCount();

  const storagePath = `${params.ownerId}/${Date.now()}.pdf`;

  const { error: storageError } = await supabaseAdmin.storage
    .from('documents')
    .upload(storagePath, params.buffer, { contentType: 'application/pdf', upsert: false });

  if (storageError) throw storageError;

  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert({
      owner_id: params.ownerId,
      title: params.title,
      status: 'draft',
      storage_path: storagePath,
      page_count: pageCount,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Document;
}

export async function listByOwner(ownerId: string): Promise<Document[]> {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*, signers(*)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Document[];
}

export async function getById(id: string, ownerId: string): Promise<Document | null> {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('*, signers(*)')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .single();

  if (error) return null;
  return data as Document;
}

export async function remove(id: string, ownerId: string): Promise<void> {
  const doc = await getById(id, ownerId);
  if (!doc) throw Object.assign(new Error('Document not found'), { status: 404 });

  await supabaseAdmin.storage.from('documents').remove([doc.storage_path]);

  if (doc.final_path) {
    await supabaseAdmin.storage.from('completed-documents').remove([doc.final_path]);
  }

  const { error } = await supabaseAdmin.from('documents').delete().eq('id', id);
  if (error) throw error;
}

export async function addSigners(
  id: string,
  ownerId: string,
  signers: SignerInput[]
): Promise<unknown[]> {
  const doc = await getById(id, ownerId);
  if (!doc) throw Object.assign(new Error('Document not found'), { status: 404 });

  const rows = signers.map((s) => ({
    document_id: id,
    name: s.name,
    email: s.email,
    sign_order: s.sign_order,
    status: 'pending',
  }));

  const { data, error } = await supabaseAdmin
    .from('signers')
    .insert(rows)
    .select();

  if (error) throw error;
  return data ?? [];
}

export async function send(id: string, ownerId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('documents')
    .update({ status: 'sent' })
    .eq('id', id)
    .eq('owner_id', ownerId);

  if (error) throw error;
}

export async function getDownloadUrl(id: string, ownerId: string): Promise<string> {
  const doc = await getById(id, ownerId);
  if (!doc) throw Object.assign(new Error('Document not found'), { status: 404 });
  if (doc.status !== 'completed' || !doc.final_path) {
    throw Object.assign(new Error('Document is not yet completed'), { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from('completed-documents')
    .createSignedUrl(doc.final_path, 3600);

  if (error || !data?.signedUrl) throw error ?? new Error('Failed to generate download URL');
  return data.signedUrl;
}
