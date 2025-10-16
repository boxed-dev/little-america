# ChatGPT Apps SDK Next.js Starter - Comprehensive Analysis

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Model Context Protocol (MCP)](#model-context-protocol-mcp)
4. [OpenAI Apps SDK](#openai-apps-sdk)
5. [Technical Implementation Analysis](#technical-implementation-analysis)
6. [Next.js Integration Challenges & Solutions](#nextjs-integration-challenges--solutions)
7. [Codebase Structure & Components](#codebase-structure--components)
8. [API Reference](#api-reference)
9. [Best Practices & Design Patterns](#best-practices--design-patterns)
10. [Deployment & Production Considerations](#deployment--production-considerations)
11. [Future Roadmap & Ecosystem](#future-roadmap--ecosystem)

---

## Executive Summary

This repository demonstrates a production-ready integration of Next.js with ChatGPT using the OpenAI Apps SDK and Model Context Protocol (MCP). The project solves seven critical technical challenges related to running a modern JavaScript framework inside ChatGPT's sandboxed iframe architecture.

**Key Capabilities:**
- MCP server exposing tools callable from ChatGPT
- Custom widget rendering with React components
- Bidirectional communication between ChatGPT and your app
- State persistence across sessions
- Cross-origin resource handling
- Mobile and desktop compatibility

**Tech Stack:**
- Next.js 15.5.4 with Turbopack
- React 19.1.0
- TypeScript 5.x
- Model Context Protocol SDK 1.20.0
- Tailwind CSS 4.x
- Zod 3.24.2 for schema validation

---

## Architecture Overview

### The Three-Layer Iframe Architecture

ChatGPT uses a sophisticated security model with three nested iframes:

```
chatgpt.com (Host Window)
└── web-sandbox.oaiusercontent.com (Outer Sandbox Iframe)
    └── web-sandbox.oaiusercontent.com (Inner Sandbox Iframe)
       └── Your App's HTML (Next.js Application)
```

**Security Benefits:**
1. Complete origin isolation
2. CSP (Content Security Policy) enforcement
3. Prevention of XSS attacks
4. Protection of user data and conversation history

**Technical Challenge:**
This architecture creates fundamental incompatibilities with Next.js, which expects:
- Same-origin asset loading
- Direct history API access
- Standard fetch behavior for RSC (React Server Components)

### Communication Flow

```
User Input → ChatGPT Model → MCP Server (Tool Call)
                                    ↓
                            Tool Response + Resource URI
                                    ↓
                      ChatGPT Renders Widget (iframe)
                                    ↓
                         Next.js App Hydrates
                                    ↓
                     window.openai API Bridge Active
                                    ↓
              Bidirectional Communication Established
```

---

## Model Context Protocol (MCP)

### What is MCP?

Model Context Protocol is an **open-source standard** (introduced by Anthropic in November 2024) for connecting AI applications to external systems. It's the backbone that keeps server, model, and UI in sync by standardizing:

- Wire format (JSON-RPC 2.0)
- Authentication mechanisms (OAuth 2.1)
- Tool/resource metadata structures
- Transport protocols

**Current Specification:** Version 2025-06-18
**Next Release:** November 25, 2025

### MCP Core Concepts

#### 1. Tools
Callable functions that the AI model can invoke during conversations.

**Structure:**
```typescript
{
  name: "tool_identifier",
  title: "Human Readable Name",
  description: "What this tool does",
  inputSchema: z.object({ /* Zod schema */ }),
  _meta: {
    "openai/outputTemplate": "ui://widget/template.html",
    "openai/toolInvocation/invoking": "Loading...",
    "openai/toolInvocation/invoked": "Loaded",
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true
  }
}
```

#### 2. Resources
HTML templates or data that can be embedded in the conversation.

**MIME Type:** `text/html+skybridge` (for widget rendering)

**Structure:**
```typescript
{
  uri: "ui://widget/content-template.html",
  title: "Widget Title",
  description: "Widget purpose",
  mimeType: "text/html+skybridge",
  _meta: {
    "openai/widgetDescription": "...",
    "openai/widgetPrefersBorder": true,
    "openai/widgetDomain": "https://example.com"
  }
}
```

#### 3. Tool Responses
Structured data returned after tool execution.

**Three Key Fields:**

1. **`structuredContent`** (object)
   - Visible to the model
   - Must match declared `outputSchema`
   - Used for AI reasoning

2. **`content`** (string | array)
   - Visible to model and component
   - Optional Markdown/text format
   - Displayed in conversation

3. **`_meta`** (object)
   - Component-only data
   - **Hidden from the model**
   - Arbitrary JSON structure

### MCP Transport Mechanisms

**Supported Options:**
1. **Streamable HTTP** (Recommended by OpenAI)
2. Server-Sent Events (SSE)
3. Standard HTTP

**Why Streamable HTTP?**
- Better latency characteristics
- Simplified error handling
- Native browser support
- Works across mobile/desktop platforms

### MCP Authentication

Built-in OAuth 2.1 support with:
- Authorization code flow
- Token refresh mechanisms
- Protected resource handling
- Security scheme declarations in `_meta`

**Recent Security Updates (June 2025):**
- Resource Indicators to prevent malicious servers
- Clarified authorization handling
- Enhanced token security

---

## OpenAI Apps SDK

### Overview

**Status:** Developer Preview (January 2025)
**App Submission:** Opening later in 2025

The Apps SDK is OpenAI's official framework for building apps that run inside ChatGPT. It provides:

- MCP server integration
- Widget rendering system
- State persistence
- Cross-platform compatibility (web, iOS, Android, desktop)

### window.openai Component Bridge

The SDK injects a `window.openai` global object into your iframe, providing:

#### Data Access Properties

| Property | Type | Description |
|----------|------|-------------|
| `theme` | `"light" \| "dark"` | Current ChatGPT theme |
| `locale` | `string` | User's locale (RFC 4647) |
| `userAgent` | `UserAgent` | Device type and capabilities |
| `maxHeight` | `number` | Available height in pixels |
| `displayMode` | `DisplayMode` | Current layout mode |
| `safeArea` | `SafeArea` | Safe area insets |
| `toolInput` | `object` | Input parameters from tool call |
| `toolOutput` | `object \| null` | Previous tool execution result |
| `toolResponseMetadata` | `object \| null` | Additional response metadata |
| `widgetState` | `object \| null` | Persisted component state |

#### Action Methods

| Method | Parameters | Description |
|--------|-----------|-------------|
| `callTool()` | `(name: string, args: object)` | Invoke MCP tools from component |
| `sendFollowUpMessage()` | `({ prompt: string })` | Insert message into chat |
| `requestDisplayMode()` | `({ mode: DisplayMode })` | Request layout change |
| `setWidgetState()` | `(state: object)` | Persist state (visible to model) |
| `openExternal()` | `({ href: string })` | Open external URLs |

### Display Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `inline` | Embedded in chat | Default widget view |
| `pip` | Picture-in-picture | Background tasks |
| `fullscreen` | Full viewport | Complex UIs, forms |

**Mobile Behavior:** PiP automatically coerces to fullscreen

### Widget State Management

**Critical Rule:** State passed to `setWidgetState()` is:
1. Visible to the AI model
2. Persists across page refreshes
3. Survives user sessions
4. Limited to ~4k tokens

**Best Practice:** Use `widgetState` for model-relevant data only. Store UI-only state locally.

### Security & CSP

Declare Content Security Policy requirements:

```typescript
_meta: {
  "openai/widgetCSP": {
    "connect_domains": ["api.example.com"],
    "resource_domains": ["cdn.example.com"]
  }
}
```

### Localization

The SDK negotiates locale during initialization:
- Uses RFC 4647 lookup rules
- Falls back to default locale
- Echo resolved locale tags in responses

---

## Technical Implementation Analysis

### File: `app/mcp/route.ts`

**Purpose:** Core MCP server implementation

**Key Components:**

#### 1. HTML Fetcher Function
```typescript
const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};
```

**Why This Matters:**
- Pre-renders Next.js pages server-side
- Captures complete HTML including `<head>` and scripts
- Embeds directly in MCP resource responses
- Eliminates cross-origin fetch issues

#### 2. Content Widget Structure
```typescript
type ContentWidget = {
  id: string;                 // Tool identifier
  title: string;              // Human-readable name
  templateUri: string;        // Resource URI (ui://widget/...)
  invoking: string;           // Loading state text
  invoked: string;            // Completion state text
  html: string;               // Actual widget HTML
  description: string;        // Tool purpose
  widgetDomain: string;       // Optional custom domain
};
```

#### 3. Resource Registration
```typescript
server.registerResource(
  "content-widget",
  contentWidget.templateUri,
  {
    title: contentWidget.title,
    description: contentWidget.description,
    mimeType: "text/html+skybridge",  // Critical for rendering
    _meta: {
      "openai/widgetDescription": contentWidget.description,
      "openai/widgetPrefersBorder": true
    }
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "text/html+skybridge",
      text: `<html>${contentWidget.html}</html>`,
      _meta: {
        "openai/widgetDescription": contentWidget.description,
        "openai/widgetPrefersBorder": true,
        "openai/widgetDomain": contentWidget.widgetDomain
      }
    }]
  })
);
```

**Resource Callback Function:**
- Invoked when ChatGPT requests the resource
- Receives the full URI as parameter
- Returns HTML wrapped in `<html>` tags
- Includes duplicate metadata (for compatibility)

#### 4. Tool Registration with Zod Schema
```typescript
server.registerTool(
  contentWidget.id,
  {
    title: contentWidget.title,
    description: "Fetch and display the homepage content with the name of the user",
    inputSchema: {
      name: z.string().describe("The name of the user to display on the homepage")
    },
    _meta: widgetMeta(contentWidget)
  },
  async ({ name }) => {
    return {
      content: [{
        type: "text",
        text: name
      }],
      structuredContent: {
        name: name,
        timestamp: new Date().toISOString()
      },
      _meta: widgetMeta(contentWidget)
    };
  }
);
```

**Tool Handler Function:**
- Receives validated input parameters
- Returns three types of content (see MCP section)
- Links to resource via `_meta["openai/outputTemplate"]`

#### 5. HTTP Method Exports
```typescript
export const GET = handler;
export const POST = handler;
```

**Why Both Methods?**
- GET: Initial capability discovery
- POST: Tool invocation and resource fetching
- Same handler supports both (MCP library handles routing)

---

### File: `middleware.ts`

**Purpose:** Handle CORS for cross-origin RSC fetching

**Critical Challenge:** Next.js client-side navigation uses fetch to load RSC payloads. When running in iframe with different origin, these requests:
1. Trigger browser CORS preflight (OPTIONS)
2. Require specific CORS headers
3. Must allow all headers/methods

**Implementation:**

```typescript
export function middleware(request: NextRequest) {
  // Handle preflight requests
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,  // No Content
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }

  // Add CORS headers to all responses
  return NextResponse.next({
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

// Apply to all routes
export const config = {
  matcher: "/:path*"
};
```

**Production Consideration:** In production, replace `"*"` with specific ChatGPT domains for enhanced security.

---

### File: `app/layout.tsx`

**Purpose:** Root layout with SDK bootstrap and API patches

#### NextChatSDKBootstrap Component

This component solves multiple iframe-related issues:

**1. Base URL Configuration**
```typescript
<base href={baseURL}></base>
```
- Forces all relative URLs to resolve against app domain
- Fixes images, fonts, API calls, links
- Critical for asset loading

**2. Global Flags**
```typescript
<script>{`window.innerBaseUrl = ${JSON.stringify(baseURL)}`}</script>
<script>{`window.__isChatGptApp = typeof window.openai !== "undefined";`}</script>
```
- Makes base URL available to client-side code
- Detects ChatGPT environment for conditional rendering

**3. HTML Attribute Observer**
```typescript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "attributes" &&
        mutation.target === htmlElement) {
      const attrName = mutation.attributeName;
      if (attrName && attrName !== "suppresshydrationwarning") {
        htmlElement.removeAttribute(attrName);
      }
    }
  });
});
observer.observe(htmlElement, {
  attributes: true,
  attributeOldValue: true
});
```

**Why This Is Needed:**
- ChatGPT modifies `<html>` attributes (theme, lang, etc.)
- These modifications cause React hydration mismatches
- Observer removes unwanted attributes immediately
- `suppressHydrationWarning` on `<html>` suppresses warnings

**4. History API Patching**
```typescript
const originalPushState = history.pushState;
history.pushState = (s, unused, url) => {
  const u = new URL(url ?? "", window.location.href);
  const href = u.pathname + u.search + u.hash;
  originalPushState.call(history, unused, href);
};

const originalReplaceState = history.replaceState;
history.replaceState = (s, unused, url) => {
  const u = new URL(url ?? "", window.location.href);
  const href = u.pathname + u.search + u.hash;
  originalReplaceState.call(history, unused, href);
};
```

**Security Motivation:**
- Prevents full-origin URLs in browser history
- Strips protocol and domain
- Preserves only path, search, and hash
- Maintains ChatGPT sandbox security boundary

**5. External Link Handling**
```typescript
window.addEventListener("click", (e) => {
  const a = (e?.target as HTMLElement)?.closest("a");
  if (!a || !a.href) return;

  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin &&
      url.origin != appOrigin) {
    try {
      if (window.openai) {
        window.openai.openExternal({ href: a.href });
        e.preventDefault();
      }
    } catch {
      console.warn("openExternal failed, likely not in OpenAI client");
    }
  }
}, true);
```

**Behavior:**
- Intercepts all link clicks
- Detects external links (different origin)
- Routes through `window.openai.openExternal()`
- Falls back to standard behavior if not in ChatGPT
- Uses capture phase (third parameter: `true`)

**6. Fetch API Patching**
```typescript
if (isInIframe && window.location.origin !== appOrigin) {
  const originalFetch = window.fetch;

  window.fetch = (input: URL | RequestInfo, init?: RequestInit) => {
    let url: URL;
    if (typeof input === "string" || input instanceof URL) {
      url = new URL(input, window.location.href);
    } else {
      url = new URL(input.url, window.location.href);
    }

    if (url.origin === appOrigin) {
      // Already has correct origin
      if (typeof input === "string" || input instanceof URL) {
        input = url.toString();
      } else {
        input = new Request(url.toString(), input);
      }

      return originalFetch.call(window, input, {
        ...init,
        mode: "cors"
      });
    }

    if (url.origin === window.location.origin) {
      // Rewrite same-origin to app origin
      const newUrl = new URL(baseUrl);
      newUrl.pathname = url.pathname;
      newUrl.search = url.search;
      newUrl.hash = url.hash;
      url = newUrl;

      if (typeof input === "string" || input instanceof URL) {
        input = url.toString();
      } else {
        input = new Request(url.toString(), input);
      }

      return originalFetch.call(window, input, {
        ...init,
        mode: "cors"
      });
    }

    return originalFetch.call(window, input, init);
  };
}
```

**Critical Logic:**
1. Only patches fetch when in iframe with different origin
2. Rewrites same-origin requests to use app origin
3. Forces CORS mode for cross-origin requests
4. Preserves path, search, and hash
5. Enables Next.js RSC navigation

**suppressHydrationWarning:**
```typescript
<html lang="en" suppressHydrationWarning>
```

**Required Because:**
- ChatGPT modifies HTML before React hydrates
- Causes hydration mismatches without suppression
- Will be unnecessary once ChatGPT stops modifying HTML

---

### File: `baseUrl.ts`

**Purpose:** Environment-aware URL configuration

```typescript
export const baseURL =
  process.env.NODE_ENV == "development"
    ? "http://localhost:3000"
    : "https://" +
      (process.env.VERCEL_ENV === "production"
        ? process.env.VERCEL_PROJECT_PRODUCTION_URL
        : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL);
```

**Smart Defaults:**
1. **Development:** localhost:3000
2. **Production (Vercel):** `VERCEL_PROJECT_PRODUCTION_URL`
3. **Preview (Vercel):** `VERCEL_BRANCH_URL`
4. **Fallback:** `VERCEL_URL`

**Why This Matters:**
- Automatically handles Vercel deployments
- No manual configuration needed
- Supports preview branches for testing
- Used in both server and client code

---

### File: `next.config.ts`

**Purpose:** Configure asset prefix for iframe compatibility

```typescript
import type { NextConfig } from "next";
import { baseURL } from "./baseUrl";

const nextConfig: NextConfig = {
  assetPrefix: baseURL,
};

export default nextConfig;
```

**Critical for Asset Loading:**
Without this, Next.js would request:
```
https://web-sandbox.oaiusercontent.com/_next/static/chunks/app.js  ❌ 404
```

With this, Next.js requests:
```
https://your-app.vercel.app/_next/static/chunks/app.js  ✓ 200
```

**Affected Assets:**
- JavaScript chunks
- CSS stylesheets
- Font files
- Build manifests
- Webpack HMR (in development)

---

### File: `app/page.tsx`

**Purpose:** Homepage demonstrating SDK integration

**Key Hooks Used:**

#### 1. useWidgetProps
```typescript
const toolOutput = useWidgetProps<{
  name?: string;
  result?: { structuredContent?: { name?: string } };
}>();

const name = toolOutput?.result?.structuredContent?.name || toolOutput?.name;
```

**Retrieves:**
- Tool input parameters
- Tool execution results
- Structured content returned by MCP server

#### 2. useMaxHeight
```typescript
const maxHeight = useMaxHeight() ?? undefined;

<div style={{
  maxHeight,
  height: displayMode === "fullscreen" ? maxHeight : undefined
}}>
```

**Enables:**
- Responsive layouts
- Proper scrolling behavior
- Fullscreen mode support

#### 3. useDisplayMode
```typescript
const displayMode = useDisplayMode();

{displayMode !== "fullscreen" && (
  <button onClick={() => requestDisplayMode("fullscreen")}>
    Enter Fullscreen
  </button>
)}
```

**Current Mode:**
- `inline`: Embedded in chat
- `pip`: Picture-in-picture
- `fullscreen`: Full viewport

#### 4. useRequestDisplayMode
```typescript
const requestDisplayMode = useRequestDisplayMode();

const handleExpand = async () => {
  const { mode } = await requestDisplayMode("fullscreen");
  console.log("Granted mode:", mode);
};
```

**Behavior:**
- Requests mode change from host
- Host may deny request
- Returns granted mode (may differ from request)

#### 5. useIsChatGptApp
```typescript
const isChatGptApp = useIsChatGptApp();

{!isChatGptApp && (
  <div className="warning">
    This app relies on data from a ChatGPT session.
  </div>
)}
```

**Detects:**
- Whether running inside ChatGPT
- Useful for conditional rendering
- Enables graceful fallbacks

**Warning Component:**
Shows blue info banner when viewed outside ChatGPT:
- Explains app context
- Links to API reference
- Indicates missing `window.openai` property

---

### File: `app/hooks/index.ts`

**Purpose:** Central export point for all SDK hooks

**Hook Categories:**

#### OpenAI API Hooks (Actions)
- `useCallTool` - Invoke MCP tools
- `useSendMessage` - Send chat messages
- `useOpenExternal` - Open external URLs
- `useRequestDisplayMode` - Request layout changes

#### OpenAI State Hooks (Data)
- `useDisplayMode` - Current layout mode
- `useWidgetProps` - Tool input/output
- `useWidgetState` - Persistent state
- `useOpenAIGlobal` - Low-level global access

#### Utility Hooks
- `useMaxHeight` - Available height
- `useIsChatGptApp` - Environment detection

---

### File: `app/hooks/use-openai-global.ts`

**Purpose:** Low-level hook for subscribing to `window.openai` properties

**Implementation Pattern:**

```typescript
export function useOpenAIGlobal<K extends keyof OpenAIGlobals>(
  key: K
): OpenAIGlobals[K] | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const handleSetGlobal = (event: SetGlobalsEvent) => {
        const value = event.detail.globals[key];
        if (value === undefined) return;
        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true
      });

      return () => {
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
      };
    },
    () => (typeof window !== "undefined" ? window.openai?.[key] ?? null : null),
    () => null  // Server snapshot
  );
}
```

**Why useSyncExternalStore?**
- React 18+ concurrent mode safe
- Automatic subscription management
- Server-side rendering compatible
- Prevents tearing (inconsistent UI state)

**Event-Based Reactivity:**
- ChatGPT dispatches `openai:set_globals` events
- Hook subscribes to these events
- Re-renders component when values change
- Efficient (only subscribes to requested key)

**Source Attribution:**
Based on official examples from `openai/openai-apps-sdk-examples`

---

### File: `app/hooks/use-widget-state.ts`

**Purpose:** Manage persistent widget state with bidirectional sync

**Key Features:**

#### 1. useState-like API
```typescript
const [state, setState] = useWidgetState<MyState>({ count: 0 });

const increment = () => {
  setState(prev => ({ ...prev, count: prev.count + 1 }));
};
```

#### 2. Bidirectional Sync
- **From ChatGPT:** Initial state and updates via `window.openai.widgetState`
- **To ChatGPT:** State updates via `window.openai.setWidgetState()`

#### 3. Lifecycle Management
```typescript
const [widgetState, _setWidgetState] = useState<T | null>(() => {
  // Initialize from window or default
  if (widgetStateFromWindow != null) {
    return widgetStateFromWindow;
  }
  return typeof defaultState === "function"
    ? defaultState()
    : defaultState ?? null;
});

useEffect(() => {
  // Sync from window when it changes
  _setWidgetState(widgetStateFromWindow);
}, [widgetStateFromWindow]);
```

#### 4. Automatic Persistence
```typescript
const setWidgetState = useCallback(
  (state: SetStateAction<T | null>) => {
    _setWidgetState((prevState) => {
      const newState = typeof state === "function" ? state(prevState) : state;

      if (newState != null) {
        window.openai.setWidgetState(newState);  // Persists to ChatGPT
      }

      return newState;
    });
  },
  [window.openai.setWidgetState]
);
```

**State Visibility:**
- **Visible to:** AI model, component, all future renders
- **Survives:** Page refreshes, widget minimize/restore, user sessions
- **Limit:** ~4k tokens

**Use Cases:**
- User preferences
- Form data
- Progress tracking
- Multi-step workflows
- Session state

---

### File: `app/hooks/use-call-tool.ts`

**Purpose:** Call MCP tools directly from component

**Implementation:**

```typescript
export function useCallTool() {
  const callTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<CallToolResponse | null> => {
      if (typeof window !== "undefined" && window?.openai?.callTool) {
        return await window.openai.callTool(name, args);
      }
      return null;
    },
    []
  );

  return callTool;
}
```

**Example Usage:**

```typescript
const callTool = useCallTool();

const handleFetchData = async () => {
  const result = await callTool("search_database", {
    query: "user data",
    limit: 10
  });

  if (result) {
    console.log("Tool result:", result.result);
  }
};
```

**Tool Accessibility:**
Only works if tool is registered with:
```typescript
_meta: {
  "openai/widgetAccessible": true
}
```

**Use Cases:**
- Interactive data fetching
- Real-time updates
- User-initiated actions
- Progressive enhancement

---

### File: `app/hooks/use-send-message.ts`

**Purpose:** Send follow-up messages to ChatGPT conversation

**Implementation:**

```typescript
export function useSendMessage() {
  const sendMessage = useCallback((prompt: string) => {
    if (typeof window !== "undefined" && window?.openai?.sendFollowUpMessage) {
      return window.openai.sendFollowUpMessage({ prompt });
    }
    return Promise.resolve();
  }, []);

  return sendMessage;
}
```

**Example Usage:**

```typescript
const sendMessage = useSendMessage();

const handleAction = async () => {
  await sendMessage("Tell me more about this topic");
};
```

**Behavior:**
- Inserts message into chat as if user typed it
- Model processes and responds
- Widget remains visible
- Can trigger tool calls

**Use Cases:**
- Conversational interfaces
- Guided workflows
- Follow-up questions
- Contextual help

---

### File: `app/hooks/use-is-chatgpt-app.ts`

**Purpose:** Detect ChatGPT environment with SSR compatibility

**Implementation:**

```typescript
export function useIsChatGptApp(): boolean {
  return useSyncExternalStore(
    () => {
      // No subscription needed for static value
      return () => {};
    },
    () => {
      // Client snapshot
      if (typeof window === "undefined") return false;
      return (window as any).__isChatGptApp ?? false;
    },
    () => {
      // Server snapshot - always false
      return false;
    }
  );
}
```

**Why This Pattern?**
- SSR-safe (server always returns false)
- Client hydrates with correct value
- No subscription needed (value never changes)
- Uses React 18+ useSyncExternalStore for consistency

**Value Set By:**
```typescript
// In app/layout.tsx
<script>{`window.__isChatGptApp = typeof window.openai !== "undefined";`}</script>
```

---

### File: `app/hooks/types.ts`

**Purpose:** TypeScript definitions for OpenAI Apps SDK

**Key Types:**

#### OpenAIGlobals
Complete type definition for `window.openai`:

```typescript
export type OpenAIGlobals<
  ToolInput = UnknownObject,
  ToolOutput = UnknownObject,
  ToolResponseMetadata = UnknownObject,
  WidgetState = UnknownObject
> = {
  // Visuals
  theme: Theme;                    // "light" | "dark"
  userAgent: UserAgent;           // Device info
  locale: string;                 // RFC 4647

  // Layout
  maxHeight: number;              // px
  displayMode: DisplayMode;       // "pip" | "inline" | "fullscreen"
  safeArea: SafeArea;            // Insets

  // State
  toolInput: ToolInput;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
  setWidgetState: (state: WidgetState) => Promise<void>;
};
```

#### UserAgent
Device capabilities:

```typescript
export type UserAgent = {
  device: { type: DeviceType };  // "mobile" | "tablet" | "desktop" | "unknown"
  capabilities: {
    hover: boolean;               // Mouse/trackpad support
    touch: boolean;              // Touchscreen support
  };
};
```

**Adaptive UI Example:**
```typescript
const userAgent = useOpenAIGlobal("userAgent");

if (userAgent?.capabilities.touch) {
  // Larger touch targets
  buttonSize = 44;
} else {
  // Smaller mouse targets
  buttonSize = 32;
}
```

#### SafeArea
Insets for safe rendering:

```typescript
export type SafeArea = {
  insets: {
    top: number;     // Status bar, notch
    bottom: number;  // Home indicator
    left: number;    // Rounded corners
    right: number;   // Rounded corners
  };
};
```

**Mobile Importance:**
- iPhone notch/Dynamic Island
- Android camera cutouts
- Home indicators
- Rounded corners

#### Custom Events
```typescript
export const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";

export class SetGlobalsEvent extends CustomEvent<{
  globals: Partial<OpenAIGlobals>;
}> {
  readonly type = SET_GLOBALS_EVENT_TYPE;
}
```

Dispatched by ChatGPT when values change.

#### Global Declaration
```typescript
declare global {
  interface Window {
    openai: API & OpenAIGlobals;
    innerBaseUrl: string;
  }

  interface WindowEventMap {
    [SET_GLOBALS_EVENT_TYPE]: SetGlobalsEvent;
  }
}
```

Extends TypeScript's Window type for full IDE support.

---

## Next.js Integration Challenges & Solutions

### The Seven Critical Problems

#### 1. Asset Loading Failures

**Problem:**
Next.js generates asset URLs like:
```
/_next/static/chunks/main-app-123abc.js
```

When loaded in iframe, browser resolves against sandbox domain:
```
https://web-sandbox.oaiusercontent.com/_next/static/chunks/main-app-123abc.js
```

Result: **404 Not Found**

**Solution:**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  assetPrefix: baseURL,  // "https://your-app.vercel.app"
};
```

**How It Works:**
- Next.js prepends `baseURL` to all `/_next/` URLs
- Assets load from correct origin
- Applies to JS, CSS, fonts, manifests

**Alternative Approaches (Not Recommended):**
- Custom webpack config (complex)
- Asset proxying (latency)
- Manual script injection (maintenance burden)

---

#### 2. Relative URL Resolution

**Problem:**
Relative URLs in HTML resolve against current page origin:

```html
<img src="/images/logo.png" />
<!-- Resolves to: https://web-sandbox.oaiusercontent.com/images/logo.png ❌ -->

<a href="/about">About</a>
<!-- Links to: https://web-sandbox.oaiusercontent.com/about ❌ -->
```

**Solution:**
```html
<head>
  <base href="https://your-app.vercel.app" />
</head>
```

**How It Works:**
- Browser uses `<base>` for all relative URL resolution
- Images, links, forms, fetch all use correct origin
- Standard HTML5 feature with universal support

**Affected Elements:**
- `<img src>`, `<link href>`, `<script src>`
- `<a href>`, `<form action>`
- CSS `url()` references
- JavaScript fetch with relative paths

---

#### 3. Browser History URL Leaks

**Problem:**
Next.js router calls `history.pushState()` with full URLs:

```javascript
history.pushState(null, "", "https://your-app.vercel.app/about");
```

This:
1. Exposes your real domain in sandbox
2. Breaks browser back/forward buttons
3. Violates security boundaries

**Solution:**
Patch `history` APIs to strip origin:

```typescript
const originalPushState = history.pushState;
history.pushState = (state, unused, url) => {
  const u = new URL(url ?? "", window.location.href);
  const href = u.pathname + u.search + u.hash;  // Only path + query + hash
  originalPushState.call(history, state, unused, href);
};
```

**Result:**
```javascript
// Before patch
history.state.url = "https://your-app.vercel.app/about"

// After patch
history.state.url = "/about"
```

**Security Benefit:**
- Real domain hidden from sandbox
- Maintains ChatGPT security model
- Preserves navigation functionality

---

#### 4. Client-Side Navigation Failures

**Problem:**
Next.js App Router uses fetch to load React Server Components during navigation:

```javascript
// User clicks link to /about
fetch("https://web-sandbox.oaiusercontent.com/about?_rsc=xyz")
```

Server returns 404 because route doesn't exist on sandbox domain.

**Solution:**
Patch `window.fetch` to rewrite same-origin requests:

```typescript
const originalFetch = window.fetch;

window.fetch = (input, init) => {
  let url = new URL(input, window.location.href);

  // If request is for same origin (sandbox), rewrite to app origin
  if (url.origin === window.location.origin) {
    const newUrl = new URL(baseURL);
    newUrl.pathname = url.pathname;
    newUrl.search = url.search;
    newUrl.hash = url.hash;

    return originalFetch(newUrl.toString(), {
      ...init,
      mode: "cors"  // Enable CORS
    });
  }

  return originalFetch(input, init);
};
```

**How It Works:**
1. Detects fetch to sandbox origin
2. Rewrites URL to app origin
3. Preserves path, query, hash
4. Forces CORS mode
5. Next.js navigation succeeds

**RSC Payload Example:**
```
Request: https://your-app.vercel.app/about?_rsc=abc123
Response: React Server Component stream
```

---

#### 5. CORS Preflight Blocking

**Problem:**
Browser sends OPTIONS preflight before cross-origin requests:

```http
OPTIONS /about HTTP/1.1
Host: your-app.vercel.app
Origin: https://web-sandbox.oaiusercontent.com
Access-Control-Request-Method: GET
Access-Control-Request-Headers: next-router-state-tree
```

Next.js doesn't handle OPTIONS by default → **403 Forbidden**

**Solution:**
Add middleware to handle OPTIONS and inject CORS headers:

```typescript
export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,  // No Content
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*"
      }
    });
  }

  // Add CORS headers to all responses
  return NextResponse.next({
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}
```

**Status 204:**
- No Content (body not needed for preflight)
- Standard for OPTIONS responses
- Browser caches preflight response

**Production Hardening:**
```typescript
const ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://web-sandbox.oaiusercontent.com"
];

if (ALLOWED_ORIGINS.includes(request.headers.get("origin") ?? "")) {
  // Allow request
}
```

---

#### 6. React Hydration Mismatches

**Problem:**
1. Server renders `<html lang="en">`
2. ChatGPT injects into iframe
3. ChatGPT adds `<html lang="en" class="dark" data-theme="dark">`
4. React hydrates and sees mismatch
5. React shows hydration error warning

**Solution A: suppressHydrationWarning**
```typescript
<html lang="en" suppressHydrationWarning>
```

Tells React to ignore attribute mismatches on `<html>` element.

**Solution B: MutationObserver**
```typescript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === "attributes" &&
        mutation.attributeName !== "suppresshydrationwarning") {
      htmlElement.removeAttribute(mutation.attributeName);
    }
  });
});

