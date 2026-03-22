---
name: render-mcp-server
description: "Use render-mcp-server tools. Triggers on: create_cron_job, create_key_value, create_postgres, create_static_site, create_web_service, get_deploy, get_key_value, get_metrics, get_postgres, get_selected_workspace, get_service, list_deploys, list_key_value, list_log_label_values, list_logs, list_postgres_instances, list_services, list_workspaces, query_render_postgres, select_workspace, update_cron_job, update_environment_variables, update_static_site, update_web_service."
homepage: https://mcp.render.com/mcp
allowed-tools: Bash(curl:*)
metadata: {"clawdbot":{},"openclaw":{"requires":{"bins":[]},"always":true}}
---

# render-mcp-server



## Quick Start

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh <tool-name> '<json-args>'
```

## Tools

### create_cron_job

Create a new cron job in your Render account. A cron job is a scheduled task that runs on a recurring schedule specified using cron syntax. Cron jobs are ideal for background tasks like data processing, cleanup operations, sending emails, or generating reports. By default, these services are automatically deployed when the specified branch is updated. This tool is currently limited to support only a subset of the cron job configuration parameters. It also only supports cron jobs which don't use Docker, or a container registry. To create a cron job without those limitations, please use the dashboard at: https://dashboard.render.com/create

**Parameters:**
  - `autoDeploy` (string) (optional): Whether to automatically deploy the cron job when the specified branch is updated. Defaults to 'yes'.
  - `branch` (string) (optional): The repository branch to deploy. This branch will be deployed when you manually trigger deploys and when auto-deploy is enabled. If left empty, this will fall back to the default branch of the repository.
  - `buildCommand` (string) (required): The command used to build your cron job. For example, 'npm install' for Node.js or 'pip install -r requirements.txt' for Python.
  - `envVars` (array) (optional): Environment variables to set for your cron job. These are exposed during builds and at runtime.
  - `name` (string) (required): A unique name for your cron job.
  - `plan` (string) (optional): The pricing plan for your cron job. Different plans offer different levels of resources and features.
  - `region` (string) (optional): The geographic region where your cron job will be deployed. Defaults to Oregon.
  - `repo` (string) (optional): The repository containing the source code for your cron job. Must be a valid Git URL that Render can clone and deploy. Do not include the branch in the repo string. You can instead supply a 'branch' parameter.
  - `runtime` (string) (required): The runtime environment for your cron job. This determines how your job is built and run.
  - `schedule` (string) (required): The cron schedule expression that determines when the job runs. Uses standard cron syntax with 5 fields: minute (0-59), hour (0-23), day of month (1-31), month (1-12), day of week (0-6, Sunday=0). Examples: '0 0 * * *' (daily at midnight), '*/15 * * * *' (every 15 minutes), '0 9 * * 1-5' (weekdays at 9am), '0 0 1 * *' (first day of each month at midnight). For natural language requests like 'every hour' or 'daily at 3pm', convert to cron syntax.
  - `startCommand` (string) (required): The command that runs when your cron job executes. For example, 'node scripts/cleanup.js' for Node.js or 'python scripts/process_data.py' for Python.

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh create_cron_job '{"buildCommand":"<buildCommand>","name":"<name>","runtime":"<runtime>","schedule":"<schedule>","startCommand":"<startCommand>"}'
```

### create_key_value

Create a new Key Value instance in your Render account

**Parameters:**
  - `maxmemoryPolicy` (string) (optional): The eviction policy for the Key Value store
  - `name` (string) (required): Name of the Key Value instance
  - `plan` (string) (optional): Pricing plan for the Key Value instance
  - `region` (string) (optional): Region where the Key Value instance will be deployed

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh create_key_value '{"name":"<name>"}'
```

### create_postgres

Create a new Postgres instance in your Render account

**Parameters:**
  - `diskSizeGb` (number) (optional): Your database's capacity, in GB. You can increase storage at any time, but you can't decrease it. Specify 1 GB or any multiple of 5 GB.
  - `name` (string) (required): The name of the database as it will appear in the Render Dashboard
  - `plan` (string) (optional): Pricing plan for the database
  - `region` (string) (optional): Region where the database will be deployed
  - `version` (number) (optional): PostgreSQL version to use (e.g., 14, 15)

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh create_postgres '{"name":"<name>"}'
```

### create_static_site

Create a new static site in your Render account. Apps that consist entirely of statically served assets (commonly HTML, CSS, and JS). Static sites have a public onrender.com subdomain and are served over a global CDN. Create a static site if you're building with a framework like: Create React App, Vue.js, Gatsby, etc.This tool is currently limited to support only a subset of the static site configuration parameters.To create a static site without those limitations, please use the dashboard at: https://dashboard.render.com/static/new

