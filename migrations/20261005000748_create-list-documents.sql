-- Lista de documentos ingestados (uno por `source`), visible para cualquier usuario autenticado.
--
-- public.documents sigue cerrada para los clientes (contiene el texto y los embeddings): esta RPC
-- corre como su dueño (SECURITY DEFINER) y solo expone el nombre y la fecha de subida. Los
-- documentos son una base de conocimiento compartida, por eso no se filtra por usuario.
--
-- POST /api/database/rpc/list_documents   (Authorization: Bearer <token de usuario>)
-- Más recientes primero. Paginación opcional con los parámetros de PostgREST: ?limit=20&offset=0

CREATE FUNCTION public.list_documents()
RETURNS TABLE (
  source TEXT,
  uploaded_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Re-ingestar un source reemplaza todos sus chunks, así que comparten la fecha de la última subida.
  SELECT d.source, max(d.created_at) AS uploaded_at
    FROM public.documents AS d
   GROUP BY d.source
   ORDER BY uploaded_at DESC, d.source;
$$;

REVOKE EXECUTE ON FUNCTION public.list_documents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_documents() TO authenticated, project_admin;
