# Variable surface for the AskOps data, secrets, and telemetry tier. This
# mirrors the parameter surface of the Bicep stack (see ../bicep/main.bicep)
# exactly, so both stacks describe the same footprint.

variable "environment_name" {
  description = "Environment name, used to derive resource names (dev, staging, prod)."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment_name)
    error_message = "environment_name must be one of: dev, staging, prod."
  }
}

variable "location" {
  description = "Azure region for all resources."
  type        = string
  default     = "eastus2"
}

variable "project_slug" {
  description = "Short project slug used in resource naming."
  type        = string
  default     = "askops"
}

variable "postgres_admin_login" {
  description = "Administrator login name for the PostgreSQL flexible server."
  type        = string
  default     = "askops_admin"
}

variable "postgres_admin_password" {
  description = "Administrator password for the PostgreSQL flexible server. No default: provide it via the TF_VAR_postgres_admin_password environment variable or an untracked *.auto.tfvars file, never a committed one."
  type        = string
  sensitive   = true
}

variable "enable_azure_services_firewall_rule" {
  description = "Whether to add a firewall rule that allows Azure services to reach the PostgreSQL server."
  type        = bool
  default     = true
}

variable "enable_purge_protection" {
  description = "Whether to enable purge protection on the Key Vault. Default false so a portfolio teardown is easy."
  type        = bool
  default     = false
}
