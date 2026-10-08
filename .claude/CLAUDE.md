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
| `AuthService` | `core/services/auth.service.ts` | Sesión (`user()`, `isAuthenticated()`, `getToken()`, `login()`, `logout()`); se recuerda en `localStorage` hasta que expira el token. |
| `authGuard` / `guestGuard` | `core/guards/auth.guard.ts` | `authGuard` protege rutas privadas (redirige a `/login?returnUrl=…`); `guestGuard` saca de `/login` a quien ya tiene sesión. |
| `authTokenInterceptor` | `core/interceptors/auth-token.interceptor.ts` | Envía `Authorization: Bearer <token>` en las peticiones a `API_CONFIG.baseUrl` (menos el login). |
| `sessionInterceptor` | `core/interceptors/session.interceptor.ts` | Recibe el token de la respuesta del login y lo guarda; ante un 401 cierra sesión y lleva al login. |
| `authMockInterceptor` | `core/mocks/auth-mock.interceptor.ts` | Backend falso de `POST /auth/login` (credenciales en `MOCK_CREDENTIALS`). Se activa con `API_CONFIG.useMocks` en `core/config/api.config.ts`. |
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
- **Todavía no se conecta el frontend con el backend.** No agregues `@insforge/sdk`, `.env.local` ni llamadas al backend en `src/` hasta que se pida explícitamente.

### RAG

| Pieza | Ubicación | Notas |
| --- | --- | --- |
| Tabla `public.documents` + `match_documents()` | `migrations/` | `embedding vector(1536)` (text-embedding-3-small), índice HNSW coseno. `score` = similitud coseno. RLS activo y sin privilegios para `anon`/`authenticated`: solo se accede vía edge functions. |
| Edge function `ingest` | `insforge/functions/ingest.ts` | Solo con la API key. Chunks de ≤500 tokens (`cl100k_base`) con 100 de overlap respetando oraciones; re-ingestar un `source` reemplaza sus chunks. |
| Edge function `ask` | `insforge/functions/ask.ts` | Token de usuario autenticado o API key (el anon key no). Top 5 chunks → LLM (`OPENROUTER_CHAT_MODEL`, por defecto `openai/gpt-4o-mini`); si no está en el contexto responde "No tengo esa información en mis documentos". |
| Prueba end-to-end | `insforge/scripts/test-rag.sh` | Ingesta `insforge/samples/nebula-logistica.txt` y hace una pregunta presente y otra ausente. |

- Desplegar una función: `npx -y @insforge/cli functions deploy <slug> --file insforge/functions/<slug>.ts`. Cada función es un solo archivo (no pueden importarse entre sí).
- Endpoints: `https://fkk6yt6n.us-east.insforge.app/functions/<slug>`.
- Las funciones leen `API_KEY`, `INSFORGE_BASE_URL` y `OPENROUTER_API_KEY` de los secrets del proyecto.
- **Pendiente:** la organización está en plan free y el Model Gateway (y la memoria de agente de InsForge) solo funcionan en planes pagos; el secret `OPENROUTER_API_KEY` todavía no existe, así que `ingest` y `ask` responden 500 hasta configurarlo.

@../AGENTS.md

## Estado actual

- Solo UI: `features/agent/services/chat.service.ts` guarda los chats en memoria y simula las respuestas del agente. Al conectar el backend, reemplazar la lógica de ese servicio manteniendo su API pública.
- Login con **mock**: no hay API de autenticación todavía, `authMockInterceptor` responde `POST /api/auth/login`. Al existir el endpoint real: poner `API_CONFIG.useMocks = false` (y ajustar `baseUrl`) y borrar `core/mocks/`; guards, interceptores y `AuthService` no cambian. La respuesta esperada es `LoginResponse` (`core/models/auth.model.ts`).
- Las opciones "Perfil" y "Configuración" del menú de usuario aún no tienen acción.
