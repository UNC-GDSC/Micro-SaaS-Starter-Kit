"""
Print a Fernet ciphertext for a known plaintext using a fixed key.
Used to verify cross-language (Python → Node.js) Fernet round-trips.

Usage:
    python worker/tests/fixtures/fernet_fixture.py
"""
from cryptography.fernet import Fernet

KEY = b'bV4UmliwP4xFApJTnq5O5XxJ4mltOC4bjrQQ7EdCUtc='
PLAINTEXT = b'test-password-123'

if __name__ == '__main__':
    f = Fernet(KEY)
    ciphertext = f.encrypt(PLAINTEXT).decode()
    print(ciphertext)
