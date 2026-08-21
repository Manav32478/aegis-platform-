# Infrastructure as Code (OpenTofu)

Install OpenTofu: https://opentofu.org/docs/intro/install

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill in your token + zone id
tofu init
tofu plan
tofu apply
```

This gives you a real IaC artifact for the report. Full multi-cloud Terraform
(GCP/Oracle) is a stretch goal — note it as future scope if you don't get to it.
