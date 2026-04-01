"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DocComposerGuideRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/help#doc-composer"); }, [router]);
  return null;
}
