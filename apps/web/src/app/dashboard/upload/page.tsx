'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { documentsApi } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import type { SignerInput } from '@/types';

interface SignerRow extends SignerInput {
  key: number;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [dragging, setDragging] = useState(false);
  const [documentId, setDocumentId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [signers, setSigners] = useState<SignerRow[]>([
    { key: 0, name: '', email: '', sign_order: 1 },
  ]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      setTitle(dropped.name.replace('.pdf', ''));
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setTitle(selected.name.replace('.pdf', ''));
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || file.name);
      const res = await documentsApi.upload(token, formData);
      setDocumentId(res.data.id);
      setStep(2);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function addSigner() {
    setSigners((prev) => [
      ...prev,
      { key: Date.now(), name: '', email: '', sign_order: prev.length + 1 },
    ]);
  }

  function updateSigner(key: number, field: keyof SignerInput, value: string | number) {
    setSigners((prev) =>
      prev.map((s) => (s.key === key ? { ...s, [field]: value } : s))
    );
  }

  function removeSigner(key: number) {
    setSigners((prev) => prev.filter((s) => s.key !== key));
  }

  async function handleSend() {
    const valid = signers.every((s) => s.name.trim() && s.email.trim());
    if (!valid) { setSendError('All signers need a name and email'); return; }
    setSending(true);
    setSendError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      await documentsApi.addSigners(token, documentId, signers);
      await documentsApi.send(token, documentId);
      router.push(`/dashboard/documents/${documentId}`);
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Documents</Link>
      <h1 className="text-2xl font-bold text-gray-900 mt-2 mb-6">New Document</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium ${step >= n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {n}
            </div>
            <span className={`text-sm ${step >= n ? 'text-gray-900' : 'text-gray-400'}`}>
              {n === 1 ? 'Upload PDF' : 'Add Signers'}
            </span>
            {n < 2 && <div className="w-8 h-px bg-gray-300 mx-1" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${dragging ? 'border-blue-500 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400'}`}
          >
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
            {file ? (
              <div>
                <p className="text-2xl mb-2">📄</p>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-2xl mb-2">⬆️</p>
                <p className="font-medium text-gray-700">Drop your PDF here</p>
                <p className="text-sm text-gray-400 mt-1">or click to browse</p>
              </div>
            )}
          </div>

          {file && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {uploading ? 'Uploading…' : 'Continue'}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-3">
            {signers.map((signer, i) => (
              <div key={signer.key} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Signer {i + 1}</span>
                  {signers.length > 1 && (
                    <button onClick={() => removeSigner(signer.key)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Full name</label>
                    <input
                      type="text"
                      value={signer.name}
                      onChange={(e) => updateSigner(signer.key, 'name', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Email</label>
                    <input
                      type="email"
                      value={signer.email}
                      onChange={(e) => updateSigner(signer.key, 'email', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 mb-1">Signing order (1 = sign first, same number = simultaneously)</label>
                  <input
                    type="number"
                    min={1}
                    value={signer.sign_order}
                    onChange={(e) => updateSigner(signer.key, 'sign_order', parseInt(e.target.value) || 1)}
                    className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addSigner}
            className="w-full border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Add another signer
          </button>

          {sendError && <p className="text-sm text-red-600">{sendError}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Sending…' : 'Send for Signing'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
