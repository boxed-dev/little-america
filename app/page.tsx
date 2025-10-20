"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useWidgetProps,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
} from "./hooks";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Maximize } from "lucide-react";

export default function Home() {
  const toolOutput = useWidgetProps<{
    name?: string;
    result?: { structuredContent?: { name?: string } };
  }>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const isChatGptApp = useIsChatGptApp();

  const name = toolOutput?.result?.structuredContent?.name || toolOutput?.name;

  return (
    <div
      className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20"
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : undefined,
      }}
    >
      {displayMode !== "fullscreen" && (
        <Button
          aria-label="Enter fullscreen"
          className="fixed top-4 right-4 z-50 rounded-full shadow-lg ring-1 ring-slate-900/10 dark:ring-white/10 p-2.5 h-auto"
          onClick={() => requestDisplayMode("fullscreen")}
          variant="outline"
        >
          <Maximize className="w-5 h-5" />
        </Button>
      )}
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        {!isChatGptApp && (
          <Alert>
            <Info className="h-5 w-5" />
            <AlertDescription>
              This app relies on data from a ChatGPT session. No{" "}
              <a
                href="https://developers.openai.com/apps-sdk/reference"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded"
              >
                window.openai
              </a>{" "}
              property detected
            </AlertDescription>
          </Alert>
        )}
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Welcome to the ChatGPT Apps SDK Next.js Starter
          </li>
          <li className="mb-2 tracking-[-.01em]">
            Name returned from tool call: {name ?? "..."}
          </li>
          <li className="mb-2 tracking-[-.01em]">MCP server path: /mcp</li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <Link
            prefetch={false}
            href="/custom-page"
          >
            <Button>
              Visit another page
            </Button>
          </Link>
          <a
            href="https://vercel.com/templates/ai/chatgpt-app-with-next-js"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Deploy on Vercel
          </a>
        </div>
      </main>
    </div>
  );
}
