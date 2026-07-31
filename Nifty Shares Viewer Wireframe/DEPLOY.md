# DEPLOY.md — PaRo deployment

Three paths. Pick one. All assume the build is green locally (`docker compose up` works, all phases `DONE`).

**Constant across all paths:** Azure AI Foundry is a paid cloud API (chat + embeddings + vision-OCR) — you pay per token/page regardless of where the app is hosted. Keep its endpoint/key/deployment names in the host's secret store, never in the image.

**What has to run:**
- `api` (FastAPI) — HTTP
- `worker` (book ingestion, Phase 6) — background; can be an on-demand job on free tiers
- Postgres 15 **with pgvector**
- Redis (ingestion queue)
- `web` (React static build)
- Object storage (PDFs + rendered page images)

Before any deploy: build multi-stage Docker images for api/worker/web; run Alembic migrations as a pre-deploy release step; enable the `vector` extension on the managed Postgres; set all config via env/secrets.

---

## Path A — Free tier (demo / personal)
Zero hosting cost; you still pay Azure per AI call. Free tiers sleep and are small — fine for a demo, not production.

| Component | Service (free) | Notes |
|---|---|---|
| Postgres + pgvector | **Supabase** (or Neon) | `create extension vector;` Supabase also gives Storage. |
| Object storage | **Supabase Storage** (or Cloudflare R2) | PDFs + page images. |
| Redis | **Upstash** | Serverless; free tier fine. |
| API | **Render** free web service (or Fly.io) | Sleeps when idle → cold start. |
| Worker | **on-demand job**, not always-on | See note below. |
| Web | **Vercel** (or Netlify / Cloudflare Pages) | Point `VITE_API_URL` at the API. |

**Worker on free tier:** don't run an always-on worker. Either (a) run ingestion **synchronously** in the API request for small PDFs, or (b) trigger a **Render Cron Job / scheduled task** that drains the queue. Record the choice in `BUILD_LOG.md`.

Steps:
1. Create Supabase project → enable `vector` → copy the connection string + service key.
2. Create an Upstash Redis DB → copy the URL.
3. Deploy `web` to Vercel from the repo (`/web`), set `VITE_API_URL`.
4. Deploy `api` to Render from `/api` Dockerfile; set env (DB URL, Redis URL, Supabase storage keys, Azure Foundry config).
5. Run migrations (Render "pre-deploy command" → `alembic upgrade head`).
6. Seed the universe (`uploads/ind_nifty200list.csv`) via the admin upload or a one-off job.

**Truly-free always-on alternative:** one **Oracle Cloud Always-Free VM** running `docker compose` — no sleep, but you manage it (TLS via Caddy/nginx).

### One-click (Render Blueprint)
For a near one-click deploy, commit a **`render.yaml`** at the repo root. Render reads it and provisions **all** services at once from a single "Deploy to Render" button/URL; you paste secrets (Azure Foundry) once, and migrations run on release. Render managed Postgres supports the `pgvector` extension (`CREATE EXTENSION vector;` in the release step). Object storage still points to Supabase/R2 (Render has no blob store).

Add a button to the repo README:
```
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=<your-repo-url>)
```

