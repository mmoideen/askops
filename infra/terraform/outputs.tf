# Outputs for the AskOps data, secrets, and telemetry tier. These mirror the
# outputs of the Bicep stack (see ../bicep/main.bicep) with one deliberate
# difference: here the Application Insights connection string is exposed
# directly, marked sensitive, since Terraform state can hold it safely.

output "resource_group_name" {
  description = "Name of the resource group containing all provisioned resources."
  value       = azurerm_resource_group.main.name
}

output "postgres_server_fqdn" {
  description = "Fully qualified domain name of the PostgreSQL flexible server."
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "postgres_database_name" {
  description = "Name of the application database on the PostgreSQL flexible server."
  value       = azurerm_postgresql_flexible_server_database.askops.name
}

output "key_vault_name" {
  description = "Name of the Key Vault."
  value       = azurerm_key_vault.main.name
}

output "key_vault_uri" {
  description = "URI of the Key Vault."
  value       = azurerm_key_vault.main.vault_uri
}

output "application_insights_connection_string" {
  description = "Connection string for Application Insights. Sensitive: fetch it with terraform output -raw application_insights_connection_string, never print it in a log."
  value       = azurerm_application_insights.main.connection_string
  sensitive   = true
}

output "log_analytics_workspace_id" {
  description = "Resource id of the Log Analytics workspace."
  value       = azurerm_log_analytics_workspace.main.id
}