**Parameters:**
  - `autoDeploy` (string) (optional): Whether to automatically deploy the service when the specified branch is updated. Defaults to 'yes'.
  - `branch` (string) (optional): The repository branch to deploy. This branch will be deployed when you manually trigger deploys and when auto-deploy is enabled. If left empty, this will fall back to the default branch of the repository.
  - `buildCommand` (string) (required): Render runs this command to build your app before each deploy. For example, 'yarn; yarn build' a React app.
  - `envVars` (array) (optional): Environment variables to set for your service. These are exposed during builds and at runtime.
  - `name` (string) (required): A unique name for your service. This will be used to generate the service's URL if it is public.
  - `publishPath` (string) (optional): The relative path of the directory containing built assets to publish. Examples: ./, ./build, dist and frontend/build. This is the directory that will be served to the public.
  - `repo` (string) (optional): The repository containing the source code for your service. Must be a valid Git URL that Render can clone and deploy. Do not include the branch in the repo string. You can instead supply a 'branch' parameter.

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh create_static_site '{"buildCommand":"<buildCommand>","name":"<name>"}'
```

### create_web_service

Create a new web service in your Render account. A web service is a public-facing service that can be accessed by users on the internet. By default, these services are automatically deployed when the specified branch is updated and do not require a manual trigger of a deploy. The user should only be prompted to manually trigger a deploy if auto-deploy is disabled.This tool is currently limited to support only a subset of the web service configuration parameters.It also only supports web services which don't use Docker, or a container registry.To create a service without those limitations, please use the dashboard at: https://dashboard.render.com/web/new

**Parameters:**
  - `autoDeploy` (string) (optional): Whether to automatically deploy the service when the specified branch is updated. Defaults to 'yes'.
  - `branch` (string) (optional): The repository branch to deploy. This branch will be deployed when you manually trigger deploys and when auto-deploy is enabled. If left empty, this will fall back to the default branch of the repository.
  - `buildCommand` (string) (required): The command used to build your service. For example, 'npm run build' for Node.js or 'pip install -r requirements.txt' for Python.
  - `envVars` (array) (optional): Environment variables to set for your service. These are exposed during builds and at runtime.
  - `name` (string) (required): A unique name for your service. This will be used to generate the service's URL if it is public.
  - `plan` (string) (optional): The pricing plan for your service. Different plans offer different levels of resources and features.
  - `region` (string) (optional): The geographic region where your service will be deployed. Defaults to Oregon. Choose the region closest to your users for best performance.
  - `repo` (string) (optional): The repository containing the source code for your service. Must be a valid Git URL that Render can clone and deploy. Do not include the branch in the repo string. You can instead supply a 'branch' parameter.
  - `runtime` (string) (required): The runtime environment for your service. This determines how your service is built and run.
  - `startCommand` (string) (required): The command used to start your service. For example, 'npm start' for Node.js or 'gunicorn app:app' for Python.

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh create_web_service '{"buildCommand":"<buildCommand>","name":"<name>","runtime":"<runtime>","startCommand":"<startCommand>"}'
```

### get_deploy

Retrieve the details of a particular deploy for a particular service.

**Parameters:**
  - `deployId` (string) (required): The ID of the deployment to retrieve
  - `serviceId` (string) (required): The ID of the service to get deployments for

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh get_deploy '{"deployId":"<deployId>","serviceId":"<serviceId>"}'
```

### get_key_value

Retrieve a Key Value instance by ID

**Parameters:**
  - `keyValueId` (string) (required): The ID of the Key Value instance to retrieve

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh get_key_value '{"keyValueId":"<keyValueId>"}'
```

### get_metrics

Get performance metrics for any Render resource (services, Postgres databases, key-value stores). Supports CPU usage/limits/targets, memory usage/limits/targets, service instance counts, HTTP request counts and response time metrics, bandwidth usage metrics, database active connection counts for debugging, capacity planning, and performance optimization. Returns time-series data with timestamps and values for the specified time range. HTTP metrics support filtering by host and path for more granular analysis. Limits and targets help understand resource constraints and autoscaling thresholds. Metrics may be empty if the metric is not valid for the given resource.

