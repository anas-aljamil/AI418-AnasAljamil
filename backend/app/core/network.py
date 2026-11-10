"""Facts about where a request came from, for the public link (docs/run-on-phone.md, Section 3b).

The public link is a Cloudflare tunnel to this computer: every request then reaches the API
from cloudflared on 127.0.0.1, and Cloudflare's edge puts the visitor's real address in
CF-Connecting-IP (it replaces any copy a visitor sends). Requests without that header
came straight from this computer or the local Wi-Fi.
"""

from fastapi import Request

TUNNEL_CLIENT_HEADER = "cf-connecting-ip"


def came_through_tunnel(request: Request) -> bool:
    return TUNNEL_CLIENT_HEADER in request.headers


def client_address(request: Request) -> str:
    """The visitor's address, for rate limits: the tunnel's header, else the connection."""
    if came_through_tunnel(request):
        return request.headers[TUNNEL_CLIENT_HEADER]
    return request.client.host if request.client else "unknown"


def is_https(request: Request) -> bool:
    """True when the browser used HTTPS, also behind the tunnel (which forwards plain HTTP)."""
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
