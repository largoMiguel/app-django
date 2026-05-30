#!/usr/bin/env python3
"""Configura secrets de GitHub Actions via API (requiere GITHUB_TOKEN con scope repo)."""
from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = os.environ.get("GITHUB_REPO", "largoMiguel/app-django")
ROOT = Path(__file__).resolve().parents[1]
KEY_FILE = ROOT / "keys" / "softone_deploy"


def api(method: str, path: str, token: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def encrypt_secret(public_key: str, secret_value: str) -> str:
    try:
        from nacl import encoding, public
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "pynacl"])
        from nacl import encoding, public

    pk = public.PublicKey(public_key.encode(), encoding.Base64Encoder())
    sealed = public.SealedBox(pk).encrypt(secret_value.encode())
    return base64.b64encode(sealed).decode()


def set_secret(token: str, name: str, value: str, key_id: str, public_key: str) -> None:
    api(
        "PUT",
        f"/repos/{REPO}/actions/secrets/{name}",
        token,
        {
            "encrypted_value": encrypt_secret(public_key, value),
            "key_id": key_id,
        },
    )
    print(f"OK secret {name}")


def main() -> int:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("ERROR: export GITHUB_TOKEN=<PAT con permiso repo + secrets>", file=sys.stderr)
        return 1
    if not KEY_FILE.is_file():
        print(f"ERROR: falta {KEY_FILE}", file=sys.stderr)
        return 1

    pub = api("GET", f"/repos/{REPO}/actions/secrets/public-key", token)
    key_id = pub["key_id"]
    public_key = pub["key"]

    set_secret(token, "SSH_PRIVATE_KEY", KEY_FILE.read_text(), key_id, public_key)
    set_secret(token, "DEPLOY_HOST", "ssh.softone360.com", key_id, public_key)
    set_secret(token, "DEPLOY_USER", "softone", key_id, public_key)

    cf_id = os.environ.get("CF_ACCESS_CLIENT_ID")
    cf_secret = os.environ.get("CF_ACCESS_CLIENT_SECRET")
    if cf_id and cf_secret:
        set_secret(token, "CF_ACCESS_CLIENT_ID", cf_id, key_id, public_key)
        set_secret(token, "CF_ACCESS_CLIENT_SECRET", cf_secret, key_id, public_key)
    else:
        print("INFO: CF_ACCESS_* omitidos (opcionales con túnel SSH actual)")

    print(f"Secrets configurados en {REPO}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
