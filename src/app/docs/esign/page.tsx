"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EsignDocsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/help#esign"); }, [router]);
  return null;
}