observer.observe(document.documentElement, {
  attributes: true
});
```

Actively removes ChatGPT-added attributes after they're added.

**Combined Approach:**
- `suppressHydrationWarning` prevents warnings
- Observer prevents ChatGPT interference
- React has full control over DOM

**Future:**
Once ChatGPT stops modifying HTML, both can be removed.

---

#### 7. External Link Handling

**Problem:**
Standard `<a>` tags in iframe:
1. Open in iframe (breaks UX)
2. Can't open new tabs (sandbox restriction)
3. Don't respect native app context (mobile)

**Solution:**
Intercept clicks and route through `window.openai.openExternal()`:

```typescript
window.addEventListener("click", (e) => {
  const a = (e?.target as HTMLElement)?.closest("a");
  if (!a || !a.href) return;

  const url = new URL(a.href, window.location.href);

  // If external link
  if (url.origin !== window.location.origin &&
      url.origin !== appOrigin) {
    try {
      if (window.openai) {
        window.openai.openExternal({ href: a.href });
        e.preventDefault();
      }
    } catch {
      console.warn("openExternal failed");
    }
  }
}, true);  // Capture phase
```

**Behavior:**
- Internal links → Next.js routing
- External links → Native browser/app
- Mobile → Opens in Safari/Chrome
- Desktop → Opens new tab

**Capture Phase:**
Using `true` as third parameter ensures handler runs before React's onClick.

---

## Codebase Structure & Components

### Directory Tree

```
chatgpt-apps-sdk-nextjs-starter/
├── app/
│   ├── hooks/
│   │   ├── index.ts                    # Hook exports
│   │   ├── types.ts                    # TypeScript definitions
│   │   ├── use-call-tool.ts           # Call MCP tools
│   │   ├── use-display-mode.ts        # Get display mode
│   │   ├── use-is-chatgpt-app.ts      # Detect environment
│   │   ├── use-max-height.ts          # Get max height
│   │   ├── use-open-external.ts       # Open URLs
│   │   ├── use-openai-global.ts       # Low-level access
│   │   ├── use-request-display-mode.ts # Request mode change
│   │   ├── use-send-message.ts        # Send messages
│   │   ├── use-widget-props.ts        # Get tool output
│   │   └── use-widget-state.ts        # Persistent state
│   ├── mcp/
│   │   └── route.ts                   # MCP server (GET/POST)
│   ├── custom-page/
│   │   └── page.tsx                   # Example page
│   ├── layout.tsx                      # Root layout + bootstrap
│   ├── page.tsx                        # Homepage
│   └── globals.css                     # Global styles
├── baseUrl.ts                          # Environment config
├── middleware.ts                       # CORS handling
├── next.config.ts                      # Asset prefix
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript config
└── README.md                           # Documentation
```

### File Sizes & Complexity

| File | Lines | Purpose | Complexity |
|------|-------|---------|------------|
| `app/mcp/route.ts` | 103 | MCP server | Medium |
| `middleware.ts` | 27 | CORS | Low |
| `app/layout.tsx` | 163 | Bootstrap | High |
| `app/page.tsx` | 130 | Homepage | Medium |
| `baseUrl.ts` | 8 | Config | Low |
| `next.config.ts` | 9 | Config | Low |
| `app/hooks/use-openai-global.ts` | 54 | Core hook | Medium |
| `app/hooks/use-widget-state.ts` | 73 | State mgmt | High |
| `app/hooks/types.ts` | 105 | Types | Low |

### Dependency Analysis

#### Core Dependencies

**Next.js 15.5.4**
- App Router with RSC
- Turbopack for fast builds
- Built-in optimization

**React 19.1.0**
- Concurrent features
- Server Components
- `useSyncExternalStore` hook

**@modelcontextprotocol/sdk 1.20.0**
- Official MCP client library
- TypeScript support
- Server-side execution

**mcp-handler 1.0.2**
- Next.js Route Handler wrapper
- Simplifies MCP server creation
- Handles GET/POST routing

**Zod 3.24.2**
- Runtime schema validation
- Type inference
- Input sanitization

#### Dev Dependencies

**TypeScript 5.x**
- Type safety
- IDE integration
- Refactoring support

**Tailwind CSS 4.x**
- Utility-first styling
- Dark mode support
- Responsive design

### No External Runtime Dependencies

**Notable Absences:**
- No state management library (uses React built-ins)
- No API client (uses native fetch)
- No UI component library (custom components)
- No testing framework (add as needed)

**Philosophy:**
- Minimal dependencies
- Standard APIs
- Framework primitives
- Easy to understand

---

## API Reference

### window.openai

Complete API surface for ChatGPT integration.

#### Properties

##### theme
```typescript
window.openai.theme: "light" | "dark"
```

Current ChatGPT theme preference.

**Usage:**
```typescript
const theme = useOpenAIGlobal("theme");

