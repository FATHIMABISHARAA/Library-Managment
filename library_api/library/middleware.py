
import time
from datetime import datetime
from pathlib import Path


class RequestLogMiddleware:

    def __init__(self, get_response):
        self.get_response = get_response

        # Save server.log in the backend folder
        self.log_file = Path(__file__).resolve().parent.parent / "server.log"

    def __call__(self, request):

        start_time = time.perf_counter()

        response = self.get_response(request)

        response_time = time.perf_counter() - start_time

        ip = request.META.get("REMOTE_ADDR", "unknown")
        timestamp = datetime.now().strftime("%d/%b/%Y:%H:%M:%S")
        method = request.method
        path = request.path
        protocol = request.META.get("SERVER_PROTOCOL", "HTTP/1.1")
        status = response.status_code
        size = len(response.content) if hasattr(response, "content") else 0

        log_line = (
            f'{ip} - [{timestamp}] '
            f'"{method} {path} {protocol}" '
            f'{status} {size} {response_time:.4f}\n'
        )

        with open(self.log_file, "a", encoding="utf-8") as file:
            file.write(log_line)

        return response
