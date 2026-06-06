import { useEffect, useState } from "react";
import { fetchAuthenticatedFile } from "@/core/api/client";

const FILE_DELIVERY_HOST = "files.softone360.com";
const blobUrlCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

function isSignedDeliveryUrl(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.hostname === FILE_DELIVERY_HOST && parsed.searchParams.has("sig");
  } catch {
    return false;
  }
}

async function getCachedBlobUrl(url: string): Promise<string> {
  if (isSignedDeliveryUrl(url)) {
    return url;
  }

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
  const [src, setSrc] = useState<string | null>(() => {
    if (!url) return null;
    if (isSignedDeliveryUrl(url)) return url;
    return blobUrlCache.get(url) ?? null;
  });

  useEffect(() => {
    if (!url) {
      setSrc(null);
      return;
    }

    if (isSignedDeliveryUrl(url)) {
      setSrc(url);
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
