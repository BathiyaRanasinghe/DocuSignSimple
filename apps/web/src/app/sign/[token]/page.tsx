'use client';

import { useEffect, useRef, useState, MouseEvent } from 'react';
import { useParams } from 'next/navigation';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import SignatureCanvas from 'react-signature-canvas';
import { signApi } from '@/lib/api';
import type { SigningSession, SignaturePayload } from '@/types';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface PlacedSignature {
  pageNumber: number;
  x: number;        // fractional (0-1) relative to page
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  // Pixel coords for rendering the overlay
  pxX: number;
  pxY: number;
  pxWidth: number;
  pxHeight: number;
}

const PAGE_WIDTH_PX = 680;

export default function SignPage() {
  const { token } = useParams<{ token: string }>();

  const [session, setSession] = useState<SigningSession | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'alreadySigned' | 'waiting' | 'error' | 'submitted'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [numPages, setNumPages] = useState(0);

  // Signature modal
  const [showModal, setShowModal] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  // Pending placement (after confirming signature, before placing)
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number | null>(null);

  // Placed signatures
  const [placed, setPlaced] = useState<PlacedSignature[]>([]);

  // Per-page rendered dimensions (populated by react-pdf onRenderSuccess)
  const pageDimsRef = useRef<Map<number, { width: number; height: number }>>(new Map());

  // Dragging state
  const draggingRef = useRef<{ sigIndex: number; startX: number; startY: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    signApi.getSession(token)
      .then(({ data }) => {
        if (data.alreadySigned) { setStatus('alreadySigned'); return; }
        if (data.waitingForPrior) { setStatus('waiting'); return; }
        setSession(data);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  function handleConfirmSignature() {
    let dataUrl: string | null = null;

    if (signatureMode === 'draw') {
      if (!sigCanvasRef.current || sigCanvasRef.current.isEmpty()) return;
      dataUrl = sigCanvasRef.current.toDataURL('image/png');
    } else {
      if (!typedName.trim()) return;
      // Render typed name to a canvas
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 400, 100);
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'italic 48px Georgia, serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, 20, 52);
      dataUrl = canvas.toDataURL('image/png');
    }

    setPendingDataUrl(dataUrl);
    setShowModal(false);
    setActivePage(1); // default to page 1 placement mode
  }

  function handlePageClick(e: MouseEvent<HTMLDivElement>, pageNumber: number) {
    if (!pendingDataUrl) return;

    const dims = pageDimsRef.current.get(pageNumber);
    if (!dims) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const pxX = e.clientX - rect.left - 60;
    const pxY = e.clientY - rect.top - 20;

    const pxW = 180;
    const pxH = 48;

    const fracX = Math.max(0, Math.min(1, pxX / dims.width));
    const fracY = Math.max(0, Math.min(1, pxY / dims.height));
    const fracW = pxW / dims.width;
    const fracH = pxH / dims.height;

    setPlaced((prev) => [
      ...prev,
      {
        pageNumber,
        x: fracX,
        y: fracY,
        width: fracW,
        height: fracH,
        dataUrl: pendingDataUrl!,
        pxX,
        pxY,
        pxWidth: pxW,
        pxHeight: pxH,
      },
    ]);
    setPendingDataUrl(null);
    setActivePage(null);
  }

  // Drag to move placed signatures
  function onSigMouseDown(e: MouseEvent, index: number) {
    e.stopPropagation();
    draggingRef.current = { sigIndex: index, startX: e.clientX, startY: e.clientY };
  }

  useEffect(() => {
    function onMouseMove(e: globalThis.MouseEvent) {
      if (!draggingRef.current) return;
      const { sigIndex, startX, startY } = draggingRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      draggingRef.current = { sigIndex, startX: e.clientX, startY: e.clientY };

      setPlaced((prev) =>
        prev.map((sig, i) => {
          if (i !== sigIndex) return sig;
          const dims = pageDimsRef.current.get(sig.pageNumber);
          if (!dims) return sig;
          const newPxX = sig.pxX + dx;
          const newPxY = sig.pxY + dy;
          return {
            ...sig,
            pxX: newPxX,
            pxY: newPxY,
            x: Math.max(0, Math.min(1, newPxX / dims.width)),
            y: Math.max(0, Math.min(1, newPxY / dims.height)),
          };
        })
      );
    }

    function onMouseUp() { draggingRef.current = null; }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  async function handleSubmit() {
    if (placed.length === 0) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const payloads: SignaturePayload[] = placed.map((sig) => ({
        page_number: sig.pageNumber,
        x: sig.x,
        y: sig.y,
        width: sig.width,
        height: sig.height,
        signature_data_url: sig.dataUrl,
      }));
      await signApi.submit(token, payloads);
      setStatus('submitted');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
      setSubmitting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'alreadySigned') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white border border-gray-200 rounded-2xl p-10 max-w-sm">
          <p className="text-4xl mb-3">✅</p>
          <h2 className="text-xl font-bold text-gray-900">Already signed</h2>
          <p className="text-sm text-gray-500 mt-2">This document has already been signed.</p>
        </div>
      </div>
    );
  }

  if (status === 'waiting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white border border-gray-200 rounded-2xl p-10 max-w-sm">
          <p className="text-4xl mb-3">⏳</p>
          <h2 className="text-xl font-bold text-gray-900">Waiting for prior signer</h2>
          <p className="text-sm text-gray-500 mt-2">Please check back once the previous signer has completed.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white border border-red-200 rounded-2xl p-10 max-w-sm">
          <p className="text-4xl mb-3">❌</p>
          <h2 className="text-xl font-bold text-gray-900">Invalid link</h2>
          <p className="text-sm text-gray-500 mt-2">This signing link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (status === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white border border-green-200 rounded-2xl p-10 max-w-sm">
          <p className="text-4xl mb-3">🎉</p>
          <h2 className="text-xl font-bold text-gray-900">Signed successfully!</h2>
          <p className="text-sm text-gray-500 mt-2">
            Thank you, {session?.signer.name}. Your signature has been recorded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="font-bold text-blue-600 text-lg">SimpleSign</span>
          <span className="text-gray-400 mx-2">·</span>
          <span className="text-sm text-gray-700">{session?.document.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Hi, {session?.signer.name}</span>
          {pendingDataUrl && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Click on the document to place your signature</span>
          )}
          {!pendingDataUrl && (
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Add Signature
            </button>
          )}
          {placed.length > 0 && !pendingDataUrl && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit & Sign'}
            </button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 text-sm text-red-700">{errorMsg}</div>
      )}

      {/* PDF viewer */}
      <div className="py-6 flex flex-col items-center gap-6">
        <Document
          file={session?.pdfUrl}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          className="flex flex-col items-center gap-6"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              className={`relative bg-white shadow-md ${pendingDataUrl ? 'cursor-crosshair ring-2 ring-blue-400' : ''}`}
              onClick={(e) => handlePageClick(e, pageNum)}
              style={{ width: PAGE_WIDTH_PX }}
            >
              <Page
                pageNumber={pageNum}
                width={PAGE_WIDTH_PX}
                onRenderSuccess={(page) => {
                  pageDimsRef.current.set(pageNum, {
                    width: PAGE_WIDTH_PX,
                    height: page.height * (PAGE_WIDTH_PX / page.width),
                  });
                }}
              />

              {/* Render placed signatures on this page */}
              {placed
                .filter((sig) => sig.pageNumber === pageNum)
                .map((sig, i) => (
                  <div
                    key={i}
                    onMouseDown={(e) => onSigMouseDown(e, placed.indexOf(sig))}
                    className="absolute border-2 border-blue-400 cursor-move select-none"
                    style={{
                      left: sig.pxX,
                      top: sig.pxY,
                      width: sig.pxWidth,
                      height: sig.pxHeight,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sig.dataUrl} alt="signature" className="w-full h-full object-contain" />
                  </div>
                ))}
            </div>
          ))}
        </Document>
      </div>

      {/* Signature modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Create your signature</h2>

            <div className="flex gap-2 mb-4">
              {(['draw', 'type'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSignatureMode(mode)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${signatureMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {mode === 'draw' ? 'Draw' : 'Type'}
                </button>
              ))}
            </div>

            {signatureMode === 'draw' && (
              <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
                <SignatureCanvas
                  ref={sigCanvasRef}
                  penColor="black"
                  canvasProps={{ width: 436, height: 120, className: 'w-full' }}
                />
                <div className="bg-gray-50 px-3 py-2 border-t border-gray-200">
                  <button
                    onClick={() => sigCanvasRef.current?.clear()}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {signatureMode === 'type' && (
              <div>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="Type your full name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-2xl italic font-serif focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: 'Georgia, serif' }}
                />
              </div>
            )}

            <p className="text-xs text-gray-400 mt-3">
              Then click on the document to place your signature.
            </p>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowModal(false); setPendingDataUrl(null); }}
                className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSignature}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700"
              >
                Use this signature
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