**Parameters:**
  - `aggregateHttpRequestCountsBy` (string) (optional): Field to aggregate HTTP request metrics by. Only supported for http_request_count metric. Options: host (aggregate by request host), statusCode (aggregate by HTTP status code). When not specified, returns total request counts.
  - `cpuUsageAggregationMethod` (string) (optional): Method for aggregating metric values over time intervals. Only supported for CPU usage metrics. Options: AVG, MAX, MIN. Defaults to AVG.
  - `endTime` (string) (optional): End time for metrics query in RFC3339 format (e.g., '2024-01-01T13:00:00Z'). Defaults to the current time. The end time must be within the last 30 days.
  - `httpHost` (string) (optional): Filter HTTP metrics to specific request hosts. Supported for http_request_count and http_latency metrics. Example: 'api.example.com' or 'myapp.render.com'. When not specified, includes all hosts.
  - `httpLatencyQuantile` (number) (optional): The quantile/percentile of HTTP latency to fetch. Only supported for http_latency metric. Common values: 0.5 (median), 0.95 (95th percentile), 0.99 (99th percentile). Defaults to 0.95 if not specified.
  - `httpPath` (string) (optional): Filter HTTP metrics to specific request paths. Supported for http_request_count and http_latency metrics. Example: '/api/users' or '/health'. When not specified, includes all paths.
  - `metricTypes` (array) (required): Which metrics to fetch. CPU usage/limits/targets, memory usage/limits/targets, and instance count metrics are available for all resources. HTTP request counts and response time metrics, and bandwidth usage metrics are only available for services. Active connection metrics are only available for databases and key-value stores. Limits show resource constraints, targets show autoscaling thresholds.
  - `resolution` (number) (optional): Time resolution for data points in seconds. Lower values provide more granular data. Higher values provide more aggregated data points. API defaults to 60 seconds if not provided. There is a limit to the number of data points that can be returned, after which the metrics endpoint will return a 500. If you are getting a 500, try reducing granularity (increasing the value of resolution).
  - `resourceId` (string) (required): The ID of the resource to get metrics for (service ID, Postgres ID, or key-value store ID)
  - `startTime` (string) (optional): Start time for metrics query in RFC3339 format (e.g., '2024-01-01T12:00:00Z'). Defaults to 1 hour ago. The start time must be within the last 30 days.

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh get_metrics '{"metricTypes":"<metricTypes>","resourceId":"<resourceId>"}'
```

### get_postgres

Retrieve a Postgres instance by ID

**Parameters:**
  - `postgresId` (string) (required): The ID of the Postgres instance to retrieve

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh get_postgres '{"postgresId":"<postgresId>"}'
```

### get_selected_workspace

Get the currently selected workspace

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh get_selected_workspace '{}'
```

### get_service

Get details about a specific service

**Parameters:**
  - `serviceId` (string) (required): The ID of the service to retrieve

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh get_service '{"serviceId":"<serviceId>"}'
```

### list_deploys

List deploys matching the provided filters. If no filters are provided, all deploys for the service are returned.

**Parameters:**
  - `cursor` (string) (optional): A unique string that corresponds to a position in the result list. If provided, the endpoint returns results that appear after the corresponding position. To fetch the first page of results, set to the empty string.
  - `limit` (number) (optional): The maximum number of deploys to return in a single page. To fetch additional pages of results, set the cursor to the last deploy in the previous page. It should be rare to need to set this value greater than 20.
  - `serviceId` (string) (required): The ID of the service to get deployments for

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh list_deploys '{"serviceId":"<serviceId>"}'
```

### list_key_value

List all Key Value instances in your Render account

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh list_key_value '{}'
```

### list_log_label_values

List all values for a given log label in the logs matching the provided filters. This can be used to discover what values are available for filtering logs using the list_logs tool. You can query for logs across multiple resources, but all resources must be in the same region and belong to the same owner.