<div className={theme === "dark" ? "dark-mode" : "light-mode"}>
```

##### locale
```typescript
window.openai.locale: string
```

User's locale (RFC 4647 format, e.g., "en-US", "fr-FR").

**Usage:**
```typescript
const locale = useOpenAIGlobal("locale");

<FormattedDate value={date} locale={locale} />
```

##### userAgent
```typescript
window.openai.userAgent: {
  device: { type: "mobile" | "tablet" | "desktop" | "unknown" };
  capabilities: {
    hover: boolean;
    touch: boolean;
  };
}
```

Device characteristics for adaptive UIs.

**Usage:**
```typescript
const userAgent = useOpenAIGlobal("userAgent");

const buttonSize = userAgent?.capabilities.touch ? 44 : 32;
```

##### maxHeight
```typescript
window.openai.maxHeight: number
```

Available height in pixels for widget content.

**Usage:**
```typescript
const maxHeight = useMaxHeight();

<div style={{ maxHeight, overflow: "auto" }}>
```

##### displayMode
```typescript
window.openai.displayMode: "pip" | "inline" | "fullscreen"
```

Current widget layout mode.

**Usage:**
```typescript
const displayMode = useDisplayMode();

{displayMode === "fullscreen" && <FullUI />}
{displayMode === "inline" && <CompactUI />}
```

##### safeArea
```typescript
window.openai.safeArea: {
  insets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}
