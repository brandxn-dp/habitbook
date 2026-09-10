# Habitbook

An iOS-style Progressive Web App version of the "Sanctuary" monthly habit tracker from Dominic Hart's video *This book changed my life*.

| In the notebook | In the app |
| --- | --- |
| Monthly spread, days 1–31 | **Month → Spread**, a scrollable tracker grid |
| Memorable moments (one line a day) | **Today → Memorable moment**, listed in **Month** |
| Cartoon self with a motto ("Stay present") | A motto bubble for each month |
| Weight column | **Today → Weight** (kg or lb) |
| Black / blue / red pens, each with a meaning | **Pen colours**: rename them, recolour them, add your own |
| Red pen: things that affect sleep | Colours set to *Compare with sleep*, analysed in **Insights** |
| "Not every habit is a good habit" | A per-habit **Avoid** switch |
| Sleep graph (hours 4–10) + sleep score | Sleep line chart with your sleep goal, plus a score column |
| Morning routine: weigh in, revisit yesterday | A "Revisit yesterday" prompt on Today |
| "Next month" note | **Month → Next month** |
| "What are my goals?" 1–3 | Monthly goals (Month and Journal) |
| Daily journal with date, time and 3× "Grateful for" | **Journal** tab |

### Settings

- **Appearance:** Automatic, Light or Dark
- **Pen colours:** a name, a meaning and one of 14 iOS colours for each, plus whether it's compared with your sleep
- **Units and formats:** kg or lb (stored as kg, so switching is lossless), week starting Monday or Sunday, and DD.MM, MM.DD or ISO dates
- **Sleep goal:** shown as a dashed line on the sleep chart
- **Daily routine:** toggles for the "Revisit yesterday" prompt, the monthly motto, and auto-ticking Journal
- **Data:** export or import a JSON backup, or erase everything

All data is stored in the browser's `localStorage` on each device. The server only serves static files and stores nothing, so there are no volumes to back up. Use **Export Backup** instead.

## Run locally with Docker

```bash
docker compose up -d --build
```

Then open http://localhost:8090. To use a different port, set `HABITBOOK_PORT`.

## Docker image

Every push to `main` builds `ghcr.io/brandxn-dp/habitbook:latest` for amd64 and arm64 using GitHub Actions ([.github/workflows/docker.yml](.github/workflows/docker.yml)).

## Install on Unraid (web GUI)

1. Open the **Docker** tab and click **Add Container** at the bottom.
2. Fill in:
   - **Name:** `habitbook`
   - **Repository:** `ghcr.io/brandxn-dp/habitbook:latest`
   - **Network Type:** `Bridge`
   - **WebUI:** `http://[IP]:[PORT:80]/`
   - **Icon URL:** `https://raw.githubusercontent.com/brandxn-dp/habitbook/main/public/icons/icon-512.png`
3. Click **Add another Path, Port, Variable, Label or Device**. Set **Config Type** to `Port`, **Name** to `Web UI Port`, **Container Port** to `80`, **Host Port** to `8090` (or any free port), and **Connection Type** to `TCP`. Click **Add**.
4. Click **Apply**. Unraid pulls the image and starts it.
5. Click the Habitbook icon on the Docker tab and choose **WebUI**, or browse to `http://<unraid-ip>:8090`.

Alternatively, copy [unraid/habitbook.xml](unraid/habitbook.xml) to `/boot/config/plugins/dockerMan/templates-user/my-habitbook.xml` on the flash drive. **Habitbook** then appears in the **Template** dropdown under **Add Container** with everything filled in.

**Updating:** On the Docker tab, click **Check for Updates**, then **Apply Update** on Habitbook.

### HTTPS, so it installs on an iPhone

Safari only installs a PWA as a standalone home-screen app, and only enables offline mode, over HTTPS. On Unraid 7 the easiest route is its built-in Tailscale support:

1. Install the **Tailscale** plugin from the **Apps** tab and sign in. Install Tailscale on your iPhone too, signed in to the same account.
2. On the Docker tab, click Habitbook and choose **Edit**. Turn on **Use Tailscale**, set the hostname to `habitbook`, set **Tailscale Serve** to `Serve`, and set the serve port to `80`. Click **Apply**.
3. On the iPhone, open `https://habitbook.<your-tailnet>.ts.net` in Safari and choose **Share → Add to Home Screen**.

A reverse proxy with a real certificate, such as Nginx Proxy Manager or SWAG, works just as well.
