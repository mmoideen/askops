# AskOps data, secrets, and telemetry tier.
#
# Mirrors ../bicep/main.bicep resource for resource: a resource group, a
# PostgreSQL flexible server (with pgvector) and its database, a Key Vault,
# a Log Analytics workspace, and a workspace-based Application Insights
# component. The AskOps application itself deploys to Vercel, not Azure; see
# README.md for how the two fit together.

data "azurerm_client_config" "current" {}

# Resource names are derived consistently across both stacks:
# rg-{slug}-{env}, psql-{slug}-{env}, kv-{slug}-{env}, log-{slug}-{env}, appi-{slug}-{env}.
locals {
  resource_group_name = "rg-${var.project_slug}-${var.environment_name}"

  postgres_server_name   = "psql-${var.project_slug}-${var.environment_name}"
  postgres_database_name = "askops"

  # Key Vault names must be 3 to 24 characters, alphanumeric and dashes only,
  # and globally unique across Azure. kv-{slug}-{env} stays within that limit
  # for the default slug and environment values used by this project.
  key_vault_name = "kv-${var.project_slug}-${var.environment_name}"

  log_analytics_workspace_name = "log-${var.project_slug}-${var.environment_name}"
  application_insights_name    = "appi-${var.project_slug}-${var.environment_name}"

  tags = {
    project     = var.project_slug
    environment = var.environment_name
    managed_by  = "terraform"
  }
}

resource "azurerm_resource_group" "main" {
  name     = local.resource_group_name
  location = var.location
  tags     = local.tags
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                          = local.postgres_server_name
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "16"
  administrator_login           = var.postgres_admin_login
  administrator_password        = var.postgres_admin_password
  sku_name                      = "B_Standard_B1ms"
  storage_mb                    = 32768
  backup_retention_days         = 7
  geo_redundant_backup_enabled  = false
  public_network_access_enabled = true
  tags                          = local.tags
}

resource "azurerm_postgresql_flexible_server_database" "askops" {
  name      = local.postgres_database_name
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Allowlists the pgvector extension so it can be created with: CREATE EXTENSION vector;
resource "azurerm_postgresql_flexible_server_configuration" "pgvector" {
  name      = "azure.extensions"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "VECTOR"

  depends_on = [azurerm_postgresql_flexible_server_database.askops]
}

# Special case recognized by Azure: start and end IP of 0.0.0.0 allows trusted
# Azure services and resources to reach this server (the portal's "Allow public
# access from any Azure service" checkbox).
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  count = var.enable_azure_services_firewall_rule ? 1 : 0

  name             = "AllowAllAzureServicesAndResourcesWithinAzureIps"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Soft delete has no separate on/off argument in the azurerm provider: Azure has
# enforced it unconditionally on every Key Vault for years, matching the Bicep
# module's explicit enableSoftDelete: true. Retention and purge protection are
# the two knobs that remain, and both are set below.
resource "azurerm_key_vault" "main" {
  name                          = local.key_vault_name
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = var.enable_purge_protection
  soft_delete_retention_days    = 90
  public_network_access_enabled = true
  tags                          = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = local.log_analytics_workspace_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_application_insights" "main" {
  name                = local.application_insights_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  workspace_id        = azurerm_log_analytics_workspace.main.id
  application_type    = "web"
  tags                = local.tags
}
