from __future__ import annotations

from io import BytesIO
from typing import Any

import boto3
from botocore.client import BaseClient

from app.core.config import Settings, get_settings


class S3StorageGateway:
    def __init__(self, client: BaseClient) -> None:
        self._client = client

    def create_presigned_upload(
        self,
        *,
        bucket: str,
        object_key: str,
        content_type: str,
        expires_in: int,
    ) -> str:
        return self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

    def ensure_bucket_exists(self, *, bucket: str) -> None:
        try:
            self._client.head_bucket(Bucket=bucket)
        except Exception:
            self._client.create_bucket(Bucket=bucket)

    def create_presigned_download(
        self,
        *,
        bucket: str,
        object_key: str,
        expires_in: int,
    ) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": object_key},
            ExpiresIn=expires_in,
        )

    def head_object(self, *, bucket: str, object_key: str) -> dict[str, Any]:
        return self._client.head_object(Bucket=bucket, Key=object_key)

    def delete_object(self, *, bucket: str, object_key: str) -> None:
        self._client.delete_object(Bucket=bucket, Key=object_key)

    def read_bytes(self, *, bucket: str, object_key: str) -> bytes:
        response = self._client.get_object(Bucket=bucket, Key=object_key)
        return response["Body"].read()

    def write_bytes(
        self,
        *,
        bucket: str,
        object_key: str,
        content: bytes,
        content_type: str,
    ) -> None:
        self._client.upload_fileobj(
            BytesIO(content),
            bucket,
            object_key,
            ExtraArgs={"ContentType": content_type},
        )


def build_storage_gateway(settings: Settings | None = None) -> S3StorageGateway:
    resolved_settings = settings or get_settings()
    client = boto3.client(
        "s3",
        region_name=resolved_settings.aws_region,
        aws_access_key_id=resolved_settings.aws_access_key_id or None,
        aws_secret_access_key=resolved_settings.aws_secret_access_key or None,
        endpoint_url=resolved_settings.aws_s3_endpoint_url or None,
    )
    return S3StorageGateway(client)
