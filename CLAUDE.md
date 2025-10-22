# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a ChatGPT Apps SDK application built with Next.js that integrates Hotelzify hotel search and booking functionality into ChatGPT. The app uses the Model Context Protocol (MCP) to expose hotel search and room availability tools that can be invoked from ChatGPT conversations, with results rendered as interactive widgets inside ChatGPT's iframe.

**Tech Stack:**
- Next.js 15.5.4 with Turbopack and App Router
- React 19.1.0
- TypeScript 5.x
- Model Context Protocol SDK 1.20.0
- Tailwind CSS 4.x
- Zod 3.24.2 for schema validation

## Development Commands

```bash
# Development (with Turbopack)
pnpm dev

# Production build (with Turbopack)
pnpm build

# Start production server
pnpm start
```

**Package Manager:** pnpm (required - specified in package.json)

## Architecture

### ChatGPT Integration

The app runs inside ChatGPT's sandboxed iframe architecture. Key integration files:

- **`app/mcp/route.ts`** - MCP server exposing tools and resources to ChatGPT
- **`app/layout.tsx`** - SDK bootstrap with critical iframe compatibility patches
- **`middleware.ts`** - CORS handling for cross-origin RSC requests
- **`next.config.ts`** - Asset prefix configuration for iframe asset loading
- **`baseUrl.ts`** - Environment-aware URL configuration

### MCP Tools

Two primary tools are registered in `app/mcp/route.ts`:

1. **`search_hotels`** - Search hotels by location/query
   - Fetches from `https://chatapi.hotelzify.com/search/hotels`
   - Merges with hotel images from `https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2`
   - Renders `/hotel-search` page as widget

2. **`check_room_availability`** - Check room availability and pricing
   - Fetches from `https://api.hotelzify.com/hotel/v1/hotel/chatbot-availability`
   - Renders `/room-availability` page as widget

### Widget Pages

Widget pages use OpenAI Apps SDK hooks from `app/hooks/`:

- **`app/hotel-search/page.tsx`** - Displays hotel search results with horizontal scrolling cards
- **`app/room-availability/page.tsx`** - Shows available rooms with pricing options

Both pages feature:
- Modern, minimal design with gradient backgrounds
- Smooth fade-in animations and staggered card reveals
- Hover effects with image zoom and card lift animations
- Fixed height images (h-52) to prevent aspect ratio issues
- Scroll-snap behavior for smooth horizontal scrolling
- Custom styled scrollbar with transitions
- Backdrop blur effects on cards
- Loading states with animated spinners
- Empty states with illustrative icons
- Gradient text on headers
- Responsive to `useWidgetProps()`, `useMaxHeight()`, and `useDisplayMode()`
- Full dark mode support

**Hotel Search Enhancements:**
- Hotel cards with gradient overlays on hover
- Rating badges with backdrop blur
- Sparkles icon in header
- Image placeholder with Hotel icon for missing images

**Room Availability Enhancements:**
- Booking details card with calendar and guest info
- Discount badges on pricing options with percentage savings
- Availability indicator badges
- Pricing cards with hover slide animation
- Multiple rate plan display with original price strikethrough

### Critical Iframe Compatibility Patches

The `app/layout.tsx` file includes essential patches for running Next.js inside ChatGPT's iframe:

1. **Base URL** - `<base href={baseURL}>` for relative URL resolution
2. **History API patching** - Strips full origin URLs from browser history
3. **Fetch API patching** - Rewrites same-origin requests to app origin for RSC navigation
4. **HTML attribute observer** - Removes ChatGPT-added attributes that cause hydration mismatches
5. **External link handling** - Routes external links through `window.openai.openExternal()`

## API Integration

### Hotelzify APIs

**Hotel Search API:**
- Endpoint: `POST https://chatapi.hotelzify.com/search/hotels`
- Body: `{ query: string, chain_id: string, k: number }`
- Returns: Search results with hotel data

**Chain Hotels API:**
- Endpoint: `GET https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2?chainId={id}`
- Returns: Hotel details including images

