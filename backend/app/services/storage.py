"""Unified storage backend — local disk or Azure Blob Storage.

Set STORAGE_BACKEND=azure and supply AZURE_STORAGE_CONNECTION_STRING
+ AZURE_CONTAINER_NAME in .env to switch to cloud storage.
Local disk is used by default (STORAGE_BACKEND=local).
"""
from __future__ import annotations

import os

from app.config import settings




def save_file(storage_key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Persist bytes at storage_key; return the public URL."""
    if settings.storage_backend == "azure":
        return _azure_save(storage_key, data, content_type)
    return _local_save(storage_key, data)


def read_file(storage_key: str) -> bytes:
    """Read bytes from storage_key."""
    if settings.storage_backend == "azure":
        return _azure_read(storage_key)
    return _local_read(storage_key)


def delete_file(storage_key: str) -> None:
    """Delete a file; silently ignore errors."""
    if settings.storage_backend == "azure":
        _azure_delete(storage_key)
    else:
        _local_delete(storage_key)




def _local_save(storage_key: str, data: bytes) -> str:
    disk_path = os.path.join(settings.uploads_dir, storage_key)
    os.makedirs(os.path.dirname(disk_path), exist_ok=True)
    with open(disk_path, "wb") as f:
        f.write(data)
    return f"/uploads/{storage_key}"


def _local_read(storage_key: str) -> bytes:
    with open(os.path.join(settings.uploads_dir, storage_key), "rb") as f:
        return f.read()


def _local_delete(storage_key: str) -> None:
    path = os.path.join(settings.uploads_dir, storage_key)
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass




def _container_client():
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    return client.get_container_client(settings.azure_container_name)


def _azure_save(storage_key: str, data: bytes, content_type: str) -> str:
    from azure.storage.blob import ContentSettings

    container = _container_client()
    blob = container.get_blob_client(storage_key)
    blob.upload_blob(
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    # Public URL — requires container Public Access Level = Blob
    return blob.url


def _azure_read(storage_key: str) -> bytes:
    blob = _container_client().get_blob_client(storage_key)
    return blob.download_blob().readall()


def _azure_delete(storage_key: str) -> None:
    try:
        blob = _container_client().get_blob_client(storage_key)
        blob.delete_blob()
    except Exception:
        pass
