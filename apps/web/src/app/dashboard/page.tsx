'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { documentsApi } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import type { Document } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
};

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAccessToken().then((token) => {
      if (!token) return;
      documentsApi.list(token)
        .then((res) => setDocuments(res.data))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    });
  }, []);

  function signerSummary(doc: Document): string {
    const signers = doc.signers ?? [];
    if (signers.length === 0) return 'No signers';
    const signed = signers.filter((s) => s.status === 'signed').length;
    return `${signed} / ${signers.length} signed`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <Link
          href="/dashboard/upload"
          className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Document
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && documents.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📄</p>
          <p className="font-medium">No documents yet</p>
          <p className="text-sm mt-1">Upload your first PDF to get started</p>
        </div>
      )}

      <div className="grid gap-3">
        {documents.map((doc) => (
          <Link
            key={doc.id}
            href={`/dashboard/documents/${doc.id}`}
            className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all flex items-center justify-between"
          >
            <div>
              <p className="font-medium text-gray-900">{doc.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date(doc.created_at).toLocaleDateString()} · {signerSummary(doc)}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[doc.status]}`}>
              {doc.status.replace('_', ' ')}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
