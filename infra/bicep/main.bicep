// AskOps data, secrets, and telemetry tier.
//
// This template runs at subscription scope so it can create its own resource
// group, then deploys three modules into that group: PostgreSQL Flexible
// Server (with pgvector), Key Vault, and monitoring (Log Analytics plus
// Application Insights). The AskOps application itself deploys to Vercel, not
// Azure; see README.md for how the two fit together.

targetScope = 'subscription'

@description('Environment name, used to derive resource names (e.g. dev, staging, prod).')
param environment_name string = 'dev'

@description('Azure region for all resources.')
param location string = 'eastus2'

@description('Short project slug used in resource naming.')
param project_slug string = 'askops'

@description('Administrator login name for the PostgreSQL flexible server.')
param postgres_admin_login string = 'askops_admin'

@description('Administrator password for the PostgreSQL flexible server. No default: supply it via the .bicepparam file (readEnvironmentVariable) or with --parameters at deploy time. Never commit a real value.')
@secure()
param postgres_admin_password string

@description('Whether to add a firewall rule that allows Azure services to reach the PostgreSQL server.')
param enable_azure_services_firewall_rule bool = true

@description('Whether to enable purge protection on the Key Vault. Default false so a portfolio teardown is easy.')
param enable_purge_protection bool = false

var resourceGroupName = 'rg-${project_slug}-${environment_name}'
var commonTags = {
  project: project_slug
  environment: environment_name
  managed_by: 'bicep'
}

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-deployment'
  scope: rg
  params: {
    location: location
    project_slug: project_slug
    environment_name: environment_name
    tags: commonTags
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres-deployment'
  scope: rg
  params: {
    location: location
    project_slug: project_slug
    environment_name: environment_name
    postgres_admin_login: postgres_admin_login
    postgres_admin_password: postgres_admin_password
    enable_azure_services_firewall_rule: enable_azure_services_firewall_rule
    tags: commonTags
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault-deployment'
  scope: rg
  params: {
    location: location
    project_slug: project_slug
    environment_name: environment_name
    enable_purge_protection: enable_purge_protection
    tags: commonTags
  }
}

@description('Name of the resource group containing all provisioned resources.')
output resource_group_name string = rg.name

@description('Fully qualified domain name of the PostgreSQL flexible server.')
output postgres_server_fqdn string = postgres.outputs.postgres_server_fqdn

@description('Name of the application database on the PostgreSQL flexible server.')
output postgres_database_name string = postgres.outputs.postgres_database_name

@description('Name of the Key Vault.')
output key_vault_name string = keyvault.outputs.key_vault_name

@description('URI of the Key Vault.')
output key_vault_uri string = keyvault.outputs.key_vault_uri

@description('Resource id of the Application Insights component. The connection string is sensitive and is deliberately not an output: read it after deployment via the Azure CLI, do not echo secrets in deployment outputs. See README.md for the exact command.')
output application_insights_id string = monitoring.outputs.application_insights_id

@description('Resource id of the Log Analytics workspace.')
output log_analytics_workspace_id string = monitoring.outputs.log_analytics_workspace_id
