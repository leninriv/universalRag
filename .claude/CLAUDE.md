# Universal RAG — Guía del proyecto

Aplicación Angular 18 (standalone) con **PrimeNG 17** como única librería de componentes UI.

## Comandos

- `npm start` — servidor de desarrollo en http://localhost:4200
- `npm run build` — build de producción (debe compilar sin errores antes de dar una tarea por terminada)
- `npm test` — tests unitarios (Karma + Jasmine)

## Regla principal: siempre PrimeNG y reutilizar componentes

1. **Toda la UI se construye con componentes de PrimeNG v17.** Documentación: https://v17.primeng.org/installation
   - Antes de escribir HTML/CSS propio para un control (botón, input, lista, menú, modal, drawer, tabla, tag, avatar, tooltip, skeleton, toast, etc.), busca el equivalente en PrimeNG y úsalo.
   - No agregues otras librerías de UI (Angular Material, Bootstrap, Tailwind, ng-zorro…).
   - Íconos: solo **PrimeIcons** (`pi pi-*`).
   - Layout, espaciado, tipografía y colores: utilidades de **PrimeFlex** (`flex`, `gap-2`, `p-3`, `text-color-secondary`, `surface-border`…). Para colores usa las variables del tema (`var(--primary-color)`, `var(--surface-border)`, `var(--highlight-bg)`…); nunca colores hardcodeados.
   - El SCSS de componente debe ser mínimo (solo lo que PrimeFlex no cubre). Personalizaciones globales de componentes PrimeNG van en `src/styles.scss` como variantes con clase propia (ej. `.app-nav-menu`).
   - Mantén PrimeNG en la línea **17.x** (PrimeNG 18+ cambia el sistema de temas).
   - **Todo debe verse bien en tema claro y oscuro.** Los temas son `lara-light-indigo` y `lara-dark-indigo`, generados como bundles aparte en `angular.json` y alternados por `ThemeService` (no los agregues como estilos inyectados). Usa clases que dependen del tema (`surface-ground`, `surface-section`, `surface-card`, `surface-border`, `text-color`, `text-color-secondary`, `bg-primary`, `text-primary`) y nunca tonos fijos de paleta (`bg-white`, `bg-gray-100`, `bg-primary-100`, `text-gray-700`…), que no cambian con el tema.

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
| `<app-user-menu>` | `layout/user-menu` | Avatar del usuario con menú desplegable. |
| `ThemeService` | `core/services/theme.service.ts` | Tema actual (`mode`, `isDark`, `toggle()`); se recuerda en `localStorage`. |
| `LayoutService` | `layout/layout.service.ts` | Menú lateral colapsado (desktop), drawer abierto (mobile) y contenido de la barra superior. |
| `.app-avatar-accent` | `src/styles.scss` | Variante de `p-avatar` con el color de acento del tema. |
| `.app-nav-menu` | `src/styles.scss` | Variante de `p-menu` para navegación lateral; resalta el item cuya `routerLink` está activa. |
| `.app-drawer` | `src/styles.scss` | Variante de `p-sidebar` sin padding en el contenido. |
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
    agent/           Chat estilo ChatGPT (rutas /agent y /agent/:chatId)
    file-manager/    Coming soon
    open-wa/         Coming soon
```

- Cada módulo es independiente y se carga con lazy loading desde `app.routes.ts` (`features/<modulo>/<modulo>.routes.ts`). Un módulo no importa nada de otro módulo; lo compartido va a `shared/`.
- Para agregar un módulo: crear `features/<modulo>/` con su archivo de rutas, registrarlo en `app.routes.ts` y agregar su item en `layout/navigation.ts`.
- Componentes standalone con `ChangeDetectionStrategy.OnPush`.
- Estado con signals (`signal`, `computed`, `input()`, `output()`, `viewChild()`); control flow nativo (`@if`, `@for`).
- Los parámetros de ruta llegan como `input()` gracias a `withComponentInputBinding()`.
- Los módulos de PrimeNG se importan en el array `imports` de cada componente (`ButtonModule`, `MenuModule`, …).
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
- El usuario del avatar es un dato de ejemplo (`CURRENT_USER` en `layout/user-menu`) y sus opciones de menú aún no tienen acción.
