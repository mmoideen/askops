# Provider requirements and configuration for the AskOps data, secrets, and
# telemetry tier. The AskOps application itself deploys to Vercel, not Azure,
# so this stack intentionally only manages the azurerm provider.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
}
