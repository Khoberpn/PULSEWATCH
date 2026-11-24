import pytest
from backend.app.services.ssrf import validate_url_for_ssrf, SSRFValidationError, is_ip_allowed


def test_ip_allowed():
    # Public IPs should be allowed
    assert is_ip_allowed("8.8.8.8") is True
    assert is_ip_allowed("1.1.1.1") is True
    assert is_ip_allowed("93.184.216.34") is True

    # Private and loopback IPs must be blocked
    assert is_ip_allowed("127.0.0.1") is False
    assert is_ip_allowed("10.0.0.1") is False
    assert is_ip_allowed("172.16.0.1") is False
    assert is_ip_allowed("192.168.1.1") is False
    assert is_ip_allowed("169.254.169.254") is False
    assert is_ip_allowed("::1") is False
    assert is_ip_allowed("fe80::1") is False
    assert is_ip_allowed("0.0.0.0") is False


def test_ssrf_disallowed_schemes():
    with pytest.raises(SSRFValidationError, match="Disallowed scheme"):
        validate_url_for_ssrf("ftp://example.com")

    with pytest.raises(SSRFValidationError, match="Disallowed scheme"):
        validate_url_for_ssrf("file:///etc/passwd")

    with pytest.raises(SSRFValidationError, match="Disallowed scheme"):
        validate_url_for_ssrf("gopher://127.0.0.1:70")


def test_ssrf_blocked_hostnames():
    with pytest.raises(SSRFValidationError):
        validate_url_for_ssrf("http://localhost:8000/api")

    with pytest.raises(SSRFValidationError):
        validate_url_for_ssrf("http://127.0.0.1:3000")

    with pytest.raises(SSRFValidationError):
        validate_url_for_ssrf("http://metadata.google.internal/computeMetadata/v1")

    with pytest.raises(SSRFValidationError):
        validate_url_for_ssrf("http://169.254.169.254/latest/meta-data")


def test_ssrf_valid_public_url():
    scheme, host, port = validate_url_for_ssrf("https://httpbin.org/get")
    assert scheme == "https"
    assert host == "httpbin.org"
    assert port == 443
