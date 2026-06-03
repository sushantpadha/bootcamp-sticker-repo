# Deployment Guide

This directory contains everything needed to run the app on an EC2 instance behind nginx.

---

## Prerequisites

Tested on Ubuntu 22.04 / 24.04. Run all commands as a user with `sudo` privileges.

### 1. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # should print v20.x.x
```

### 2. Install Git

```bash
sudo apt-get install -y git
```

### 3. Clone the repository

```bash
sudo mkdir -p /srv/sticker-repo
sudo chown "$USER":"$USER" /srv/sticker-repo
git clone https://github.com/sushantpadha/bootcamp-sticker-repo.git /srv/sticker-repo
```

### 4. Install nginx

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
```

---

## Configure nginx

### 1. Copy the server block config

```bash
sudo cp /srv/sticker-repo/deploy/nginx.conf \
        /etc/nginx/sites-available/sticker-repo
```

### 2. Edit the domain name

Open `/etc/nginx/sites-available/sticker-repo` and replace every occurrence of
`example.com` with your actual domain (or the EC2 public IP for testing).

### 3. Create the web root and enable the site

```bash
sudo mkdir -p /var/www/sticker-repo
sudo ln -s /etc/nginx/sites-available/sticker-repo \
           /etc/nginx/sites-enabled/sticker-repo
sudo rm -f /etc/nginx/sites-enabled/default   # remove the placeholder default
sudo nginx -t                                 # verify config
sudo systemctl reload nginx
```

---

## Set up SSL with Certbot

> Skip this section if you are testing with an IP address — certificates require a real domain.

### 1. Install certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
```

### 2. Obtain a certificate

```bash
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot will:
- Prove domain ownership via HTTP-01 challenge
- Write the certificate files to `/etc/letsencrypt/live/example.com/`
- Patch `/etc/nginx/sites-available/sticker-repo` with the SSL directives
- Set up automatic renewal via a systemd timer

### 3. Uncomment the HTTP→HTTPS redirect

In `/etc/nginx/sites-available/sticker-repo`, inside the `listen 80` block, uncomment:

```nginx
return 301 https://$host$request_uri;
```

Then reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Verify auto-renewal

```bash
sudo certbot renew --dry-run
```

---

## Running deploy.sh

`deploy.sh` pulls the latest code, runs checks, builds, and copies `dist/` to the web root.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `REPO_DIR` | `/srv/sticker-repo` | Path to the cloned repository |
| `WEB_ROOT` | `/var/www/sticker-repo` | nginx web root |
| `BRANCH` | `main` | Branch to deploy |

### Run manually

```bash
# Using defaults
bash /srv/sticker-repo/deploy/deploy.sh

# Override the web root
WEB_ROOT=/var/www/custom bash /srv/sticker-repo/deploy/deploy.sh
```

The script requires `sudo` access to write to the web root. If running as a
non-root user, ensure that user is in the `sudo` group and that `rsync` is
installed (`sudo apt-get install -y rsync`).

### Make it executable (optional)

```bash
chmod +x /srv/sticker-repo/deploy/deploy.sh
/srv/sticker-repo/deploy/deploy.sh
```

---

## Quick smoke-test after deploy

```bash
curl -I http://your-domain-or-ip/
# Expect: HTTP/1.1 200 OK (or 301 redirect to HTTPS if SSL is configured)

curl -I http://your-domain-or-ip/some/spa/route
# Expect: 200 OK — index.html served by the try_files fallback
```
