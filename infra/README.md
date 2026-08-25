# AskOps infrastructure (Azure data, secrets, and telemetry tier)

AskOps is a Next.js RAG application. The application itself deploys to Vercel, not Azure.
This directory provisions only the Azure resources that back it: the Postgres database
(with pgvector), a Key Vault for secrets, and the Log Analytics and Application Insights
resources used for telemetry. Two equivalent implementations are provided so a reviewer
can compare them side by side:

- `bicep/`: an ARM/Bicep deployment, subscription scoped, that creates the resource group
  itself and deploys three modules into it.
- `terraform/`: a Terraform deployment using the `azurerm` provider, with an
  `azurerm_resource_group` resource playing the same role.

Both stacks describe the exact same footprint (same resource types, same SKUs, same
names, same defaults) so that either one can be used to stand up the environment.

## Footprint

Both stacks provision:

1. **Resource group**, named `rg-{project_slug}-{environment_name}`.
2. **Azure Database for PostgreSQL Flexible Server**, version 16, `Standard_B1ms`
   (Burstable tier, the cheapest sane SKU) with 32 GB of storage, 7 day backup retention,
   and no geo redundant backup or high availability add on (kept off to keep this a cheap
   portfolio environment). It has:
   - A database named `askops`.
   - The `pgvector` extension allowlisted via the `azure.extensions` server configuration
     parameter, set to `VECTOR`. Once deployed, `CREATE EXTENSION vector;` can be run
     against the `askops` database.
   - An administrator login and password. The password is always supplied through a
     secure/sensitive parameter, never a default value, and is never written to disk by
     these files.
   - An optional firewall rule, `AllowAllAzureServicesAndResourcesWithinAzureIps`
     (start and end IP `0.0.0.0`, the special case Azure recognizes as "allow trusted
     Azure services"), controlled by a boolean parameter.
3. **Azure Key Vault**, RBAC authorization mode (no access policies), soft delete on,
   purge protection controlled by a parameter and defaulted to off so a portfolio
   environment can be torn down cleanly. No secrets are created by either stack; the
   vault is provisioned empty and populated afterward by an operator or a deploy
   pipeline.
4. **Log Analytics workspace**, `PerGB2018` pricing tier, 30 day retention.
5. **Application Insights**, workspace based (linked to the Log Analytics workspace
   above), kind/type `web`.

## Parameter surface

Both stacks expose the identical set of inputs:

| Name                                  | Default         | Notes                                                                    |
| ------------------------------------- | --------------- | ------------------------------------------------------------------------ |
| `environment_name`                    | `dev`           | Also validated as one of `dev`, `staging`, `prod` in Terraform.          |
| `location`                            | `eastus2`       | Azure region for every resource.                                         |
| `project_slug`                        | `askops`        | Short slug used in every resource name.                                  |
| `postgres_admin_login`                | `askops_admin`  | Postgres administrator login name.                                       |
| `postgres_admin_password`             | none (required) | Secure/sensitive, no default. Supplied by the operator, never committed. |
| `enable_azure_services_firewall_rule` | `true`          | Adds the "allow Azure services" firewall rule when true.                 |
| `enable_purge_protection`             | `false`         | Key Vault purge protection. Left off by default for easy teardown.       |

Resource names are derived consistently in both stacks:

- Resource group: `rg-{project_slug}-{environment_name}`
- Postgres server: `psql-{project_slug}-{environment_name}`
- Key Vault: `kv-{project_slug}-{environment_name}`
- Log Analytics workspace: `log-{project_slug}-{environment_name}`
- Application Insights: `appi-{project_slug}-{environment_name}`

Key Vault names must be 3 to 24 characters, alphanumeric and dashes only, and globally
unique across all of Azure (not just this subscription). With the default `project_slug`
and `environment_name` values the generated name is well within that limit; a reviewer
picking unusual values for those two parameters should keep the combined length in mind.
This constraint is also called out as a comment next to where each stack builds the name
(`bicep/modules/keyvault.bicep` and `terraform/main.tf`).

## Deploying the Bicep stack

Resource group creation happens at subscription scope, so the deployment is a
subscription level deployment, not a resource group level one:

```bash
export AZURE_POSTGRES_ADMIN_PASSWORD='choose-a-strong-value-yourself'

az login
az account set --subscription '<your-subscription-id-or-name>'

az deployment sub create \
  --name askops-infra \
  --location eastus2 \
  --template-file bicep/main.bicep \
  --parameters bicep/main.bicepparam
```

`bicep/main.bicepparam` reads the Postgres administrator password from the
`AZURE_POSTGRES_ADMIN_PASSWORD` environment variable via `readEnvironmentVariable(...)`,
so nothing secret ever needs to be written into a parameter file. Override any other
default by adding more `--parameters name=value` entries after the `.bicepparam` file.

## Deploying the Terraform stack

```bash
cd terraform
terraform init

export TF_VAR_postgres_admin_password='choose-a-strong-value-yourself'
# Or: cp terraform.tfvars.example terraform.tfvars, edit it, and add
# -var-file=terraform.tfvars to the plan/apply commands below. Either way,
# never commit a file that contains the real password.

terraform plan -out=askops.tfplan
terraform apply askops.tfplan
```

## Fetching outputs after deployment

Both stacks return the resource group name, Postgres FQDN, Postgres database name, Key
Vault name and URI, and Log Analytics workspace id as plain outputs. Terraform also
returns the Application Insights connection string directly, marked as a sensitive
output (`terraform output -raw application_insights_connection_string`). Bicep
deliberately does not echo it (see `bicep/modules/monitoring.bicep`); fetch it with the
Azure CLI instead, the same way you would regardless of which stack you used:

```bash
# Postgres FQDN
az postgres flexible-server show \
  --resource-group rg-askops-dev \
  --name psql-askops-dev \
  --query fullyQualifiedDomainName -o tsv

# Application Insights connection string
az monitor app-insights component show \
  --app appi-askops-dev \
  --resource-group rg-askops-dev \
  --query connectionString -o tsv
```

Treat both commands' output as sensitive: avoid printing them into shared logs or CI
output.

## Cost and access warning

Applying either stack creates real, billable Azure resources (the Postgres Flexible
Server in particular is not part of the free tier). Running `terraform apply` or
`az deployment sub create` requires the operator's own Azure subscription and an
authenticated `az login` (Terraform's `azurerm` provider also relies on the Azure CLI's
login session by default). Nothing in this repository will deploy anything on its own.
Remember to tear the environment down (`az group delete --name rg-askops-dev` or
`terraform destroy`) when you are done with the portfolio demo to stop paying for it.

## How these files were validated

These files were authored to pass the following commands exactly as written:

```bash
az bicep build --file bicep/main.bicep
terraform -chdir=terraform init -backend=false
terraform -chdir=terraform validate
terraform -chdir=terraform fmt -check
```

The sandbox that produced this repository has no `az` or `terraform` installed by
default, so these commands must be run by the operator, from the `infra/` directory, to
confirm the files are still valid in their own environment before deploying anything.

## How this maps to the AskOps app on Vercel

AskOps deploys to Vercel, not Azure. Azure only hosts the data, secrets, and telemetry
tier described above. After provisioning, set the following in the Vercel project's
Environment Variables settings:

| Vercel env var                                 | Sourced from                                                                                                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                 | Built from the Postgres flexible server FQDN and the `askops` database name (`postgres_server_fqdn` / `postgres_database_name` outputs), plus the administrator login and password, e.g. `postgresql://<login>:<password>@<fqdn>:5432/askops?sslmode=require`. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING`        | The Application Insights connection string (fetched via the Azure CLI command above, or the Terraform sensitive output).                                                                                                                                       |
| Any other application secrets (API keys, etc.) | Stored in the Key Vault (`key_vault_name` / `key_vault_uri` outputs) as the source of truth, then mirrored by hand (or by a deploy pipeline) into the Vercel project's Environment Variables, since Vercel does not read from Azure Key Vault directly.        |
