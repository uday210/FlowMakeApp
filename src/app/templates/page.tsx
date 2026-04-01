"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TemplatesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/workflows?tab=templates"); }, [router]);
  return null;
}
