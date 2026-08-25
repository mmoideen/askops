// Azure Key Vault module for AskOps.
// Provisions an RBAC-authorized vault only. No secrets are created here; secret
// values are written by an operator or a deploy pipeline after the vault exists.

@description('Azure region for the Key Vault.')
param location string

@description('Short project slug used in resource naming (e.g. askops).')
param project_slug string

@description('Environment name used in resource naming (e.g. dev, staging, prod).')
param environment_name string

@description('Whether to enable purge protection. Default false so a portfolio teardown is easy. Once enabled on a vault it cannot be turned back off for that vault.')
param enable_purge_protection bool

@description('Tags applied to every resource created by this module.')
param tags object

// Key Vault names must be 3 to 24 characters, alphanumeric and dashes only, and
// globally unique across Azure. kv-{slug}-{env} stays well within that limit for
// the default slug and environment values used by this project.
var keyVaultName = 'kv-${project_slug}-${environment_name}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: enable_purge_protection
  }
}

@description('Name of the Key Vault.')
output key_vault_name string = keyVault.name

@description('URI of the Key Vault, used by clients to address secrets, keys, and certificates.')
output key_vault_uri string = keyVault.properties.vaultUri
