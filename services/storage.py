import os
import requests
from requests.auth import HTTPBasicAuth

NEXTCLOUD_URL = os.getenv("NEXTCLOUD_URL")
NEXTCLOUD_USER = os.getenv("NEXTCLOUD_USER")
NEXTCLOUD_PASSWORD = os.getenv("NEXTCLOUD_PASSWORD")
NEXTCLOUD_PUBLIC_BASE = os.getenv("NEXTCLOUD_PUBLIC_BASE")


def ensure_folder(path):
    url = f"{NEXTCLOUD_URL}/{NEXTCLOUD_USER}/{path}"
    r = requests.request(
        "MKCOL",
        url,
        auth=HTTPBasicAuth(NEXTCLOUD_USER, NEXTCLOUD_PASSWORD)
    )

    if r.status_code not in (201, 405):
        raise Exception(f"No se pudo crear carpeta {path}: {r.text}")


class StorageService:
    def save(self, file_stream, file_name, folder):  # -> str
        ensure_folder("clientes")
        ensure_folder(folder)

        remote_path = f"{folder}/{file_name}"
        url = f"{NEXTCLOUD_URL}/{NEXTCLOUD_USER}/{remote_path}"

        r = requests.put(
            url,
            data=file_stream,
            auth=HTTPBasicAuth(NEXTCLOUD_USER, NEXTCLOUD_PASSWORD)
        )

        if r.status_code not in (200, 201, 204):
            raise Exception("Error subiendo a Nextcloud")

        return remote_path

    def delete(self, storage_path):  # -> bool
        url = f"{NEXTCLOUD_URL}/{NEXTCLOUD_USER}/{storage_path}"

        r = requests.delete(
            url,
            auth=HTTPBasicAuth(NEXTCLOUD_USER, NEXTCLOUD_PASSWORD)
        )

        return r.status_code in (200, 204)

    def get_public_url(self, storage_path):  # -> str
        return f"{NEXTCLOUD_PUBLIC_BASE}{storage_path}"
