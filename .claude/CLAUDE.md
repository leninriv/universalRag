# Universal RAG — Guía del proyecto

Aplicación Angular 22 (standalone) con **Angular Material 22** (Material 3) como única librería de componentes UI.

## Comandos

- `npm start` — servidor de desarrollo en http://localhost:4200
- `npm run build` — build de producción (debe compilar sin errores antes de dar una tarea por terminada)
- `npm test` — tests unitarios (Karma + Jasmine)

## Regla principal: siempre Angular Material y reutilizar componentes

1. **Toda la UI se construye con componentes de Angular Material v22.** Documentación: https://material.angular.dev
   - Antes de escribir HTML/CSS propio para un control (botón, input, lista, menú, diálogo, sidenav, tabla, chip, tooltip, snackbar, etc.), busca el equivalente en Angular Material (o en el CDK) y úsalo.
   - No agregues otras librerías de UI (PrimeNG, Bootstrap, Tailwind, ng-zorro…).
   - Botones con la API nueva: `matButton` / `matButton="outlined|filled|tonal|elevated"`, `matIconButton`, `matFab`. Carga en un botón: `[showProgress]` + `<mat-progress-spinner progressIndicator>`.
   - Íconos: solo **Material Symbols** con `<mat-icon>nombre</mat-icon>` (fuente en `index.html`, `MAT_ICON_DEFAULT_OPTIONS` en `app.config.ts`). Los inputs de íconos de los componentes propios reciben el nombre del símbolo (`icon="folder"`).
   - Layout, espaciado y tipografía: utilidades de **PrimeFlex** (`flex`, `gap-2`, `p-3`, `text-color-secondary`, `surface-border`…), que se mantiene solo como librería CSS de utilidades. Para colores usa los tokens del tema (`var(--mat-sys-primary)`, `var(--mat-sys-surface-container)`, `var(--mat-sys-outline-variant)`…) o las clases de PrimeFlex mapeadas a ellos; nunca colores hardcodeados.
   - El SCSS de componente debe ser mínimo (solo lo que PrimeFlex no cubre). Personalizaciones globales de componentes Material van en `src/styles.scss` como variantes con clase propia (ej. `.app-nav-list`); para cambiar tokens de un componente usa los mixins `mat.<componente>-overrides(...)`.
   - Lo que Material no trae (avatar, skeleton, aviso en línea) está resuelto en el catálogo: úsalo en vez de crear otra versión.
   - **Todo debe verse bien en tema claro y oscuro.** El tema es M3 (`mat.theme` en `src/styles.scss`, primario violet y terciario azure). Los tokens `--mat-sys-*` usan `light-dark()`: el modo lo decide `color-scheme`, que `ThemeService` pone en `<html>` junto con la clase `app-dark`. `src/styles.scss` mapea las variables de PrimeFlex (`--surface-*`, `--text-color`, `--primary-color`, `--highlight-bg`…) a esos tokens, así que usa clases que dependen del tema (`surface-ground`, `surface-section`, `surface-card`, `surface-border`, `text-color`, `text-color-secondary`, `bg-primary`, `text-primary`) y nunca tonos fijos de paleta (`bg-white`, `surface-100`, `bg-gray-100`, `bg-primary-100`, `text-gray-700`…), que no cambian con el tema.

2. **Reutiliza antes de crear.** Antes de crear un componente nuevo:
   - Revisa el catálogo de abajo y `src/app/shared/components/`.
   - Si algo ya existe, úsalo o extiéndelo con `input()`s en lugar de duplicarlo.
   - Si un patrón de UI se repite en 2 o más lugares, extráelo a un componente reutilizable (`shared/` si lo usan varios módulos, `features/<modulo>/components/` si es propio de un módulo) y actualiza el catálogo de este archivo.

## Catálogo de componentes y estilos reutilizables