```

Safe area insets (important for mobile).

**Usage:**
```typescript
const safeArea = useOpenAIGlobal("safeArea");

<div style={{
  paddingTop: safeArea?.insets.top,
  paddingBottom: safeArea?.insets.bottom
}}>
```

##### toolInput
```typescript
window.openai.toolInput: Record<string, unknown>
```

Input parameters from MCP tool call.

**Usage:**
```typescript
const toolOutput = useWidgetProps<{ userId: string }>();
const userId = toolOutput?.toolInput?.userId;
```

##### toolOutput
```typescript
window.openai.toolOutput: Record<string, unknown> | null
```

Result from previous tool execution.

**Usage:**
```typescript
const toolOutput = useWidgetProps<{
  result?: { structuredContent?: { data: string } }
}>();

const data = toolOutput?.result?.structuredContent?.data;
```

##### toolResponseMetadata
```typescript
window.openai.toolResponseMetadata: Record<string, unknown> | null
```

Additional metadata from tool response `_meta` field.

##### widgetState
```typescript
window.openai.widgetState: Record<string, unknown> | null
```

Persistent widget state (survives sessions).

**Usage:**
```typescript
const [state, setState] = useWidgetState({ count: 0 });
```

#### Methods

##### callTool()
```typescript
window.openai.callTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ result: string }>
```

Invoke MCP tool from component (requires `openai/widgetAccessible: true`).

**Usage:**
```typescript
const callTool = useCallTool();

