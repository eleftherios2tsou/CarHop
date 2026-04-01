"""Unified storage backend — local disk or Azure Blob Storage.

Set STORAGE_BACKEND=azure and supply AZURE_STORAGE_CONNECTION_STRING
+ AZURE_CONTAINER_NAME in .env to switch to cloud storage.
Local disk is used by default (STORAGE_BACKEND=local).
"""
from __future__ import annotations

import os

from app.config import settings


# ── public API ────────────────────────────────────────────────────────────────
# these three functions are the only ones the rest of the app should call directly
# they route to the right backend (local or Azure) based on the STORAGE_BACKEND setting


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


# ── local disk backend ────────────────────────────────────────────────────────
# used in local development — files are saved to the uploads/ directory
# which is bind-mounted into the Docker container at /app/uploads


def _local_save(storage_key: str, data: bytes) -> str:
    # build the full path and make sure all parent directories exist
    disk_path = os.path.join(settings.uploads_dir, storage_key)
    os.makedirs(os.path.dirname(disk_path), exist_ok=True)
    with open(disk_path, "wb") as f:
        f.write(data)
    # return a URL path that the frontend can use to display the file
    return f"/uploads/{storage_key}"


def _local_read(storage_key: str) -> bytes:
    # just read the file straight from disk
    with open(os.path.join(settings.uploads_dir, storage_key), "rb") as f:
        return f.read()


def _local_delete(storage_key: str) -> None:
    path = os.path.join(settings.uploads_dir, storage_key)
    try:
        if os.path.exists(path):
            os.remove(path)
    except OSError:
        pass  # silently ignore if the file doesn't exist or can't be deleted


# ── Azure Blob Storage backend ────────────────────────────────────────────────
# used in production — files are stored in Azure Blob Storage
# requires AZURE_STORAGE_CONNECTION_STRING and AZURE_CONTAINER_NAME in .env


def _container_client():
    # we import azure SDK here (not at the top) so local dev doesn't need the azure package installed
    from azure.storage.blob import BlobServiceClient

    client = BlobServiceClient.from_connection_string(settings.azure_storage_connection_string)
    return client.get_container_client(settings.azure_container_name)


def _azure_save(storage_key: str, data: bytes, content_type: str) -> str:
    from azure.storage.blob import ContentSettings

    container = _container_client()
    blob = container.get_blob_client(storage_key)
    blob.upload_blob(
        data,
        overwrite=True,  # replace the file if it already exists (e.g. avatar update)
        content_settings=ContentSettings(content_type=content_type),  # so browsers render it correctly
    )
    # Public URL — requires container Public Access Level = Blob (set in Azure portal)
    return blob.url


def _azure_read(storage_key: str) -> bytes:
    blob = _container_client().get_blob_client(storage_key)
    return blob.download_blob().readall()


def _azure_delete(storage_key: str) -> None:
    try:
        blob = _container_client().get_blob_client(storage_key)
        blob.delete_blob()
    except Exception:
        pass  # silently ignore — the file might already be gone
