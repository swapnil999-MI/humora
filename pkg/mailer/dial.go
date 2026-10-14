package mailer

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/netip"
	"os"
	"time"

	"humora-backend/configs"
)

// SMTP hosts are typed in by tenant admins, so the server must not become a way to
// reach machines on its own network (databases, Docker API, admin panels). Outside
// local/test only public addresses are dialled, unless the operator runs an internal
// relay and sets SMTP_ALLOW_PRIVATE_HOSTS=true.

const dialTimeout = 10 * time.Second

var errUnreachable = errors.New("could not connect to the SMTP server. check the host, port and encryption settings")

// errBlockedHost is returned for hosts that resolve to private or reserved addresses.
var errBlockedHost = errors.New("this SMTP host resolves to a private or reserved network address, which is not allowed")

// cgnat is 100.64.0.0/10 (carrier-grade NAT), which netip does not treat as private.
var cgnat = netip.MustParsePrefix("100.64.0.0/10")

func privateHostsAllowed() bool {
	if os.Getenv("SMTP_ALLOW_PRIVATE_HOSTS") == "true" {
		return true
	}
	return configs.AppConfig != nil && configs.AppConfig.IsLocal()
}

func isPublicAddr(a netip.Addr) bool {
	a = a.Unmap()
	return a.IsValid() && a.IsGlobalUnicast() && !a.IsPrivate() && !cgnat.Contains(a)
}

// dialSMTP resolves host once, refuses non-public addresses and connects to the
// vetted IP itself, so a DNS answer that changes between check and dial cannot
// redirect the connection.
func dialSMTP(host string, port int) (net.Conn, error) {
	ctx, cancel := context.WithTimeout(context.Background(), dialTimeout)
	defer cancel()

	addrs, err := net.DefaultResolver.LookupNetIP(ctx, "ip", host)
	if err != nil || len(addrs) == 0 {
		log.Printf("[Mailer] Could not resolve SMTP host %q: %v", host, err)
		return nil, errUnreachable
	}

	allowPrivate := privateHostsAllowed()
	dialer := net.Dialer{Timeout: dialTimeout}
	blocked := false
	for _, a := range addrs {
		if !allowPrivate && !isPublicAddr(a) {
			blocked = true
			continue
		}
		conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(a.Unmap().String(), fmt.Sprint(port)))
		if err == nil {
			return conn, nil
		}
		log.Printf("[Mailer] SMTP dial to %s:%d (%s) failed: %v", host, port, a, err)
	}
	if blocked {
		return nil, errBlockedHost
	}
	return nil, errUnreachable
}
