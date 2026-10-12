#!/bin/sh
# Runs from the nginx image's entrypoint. When a TLS proxy or load balancer sits in
# front of this container, TRUSTED_PROXIES (comma separated IPs/CIDRs) names it, and
# only its X-Forwarded-For is believed. Empty: clients connect directly.
set -eu
out=/etc/nginx/conf.d/00-realip.conf
: > "$out"
[ -n "${TRUSTED_PROXIES:-}" ] || exit 0
for cidr in $(echo "$TRUSTED_PROXIES" | tr ',' ' '); do
  echo "set_real_ip_from $cidr;" >> "$out"
done
echo "real_ip_header X-Forwarded-For;" >> "$out"
echo "real_ip_recursive on;" >> "$out"
