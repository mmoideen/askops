// Monitoring module for AskOps: a Log Analytics workspace plus a workspace-based
// Application Insights resource linked to it.

@description('Azure region for the monitoring resources.')
param location string

@description('Short project slug used in resource naming (e.g. askops).')
param project_slug string

@description('Environment name used in resource naming (e.g. dev, staging, prod).')
param environment_name string

@description('Tags applied to every resource created by this module.')
param tags object

var logAnalyticsWorkspaceName = 'log-${project_slug}-${environment_name}'
var applicationInsightsName = 'appi-${project_slug}-${environment_name}'

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
  }
}

@description('Resource id of the Log Analytics workspace.')
output log_analytics_workspace_id string = logAnalyticsWorkspace.id

@description('Resource id of the Application Insights component. The connection string itself is sensitive and is intentionally not exposed as an output: fetch it after deployment via the Azure CLI (see README.md), do not echo secrets in deployment outputs.')
output application_insights_id string = applicationInsights.id
