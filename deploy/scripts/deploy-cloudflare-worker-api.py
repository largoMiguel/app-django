"""Despliega el Worker files.softone360.com.

Requiere Node.js + wrangler (bundlea aws4fetch). En servidores sin Node use:
  deploy/scripts/deploy-cloudflare-worker-from-prod.sh
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parents[1] / "cloudflare-worker"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--token", default=os.getenv("CLOUDFLARE_API_TOKEN", ""))
    parser.add_argument("--b2-key-id", default=os.getenv("B2_KEY_ID", ""))
    parser.add_argument("--b2-app-key", default=os.getenv("B2_APP_KEY", ""))
    parser.add_argument(
        "--signing-key",
        default=os.getenv("FILE_DELIVERY_SIGNING_KEY", ""),
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Despliega softone-files-demo (files-demo.softone360.com)",
    )
    args = parser.parse_args()

    if not shutil.which("npm"):
        print(
            "ERROR: Node/npm no disponible. Ejecute desde su máquina:\n"
            "  bash deploy/scripts/deploy-cloudflare-worker-from-prod.sh",
            file=sys.stderr,
        )
        return 1

    for name, val in (
        ("CLOUDFLARE_API_TOKEN", args.token),
        ("B2_KEY_ID", args.b2_key_id),
        ("B2_APP_KEY", args.b2_app_key),
        ("FILE_DELIVERY_SIGNING_KEY", args.signing_key),
    ):
        if not val:
            print(f"ERROR: falta {name}", file=sys.stderr)
            return 1

    env = os.environ.copy()
    env["CLOUDFLARE_API_TOKEN"] = args.token
    wrangler_config = "wrangler.demo.toml" if args.demo else "wrangler.toml"
    deploy_url = (
        "https://files-demo.softone360.com"
        if args.demo
        else "https://files.softone360.com"
    )
    config_flag = ["--config", wrangler_config]

    print("==> npm install (worker)…")
    subprocess.run(["npm", "install", "--silent"], cwd=WORKER_DIR, check=True)

    print("==> wrangler deploy…")
    subprocess.run(
        ["npx", "wrangler", "deploy", *config_flag],
        cwd=WORKER_DIR,
        env=env,
        check=True,
    )

    print("==> wrangler secrets…")
    for secret_name, secret_val in (
        ("B2_KEY_ID", args.b2_key_id),
        ("B2_APP_KEY", args.b2_app_key),
        ("FILE_DELIVERY_SIGNING_KEY", args.signing_key),
    ):
        proc = subprocess.run(
            ["npx", "wrangler", "secret", "put", secret_name, *config_flag],
            cwd=WORKER_DIR,
            env=env,
            input=secret_val.encode(),
            check=True,
        )
        if proc.returncode != 0:
            return proc.returncode

    print(f"OK: Worker desplegado en {deploy_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
