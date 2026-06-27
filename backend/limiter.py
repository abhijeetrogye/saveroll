"""
Shared rate-limiter instance.

Kept in a separate module to avoid the circular import that would occur if
routes.py imported from main.py (which itself imports router from routes.py).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
