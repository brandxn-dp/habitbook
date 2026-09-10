# Habitbook

An iOS-style Progressive Web App version of the "Sanctuary" monthly habit tracker from Dominic Hart's video *This book changed my life*.

| In the notebook | In the app |
| --- | --- |
| Monthly spread, days 1–31 | **Month → Spread**, a tracker grid sized to fit the phone screen |
| Memorable moments (one line a day) | **Today**, or at the top of each **Journal** entry |
| Cartoon self with a motto ("Stay present") | A motto bubble for each month |
| Weight column | **Today → Weight** (kg or lb), or imported from Apple Health |
| Black / blue / red pens, each with a meaning | **Pen colours**: rename them, recolour them, add your own |
| Red pen: things that affect sleep | Colours set to *Compare with sleep*, analysed in **Insights** |
| "Not every habit is a good habit" | A per-habit **Avoid** switch |
| Habits that only happen on some days | A per-habit **Repeat** setting (days of the week, Weekdays, or Weekends). Off-days are shaded and never count against you |
| Rearranging columns for next month | **Habits → Edit**: drag ≡ to reorder habits, or drop one into another colour |
| Sleep graph (hours 4–10) + sleep score | Sleep line chart with your sleep goal, plus a score column |
| Morning routine: weigh in, revisit yesterday | A "Revisit yesterday" prompt on Today |
| "Next month" note | **Month → Next month** |
| "What are my goals?" 1–3 | Monthly goals (Month and Journal) |
| Daily journal with date, time and 3× "Grateful for" | **Journal** tab |

## Accounts and sync

The app works on its own with no account; the book is saved in the browser. Signing in (**Settings → Account & sync**) syncs the book across all of your devices.

- **The first account created becomes the admin.** Admins add other people under **Settings → Users**, and each person gets a private book.
- Self sign-up is off by default. Set `ALLOW_SIGNUPS=true` on the container to let anyone who can reach the server create an account.
- Edits merge field by field. For example, ticking a habit on your phone and an Apple Health import on the same day both survive. Things you do offline sync the next time the app opens.
- On the server, data lives in `/data`: `db.json` holds accounts (passwords are hashed with scrypt) and `states/` holds one file per book. Back up that folder.

## Apple Health

iPhone web apps can't read Apple Health directly, but the **Shortcuts** app can. **Settings → Apple Health** shows your personal link and creates an API key. A daily Shortcuts automation then sends your weight and sleep:

```
POST /api/health-data
Authorization: Bearer hb_…
Content-Type: application/json

{ "weight": 83.2, "weightUnit": "kg", "sleepMinutes": 422, "sleepScore": 77 }
```

- Weight goes on today's page. Sleep and sleep score go on yesterday's page, the night that followed it, just like the notebook. You can override this with `date` or `sleepDate` (`YYYY-MM-DD`).
- `weight` also accepts values with units, such as `"183.4 lb"`. Sleep can be sent as `sleepMinutes`, `sleepHours`, `sleepSeconds`, or text such as `"7 hr 2 min"`.
- Apple Health has no Garmin sleep score, so `sleepScore` is optional. You can type it in on Today instead.

## Run locally with Docker

```bash
docker compose up -d --build
```

Then open http://localhost:8090. Data is stored in `./data`.

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
3. Click **Add another Path, Port, Variable, Label or Device** three times, adding:
   - **Port:** name `Web UI Port`, container port `80`, host port `8090`, TCP
   - **Path:** name `Data`, container path `/data`, host path `/mnt/user/appdata/habitbook`
   - **Variable:** name `Allow sign-ups`, key `ALLOW_SIGNUPS`, value `false`
4. Click **Apply**, open the **WebUI**, go to **Settings → Create Admin Account**, and sign in.

Alternatively, copy [unraid/habitbook.xml](unraid/habitbook.xml) to `/boot/config/plugins/dockerMan/templates-user/my-habitbook.xml` on the flash drive. **Habitbook** then appears in the **Template** dropdown with everything filled in.

**Updating:** On the Docker tab, click **Check for Updates**, then **Apply Update**. If you set Habitbook up before version 1.2, edit the container and add the `/data` path from step 3 first.

### HTTPS, so it installs on an iPhone

Safari only installs a PWA as a standalone home-screen app over HTTPS. On Unraid 7 the easiest route is its built-in Tailscale support:

1. Install the **Tailscale** plugin from the **Apps** tab and sign in. Install Tailscale on your iPhone too, signed in to the same account.
2. On the Docker tab, click Habitbook and choose **Edit**. Turn on **Use Tailscale**, set the hostname to `habitbook`, set **Tailscale Serve** to `Serve`, and set the serve port to `80`. Click **Apply**.
3. On the iPhone, open `https://habitbook.<your-tailnet>.ts.net` in Safari and choose **Share → Add to Home Screen**.

A reverse proxy with a real certificate, such as Nginx Proxy Manager or SWAG, works just as well.