**Room Availability API:**
- Endpoint: `POST https://api.hotelzify.com/hotel/v1/hotel/chatbot-availability`
- Body: `{ hotelId, checkInDate, checkOutDate, adults, children, infants, totalGuest }`
- Returns: Available rooms with pricing

All API calls are made server-side in MCP tool handlers for security.

## Code Patterns

### MCP Tool Registration

Tools follow this pattern in `app/mcp/route.ts`:

```typescript
// 1. Pre-render the widget HTML
const widgetHtml = await getAppsSdkCompatibleHtml(baseURL, "/widget-page");

// 2. Define widget metadata
const widget: ContentWidget = {
  id: "tool_name",
  title: "Tool Title",
  templateUri: "ui://widget/template.html",
  invoking: "Loading text...",
  invoked: "Completed text",
  html: widgetHtml,
  description: "Tool description",
  widgetDomain: "https://hotelzify.com",
};

// 3. Register resource (HTML content)
server.registerResource("resource-id", widget.templateUri, { ... });

// 4. Register tool with input schema
server.registerTool(widget.id, {
  inputSchema: { /* Zod schema */ },
  _meta: widgetMeta(widget)
}, async (input) => {
  // Tool handler logic
  return {
    content: [{ type: "text", text: "..." }],
    structuredContent: { /* Data for model */ },
    _meta: widgetMeta(widget)
  };
});
```

### Widget Component Pattern

Widget pages follow this structure:

```typescript
"use client";

import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";

export default function WidgetPage() {
  const toolOutput = useWidgetProps<DataType>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();

  const isLoading = !toolOutput || !toolOutput.requiredField;

  return (
    <div style={{ maxHeight, height: displayMode === "fullscreen" ? maxHeight : undefined }}>
      {isLoading ? <LoadingState /> : <Content data={toolOutput} />}
    </div>
  );
}
```

### Horizontal Scrolling UI

Both widget pages implement horizontal scrolling for cards:

```typescript
<div className="horizontal-scroll overflow-x-auto overflow-y-visible pb-4">
  <div className="flex gap-4 w-max">
    {items.map(item => <Card className="w-96 shrink-0" />)}
  </div>
</div>
```

With custom scrollbar styling via inline styles.

## UI Components

UI components are in `components/ui/` using Radix UI and Tailwind CSS:
- `card.tsx` - Card, CardHeader, CardContent, CardTitle components
- `button.tsx` - Button component with variants
- `carousel.tsx` - Embla carousel integration
- `alert.tsx` - Alert components

Icons from `lucide-react` are used throughout.

## Deployment

The app is designed for Vercel deployment with zero configuration:
- `baseUrl.ts` auto-detects Vercel environment variables
- `assetPrefix` is automatically set to correct domain
- Preview deployments work out of the box

**Connecting to ChatGPT:**
1. Deploy to production
2. Navigate to ChatGPT → Settings → Connectors
3. Add MCP server URL: `https://your-domain.vercel.app/mcp`

## Important Notes

### CORS Configuration
Currently uses `"Access-Control-Allow-Origin": "*"` in middleware. For production, restrict to ChatGPT domains:
```typescript
const ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://web-sandbox.oaiusercontent.com"
];
```

### Asset Loading
The `assetPrefix` in `next.config.ts` is critical - without it, Next.js assets will 404 when loaded in iframe.

### Hydration Warnings
`suppressHydrationWarning` on `<html>` is required because ChatGPT modifies HTML attributes before React hydrates.

### Environment Detection
Use `useIsChatGptApp()` hook to detect if running inside ChatGPT vs. standalone.

## State Management

- **Widget state** - Use `useWidgetState()` for data visible to AI model (persists across sessions)
- **Local state** - Use `useState()` for UI-only state
- **Tool props** - Use `useWidgetProps()` to receive tool output data

Widget state is limited to ~4k tokens and visible to the AI model for context.

## Error Handling

All MCP tool handlers include try-catch blocks that return user-friendly error messages:

```typescript
try {
  // API call
} catch (error) {
  return {
    content: [{ type: "text", text: `Error: ${error.message}` }],
    structuredContent: { error: true },
    _meta: widgetMeta(widget)
  };
}
```