const result = await callTool("search", { query: "hello" });
console.log(result.result);
```

##### sendFollowUpMessage()
```typescript
window.openai.sendFollowUpMessage({
  prompt: string
}): Promise<void>
```

Insert message into ChatGPT conversation.

**Usage:**
```typescript
const sendMessage = useSendMessage();

await sendMessage("Show me more details");
```

##### requestDisplayMode()
```typescript
window.openai.requestDisplayMode({
  mode: "pip" | "inline" | "fullscreen"
}): Promise<{ mode: DisplayMode }>
```

Request layout change (host may deny).

**Usage:**
```typescript
const requestDisplayMode = useRequestDisplayMode();

const { mode } = await requestDisplayMode("fullscreen");
if (mode === "fullscreen") {
  // Request granted
}
```

##### setWidgetState()
```typescript
window.openai.setWidgetState(
  state: Record<string, unknown>
): Promise<void>
```

Persist state (visible to model, survives sessions).

**Usage:**
```typescript
const [state, setState] = useWidgetState({ step: 1 });

setState({ step: 2 });  // Automatically calls setWidgetState
```

##### openExternal()
```typescript
window.openai.openExternal({
  href: string
}): void
```

Open URL in native browser/app.

**Usage:**
```typescript
const openExternal = useOpenExternal();

