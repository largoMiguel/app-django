import { useEffect, useState } from "react";
import { fetchAuthenticatedFile } from "@/core/api/client";
import { isSignedDeliveryUrl } from "@/core/api/fileDelivery";

const blobUrlCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

async function getCachedBlobUrl(url: string): Promise<string> {
  if (isSignedDeliveryUrl(url)) {
    return url;
  }

  const cached = blobUrlCache.get(url);
  if (cached) return cached;

  const pending = inflightRequests.get(url);
  if (pending) return pending;

  const request = fetchAuthenticatedFile(url)
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      blobUrlCache.set(url, blobUrl);
      inflightRequests.delete(url);
      return blobUrl;
    })
    .catch((err) => {
      inflightRequests.delete(url);
      throw err;
    });

  inflightRequests.set(url, request);
  return request;
}

export function useAuthenticatedImage(
  url: string | null | undefined,
): { src: string | null; failed: boolean } {
  const [src, setSrc] = useState<string | null>(() => {
    if (!url) return null;
    if (isSignedDeliveryUrl(url)) return url;
    return blobUrlCache.get(url) ?? null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) {
      setSrc(null);
      setFailed(false);
      return;
    }

    if (isSignedDeliveryUrl(url)) {
      setSrc(url);
      setFailed(false);
      return;
    }

    const cached = blobUrlCache.get(url);
    if (cached) {
      setSrc(cached);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setFailed(false);
    void getCachedBlobUrl(url)
      .then((blobUrl) => {
        if (!cancelled) setSrc(blobUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { src, failed };
}
