"""Helpers boto3 para Backblaze B2."""
from __future__ import annotations

import datetime

from django.utils import timezone

from django.conf import settings

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError


def get_b2_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.B2_ENDPOINT_URL,
        aws_access_key_id=settings.B2_KEY_ID,
        aws_secret_access_key=settings.B2_APP_KEY,
        region_name=settings.B2_REGION,
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )


def delete_prefix(bucket: str, prefix: str) -> int:
    """Elimina todos los objetos bajo `prefix`. Devuelve cantidad eliminada."""
    client = get_b2_client()
    prefix = prefix.lstrip("/")
    deleted = 0
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        contents = page.get("Contents") or []
        if not contents:
            continue
        objects = [{"Key": item["Key"]} for item in contents]
        client.delete_objects(Bucket=bucket, Delete={"Objects": objects, "Quiet": True})
        deleted += len(objects)
    return deleted


def purge_bucket(bucket: str) -> int:
    """Elimina todos los objetos (y versiones si aplica) de un cubo."""
    client = get_b2_client()
    deleted = 0

    try:
        paginator = client.get_paginator("list_object_versions")
        for page in paginator.paginate(Bucket=bucket):
            batch: list[dict] = []
            for item in page.get("Versions", []) + page.get("DeleteMarkers", []):
                entry = {"Key": item["Key"]}
                if item.get("VersionId"):
                    entry["VersionId"] = item["VersionId"]
                batch.append(entry)
            for i in range(0, len(batch), 1000):
                chunk = batch[i : i + 1000]
                if chunk:
                    client.delete_objects(
                        Bucket=bucket,
                        Delete={"Objects": chunk, "Quiet": True},
                    )
                    deleted += len(chunk)
    except ClientError:
        deleted = delete_prefix(bucket, "")

    if deleted == 0:
        deleted = delete_prefix(bucket, "")

    return deleted


def count_bucket_objects(bucket: str) -> int:
    client = get_b2_client()
    total = 0
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket):
        total += len(page.get("Contents") or [])
    return total


def prune_old_objects(bucket: str, prefix: str, keep_days: int) -> int:
    """Elimina objetos más antiguos que keep_days bajo prefix."""
    client = get_b2_client()
    prefix = prefix.lstrip("/")
    cutoff = timezone.now() - datetime.timedelta(days=keep_days)
    deleted = 0
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for item in page.get("Contents") or []:
            last_modified = item.get("LastModified")
            if last_modified and last_modified <= cutoff:
                client.delete_object(Bucket=bucket, Key=item["Key"])
                deleted += 1
    return deleted
