import ipaddress
import socket
from typing import List, Tuple
from urllib.parse import urlparse
from backend.app.config import settings

# Disallowed hostnames specifically targeting cloud metadata
BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "instance-data",
}

# IP networks that must be rejected
DISALLOWED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # "This" network
    ipaddress.ip_network("10.0.0.0/8"),         # RFC 1918 private
    ipaddress.ip_network("100.64.0.0/10"),      # Shared Address Space (CGNAT)
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),     # Link-local / AWS / GCP / Azure metadata
    ipaddress.ip_network("172.16.0.0/12"),      # RFC 1918 private
    ipaddress.ip_network("192.0.0.0/24"),       # IETF Protocol Assignments
    ipaddress.ip_network("192.0.2.0/24"),       # TEST-NET-1
    ipaddress.ip_network("192.168.0.0/16"),     # RFC 1918 private
    ipaddress.ip_network("198.18.0.0/15"),      # Network benchmark tests
    ipaddress.ip_network("198.51.100.0/24"),    # TEST-NET-2
    ipaddress.ip_network("203.0.113.0/24"),     # TEST-NET-3
    ipaddress.ip_network("224.0.0.0/4"),        # Multicast
    ipaddress.ip_network("240.0.0.0/4"),        # Reserved
    ipaddress.ip_network("255.255.255.255/32"), # Broadcast
    # IPv6
    ipaddress.ip_network("::1/128"),            # Loopback
    ipaddress.ip_network("::/128"),             # Unspecified
    ipaddress.ip_network("::ffff:0:0/96"),      # IPv4-mapped IPv6
    ipaddress.ip_network("64:ff9b::/96"),       # IPv4/IPv6 translation
    ipaddress.ip_network("100::/64"),           # Discard-only
    ipaddress.ip_network("2001:db8::/32"),      # Documentation
    ipaddress.ip_network("fc00::/7"),           # Unique local (ULA)
    ipaddress.ip_network("fe80::/10"),          # Link-local unicast
    ipaddress.ip_network("ff00::/8"),           # Multicast
]


class SSRFValidationError(Exception):
    """Raised when a URL or resolved IP fails SSRF validation."""
    pass


def is_ip_allowed(ip_str: str, allow_local: bool = False) -> bool:
    """Check if an individual IP address is globally routable and not in disallowed ranges."""
    if allow_local:
        return True

    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False

    # Check against known private/loopback properties
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return False

    # Explicit subnet range check
    for net in DISALLOWED_NETWORKS:
        if ip in net:
            return False

    return True


def resolve_hostname_ips(hostname: str) -> List[str]:
    """Resolve a hostname to all associated IPv4 and IPv6 addresses."""
    try:
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        ips = list({info[4][0] for info in addr_info})
        return ips
    except socket.gaierror as e:
        raise SSRFValidationError(f"DNS resolution failed for hostname '{hostname}': {e}")


def validate_url_for_ssrf(url: str, allow_local: bool = False) -> Tuple[str, str, int]:
    """
    Validate target URL against SSRF vulnerabilities.
    Returns (scheme, hostname, port).
    Raises SSRFValidationError on violation.
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise SSRFValidationError(f"Invalid URL structure: {e}")

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        raise SSRFValidationError(f"Disallowed scheme '{scheme}'. Only HTTP and HTTPS are permitted.")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFValidationError("URL has no valid hostname.")

    hostname_clean = hostname.strip().lower()

    if not allow_local:
        # Check blocked hostname list
        if hostname_clean in BLOCKED_HOSTNAMES:
            raise SSRFValidationError(f"Target hostname '{hostname_clean}' is blocked (metadata/loopback).")

        if hostname_clean.endswith(".internal") or hostname_clean.endswith(".local") or hostname_clean.endswith(".localhost"):
            raise SSRFValidationError(f"Target domain '{hostname_clean}' is in a private/internal TLD.")

        # Resolve IPs
        ips = resolve_hostname_ips(hostname_clean)
        if not ips:
            raise SSRFValidationError(f"Could not resolve any IP address for '{hostname_clean}'.")

        for ip in ips:
            if not is_ip_allowed(ip, allow_local=False):
                raise SSRFValidationError(f"Target '{hostname_clean}' resolves to disallowed/private IP '{ip}'.")

    port = parsed.port or (443 if scheme == "https" else 80)
    return scheme, hostname_clean, port
