# Policy-as-code — Month 4.3 (OPA / Rego)
# Rule: storage resources must never be publicly accessible.
package aegis.policy

deny[msg] {
  input.resource.public == true
  msg := "Storage resource must not be publicly accessible"
}

# Rule: every resource must have a team tag (cost/ownership hygiene).
deny[msg] {
  input.resource.tags.team == ""
  msg := "Resource must have a 'team' tag"
}
