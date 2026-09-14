"""Parser worker entrypoint. Phase 2A gives it a queue consumer; Phase 1 only proves the image."""

import signal
import sys
import threading


def main() -> int:
    print("ei-ai parser skeleton: no work is consumed in Phase 1", file=sys.stderr, flush=True)
    stop = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stop.set())
    stop.wait()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
