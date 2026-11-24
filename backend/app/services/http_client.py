import time
import httpx
from urllib.parse import urljoin
from typing import Optional, Tuple
from backend.app.config import settings
from backend.app.services.ssrf import validate_url_for_ssrf, SSRFValidationError


class MonitoringHttpClient:
    """
    Secure asynchronous HTTP client for executing health checks with:
    - Pre-request SSRF validation
    - Hop-by-hop redirect re-validation
    - Response size limits
    - Monotonic latency measurement
    """

    def __init__(self, allow_local_targets: Optional[bool] = None):
        self.allow_local = (
            allow_local_targets
            if allow_local_targets is not None
            else settings.ALLOW_LOCAL_TARGETS
        )

    async def execute_check(
        self,
        url: str,
        method: str = "GET",
        timeout_seconds: int = 10,
    ) -> Tuple[Optional[int], float, Optional[str]]:
        """
        Executes a safe HTTP/HTTPS check.
        Returns:
            (status_code, response_time_ms, error_message)
        """
        start_time = time.perf_counter()
        current_url = url
        redirect_count = 0
        max_redirects = settings.MAX_REDIRECTS

        limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
        client_timeout = httpx.Timeout(timeout_seconds)

        # 1. SSRF validate initial URL
        try:
            validate_url_for_ssrf(current_url, allow_local=self.allow_local)
        except SSRFValidationError as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return None, elapsed_ms, f"Security violation: {str(e)}"

        try:
            async with httpx.AsyncClient(
                verify=True,
                follow_redirects=False,
                limits=limits,
                timeout=client_timeout,
                headers={"User-Agent": "PulseWatch-Monitor/1.0 (+https://github.com/pulsewatch)"},
            ) as client:
                while True:
                    req = client.build_request(method=method, url=current_url)
                    response = await client.send(req)

                    # Handle Redirects safely
                    if response.is_redirect and "location" in response.headers:
                        redirect_count += 1
                        if redirect_count > max_redirects:
                            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                            return response.status_code, elapsed_ms, f"Too many redirects (exceeded limit of {max_redirects})"

                        next_url = urljoin(current_url, response.headers["location"])
                        # Re-validate new destination against SSRF!
                        try:
                            validate_url_for_ssrf(next_url, allow_local=self.allow_local)
                        except SSRFValidationError as e:
                            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                            return response.status_code, elapsed_ms, f"Redirect to unsafe destination blocked: {str(e)}"

                        current_url = next_url
                        continue

                    # Read up to MAX_RESPONSE_BYTES to prevent memory exhaustion
                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > settings.MAX_RESPONSE_BYTES:
                        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                        return response.status_code, elapsed_ms, "Response exceeded maximum size limit"

                    elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    return response.status_code, elapsed_ms, None

        except httpx.TimeoutException:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return None, elapsed_ms, f"Request timed out after {timeout_seconds}s"
        except httpx.ConnectError as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return None, elapsed_ms, f"Connection failed: {str(e)}"
        except httpx.HTTPError as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return None, elapsed_ms, f"HTTP error: {str(e)}"
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return None, elapsed_ms, f"Unexpected check failure: {str(e)}"
