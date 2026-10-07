-- Historial de chats estilo ChatGPT: cada usuario tiene varios chats y cada chat guarda los
-- mensajes enviados (role = 'user') y recibidos (role = 'assistant').
--
-- Lectura (token de usuario): RLS + RPCs paginadas list_chats y get_chat_messages.
-- Renombrar / borrar chats (token de usuario): REST de records con RLS.
-- Escritura de mensajes: solo el servidor (edge function ask) con save_chat_exchange, para que
-- nadie pueda fabricar respuestas del asistente.

CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Última actividad: ordena el historial. La mantiene el trigger de chat_messages.
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE INDEX chats_user_recent_idx ON public.chats (user_id, updated_at DESC, id DESC);

CREATE TABLE public.chat_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id UUID NOT NULL,
  -- Dueño del chat copiado en cada mensaje para que RLS no necesite joins.
  -- La FK compuesta garantiza que siempre coincida con el dueño del chat.
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (length(content) > 0),
  -- Fuentes (chunks de documents) usadas por el asistente para responder.
  sources JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources) = 'array'),
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (chat_id, user_id) REFERENCES public.chats (id, user_id) ON DELETE CASCADE
);

CREATE INDEX chat_messages_chat_page_idx ON public.chat_messages (chat_id, id DESC);

-- ---------------------------------------------------------------------------
-- Última actividad del chat
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.touch_chat_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.chats
     SET updated_at = NEW.created_at
   WHERE id = NEW.chat_id
     AND updated_at < NEW.created_at;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.touch_chat_on_message() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER chat_messages_touch_chat
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_chat_on_message();

-- ---------------------------------------------------------------------------
-- Acceso: cada usuario solo ve, renombra y borra sus propios chats
-- ---------------------------------------------------------------------------

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chats, public.chat_messages FROM anon, authenticated;
GRANT SELECT, DELETE ON public.chats TO authenticated;
GRANT UPDATE (title) ON public.chats TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;

CREATE POLICY "chats_select_own" ON public.chats
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "chats_update_own" ON public.chats
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "chats_delete_own" ON public.chats
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "chat_messages_select_own" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- RPC: historial de chats del usuario, del más reciente al más antiguo.
-- POST /api/database/rpc/list_chats  { "page_size"?: 20, "before_cursor"?: next_cursor }
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.list_chats(page_size INT DEFAULT 20, before_cursor TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(list_chats.page_size, 20), 1), 100);
  v_cursor_at TIMESTAMPTZ;
  v_cursor_id UUID;
  v_result JSONB;
