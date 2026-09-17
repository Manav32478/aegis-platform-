variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API token with DNS + Workers edit permission"
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Zone ID of your domain in Cloudflare"
}
