"""Serve the connection example on a different origin from the model backend."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class ExampleHandler(SimpleHTTPRequestHandler):
    def allowed(self):
        path = (ROOT / unquote(urlsplit(self.path).path).lstrip("/")).resolve()
        return any(path.is_relative_to(ROOT / name) for name in ("examples", "frontend"))

    def do_GET(self):
        # Only the browser example and adapter are public on this small server.
        if not self.allowed():
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self):
        if not self.allowed():
            self.send_error(404)
            return
        super().do_HEAD()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5174)
    args = parser.parse_args()
    handler = partial(ExampleHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Connection example: http://127.0.0.1:{args.port}/examples/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
