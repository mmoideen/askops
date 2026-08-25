using 'main.bicep'

// Default parameter values for the AskOps portfolio deployment. Override any of
// these on the command line with additional --parameters entries if needed.
//
// postgres_admin_password deliberately has no literal value here. It is read
// from the AZURE_POSTGRES_ADMIN_PASSWORD environment variable at deploy time so
// no secret ever needs to be committed to source control. Set it before running
// az deployment sub create, for example: export AZURE_POSTGRES_ADMIN_PASSWORD='a-strong-value-you-generate'

param environment_name = 'dev'
param location = 'eastus2'
param project_slug = 'askops'
param postgres_admin_login = 'askops_admin'
param postgres_admin_password = readEnvironmentVariable('AZURE_POSTGRES_ADMIN_PASSWORD')
param enable_azure_services_firewall_rule = true
param enable_purge_protection = false
