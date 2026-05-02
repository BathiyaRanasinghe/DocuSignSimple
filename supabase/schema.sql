-- ============================================================
-- SimpleSign — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE document_status AS ENUM ('draft', 'sent', 'in_progress', 'completed');
CREATE TYPE signer_status   AS ENUM ('pending', 'opened', 'signed');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  status       document_status NOT NULL DEFAULT 'draft',
  storage_path TEXT NOT NULL,
  final_path   TEXT,
  page_count   INTEGER NOT NULL DEFAULT 1,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE signers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  sign_order  INTEGER NOT NULL DEFAULT 1,
  status      signer_status NOT NULL DEFAULT 'pending',
  token       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  signed_at   TIMESTAMPTZ,
  opened_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE signature_placements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_id          UUID NOT NULL REFERENCES signers(id) ON DELETE CASCADE,
  document_id        UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number        INTEGER NOT NULL,
  x                  NUMERIC(10,8) NOT NULL,
  y                  NUMERIC(10,8) NOT NULL,
  width              NUMERIC(10,8) NOT NULL,
  height             NUMERIC(10,8) NOT NULL,
  signature_data_url TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_documents_owner_id     ON documents(owner_id);
CREATE INDEX idx_documents_status       ON documents(status);
CREATE INDEX idx_signers_document_id    ON signers(document_id);
CREATE INDEX idx_signers_token          ON signers(token);
CREATE INDEX idx_sigplacements_signer   ON signature_placements(signer_id);
CREATE INDEX idx_sigplacements_document ON signature_placements(document_id);

-- ============================================================
-- updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_signers_updated_at
  BEFORE UPDATE ON signers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- (Backend uses service_role key which bypasses RLS.
--  Policies below protect direct Studio/client access.)
-- ============================================================
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE signers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_owner_all"
  ON documents FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "signers_owner_all"
  ON signers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = signers.document_id AND d.owner_id = auth.uid()
    )
  );

CREATE POLICY "signature_placements_owner_read"
  ON signature_placements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = signature_placements.document_id AND d.owner_id = auth.uid()
    )
  );

-- ============================================================
-- STORAGE BUCKETS
-- Run in Supabase Dashboard > Storage, or via SQL below:
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('completed-documents', 'completed-documents', false);