openExternal("https://example.com");
```

---

### MCP Tool Metadata

#### OpenAI-Specific Fields

##### openai/outputTemplate
```typescript
_meta["openai/outputTemplate"]: string
```

URI of resource to render as widget.

**Example:**
```typescript
_meta: {
  "openai/outputTemplate": "ui://widget/content-template.html"
}
```

##### openai/toolInvocation/invoking
```typescript
_meta["openai/toolInvocation/invoking"]: string
```

Status text shown while tool executes (≤64 chars).

**Example:**
```typescript
_meta: {
  "openai/toolInvocation/invoking": "Loading data..."
}
```

##### openai/toolInvocation/invoked
```typescript
_meta["openai/toolInvocation/invoked"]: string
```

Status text shown after tool completes (≤64 chars).

**Example:**
```typescript
_meta: {
  "openai/toolInvocation/invoked": "Data loaded"
}
```

##### openai/widgetAccessible
```typescript
_meta["openai/widgetAccessible"]: boolean
```

Allow component to call this tool via `callTool()`.

**Example:**
```typescript
_meta: {
  "openai/widgetAccessible": true
}
```

##### openai/resultCanProduceWidget
```typescript
_meta["openai/resultCanProduceWidget"]: boolean
```

Enable widget rendering for this tool.

**Example:**
```typescript
_meta: {
  "openai/resultCanProduceWidget": true
}
```

##### openai/widgetCSP
```typescript
_meta["openai/widgetCSP"]: {
  connect_domains: string[];
  resource_domains: string[];
}
```

Declare Content Security Policy requirements.

**Example:**
```typescript
_meta: {
  "openai/widgetCSP": {
    "connect_domains": ["api.example.com"],
    "resource_domains": ["cdn.example.com"]
  }
}
```

##### openai/widgetDescription
```typescript
_meta["openai/widgetDescription"]: string
```

Human-readable widget description (shown to model).

**Example:**
```typescript
_meta: {
  "openai/widgetDescription": "Displays user profile information"
}
```

##### openai/widgetPrefersBorder
```typescript
_meta["openai/widgetPrefersBorder"]: boolean
```

Render widget with bordered card UI.

**Example:**
```typescript
_meta: {
  "openai/widgetPrefersBorder": true
}
```

##### openai/widgetDomain
```typescript
_meta["openai/widgetDomain"]: string
```

Optional custom subdomain for widget.

**Example:**
```typescript
_meta: {
  "openai/widgetDomain": "https://widgets.example.com"
}
```

---

### MCP Resource Metadata

Resources use the same metadata fields as tools, plus:

##### mimeType
```typescript
mimeType: "text/html+skybridge"
```

**Critical:** Must be `text/html+skybridge` for widget rendering.

##### text
```typescript
text: string
```

HTML content to render in iframe.

**Example:**
```typescript
{
  uri: "ui://widget/content.html",
  mimeType: "text/html+skybridge",
  text: `<html>
    <head>...</head>
    <body>...</body>
  </html>`
}
```

---

## Best Practices & Design Patterns

### MCP Server Design

#### 1. Single Responsibility Per Tool
Each tool should do one thing well.

**Good:**
```typescript
server.registerTool("search_users", { ... });
server.registerTool("get_user_profile", { ... });
server.registerTool("update_user_profile", { ... });
```

**Bad:**
```typescript
server.registerTool("user_operations", {
  inputSchema: {
    action: z.enum(["search", "get", "update"]),
    // ...
  }
});
```

#### 2. Descriptive Tool Names
Use machine-friendly identifiers with clear descriptions.

**Good:**
```typescript
{
  name: "calculate_mortgage_payment",
  title: "Calculate Mortgage Payment",
  description: "Calculate monthly mortgage payment given loan amount, interest rate, and term"
}
```

**Bad:**
```typescript
{
  name: "calc",
  title: "Calculator",
  description: "Does calculations"
}
```

#### 3. Comprehensive Input Schemas
Validate all inputs with Zod.

**Good:**
```typescript
inputSchema: {
  amount: z.number().positive().describe("Loan amount in dollars"),
  rate: z.number().min(0).max(100).describe("Annual interest rate (%)"),
  years: z.number().int().positive().describe("Loan term in years")
}
```

**Bad:**
```typescript
inputSchema: {
  amount: z.number(),
  rate: z.number(),
  years: z.number()
}
```

#### 4. Structured Responses
Always include `structuredContent` for model reasoning.

**Good:**
```typescript
return {
  content: [{ type: "text", text: "Monthly payment: $1,234.56" }],
  structuredContent: {
    monthlyPayment: 1234.56,
    totalPayment: 444441.60,
    totalInterest: 194441.60
  },
  _meta: widgetMeta(widget)
};
```

**Bad:**
```typescript
return {
  content: [{ type: "text", text: "Monthly payment: $1,234.56" }]
};
```

#### 5. Resource Versioning
Use versioned URIs to prevent stale assets.

**Good:**
```typescript
templateUri: "ui://widget/mortgage-calculator-v2.html"
```

**Bad:**
```typescript
templateUri: "ui://widget/mortgage-calculator.html"
// User updates, breaking existing conversations
```

**Breaking Changes Require New URIs.**

#### 6. Error Handling
Return meaningful error messages in `content`.

**Good:**
```typescript
try {
  const result = await api.fetchData();
  return { structuredContent: result, ... };
} catch (error) {
  return {
    content: [{
      type: "text",
      text: `Error: ${error.message}. Please try again or contact support.`
    }],
    structuredContent: { error: true, message: error.message }
  };
}
```

**Bad:**
```typescript
const result = await api.fetchData();  // Throws, crashes server
return { structuredContent: result, ... };
```

---

### Widget Component Design

#### 1. Responsive Layouts
Adapt to `maxHeight` and `displayMode`.

**Good:**
```typescript
const maxHeight = useMaxHeight();
const displayMode = useDisplayMode();