| Componente / clase | Ubicación | Uso |
| --- | --- | --- |
| `<app-coming-soon>` | `shared/components/coming-soon` | Placeholder de módulo no implementado (`moduleName`, `icon`, `description`). |
| `<app-brand>` | `layout/brand` | Logo + nombre de la app (`compact` = solo logo). |
| `<app-side-nav>` | `layout/side-nav` | Menú de módulos (items en `layout/navigation.ts`); `collapsed` = solo íconos con tooltip. |
| `<app-topbar>` | `layout/topbar` | Barra superior global: botón del menú lateral, contenido de la página, tema y avatar. |
| `<ng-template appTopbarContent>` | `layout/topbar/topbar-content.directive.ts` | Proyecta el título/acciones de una página en la barra superior. Úsalo en vez de crear otra barra de encabezado por página. |
| `<app-theme-toggle>` | `layout/theme-toggle` | Botón para alternar tema claro/oscuro. |
| `<app-user-menu>` | `layout/user-menu` | Avatar del usuario en sesión con menú desplegable (incluye "Cerrar sesión"). |
| `AuthService` | `core/services/auth.service.ts` | Login real contra InsForge (`POST /api/auth/sessions`). Sesión (`user()`, `isAuthenticated()`, `getToken()`, `login()`, `logout()`); se recuerda en `localStorage` hasta que expira el token. |
| `authGuard` / `guestGuard` | `core/guards/auth.guard.ts` | `authGuard` protege rutas privadas (redirige a `/login?returnUrl=…`); `guestGuard` saca de `/login` a quien ya tiene sesión. |
| `authTokenInterceptor` | `core/interceptors/auth-token.interceptor.ts` | Envía `Authorization: Bearer <token>` en las peticiones a `API_CONFIG.baseUrl` (menos el login). |
| `sessionInterceptor` | `core/interceptors/session.interceptor.ts` | Recibe el accessToken de la respuesta del login y lo guarda (vence según el `exp` del JWT); ante un 401 cierra sesión y lleva al login. |
| `ThemeService` | `core/services/theme.service.ts` | Tema actual (`mode`, `isDark`, `toggle()`); se recuerda en `localStorage`. |
| `LayoutService` | `layout/layout.service.ts` | Menú lateral colapsado (desktop), drawer abierto (mobile) y contenido de la barra superior. |
| `<app-avatar>` | `shared/components/avatar` | Círculo con ícono o iniciales (`icon`, `label`, `size` = `small`/`normal`/`xlarge`, `variant` = `primary`/`accent`). |
| `<app-drawer-header>` | `shared/components/drawer-header` | Cabecera de un `mat-sidenav` usado como drawer: contenido proyectado + botón cerrar (`closed`). |
| `.app-nav-list` | `src/styles.scss` | Variante de `mat-nav-list` para navegación lateral (subheaders, item activo con `[activated]` + `routerLinkActive`); `.app-nav-list-collapsed` = solo íconos. |
| `.app-drawer` | `src/styles.scss` | Variante de `mat-sidenav` (`mode="over"`) usada como drawer de navegación. |
| `.app-dense` | `src/styles.scss` | `mat-form-field` compacto (densidad -4), p. ej. buscadores. |
| `.app-button-multiline` | `src/styles.scss` | Botón de Material con contenido de varias líneas alineado a la izquierda (tarjetas de sugerencias). |
| `.app-icon-button-filled` | `src/styles.scss` | `matIconButton` relleno con el color primario (p. ej. "Enviar"). |
| `.app-callout` / `.app-callout-error` | `src/styles.scss` | Aviso en línea informativo / de error. |
| `.app-skeleton` | `src/styles.scss` | Línea de carga tipo skeleton (ancho con `style="width: …"`). |
| `.app-content-column` | `src/styles.scss` | Columna central de lectura (max 48rem). |
| `<app-chat-message>` | `features/agent/components/chat-message` | Burbuja de mensaje (usuario / agente). |
| `<app-chat-composer>` | `features/agent/components/chat-composer` | Caja para escribir y enviar mensajes. |
| `<app-chat-typing-indicator>` | `features/agent/components/chat-typing-indicator` | Placeholder mientras responde el agente. |
| `<app-chat-history>` | `features/agent/components/chat-history` | Nuevo chat + buscador + historial agrupado por fecha. |

## Arquitectura

```
src/app/
  core/services/     Servicios globales de la app (tema, etc.)
  layout/            Shell: menú lateral colapsable (desktop) / drawer (mobile) + barra superior
  shared/components/ Componentes reutilizables entre módulos
  features/
    auth/            Login (ruta /login, pública)
    agent/           Chat estilo ChatGPT (rutas /agent y /agent/:chatId)
    file-manager/    Coming soon
    open-wa/         Coming soon
```

- Cada módulo es independiente y se carga con lazy loading desde `app.routes.ts` (`features/<modulo>/<modulo>.routes.ts`). Un módulo no importa nada de otro módulo; lo compartido va a `shared/`.
- Todas las rutas salvo `/login` están protegidas por `authGuard` (en la ruta del shell, `app.routes.ts`).
- Para agregar un módulo: crear `features/<modulo>/` con su archivo de rutas, registrarlo en `app.routes.ts` y agregar su item en `layout/navigation.ts`.
- Componentes standalone con `ChangeDetectionStrategy.OnPush`.
- Estado con signals (`signal`, `computed`, `input()`, `output()`, `viewChild()`); control flow nativo (`@if`, `@for`).
- Los parámetros de ruta llegan como `input()` gracias a `withComponentInputBinding()`.
- Los módulos de Angular Material se importan en el array `imports` de cada componente (`MatButtonModule`, `MatIconModule`, …).
- Textos de la UI en español.

## Backend (InsForge)

