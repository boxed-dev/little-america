"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <h1 className="text-4xl font-black tracking-tight">Welcome</h1>
        <p className="font-mono text-sm/6 text-center sm:text-left tracking-[-.01em] max-w-xl">
          This is a client-side rendered page demonstrating navigation in your ChatGPT app.
        </p>
        <Link 
          href="/"
        >
          <Button>
            Go to the main page
          </Button>
        </Link>
      </main>
    </div>
  );
}
