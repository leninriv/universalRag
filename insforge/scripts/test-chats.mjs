#!/usr/bin/env node
/**
 * Prueba end-to-end del historial de chats con usuarios reales.
 *
 * Uso (credenciales de un usuario; el segundo es opcional y prueba el aislamiento entre usuarios):
 *   INSFORGE_TEST_EMAIL=... INSFORGE_TEST_PASSWORD=... \
 *   INSFORGE_TEST_EMAIL_2=... INSFORGE_TEST_PASSWORD_2=... \
 *   node insforge/scripts/test-chats.mjs
 *
 * También acepta tokens ya emitidos: INSFORGE_USER_TOKEN / INSFORGE_USER_TOKEN_2.
 * Hace 3 llamadas a `ask` (consume créditos del model gateway) y borra el chat al final.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const project = JSON.parse(readFileSync(`${root}.insforge/project.json`, 'utf8'));
const BASE_URL = process.env.INSFORGE_URL ?? project.oss_host;
const env = process.env;

let failures = 0;

async function main() {
  const tokenA = env.INSFORGE_USER_TOKEN ?? (await signIn(env.INSFORGE_TEST_EMAIL, env.INSFORGE_TEST_PASSWORD));
  const tokenB =
    env.INSFORGE_USER_TOKEN_2 ??
    (env.INSFORGE_TEST_EMAIL_2 ? await signIn(env.INSFORGE_TEST_EMAIL_2, env.INSFORGE_TEST_PASSWORD_2) : null);

  // 1. Primer mensaje: crea el chat
  const first = await ask(tokenA, { question: '¿Cuántos días de vacaciones tiene un empleado durante su primer año?' });
  check('ask sin chat_id crea un chat (201)', first.status === 201 && first.body.chat?.id, first);
  const chatId = first.body.chat.id;
  check(
    'la respuesta trae el mensaje del usuario y del asistente',
    first.body.user_message?.role === 'user' && first.body.assistant_message?.role === 'assistant',
    first.body,
  );
  console.log(`   chat: ${chatId} · "${first.body.chat.title}"`);
  console.log(`   respuesta: ${first.body.answer}`);

  // 2. Más mensajes en el mismo chat
  const second = await ask(tokenA, { chat_id: chatId, question: '¿Y cuál es el máximo de días que se puede llegar a tener?' });
  check('ask con chat_id agrega al mismo chat (200)', second.status === 200 && second.body.chat?.id === chatId, second);
  const third = await ask(tokenA, { chat_id: chatId, question: '¿Cuál es el salario promedio de los conductores?' });
  check('pregunta fuera de los documentos', third.status === 200 && third.body.found === false, third.body);
  console.log(`   respuesta: ${third.body.answer}`);

  // 3. Historial de chats
  const chats = await rpc(tokenA, 'list_chats', { page_size: 1 });
  check('list_chats devuelve el chat más reciente primero', chats.body.chats?.[0]?.id === chatId, chats.body);

  // 4. Mensajes paginados: 6 mensajes en páginas de 4 → [3..6] y luego [1..2]
  const page1 = await rpc(tokenA, 'get_chat_messages', { chat_id: chatId, page_size: 4 });
  const ids1 = (page1.body.messages ?? []).map((m) => m.id);
  check(
    'página 1: los 4 más recientes en orden cronológico, has_more = true',
    ids1.length === 4 && isAscending(ids1) && page1.body.has_more === true && page1.body.next_cursor === ids1[0],
    page1.body,
  );
  const page2 = await rpc(tokenA, 'get_chat_messages', { chat_id: chatId, page_size: 4, before_id: page1.body.next_cursor });
  const ids2 = (page2.body.messages ?? []).map((m) => m.id);
  check(
    'página 2: los 2 anteriores, has_more = false',
    ids2.length === 2 && isAscending(ids2) && ids2.at(-1) < ids1[0] && page2.body.has_more === false && page2.body.next_cursor === null,
    page2.body,
  );
  const roles = [...page2.body.messages, ...page1.body.messages].map((m) => m.role).join(',');
  check('los mensajes alternan user/assistant', roles === 'user,assistant,user,assistant,user,assistant', roles);

  // 5. Renombrar y permisos de escritura
  const renamed = await records(tokenA, 'PATCH', `chats?id=eq.${chatId}`, { title: 'Vacaciones en Nébula' });
  check('renombrar el chat', renamed.ok && renamed.body?.[0]?.title === 'Vacaciones en Nébula', renamed);
  const ownerChange = await records(tokenA, 'PATCH', `chats?id=eq.${chatId}`, { user_id: '00000000-0000-0000-0000-000000000000' });
  check('no se puede cambiar el dueño del chat', !ownerChange.ok, ownerChange);
  const forged = await records(tokenA, 'POST', 'chat_messages', [{ chat_id: chatId, role: 'assistant', content: 'falso' }]);
  check('no se pueden insertar mensajes directamente', !forged.ok, forged);

  // 6. Aislamiento entre usuarios
  if (tokenB) {
    const foreign = await rpc(tokenB, 'get_chat_messages', { chat_id: chatId });
    check('otro usuario no puede leer los mensajes', !foreign.ok, foreign);
    const foreignList = await rpc(tokenB, 'list_chats', {});
    check('otro usuario no ve el chat en su historial', !foreignList.body.chats?.some((c) => c.id === chatId), foreignList.body);
    const foreignAsk = await ask(tokenB, { chat_id: chatId, question: 'hola' });
    check('otro usuario no puede escribir en el chat (404)', foreignAsk.status === 404, foreignAsk);
    await records(tokenB, 'DELETE', `chats?id=eq.${chatId}`);
    const stillThere = await rpc(tokenA, 'get_chat_messages', { chat_id: chatId, page_size: 1 });
    check('otro usuario no puede borrar el chat', stillThere.ok, stillThere);
  } else {
    console.log('-  aislamiento entre usuarios: omitido (falta un segundo usuario)');
  }

  // 7. Documentos ingestados (lista compartida, un elemento por source)
  const documents = await rpc(tokenA, 'list_documents', {});
  const documentSources = Array.isArray(documents.body) ? documents.body.map((d) => d.source) : [];
  check(
    'list_documents: un elemento por source, con fecha de subida',
    documents.ok &&
      documentSources.length > 0 &&
      new Set(documentSources).size === documentSources.length &&
      documents.body.every((d) => d.source && d.uploaded_at && Object.keys(d).length === 2),
    documents.body,
  );

  // 8. Borrar el chat (sus mensajes se borran en cascada)
  const deleted = await records(tokenA, 'DELETE', `chats?id=eq.${chatId}`);
  const afterDelete = await rpc(tokenA, 'get_chat_messages', { chat_id: chatId });
  check('borrar el chat', deleted.ok && !afterDelete.ok, afterDelete);

  console.log(failures === 0 ? '\nTodo OK' : `\n${failures} prueba(s) fallaron`);
  process.exit(failures === 0 ? 0 : 1);
}

// ---------------------------------------------------------------------------

async function signIn(email, password) {
  if (!email || !password) {
    throw new Error('Define INSFORGE_TEST_EMAIL e INSFORGE_TEST_PASSWORD (o INSFORGE_USER_TOKEN).');
  }
  const res = await request('POST', '/api/auth/sessions?client_type=server', null, { email, password });
  if (!res.ok || !res.body?.accessToken) {
    throw new Error(`No se pudo iniciar sesión con ${email}: ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

const ask = (token, body) => request('POST', '/functions/ask', token, body);
const rpc = (token, fn, body) => request('POST', `/api/database/rpc/${fn}`, token, body);
const records = (token, method, path, body) =>
  request(method, `/api/database/records/${path}`, token, body, { Prefer: 'return=representation' });

async function request(method, path, token, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // respuesta no JSON
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

function check(name, condition, detail) {
  if (condition) {
    console.log(`✓  ${name}`);
  } else {
    failures++;
    console.log(`✗  ${name}\n   ${JSON.stringify(detail).slice(0, 500)}`);
  }
}

function isAscending(values) {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
