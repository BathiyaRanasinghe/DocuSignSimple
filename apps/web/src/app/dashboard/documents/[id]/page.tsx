'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { documentsApi } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import type { Document, Signer } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  opened: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
};

const SIGNING_LINK_BASE =
  typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? '';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    getAccessToken().then((token) => {
      if (!token) return;
      documentsApi.get(token, id)
        .then((res) => setDoc(res.data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function copyLink(signer: Signer) {
    const link = `${SIGNING_LINK_BASE}/sign/${signer.token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(signer.id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function handleDelete() {
    if (!confirm('Delete this document permanently?')) return;
    const token = await getAccessToken();
    if (!token) return;
    await documentsApi.delete(token, id);
    window.location.href = '/dashboard';
  }

  async function handleDownload() {
    const token = await getAccessToken();
    if (!token) return;
    const res = await documentsApi.getDownloadUrl(token, id);
    window.open(res.data.url, '_blank');
  }

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !doc) return (
    <div className="text-red-600">{error || 'Document not found'}</div>
  );

  const signers: Signer[] = doc.signers ?? [];
  const signedCount = signers.filter((s) => s.status === 'signed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Documents</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{doc.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {doc.page_count} page{doc.page_count !== 1 ? 's' : ''} · Uploaded {new Date(doc.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {doc.status === 'completed' && (
            <button
              onClick={handleDownload}
              className="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Download Signed PDF
            </button>
          )}
          <button
            onClick={handleDelete}
            className="text-red-600 border border-red-200 rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {signers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          {signedCount} of {signers.length} signer{signers.length !== 1 ? 's' : ''} completed
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Signers</h2>
        </div>

        {signers.length === 0 ? (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">No signers added</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-5 py-3 text-left">Name</th>
                <th className="px-5 py-3 text-left">Email</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Signing Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {signers.map((signer) => (
                <tr key={signer.id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{signer.name}</td>
                  <td className="px-5 py-3 text-gray-600">{signer.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[signer.status]}`}>
                      {signer.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {signer.status !== 'signed' ? (
                      <button
                        onClick={() => copyLink(signer)}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        {copied === signer.id ? '✓ Copied!' : 'Copy link'}
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">Signed {signer.signed_at ? new Date(signer.signed_at).toLocaleDateString() : ''}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