BEGIN
  -- Cursor opaco "<updated_at ISO>|<id>" del último chat de la página anterior.
  IF list_chats.before_cursor IS NOT NULL THEN
    BEGIN
      v_cursor_at := split_part(list_chats.before_cursor, '|', 1)::timestamptz;
      v_cursor_id := split_part(list_chats.before_cursor, '|', 2)::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'before_cursor inválido' USING ERRCODE = '22023';
    END;
  END IF;

  WITH page AS (
    SELECT c.id, c.title, c.created_at, c.updated_at
      FROM public.chats AS c
     WHERE c.user_id = (SELECT auth.uid())
       AND (v_cursor_at IS NULL OR (c.updated_at, c.id) < (v_cursor_at, v_cursor_id))
     ORDER BY c.updated_at DESC, c.id DESC
     LIMIT v_limit + 1
  ),
  visible AS (
    SELECT * FROM page ORDER BY updated_at DESC, id DESC LIMIT v_limit
  ),
  oldest AS (
    SELECT * FROM visible ORDER BY updated_at ASC, id ASC LIMIT 1
  )
  SELECT jsonb_build_object(
    'chats', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.updated_at DESC, v.id DESC) FROM visible AS v), '[]'::jsonb),
    'has_more', (SELECT count(*) FROM page) > v_limit,
    'next_cursor', CASE WHEN (SELECT count(*) FROM page) > v_limit THEN (
      SELECT to_char(o.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || o.id
        FROM oldest AS o
    ) END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: mensajes de un chat, paginados como ChatGPT. La primera página trae los más recientes;
-- para cargar anteriores se pasa `next_cursor` como `before_id`. Los mensajes de cada página
-- vienen en orden cronológico.
-- POST /api/database/rpc/get_chat_messages  { "chat_id": uuid, "before_id"?: number, "page_size"?: 30 }
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.get_chat_messages(chat_id UUID, before_id BIGINT DEFAULT NULL, page_size INT DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(get_chat_messages.page_size, 30), 1), 100);
  v_chat JSONB;
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object('id', c.id, 'title', c.title, 'created_at', c.created_at, 'updated_at', c.updated_at)
    INTO v_chat
    FROM public.chats AS c
   WHERE c.id = get_chat_messages.chat_id
     AND c.user_id = (SELECT auth.uid());

  IF v_chat IS NULL THEN
    RAISE EXCEPTION 'Chat no encontrado' USING ERRCODE = 'P0002';
  END IF;

  WITH page AS (
    SELECT m.id, m.role, m.content, m.sources, m.model, m.created_at
      FROM public.chat_messages AS m
     WHERE m.chat_id = get_chat_messages.chat_id
       AND (get_chat_messages.before_id IS NULL OR m.id < get_chat_messages.before_id)
     ORDER BY m.id DESC
     LIMIT v_limit + 1
  ),
  visible AS (
    SELECT * FROM page ORDER BY id DESC LIMIT v_limit
  )
  SELECT jsonb_build_object(
    'chat', v_chat,
    'messages', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.id) FROM visible AS v), '[]'::jsonb),
    'has_more', (SELECT count(*) FROM page) > v_limit,
    'next_cursor', CASE WHEN (SELECT count(*) FROM page) > v_limit THEN (SELECT min(v.id) FROM visible AS v) END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.list_chats(INT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_chat_messages(UUID, BIGINT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_chats(INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_messages(UUID, BIGINT, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC interna (solo servidor): guarda pregunta + respuesta en una sola transacción.
-- Sin p_chat_id crea un chat nuevo con p_title. La usa la edge function ask con la API key.
-- ---------------------------------------------------------------------------

CREATE FUNCTION public.save_chat_exchange(
  p_owner_id UUID,
  p_chat_id UUID,
  p_question TEXT,
  p_answer TEXT,
  p_sources JSONB DEFAULT '[]'::jsonb,
  p_model TEXT DEFAULT NULL,
  p_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_chat_id UUID := p_chat_id;
  v_user_message public.chat_messages%ROWTYPE;
  v_assistant_message public.chat_messages%ROWTYPE;
  v_chat JSONB;
BEGIN
  IF v_chat_id IS NULL THEN
    INSERT INTO public.chats (user_id, title)
    VALUES (p_owner_id, left(COALESCE(NULLIF(btrim(p_title), ''), 'Nuevo chat'), 200))
    RETURNING id INTO v_chat_id;
  ELSE
    -- Bloquea el chat para que dos envíos simultáneos no intercalen sus mensajes.
    PERFORM 1 FROM public.chats WHERE id = v_chat_id AND user_id = p_owner_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Chat no encontrado' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.chat_messages (chat_id, user_id, role, content)
  VALUES (v_chat_id, p_owner_id, 'user', p_question)
  RETURNING * INTO v_user_message;

  INSERT INTO public.chat_messages (chat_id, user_id, role, content, sources, model)
  VALUES (v_chat_id, p_owner_id, 'assistant', p_answer, COALESCE(p_sources, '[]'::jsonb), p_model)
  RETURNING * INTO v_assistant_message;

  SELECT jsonb_build_object('id', c.id, 'title', c.title, 'created_at', c.created_at, 'updated_at', c.updated_at)
    INTO v_chat
    FROM public.chats AS c
   WHERE c.id = v_chat_id;

  RETURN jsonb_build_object(
    'chat', v_chat,
    'user_message', to_jsonb(v_user_message) - 'user_id' - 'chat_id',
    'assistant_message', to_jsonb(v_assistant_message) - 'user_id' - 'chat_id'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_chat_exchange(UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_chat_exchange(UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT) TO project_admin;
