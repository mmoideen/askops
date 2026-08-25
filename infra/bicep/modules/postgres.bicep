// Azure Database for PostgreSQL Flexible Server module for AskOps.
// Provisions a single burstable-tier server, an application database, the pgvector
// extension allowlist entry, and an optional firewall rule for Azure services.

@description('Azure region for the PostgreSQL flexible server.')
param location string

@description('Short project slug used in resource naming (e.g. askops).')
param project_slug string

@description('Environment name used in resource naming (e.g. dev, staging, prod).')
param environment_name string

@description('Administrator login name for the PostgreSQL flexible server.')
param postgres_admin_login string

@description('Administrator password for the PostgreSQL flexible server. Supplied by the caller as a secure parameter, never given a default value.')
@secure()
param postgres_admin_password string

@description('Whether to add a firewall rule that allows Azure services to reach this server.')
param enable_azure_services_firewall_rule bool

@description('Tags applied to every resource created by this module.')
param tags object

var serverName = 'psql-${project_slug}-${environment_name}'
var databaseName = 'askops'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgres_admin_login
    administratorLoginPassword: postgres_admin_password
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allowlists the pgvector extension so it can be created with: CREATE EXTENSION vector;
resource pgvectorExtension 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgresServer
  name: 'azure.extensions'
  properties: {
    value: 'VECTOR'
    source: 'user-override'
  }
  dependsOn: [
    postgresDatabase
  ]
}

// Special case recognized by Azure: start and end IP of 0.0.0.0 allows trusted
// Azure services and resources to reach this server (the portal's "Allow public
// access from any Azure service" checkbox).
resource firewallRuleAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (enable_azure_services_firewall_rule) {
  parent: postgresServer
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

@description('Fully qualified domain name of the PostgreSQL flexible server.')
output postgres_server_fqdn string = postgresServer.properties.fullyQualifiedDomainName

@description('Name of the application database on the server.')
output postgres_database_name string = postgresDatabase.name
