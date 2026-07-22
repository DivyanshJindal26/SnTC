# Deploying to sntc.iitmandi.co.in

One Docker container serves the static site and the API on the same origin.
Host port **8324** (8325/8326 are reserved for future services; nothing uses
them yet).

## 1. Files the server needs (never in git)

Copy these to the repo root on the server:

| File | Contents |
|---|---|
| `.env` | Client auth config (`PUBLIC_*` vars) — copy from `.env.example` |
| `server/.env` | Server secrets (SMTP, admin emails, CORS…) — copy from `server/.env.example` |
| `server/service-account.json` | Firebase Admin key (Firebase Console → Project Settings → Service Accounts) |

On the production server do **not** set `HOST_PORT` in `.env` — the compose
default 8324 applies. (Locally it is set to 3000.)

## 2. Google configuration (one-time)

- Google Cloud Console → APIs & Services → Credentials → the OAuth 2.0 Web
  client → **Authorized JavaScript origins**: add `https://sntc.iitmandi.co.in`.
- Firebase Console → Authentication → Settings → Authorized domains: add
  `sntc.iitmandi.co.in`.

## 3. Start the app

```sh
docker compose up -d --build
curl http://localhost:8324/api/health   # → {"status":"ok",...}
```

## 4. nginx site config

`/etc/nginx/sites-available/sntc.iitmandi.co.in`:

```nginx
server {
    server_name sntc.iitmandi.co.in;

    location / {
        proxy_pass http://127.0.0.1:8324;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
```

```sh
ln -s /etc/nginx/sites-available/sntc.iitmandi.co.in /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d sntc.iitmandi.co.in   # HTTPS — required for Google sign-in
```

`X-Forwarded-For` matters: the app has `TRUST_PROXY=1` so per-visitor rate
limiting works behind the proxy. HTTPS is mandatory — Google Identity Services
refuses insecure origins (localhost excepted).

## 5. Update / redeploy

```sh
git pull
docker compose up -d --build
```

Registration data lives in the `app-data` Docker volume (SQLite) and survives
rebuilds. Back it up with:

```sh
docker compose cp app:/app/server/data ./backup-$(date +%F)
```