Starter `render.yaml` (the agent finalizes ports/paths in Phase 8):
```yaml
databases:
  - name: paro-db
    plan: free          # enable pgvector in the release step: CREATE EXTENSION IF NOT EXISTS vector;
    postgresMajorVersion: "15"

services:
  - type: keyvalue      # Redis-compatible (ingestion queue)
    name: paro-redis
    plan: free
    ipAllowList: []

  - type: web           # FastAPI
    name: paro-api
    runtime: docker
    dockerfilePath: ./api/Dockerfile
    plan: free
    preDeployCommand: "alembic upgrade head"
    envVars:
      - key: DATABASE_URL
        fromDatabase: { name: paro-db, property: connectionString }
      - key: REDIS_URL
        fromService: { type: keyvalue, name: paro-redis, property: connectionString }
      - key: AZURE_FOUNDRY_ENDPOINT
        sync: false     # paste once in dashboard
      - key: AZURE_FOUNDRY_KEY
        sync: false
      - key: AZURE_CHAT_DEPLOYMENT
        sync: false
      - key: AZURE_EMBED_DEPLOYMENT
        sync: false
      - key: AZURE_VISION_DEPLOYMENT
        sync: false
      - key: STORAGE_URL          # Supabase/R2 bucket
        sync: false
      - key: STORAGE_KEY
        sync: false

  - type: worker        # book ingestion (Phase 6). Omit on strict free tier; use a cron job instead.
    name: paro-worker
    runtime: docker
    dockerfilePath: ./api/Dockerfile.worker
    plan: free
    envVars:
      - key: DATABASE_URL
        fromDatabase: { name: paro-db, property: connectionString }
      - key: REDIS_URL
        fromService: { type: keyvalue, name: paro-redis, property: connectionString }
      # + same AZURE_* / STORAGE_* as api

  - type: web           # React static build
    name: paro-web
    runtime: static
    buildCommand: "cd web && npm ci && npm run build"
    staticPublishPath: ./web/dist
    envVars:
      - key: VITE_API_URL
        fromService: { type: web, name: paro-api, property: host }
```
Notes: Render's free `worker` type may not be available on all plans — if not, drop the `paro-worker` service and run ingestion via a **Render Cron Job** or synchronously (see worker note above). Seed the universe (admin upload / one-off job) after first deploy.

**Even-more-one-click alternatives:** a **Railway template** link (similar single-definition provisioning) or an Azure **"Deploy to Azure"** Bicep button (Path B infra in one click; you still set images + Foundry secrets).

---

## Path B — Azure (recommended production; same tenant as Foundry)

| Component | Azure service |
|---|---|
| api / worker | **Container Apps** (worker = separate app or a Container Apps Job) |
| Postgres + pgvector | **Azure Database for PostgreSQL Flexible Server** (enable `vector` extension) |
| Redis | **Azure Cache for Redis** |
| web | **Static Web Apps** |
| object storage | **Azure Blob Storage** |
| secrets | **Key Vault** (referenced by Container Apps) |
| images | **Azure Container Registry** |

CLI sketch:
```
az group create -n paro-rg -l centralindia
az acr create -g paro-rg -n paroacr --sku Basic
az acr build -r paroacr -t paro-api:latest ./api
az acr build -r paroacr -t paro-worker:latest ./api -f api/Dockerfile.worker
az postgres flexible-server create -g paro-rg -n paro-pg --version 15 ...
#   then: enable the 'vector' extension (server parameter azure.extensions=VECTOR), CREATE EXTENSION vector;
az redis create -g paro-rg -n paro-redis --sku Basic --vm-size c0
az containerapp env create -g paro-rg -n paro-env
az containerapp create -g paro-rg -n paro-api  --environment paro-env --image paroacr.azurecr.io/paro-api:latest    --ingress external --target-port 8000 --secrets ... --env-vars ...
az containerapp create -g paro-rg -n paro-worker --environment paro-env --image paroacr.azurecr.io/paro-worker:latest --min-replicas 1
az staticwebapp create -g paro-rg -n paro-web --source <repo> --app-location /web
```
- Migrations: a Container Apps **Job** running `alembic upgrade head` on each release.
- Foundry: reference the existing deployments; store key in Key Vault; prefer private networking within the tenant.

### One-click (Deploy to Azure button)
Commit **`deploy/azuredeploy.bicep`** (+ compiled `azuredeploy.json`) describing the RG resources: Container Apps env + `paro-api` + `paro-worker`, Postgres Flexible (param `azure.extensions=VECTOR`), Cache for Redis, Static Web App, Storage account, Key Vault. Add to README:
```
[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/<URL-encoded raw azuredeploy.json>)
```
The button opens a portal form (region, admin creds, Foundry endpoint/key/deployments as parameters) and provisions everything in one submit. Prereq: images pushed to ACR first (`az acr build`) — the template references them by tag; run `CREATE EXTENSION vector;` + `alembic upgrade head` as a post-deploy Container Apps Job.

---

