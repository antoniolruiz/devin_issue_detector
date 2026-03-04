import httpx
from typing import Optional


class DevinService:
    BASE_URL = "https://api.devin.ai"

    def __init__(self, api_token: str, org_id: str):
        self.api_token = api_token
        self.org_id = org_id
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }

    async def create_session(
        self,
        prompt: str,
        repos: Optional[list[str]] = None,
        title: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> dict:
        url = f"{self.BASE_URL}/v3beta1/organizations/{self.org_id}/sessions"
        payload: dict = {"prompt": prompt}
        if repos:
            payload["repos"] = repos
        if title:
            payload["title"] = title
        if tags:
            payload["tags"] = tags

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=self.headers, json=payload)
            response.raise_for_status()
            return response.json()

    async def get_session(self, session_id: str) -> dict:
        url = f"{self.BASE_URL}/v3beta1/organizations/{self.org_id}/sessions/{session_id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()

    async def send_message(self, session_id: str, message: str) -> dict:
        url = f"{self.BASE_URL}/v3beta1/organizations/{self.org_id}/sessions/{session_id}/messages"
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                url,
                headers=self.headers,
                json={"message": message},
            )
            response.raise_for_status()
            return response.json()

    async def terminate_session(self, session_id: str) -> dict:
        url = f"{self.BASE_URL}/v3beta1/organizations/{self.org_id}/sessions/{session_id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
