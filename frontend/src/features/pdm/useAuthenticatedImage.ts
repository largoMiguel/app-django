import { useEffect, useState } from "react";
import { fetchAuthenticatedFile } from "@/core/api/client";

const blobUrlCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

async function getCachedBlobUrl(url: string): Promise<string> {
  const cached = blobUrlCache.get(url);
  if (cached) return cached;

  const pending = inflightRequests.get(url);
  if (pending) return pending;

  const request = fetchAuthenticatedFile(url).then((blob) => {
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(url, blobUrl);
    inflightRequests.delete(url);
    return blobUrl;
  });

  inflightRequests.set(url, request);
  return request;
}

export function useAuthenticatedImage(url: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(() => (url ? blobUrlCache.get(url) ?? null : null));

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }

    const cached = blobUrlCache.get(url);
    if (cached) {
      setSrc(cached);
      return;
    }

    let cancelled = false;
    void getCachedBlobUrl(url).then((blobUrl) => {
      if (!cancelled) setSrc(blobUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return src;
}