## Path C — AWS (equivalent)
ECS Fargate (api) + a Fargate service/scheduled task (worker) · **RDS PostgreSQL** (enable pgvector) · **ElastiCache** (Redis) · **S3 + CloudFront** (web) · **S3** (PDFs) · **Secrets Manager** · **ECR** (images). AI calls still go to Azure Foundry over the internet (cross-cloud egress + secrets in Secrets Manager). Migrations run as a one-off ECS task on release.

### One-click (CloudFormation Launch Stack button)
Commit **`deploy/paro.cfn.yaml`** (VPC/subnets, ECS cluster + `paro-api`/`paro-worker` Fargate services, RDS Postgres, ElastiCache Redis, S3 buckets + CloudFront, Secrets Manager entries as parameters). Upload it to a public S3 URL and add to README:
```
[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/create/review?templateURL=https://<bucket>.s3.amazonaws.com/paro.cfn.yaml&stackName=paro)
```
The button opens the CFN console pre-filled; you enter parameters (Foundry endpoint/key/deployments, DB password) and click Create. Prereq: images in ECR (`docker push`). Post-create: run the migration ECS task + `CREATE EXTENSION vector;`. (Alternatively **AWS Copilot** — `copilot init` + `copilot deploy` — gives near one-command deploys without hand-writing CFN.)

---

## Path D — Google Cloud
Cloud Run (`paro-api`) + Cloud Run service or Job (`paro-worker`) · **Cloud SQL for PostgreSQL 15** (enable `vector`) · **Memorystore** (Redis) · **Cloud Storage** (PDFs) · web on **Cloud Run (static)** or **Firebase Hosting** · secrets in **Secret Manager** · images in **Artifact Registry**. Foundry called over the internet.

### One-click (Run on Google Cloud button)
Add a **Cloud Run Button** to the README — it builds from the repo and deploys a service in one click:
```
[![Run on Google Cloud](https://deploy.cloud.run/button.svg)](https://deploy.cloud.run?dir=api)
```
The Cloud Run Button deploys **one** service (the api) one-click. Because PaRo needs managed Postgres/Redis/Storage too, provide the rest as **`deploy/main.tf`** (Terraform) so the full stack is `terraform apply` (one command): Cloud SQL (+pgvector), Memorystore, GCS bucket, Artifact Registry, and both Cloud Run services with env from Secret Manager. Run `CREATE EXTENSION vector;` + `alembic upgrade head` as a Cloud Run Job on release. (True single-click of the whole stack isn't native on GCP — button for the api, Terraform for the managed backing services.)

---

## Path E — Local on Windows (run on your own PC)

### E1 — Docker Desktop (recommended, one command)
1. Install **Docker Desktop for Windows** (uses the WSL 2 backend — enable WSL 2 if prompted).
2. Clone the repo; copy `.env.example` → `.env` and fill Azure Foundry endpoint/key/deployment names (embeddings + vision-OCR still call the cloud; hosting is local).
3. In the repo folder (PowerShell): `docker compose up --build`.
4. Open the web URL printed by compose (e.g. `http://localhost:5173`); API at `http://localhost:8000`.
5. First run: compose should auto-run `alembic upgrade head`; then seed the universe (admin upload of `uploads/ind_nifty200list.csv`) or `docker compose run api python -m app.seed`.
- This runs Postgres+pgvector, Redis, api, worker, and web exactly like the cloud topology. `docker compose down` stops it; data persists in the named volume.

### E2 — Native Windows (no Docker)
Use when Docker isn't allowed. Install:
- **Python 3.11** (from python.org; check "Add to PATH").
- **Node 18+** (nodejs.org).
- **PostgreSQL 15** (EDB installer) **+ pgvector**: pgvector isn't bundled — either install via the **PostgreSQL StackBuilder**, or `git clone` pgvector and build with MSVC (`nmake /F Makefile.win`), then `CREATE EXTENSION vector;`. *(If building pgvector on Windows is painful, point `DATABASE_URL` at a free **Neon/Supabase** cloud Postgres instead — everything else stays local.)*
- **Redis:** native Windows isn't official — run **Memurai** (Windows Redis-compatible) or Redis via WSL 2, or use free **Upstash** and set `REDIS_URL`.

Then (PowerShell), from the repo:
```powershell
# API
cd api
py -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env    # edit: DATABASE_URL, REDIS_URL, AZURE_* , STORAGE_*
alembic upgrade head
python -m app.seed        # loads uploads/ind_nifty200list.csv
uvicorn app.main:app --reload --port 8000
# Worker (new terminal, Phase 6 only)
cd api; .\.venv\Scripts\Activate.ps1; python -m app.worker
# Web (new terminal)
cd web
npm ci
"VITE_API_URL=http://localhost:8000" | Out-File -Encoding utf8 .env.local
npm run dev
```
- Object storage local option: set `STORAGE_*` to a local folder driver, or run **Azurite** (Azure Blob emulator) / MinIO, or point at Supabase/R2.
- Notes: run PowerShell as your user (not admin) for npm; if scripts are blocked, `Set-ExecutionPolicy -Scope Process RemoteSigned` before activating the venv.

**Recommendation:** on Windows use **E1 (Docker Desktop)** — it avoids the pgvector/Redis-on-Windows pain and mirrors production. Fall back to E2 only if Docker is unavailable.

### Auto-start on boot (Windows)
- **E1:** Docker Desktop → Settings → General → **"Start Docker Desktop when you log in"**, and set `restart: unless-stopped` on every service in `docker-compose.yml` so the stack relaunches when the engine starts (on **login**, not pre-login).
- **E2:** Postgres and Memurai install as auto-starting **Windows Services**; wrap `api`/`worker`/`web` with **NSSM** as services, or a **Task Scheduler** "At log on" task running a `start.ps1`.

---

## Path F — Always-free VM 24/7 (Oracle Cloud) — recommended for "always up" at $0
A personal PC isn't ideal for 24/7; an always-free VM is. **Oracle Cloud Always Free** gives an **Ampere A1 (Arm)** VM with up to **4 cores / 24 GB RAM** and 200 GB storage, with **no time limit** — enough to run the whole `docker compose` stack. (Google's free `e2-micro` is permanent but ~1 GB RAM = too small; AWS/Azure micro VMs are free for **12 months only**.)