**Parameters:**
  - `direction` (string) (optional): The direction to query logs for. Backward will return most recent logs first. Forward will start with the oldest logs in the time range.
  - `endTime` (string) (optional): End time for log query (RFC3339 format). Defaults to the current time. The end time must be within the last 30 days.
  - `host` (array) (optional): Filter request logs by their host. Wildcards and regex are supported.
  - `instance` (array) (optional): Filter logs by the instance they were emitted from.
  - `label` (string) (required): The label to list values for.
  - `level` (array) (optional): Filter logs by their severity level. Wildcards and regex are supported.
  - `method` (array) (optional): Filter request logs by their requests method. Wildcards and regex are supported.
  - `path` (array) (optional): Filter request logs by their path. Wildcards and regex are supported.
  - `resource` (array) (required): Filter by resource. A resource is the id of a server, cronjob, job, postgres, or redis.
  - `startTime` (string) (optional): Start time for log query (RFC3339 format). Defaults to 1 hour ago. The start time must be within the last 30 days.
  - `statusCode` (array) (optional): Filter request logs by their status code. Wildcards and regex are supported.
  - `text` (array) (optional): Filter by the text of the logs. Wildcards and regex are supported.
  - `type` (array) (optional): Filter logs by their type.

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh list_log_label_values '{"label":"<label>","resource":"<resource>"}'
```

### list_logs

List logs matching the provided filters. Logs are paginated by start and end timestamps. There are more logs to fetch if hasMore is true in the response. Provide the nextStartTime and nextEndTime timestamps as the startTime and endTime query parameters to fetch the next page of logs. You can query for logs across multiple resources, but all resources must be in the same region and belong to the same owner.

**Parameters:**
  - `direction` (string) (optional): The direction to query logs for. Backward will return most recent logs first. Forward will start with the oldest logs in the time range.
  - `endTime` (string) (optional): End time for log query (RFC3339 format). Defaults to the current time. The end time must be within the last 30 days.
  - `host` (array) (optional): Filter request logs by their host. Wildcards and regex are supported.
  - `instance` (array) (optional): Filter logs by the instance they were emitted from. An instance is the id of a specific running server.
  - `level` (array) (optional): Filter logs by their severity level. Wildcards and regex are supported.
  - `limit` (number) (optional): Maximum number of logs to return
  - `method` (array) (optional): Filter request logs by their requests method. Wildcards and regex are supported.
  - `path` (array) (optional): Filter request logs by their path. Wildcards and regex are supported.
  - `resource` (array) (required): Filter logs by their resource. A resource is the id of a server, cronjob, job, postgres, or redis.
  - `startTime` (string) (optional): Start time for log query (RFC3339 format). Defaults to 1 hour ago. The start time must be within the last 30 days.
  - `statusCode` (array) (optional): Filter request logs by their status code. Wildcards and regex are supported.
  - `text` (array) (optional): Filter by the text of the logs. Wildcards and regex are supported.
  - `type` (array) (optional): Filter logs by their type. Types include app for application logs, request for request logs, and build for build logs. You can find the full set of types available for a query by using the list_log_label_values tool.

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh list_logs '{"resource":"<resource>"}'
```

### list_postgres_instances

List all Postgres databases in your Render account

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh list_postgres_instances '{}'
```

### list_services

List all services in your Render account

**Parameters:**
  - `includePreviews` (boolean) (optional): Whether to include preview services in the response. Defaults to false.

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh list_services '{}'
```

### list_workspaces

List the workspaces that you have access to

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh list_workspaces '{}'
```

### query_render_postgres

Run a read-only SQL query against a Render-hosted Postgres database. This tool creates a new connection for each query and closes it after the query completes.

**Parameters:**
  - `postgresId` (string) (required): The ID of the Postgres instance to query
  - `sql` (string) (required): The SQL query to run. Note that the query will be wrapped in a read-only transaction.

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh query_render_postgres '{"postgresId":"<postgresId>","sql":"<sql>"}'
```

### select_workspace

Select a workspace to use for all actions. This tool should only be used after explicitly asking the user to select one, it should not be invoked as part of an automated process. Having the wrong workspace selected can lead to destructive actions being performed on unintended resources.

**Parameters:**
  - `ownerID` (string) (required): The ID of the owner to select

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh select_workspace '{"ownerID":"<ownerID>"}'
```

### update_cron_job

Update an existing cron job in your Render account.

**Parameters:**
  - `serviceId` (string) (required): The ID of the service to update

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh update_cron_job '{"serviceId":"<serviceId>"}'
```

### update_environment_variables

Update environment variables for a service. By default, environment variables passed in will be merged with the service's existing environment variables. This makes it safe to update environment variableswithout pulling the existing ones into the MCP host's context. To replace all existing environment variables, set the 'replace' parameter to 'true'.

**Parameters:**
  - `envVars` (array) (required): The list of environment variables to update or set for the service.
  - `replace` (boolean) (optional): Whether to replace all existing environment variables with the provided list, or merge with the existing ones. Defaults to false.
  - `serviceId` (string) (required): The ID of the service to update

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh update_environment_variables '{"envVars":"<envVars>","serviceId":"<serviceId>"}'
```

### update_static_site

Update an existing static site in your Render account.

**Parameters:**
  - `serviceId` (string) (required): The ID of the service to update

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh update_static_site '{"serviceId":"<serviceId>"}'
```

### update_web_service

Update an existing web service in your Render account.

**Parameters:**
  - `serviceId` (string) (required): The ID of the service to update

```bash
$HOME/.openclaw/skills/render-mcp-server/scripts/render-mcp-server.sh update_web_service '{"serviceId":"<serviceId>"}'
```
