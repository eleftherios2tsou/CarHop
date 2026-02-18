from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException

_lock = threading.Lock()
_buckets: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(*, scope: str, identifier: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    key = f"{scope}:{identifier}"

    with _lock:
        q = _buckets[key]
        cutoff = now - window_seconds
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(status_code=429, detail="Too many requests")
        q.append(now)
