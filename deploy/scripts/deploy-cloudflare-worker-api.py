"""Despliega el Worker files.softone360.com vía Cloudflare API (sin wrangler login)."""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ACCOUNT_ID = os.getenv("CF_ACCOUNT_ID", "6031fdec2d3f25ad748f6c5519281536")
WORKER_NAME = "softone-files"
ZONE_NAME = "softone360.com"
ROUTE_PATTERN = "files.softone360.com/*"


def api(method: str, path: str, token: str, data: bytes | None = None, content_type: str = "application/json"):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type,
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        body = json.loads(resp.read().decode())
    if not body.get("success", False):
        raise RuntimeError(json.dumps(body.get("errors", body), indent=2))
    return body


def upload_worker(token: str, script_path: Path):
    script = script_path.read_bytes()
    boundary = "----SoftOneWorkerBoundary"
    metadata = json.dumps(
        {
            "main_module": "worker.js",
            "bindings": [
                {"type": "plain_text", "name": "B2_ENDPOINT", "text": "s3.us-east-005.backblazeb2.com"},
                {"type": "plain_text", "name": "B2_REGION", "text": "us-east-005"},
                {
                    "type": "plain_text",
                    "name": "ALLOWED_BUCKETS",
                    "text": "softone-pqrs,softone-pdm,softone-th,softone-correspondence",
                },
            ],
        }
    ).encode()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="metadata"\r\n'
        f"Content-Type: application/json\r\n\r\n"
    ).encode() + metadata + (
        f"\r\n--{boundary}\r\n"
        f'Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n'
        f"Content-Type: application/javascript+module\r\n\r\n"
    ).encode() + script + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}",
        data=body,
        method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        result = json.loads(resp.read().decode())
    if not result.get("success", False):
        raise RuntimeError(json.dumps(result.get("errors", result), indent=2))


def put_secret(token: str, name: str, value: str):
    data = json.dumps({"name": name, "text": value, "type": "secret_text"}).encode()
    api("PUT", f"/accounts/{ACCOUNT_ID}/workers/scripts/{WORKER_NAME}/secrets", token, data)


def ensure_route(token: str):
    zones = api("GET", f"/zones?name={ZONE_NAME}", token)["result"]
    if not zones:
        raise RuntimeError(f"Zona {ZONE_NAME} no encontrada")
    zone_id = zones[0]["id"]
    routes = api("GET", f"/zones/{zone_id}/workers/routes", token)["result"]
    for route in routes:
        if route.get("pattern") == ROUTE_PATTERN:
            return
    data = json.dumps({"pattern": ROUTE_PATTERN, "script": WORKER_NAME}).encode()
    api("POST", f"/zones/{zone_id}/workers/routes", token, data)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--token", default=os.getenv("CLOUDFLARE_API_TOKEN", ""))
    parser.add_argument(
        "--script",
        default=str(Path(__file__).resolve().parents[1] / "cloudflare-worker" / "src" / "worker.js"),
    )
    parser.add_argument("--b2-key-id", default=os.getenv("B2_KEY_ID", ""))
    parser.add_argument("--b2-app-key", default=os.getenv("B2_APP_KEY", ""))
    parser.add_argument(
        "--signing-key",
        default=os.getenv("FILE_DELIVERY_SIGNING_KEY", ""),
    )
    args = parser.parse_args()

    if not args.token:
        print("ERROR: configure CLOUDFLARE_API_TOKEN (Workers Scripts Edit + Zone Workers Routes Edit)", file=sys.stderr)
        return 1
    for name, val in (
        ("B2_KEY_ID", args.b2_key_id),
        ("B2_APP_KEY", args.b2_app_key),
        ("FILE_DELIVERY_SIGNING_KEY", args.signing_key),
    ):
        if not val:
            print(f"ERROR: falta {name}", file=sys.stderr)
            return 1

    script_path = Path(args.script)
    if not script_path.is_file():
        print(f"ERROR: no existe {script_path}", file=sys.stderr)
        return 1

    print("==> Subiendo Worker…")
    upload_worker(args.token, script_path)
    print("==> Configurando secrets…")
    put_secret(args.token, "B2_KEY_ID", args.b2_key_id)
    put_secret(args.token, "B2_APP_KEY", args.b2_app_key)
    put_secret(args.token, "FILE_DELIVERY_SIGNING_KEY", args.signing_key)
    print("==> Ruta files.softone360.com/* …")
    ensure_route(args.token)
    print("OK: Worker desplegado en https://files.softone360.com")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