<div style={{
  maxHeight,
  height: displayMode === "fullscreen" ? maxHeight : undefined,
  overflow: "auto"
}}>
```

#### 2. Theme Support
Respect `window.openai.theme`.

**Good:**
```typescript
const theme = useOpenAIGlobal("theme");

<div className={theme === "dark" ? "dark" : ""}>
  {/* Tailwind dark: variants work automatically */}
</div>
```

#### 3. Touch-Friendly UI
Check `userAgent.capabilities.touch`.

**Good:**
```typescript
const userAgent = useOpenAIGlobal("userAgent");
const minTouchTarget = userAgent?.capabilities.touch ? 44 : 32;

<button style={{ minWidth: minTouchTarget, minHeight: minTouchTarget }}>
```

#### 4. Safe Area Awareness
Respect `safeArea.insets` on mobile.

**Good:**
```typescript
const safeArea = useOpenAIGlobal("safeArea");

<div style={{
  paddingTop: safeArea?.insets.top ?? 0,
  paddingBottom: safeArea?.insets.bottom ?? 0
}}>
```

#### 5. Loading States
Show feedback during async operations.

**Good:**
```typescript
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  setLoading(true);
  try {
    await performAction();
  } finally {
    setLoading(false);
  }
};

<button disabled={loading}>
  {loading ? "Loading..." : "Submit"}
</button>
```

#### 6. Error Boundaries
Catch and display errors gracefully.

**Good:**
```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

---

### State Management Patterns

#### 1. Widget State for Model-Visible Data
Use `useWidgetState` for data the model needs.

**Good:**
```typescript
const [formData, setFormData] = useWidgetState({
  step: 1,
  email: "",
  preferences: {}
});

// Model can see current step and provide context-aware help
```

**Bad:**
```typescript
const [formData, setFormData] = useState({ step: 1, ... });

// Model has no visibility into form progress
```

#### 2. Local State for UI-Only Data
Use `useState` for ephemeral UI state.

**Good:**
```typescript
const [isMenuOpen, setIsMenuOpen] = useState(false);
const [hoveredItem, setHoveredItem] = useState(null);

// No need to expose to model or persist
```

#### 3. Tool Props for Initial Data
Use `useWidgetProps` to receive tool output.

**Good:**
```typescript
const toolOutput = useWidgetProps<{ userId: string }>();

useEffect(() => {
  if (toolOutput?.userId) {
    fetchUserData(toolOutput.userId);
  }
}, [toolOutput]);
```

---

### Security Best Practices

#### 1. Validate All Inputs
Never trust tool inputs or user data.

**Good:**
```typescript
const schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(120)
});

const validated = schema.parse(input);
```

#### 2. Sanitize HTML
Never inject unsanitized HTML.

**Good:**
```typescript
import DOMPurify from "dompurify";

<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(userContent)
}} />
```

**Bad:**
```typescript
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

#### 3. CORS Restrictions
In production, restrict CORS to ChatGPT domains.

**Good:**
```typescript
const ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://web-sandbox.oaiusercontent.com"
];

const origin = request.headers.get("origin");
if (ALLOWED_ORIGINS.includes(origin ?? "")) {
  headers["Access-Control-Allow-Origin"] = origin;
}
```

**Bad:**
```typescript
headers["Access-Control-Allow-Origin"] = "*";  // Production risk
```

#### 4. Secrets Management
Never expose API keys in client code.

**Good:**
```typescript
// Server-side (MCP route handler)
const apiKey = process.env.SECRET_API_KEY;
const result = await fetch(url, {
  headers: { Authorization: `Bearer ${apiKey}` }
});
```

**Bad:**
```typescript
// Client-side component
const apiKey = "sk_live_123...";  // Exposed to browser
```

#### 5. CSP Declarations
Declare all external domains in widget metadata.

**Good:**
```typescript
_meta: {
  "openai/widgetCSP": {
    "connect_domains": ["api.stripe.com"],
    "resource_domains": ["js.stripe.com"]
  }
}
```

---

### Performance Optimization

#### 1. Code Splitting
Lazy load heavy components.

**Good:**
```typescript
const HeavyChart = lazy(() => import("./HeavyChart"));

<Suspense fallback={<Spinner />}>
  <HeavyChart data={data} />
</Suspense>
```

#### 2. Image Optimization
Use Next.js Image component.

**Good:**
```typescript
import Image from "next/image";

<Image
  src="/logo.png"
  width={180}
  height={38}
  alt="Logo"
  priority  // Above the fold
/>
```

#### 3. Memoization
Prevent unnecessary re-renders.

**Good:**
```typescript
const ExpensiveComponent = memo(({ data }) => {
  const processed = useMemo(() => heavyProcessing(data), [data]);

  return <div>{processed}</div>;
});
```

#### 4. State Optimization
Keep widget state under 4k tokens.

**Good:**
```typescript
const [state, setState] = useWidgetState({
  step: 1,
  userId: "abc123"  // IDs, not full objects
});
```

**Bad:**
```typescript
const [state, setState] = useWidgetState({
  step: 1,
  allUsers: [...1000 user objects...]  // Too large
});
```

---

## Deployment & Production Considerations

### Vercel Deployment

#### Automatic Configuration
`baseUrl.ts` automatically handles Vercel environments:

```typescript
export const baseURL =
  process.env.NODE_ENV == "development"
    ? "http://localhost:3000"
    : "https://" +
      (process.env.VERCEL_ENV === "production"
        ? process.env.VERCEL_PROJECT_PRODUCTION_URL
        : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL);
```

**Environment Variables:**
- `VERCEL_ENV`: "production" | "preview" | "development"
- `VERCEL_PROJECT_PRODUCTION_URL`: Production domain
- `VERCEL_BRANCH_URL`: Preview deployment URL
- `VERCEL_URL`: Generic deployment URL

#### Deploy Button
```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vercel-labs/chatgpt-apps-sdk-nextjs-starter)
```

#### Deployment Steps
1. Push code to GitHub
2. Import repository in Vercel
3. Configure environment variables (if needed)
4. Deploy
5. Note production URL
6. Add to ChatGPT Connectors

---

### ChatGPT Connector Setup

**Requirements:**
- Developer mode access (waitlist)
- Publicly accessible HTTPS URL
- MCP server at `/mcp` path

**Steps:**
1. Navigate to **ChatGPT → Settings → Connectors**
2. Click **Create**
3. Enter MCP server URL: `https://your-app.vercel.app/mcp`
4. Save connector
5. Test in conversation

