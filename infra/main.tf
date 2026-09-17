# Aegis Infrastructure as Code (OpenTofu) — Month 2.6
# Start with Cloudflare DNS + the router Worker. Expand later to cover more.

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# --- DNS: point your domain at the router ---
# resource "cloudflare_record" "aegis_apex" {
#   zone_id = var.cloudflare_zone_id
#   name    = "aegis"
#   content = "192.0.2.1"                       # placeholder — use a real target
#   type    = "A"
#   proxied = true
# }
