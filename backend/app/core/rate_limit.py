"""In-memory sliding-window rate limiter (single process; enough for the MVP).

Used for login now and for sending messages in P5. Keys combine the client
address with the target (e.g. the email), so one attacker cannot lock out
everyone and one user cannot be brute-forced from many requests.
"""

import math
import threading
import time
from collections import defaultdict, deque

from app.core.errors import AppError


class RateLimiter:
    def __init__(self, limit: int, window_seconds: float):
        self.limit, self.window = limit, window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        """Record one attempt for key; raise 429 when over the limit."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                retry = max(1, math.ceil(self.window - (now - hits[0])))
                raise AppError(
                    429,
                    "RATE_LIMITED",
                    f"Too many attempts. Try again in {retry} seconds.",
                    headers={"Retry-After": str(retry)},
                )
            hits.append(now)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
