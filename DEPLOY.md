# Putting ANATOMY PARK online (about 15 minutes)

The game has two parts:

- The **frontend** is the website. It goes on **Vercel**, which is free.
- The **backend** is the Python server that talks to Claude. It goes on **Render**, which is also free.

Your API key only ever lives in Render's dashboard. Never put it in git.

## 1. Backend on Render

1. Go to https://render.com and sign in with GitHub.
2. Click **New** > **Blueprint**, pick the repo `cklaw25/anatomyparkWHACKmark1`, and click **Apply**. Render reads `render.yaml` from the repo.
3. Render will ask for **ANTHROPIC_API_KEY**. Paste your key there, and only there.
4. Wait for the build to finish. You get a URL like `https://anatomypark-api.onrender.com`.
5. Check the server: open `<that URL>/health`. It should show `"key_set": true` and `"public": true`.

## 2. Frontend on Vercel

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New** > **Project** and import the same repo.
3. Set **Root Directory** to `frontend`. Vercel detects that it's a Vite project.
4. Under **Environment Variables**, add `VITE_API` = your Render URL from step 1.4, with no trailing slash.
5. Click **Deploy**. You get a link like `https://anatomypark.vercel.app`. That's the link to share.

If you change `VITE_API` later, you need to redeploy on Vercel for it to take effect.

## 3. Protect your credits

These protections are already built into the backend:

| Protection | Default | Change it with (Render > Environment) |
|---|---|---|
| AI calls per visitor in 10 minutes | 60, which is roughly two full games | `IP_LIMIT` |
| AI calls per day for the whole site | 2000 | `DAILY_CAP` |
| Case writing with Opus | off: visitors get the 12 cases already written | `PUBLIC=0` turns writing back on |
| Who can call the server | `*.vercel.app` sites and localhost | `ALLOWED_ORIGINS` and `ALLOWED_ORIGIN_REGEX` |

When a limit is hit, the game quietly switches to its offline content. You can see how many calls were used today at `/health` (`used_today`).

**Also do this:** in the Anthropic Console, go to **Settings > Limits** and set a monthly **spend limit**, for example $20. That's the hard safety net.

## 4. Before the pitch

The free Render server **falls asleep after 15 minutes idle**, and waking it takes about a minute. While it wakes, the game shows "waking the server up". Open the site about 2 minutes before you present.