**Testing:**
```
User: Use [Your App Name] to show content with my name "Alice"

ChatGPT: [Calls tool, renders widget with "Alice"]
```

---

### Environment Variables

#### Required Variables
None by default (auto-configured on Vercel).

#### Optional Variables

**API Keys:**
```bash
# .env.local
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_live_...
```

**Custom Base URL:**
```bash
# Override automatic detection
NEXT_PUBLIC_BASE_URL=https://custom-domain.com
```

Update `baseUrl.ts`:
```typescript
export const baseURL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.NODE_ENV == "development" ? ... : ...);
```

---

### Monitoring & Debugging

#### Logging
Add logging to MCP route handler:

```typescript
const handler = createMcpHandler(async (server) => {
  console.log("[MCP] Server initializing");

  server.registerTool("my_tool", { ... }, async (input) => {
    console.log("[MCP] Tool called:", input);

    try {
      const result = await performAction(input);
      console.log("[MCP] Tool success:", result);
      return result;
    } catch (error) {
      console.error("[MCP] Tool error:", error);
      throw error;
    }
  });
});
```

**Vercel Logs:**
View real-time logs at `https://vercel.com/[team]/[project]/logs`

#### Error Tracking
Integrate Sentry or similar:

```typescript
// app/layout.tsx
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV
});
```

#### Analytics
Track widget usage:

```typescript
// app/page.tsx
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Track widget load
    analytics.track("widget_loaded", {
      displayMode: window.openai?.displayMode,
      userAgent: window.openai?.userAgent
    });
  }, []);

  // ...
}
```

---

### Performance Monitoring

#### Web Vitals
Track Core Web Vitals:

```typescript
// app/layout.tsx
export function reportWebVitals(metric) {
  console.log(metric);

  // Send to analytics
  analytics.track("web_vital", {
    name: metric.name,
    value: metric.value
  });
}
```

#### Bundle Size
Monitor bundle size in builds:

```bash
npm run build

# Output:
# Route (app)                              Size     First Load JS
# ┌ ○ /                                    5.2 kB         92.1 kB
# ├ ○ /custom-page                         142 B          87.0 kB
# └ ○ /mcp                                 0 B                0 B
```

**Optimization Tips:**
- Use dynamic imports for heavy components
- Remove unused dependencies
- Enable gzip/brotli compression (automatic on Vercel)

---

### Security Hardening

#### 1. CORS Restrictions
```typescript
// middleware.ts (production)
const ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://web-sandbox.oaiusercontent.com",
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : null
].filter(Boolean);

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ... rest of middleware
}
```

#### 2. Rate Limiting
Add rate limiting to MCP route:

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s")
});

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return new Response("Too many requests", { status: 429 });
  }

  // ... handle request
}
```

#### 3. Input Validation
Validate all tool inputs server-side:

```typescript
server.registerTool("my_tool", {
  inputSchema: {
    email: z.string().email().max(100),
    message: z.string().max(1000)
  }
}, async (input) => {
  // Input is validated by mcp-handler
  // Add additional business logic validation
  if (isBannedEmail(input.email)) {
    throw new Error("Email not allowed");
  }

  // ... process
});
```

#### 4. Content Security Policy
Set CSP headers:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  assetPrefix: baseURL,
  async headers() {
    return [{
      source: "/:path*",
      headers: [{
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Next.js requires
          "style-src 'self' 'unsafe-inline'",                 // Tailwind requires
          "img-src 'self' data: https:",
          "connect-src 'self' https://your-api.com"
        ].join("; ")
      }]
    }];
  }
};
```

---

### Scaling Considerations

#### Database Connections
Use connection pooling:

```typescript
// lib/db.ts
import { Pool } from "@neondatabase/serverless";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query(sql: string, params: any[]) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}
```

#### Caching
Cache tool responses when appropriate:

```typescript
import { unstable_cache } from "next/cache";

const getCachedData = unstable_cache(
  async (userId: string) => {
    return await fetchUserData(userId);
  },
  ["user-data"],
  { revalidate: 300 }  // 5 minutes
);

server.registerTool("get_user", { ... }, async ({ userId }) => {
  const data = await getCachedData(userId);
  return { structuredContent: data };
});
```

#### Edge Functions
Deploy to Edge for lower latency:

```typescript
// app/mcp/route.ts
export const runtime = "edge";

const handler = createMcpHandler(async (server) => {
  // ... register tools
});

export const GET = handler;
export const POST = handler;
```

**Limitations:**
- No Node.js APIs (fs, child_process, etc.)
- Smaller bundle size limits
- Different pricing model

---

## Future Roadmap & Ecosystem

### Apps SDK Roadmap

**Current Status (January 2025):**
- Developer Preview
- Limited access (waitlist)
- Active development

**Upcoming (2025):**
- App submission opens
- Public app directory
- Enhanced discovery features
- More SDK examples
- Official component libraries

### MCP Protocol Evolution

**Next Release: November 25, 2025**
- Release Candidate: November 11, 2025
- Enhanced authorization handling
- Additional security features
- Performance improvements

**Industry Adoption:**
- OpenAI (ChatGPT)
- Anthropic (Claude)
- Google (Gemini)
- Microsoft (Copilot - rumored)

### Ecosystem Growth

**Official Examples:**
- GitHub: `openai/openai-apps-sdk-examples`
- Multiple frameworks (Next.js, SvelteKit, Vue)
- Various use cases (productivity, data, creative)

**Community Resources:**
- MCP Server Registry
- Component marketplaces
- Template galleries
- Tutorial collections

**Related Standards:**
- OpenAI Function Calling
- Anthropic Tool Use
- JSON-RPC 2.0
- OAuth 2.1

---

## Conclusion

This ChatGPT Apps SDK Next.js Starter demonstrates a complete, production-ready integration of Next.js with ChatGPT. It solves seven critical technical challenges related to iframe architecture, provides a comprehensive hook library for SDK integration, and implements best practices for MCP server development.

**Key Achievements:**
1. ✅ Asset loading across origins
2. ✅ Relative URL resolution
3. ✅ Browser history security
4. ✅ Client-side navigation
5. ✅ CORS handling
6. ✅ React hydration compatibility
7. ✅ External link routing

**Technical Excellence:**
- Zero-config Vercel deployment
- Minimal dependencies
- TypeScript throughout
- Modern React patterns
- Standard APIs

**Developer Experience:**
- Comprehensive documentation
- Type-safe hooks
- Clear code structure
- Easy customization
- Production-ready

---

## Additional Resources

### Official Documentation
- [OpenAI Apps SDK](https://developers.openai.com/apps-sdk)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)

### GitHub Repositories
- [OpenAI Apps SDK Examples](https://github.com/openai/openai-apps-sdk-examples)
- [MCP Specification](https://github.com/modelcontextprotocol/modelcontextprotocol)
- [This Starter](https://github.com/vercel-labs/chatgpt-apps-sdk-nextjs-starter)

### Community
- [OpenAI Developer Forum](https://community.openai.com)
- [MCP Discord](https://discord.gg/modelcontextprotocol)
- [Vercel Discord](https://vercel.com/discord)

### Blog Posts
- [Vercel: Running Next.js inside ChatGPT](https://vercel.com/blog/running-next-js-inside-chatgpt-a-deep-dive-into-native-app-integration)
- [OpenAI DevDay 2025 Recap](https://skywork.ai/blog/openai-devday-2025-agentkit-apps-sdk-gpt5-pro/)

---

**Last Updated:** January 2025
**Version:** 1.0.0
**License:** MIT
