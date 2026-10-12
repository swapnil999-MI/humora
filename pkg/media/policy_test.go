package media

import (
	"encoding/json"
	"testing"
)

func TestPublicReadPolicyDeniesBiometrics(t *testing.T) {
	var policy struct {
		Statement []struct {
			Effect   string
			Action   []string
			Resource []string
		}
	}
	if err := json.Unmarshal([]byte(publicReadPolicy("humora-media")), &policy); err != nil {
		t.Fatalf("policy is not valid JSON: %v", err)
	}
	if len(policy.Statement) != 2 || policy.Statement[0].Effect != "Allow" || policy.Statement[1].Effect != "Deny" {
		t.Fatalf("want one Allow then one Deny, got %+v", policy.Statement)
	}
	denied := map[string]bool{}
	for _, r := range policy.Statement[1].Resource {
		denied[r] = true
	}
	for _, want := range []string{"arn:aws:s3:::humora-media/biometrics/*", "arn:aws:s3:::humora-media/selfies/*"} {
		if !denied[want] {
			t.Errorf("%s is not denied", want)
		}
	}
}