El backend es [InsForge](https://insforge.dev), proyecto **universalRag** (`project_id` 017d3d66-0eae-4147-ab79-ce65956d2cec), ya vinculado a este directorio.

- Para tareas de backend usa la CLI (`npx insforge …`, instalada como devDependency) y las skills de InsForge (`insforge-cli`, `insforge`, `insforge-debug`, `insforge-integrations`) en lugar de adivinar la API.
- Credenciales: la CLI lee `.insforge/project.json` (ignorado por git). Nunca copies keys al código ni las subas al repositorio.
- El frontend solo está conectado al backend en el **login** (HTTP directo). No agregues `@insforge/sdk`, `.env.local` ni otras llamadas al backend en `src/` hasta que se pida explícitamente.

### RAG

| Pieza | Ubicación | Notas |
| --- | --- | --- |
| Tabla `public.documents` + `match_documents()` | `migrations/` | `embedding vector(1536)` (text-embedding-3-small), índice HNSW coseno. `score` = similitud coseno. RLS activo y sin privilegios para `anon`/`authenticated`: solo se accede vía edge functions. |
| Edge function `ingest` | `insforge/functions/ingest.ts` | Solo usuarios con sesión iniciada (el anon key y la API key se rechazan). Chunks de ≤500 tokens (`cl100k_base`) con 100 de overlap respetando oraciones; re-ingestar un `source` reemplaza sus chunks. |
| Edge function `ask` | `insforge/functions/ask.ts` | Solo usuarios con sesión iniciada (el anon key y la API key se rechazan). Top 5 chunks → LLM (`OPENROUTER_CHAT_MODEL`, hoy `deepseek/deepseek-v4.1-flash`); si no está en el contexto responde "No tengo esa información en mis documentos". Siempre guarda pregunta y respuesta en el chat del usuario (`chat_id` opcional; sin él crea uno). |
| RPC `list_documents()` | `migrations/20261005000748_create-list-documents.sql` | Cualquier usuario autenticado. Un elemento por `source`: `[{ source, uploaded_at }]`, más recientes primero. `SECURITY DEFINER` para no abrir `documents` (texto y embeddings) a los clientes. Paginación con `?limit=&offset=`. |
| Prueba end-to-end | `insforge/scripts/test-rag.sh` | Ingesta `insforge/samples/nebula-logistica.txt` y hace una pregunta presente y otra ausente. Requiere `INSFORGE_USER_TOKEN` o `INSFORGE_TEST_EMAIL`/`INSFORGE_TEST_PASSWORD`. |

### Historial de chats

| Pieza | Ubicación | Notas |
| --- | --- | --- |
| Tablas `chats` y `chat_messages` | `migrations/20261004233510_create-chats.sql` | Cada usuario ve, renombra (`title`) y borra solo sus chats (RLS). Los mensajes (`role` user/assistant, `content`, `sources`, `model`) solo los escribe el servidor. Borrar un chat borra sus mensajes. |
| RPC `list_chats(page_size, before_cursor)` | misma migración | Historial del usuario por última actividad. Devuelve `{ chats, has_more, next_cursor }`. |
| RPC `get_chat_messages(chat_id, before_id, page_size)` | misma migración | Primera página = mensajes más recientes; para cargar anteriores se pasa `next_cursor` como `before_id`. Cada página viene en orden cronológico: `{ chat, messages, has_more, next_cursor }`. |
| RPC `save_chat_exchange(...)` | misma migración | Interna (solo `project_admin`): la usa `ask` para guardar pregunta + respuesta en una transacción. |
| Prueba end-to-end | `insforge/scripts/test-chats.mjs` | Requiere credenciales de 1 o 2 usuarios (ver cabecera del script). |

Endpoints (todos con `Authorization: Bearer <token del usuario>`):
- Enviar mensaje: `POST /functions/ask` `{ question, chat_id? }`
- Historial: `POST /api/database/rpc/list_chats`
- Mensajes paginados: `POST /api/database/rpc/get_chat_messages`
- Renombrar: `PATCH /api/database/records/chats?id=eq.<id>` `{ title }`
- Borrar: `DELETE /api/database/records/chats?id=eq.<id>`
- Documentos ingestados: `POST /api/database/rpc/list_documents` (opcional `?limit=20&offset=0`)

- Desplegar una función: `npx -y @insforge/cli functions deploy <slug> --file insforge/functions/<slug>.ts`. Cada función es un solo archivo (no pueden importarse entre sí).
- Endpoints: `https://fkk6yt6n.us-east.insforge.app/functions/<slug>`.
- Las funciones leen `API_KEY`, `INSFORGE_BASE_URL`, `OPENROUTER_API_KEY` y `OPENROUTER_CHAT_MODEL` de los secrets del proyecto.
- La organización está en plan free: el Model Gateway de InsForge y su memoria de agente no están disponibles. `OPENROUTER_API_KEY` es una key propia de OpenRouter.

@../AGENTS.md

## Estado actual

- Solo UI: `features/agent/services/chat.service.ts` guarda los chats en memoria y simula las respuestas del agente. Al conectar el backend, reemplazar la lógica de ese servicio manteniendo su API pública.
- Login **real** con InsForge vía HTTP (`AuthService` → `POST /api/auth/sessions`, sin `@insforge/sdk`); `API_CONFIG.baseUrl` es la URL del proyecto. No hay refresh token: al vencer el access token (`exp` del JWT) se vuelve al login. El proyecto exige verificar el correo (`require_email_verification`). El resto del frontend (chats, ask) sigue sin conectarse.
- Las opciones "Perfil" y "Configuración" del menú de usuario aún no tienen acción.
