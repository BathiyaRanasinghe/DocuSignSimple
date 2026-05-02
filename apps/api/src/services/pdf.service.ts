import { PDFDocument } from 'pdf-lib';
import { supabaseAdmin } from '../lib/supabase';

export async function generateFinalPdf(documentId: string): Promise<void> {
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('*, owner_id')
    .eq('id', documentId)
    .single();

  if (!doc) throw new Error('Document not found');

  const { data: fileData, error: downloadError } = await supabaseAdmin.storage
    .from('documents')
    .download(doc.storage_path);

  if (downloadError || !fileData) throw downloadError ?? new Error('Failed to download PDF');

  const originalBytes = Buffer.from(await fileData.arrayBuffer());
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();

  const { data: placements } = await supabaseAdmin
    .from('signature_placements')
    .select('*')
    .eq('document_id', documentId)
    .order('page_number');

  for (const placement of placements ?? []) {
    const page = pages[placement.page_number - 1];
    if (!page) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Strip the data URI prefix and decode base64 PNG
    const base64Data = (placement.signature_data_url as string).split(',')[1];
    const pngBytes = Buffer.from(base64Data, 'base64');
    const pngImage = await pdfDoc.embedPng(pngBytes);

    // Convert from fractional top-left origin (browser) to pdf-lib bottom-left origin
    page.drawImage(pngImage, {
      x: placement.x * pageWidth,
      y: pageHeight - (placement.y * pageHeight) - (placement.height * pageHeight),
      width: placement.width * pageWidth,
      height: placement.height * pageHeight,
    });
  }

  const finalBytes = await pdfDoc.save();
  const finalPath = `${doc.owner_id}/${documentId}/final.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('completed-documents')
    .upload(finalPath, finalBytes, { contentType: 'application/pdf', upsert: true });

  if (uploadError) throw uploadError;

  const { error: updateError } = await supabaseAdmin
    .from('documents')
    .update({ status: 'completed', final_path: finalPath })
    .eq('id', documentId);

  if (updateError) throw updateError;
}
