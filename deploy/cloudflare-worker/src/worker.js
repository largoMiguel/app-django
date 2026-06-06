import { AwsClient } from "aws4fetch";

const HEX = "0123456789abcdef";

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (const byte of bytes) {
    hex += HEX[(byte >> 4) & 0xf];
    hex += HEX[byte & 0xf];
  }
  return hex;
}

function parsePath(url) {
  const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const slash = pathname.indexOf("/");
  if (slash <= 0) return null;
  const bucket = pathname.slice(0, slash);
  const key = pathname.slice(slash + 1);
  if (!bucket || !key) return null;
  return { bucket, key };
}

function allowedBuckets(env) {
  return (env.ALLOWED_BUCKETS || "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

async function verifySignedUrl(bucket, key, exp, sig, secret) {
  if (!exp || !sig || !secret) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Number(exp) < now) return false;
  const path = `${bucket}/${key}`;
  const message = `${path}?exp=${exp}`;
  const expected = await hmacSha256Hex(secret, message);
  return timingSafeEqual(expected, sig);
}

function contentDisposition(filename) {
  const safe = filename.replace(/[\r\n"]/g, "_");
  const encoded = encodeURIComponent(filename);
  return `inline; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const parsed = parsePath(new URL(request.url));
    if (!parsed) {
      return new Response("Not Found", { status: 404 });
    }

    const { bucket, key } = parsed;
    if (!allowedBuckets(env).includes(bucket)) {
      return new Response("Forbidden", { status: 403 });
    }

    const url = new URL(request.url);
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");
    const downloadName = url.searchParams.get("dl");

    const ok = await verifySignedUrl(
      bucket,
      key,
      exp,
      sig,
      env.FILE_DELIVERY_SIGNING_KEY,
    );
    if (!ok) {
      return new Response("Forbidden", { status: 403 });
    }

    const endpoint = env.B2_ENDPOINT || "s3.us-east-005.backblazeb2.com";
    const region = env.B2_REGION || "us-east-005";
    const origin = `https://${bucket}.${endpoint}/${encodeURI(key).replace(/%2F/g, "/")}`;

    const aws = new AwsClient({
      accessKeyId: env.B2_KEY_ID,
      secretAccessKey: env.B2_APP_KEY,
      region,
      service: "s3",
    });

    const upstream = await aws.fetch(origin, { method: request.method });
    if (!upstream.ok) {
      return new Response(upstream.statusText || "Upstream Error", {
        status: upstream.status,
      });
    }

    const headers = new Headers(upstream.headers);
    if (downloadName) {
      headers.set("Content-Disposition", contentDisposition(downloadName));
    }
    headers.set("Cache-Control", "private, max-age=300");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  },
};
