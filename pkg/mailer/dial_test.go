package mailer

import (
	"errors"
	"net/netip"
	"testing"
)

func TestIsPublicAddr(t *testing.T) {
	for _, s := range []string{"127.0.0.1", "10.0.0.5", "172.17.0.1", "192.168.1.20", "169.254.169.254", "100.64.1.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"} {
		if isPublicAddr(netip.MustParseAddr(s)) {
			t.Errorf("%s must not count as public", s)
		}
	}
	for _, s := range []string{"142.250.4.108", "2607:f8b0:4004:c1b::6c"} {
		if !isPublicAddr(netip.MustParseAddr(s)) {
			t.Errorf("%s should count as public", s)
		}
	}
}

func TestDialSMTPRefusesInternalHosts(t *testing.T) {
	t.Setenv("SMTP_ALLOW_PRIVATE_HOSTS", "")
	for _, host := range []string{"127.0.0.1", "localhost", "10.1.2.3"} {
		if _, err := dialSMTP(host, 587); !errors.Is(err, errBlockedHost) {
			t.Errorf("dial %s: expected errBlockedHost, got %v", host, err)
		}
	}
}