Setup:
1. Create an Oracle Cloud account (card needed for verification; Always-Free resources aren't charged). Launch an **Ampere A1** compute instance, **Ubuntu 22.04**, 2–4 OCPU / 12–24 GB. If Arm capacity is unavailable in your region, retry or change availability domain.
2. Networking: add ingress rules for **80** and **443** in the VCN security list; run `sudo iptables` open or `netfilter-persistent` as Ubuntu images ship with a strict firewall.
3. SSH in; install Docker + compose:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # re-login after
   ```
4. Clone the repo, create `.env` (Azure Foundry endpoint/key/deployments, storage creds).
5. `restart: unless-stopped` on all compose services, then `docker compose up -d --build`. It relaunches automatically after any VM reboot (Docker's daemon auto-starts on boot).
6. Migrations + seed: `docker compose run --rm api alembic upgrade head` then seed `uploads/ind_nifty200list.csv`.
7. **HTTPS:** point a domain at the VM's public IP and put **Caddy** in front for automatic TLS:
   ```
   # Caddyfile
   paro.example.com {
     handle /api/* { reverse_proxy api:8000 }
     handle        { reverse_proxy web:5173 }
   }
   ```
   Add a `caddy` service to compose (ports 80/443, `restart: unless-stopped`, volume for certs).
- Result: $0 always-on host that survives reboots. Only Azure Foundry usage is metered. Keep the OS patched (`unattended-upgrades`).

---

## Post-deploy checklist (any path)
- [ ] `vector` extension enabled; `alembic upgrade head` ran.
- [ ] Universe seeded from `uploads/ind_nifty200list.csv`; first Full sync completed.
- [ ] Azure Foundry reachable from the API (sector chat + a test book ingest + ask both work).
- [ ] Object storage read/write verified (upload a PDF, read a page image).
- [ ] Redis reachable; ingestion job runs to `ready`.
- [ ] Web points at the API URL (CORS allowed); HTTPS on; a smoke test of every screen vs `PaRo.dc.html`.
- [ ] Daily incremental sync scheduled (IST).
- [ ] Costs: only Azure Foundry token/page usage is metered on Path A; set a budget alert.
