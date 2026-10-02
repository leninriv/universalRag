-- RAG: chunks de documentos con embeddings (pgvector) y búsqueda por similitud.
-- Solo las edge functions `ingest` y `ask` acceden a estos objetos, usando la API key (project_admin).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE public.documents (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (length(trim(source)) > 0),
  chunk_index INT NOT NULL CHECK (chunk_index >= 0),
  content TEXT NOT NULL,
  token_count INT NOT NULL,
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, chunk_index)
);

COMMENT ON TABLE public.documents IS 'Chunks de documentos para RAG. Escritura vía edge function ingest.';
COMMENT ON COLUMN public.documents.source IS 'Identificador del documento de origen (nombre de archivo, URL, etc.).';

-- Sin políticas para anon/authenticated: RLS niega todo acceso directo desde clientes.
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documents FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.documents_id_seq FROM anon, authenticated;

CREATE INDEX documents_embedding_hnsw_idx
  ON public.documents
  USING hnsw (embedding vector_cosine_ops);

-- Devuelve los chunks más similares a `query_embedding`.
-- score = similitud coseno (1 - distancia coseno): 1 es idéntico, cerca de 0 no relacionado.
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  match_threshold DOUBLE PRECISION DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  source TEXT,
  chunk_index INT,
  content TEXT,
  score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.source,
    d.chunk_index,
    d.content,
    1 - (d.embedding <=> query_embedding) AS score
  FROM public.documents AS d
  WHERE 1 - (d.embedding <=> query_embedding) >= match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 50);
$$;

REVOKE EXECUTE ON FUNCTION public.match_documents(vector, INT, DOUBLE PRECISION) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_documents(vector, INT, DOUBLE PRECISION) TO project_admin;
