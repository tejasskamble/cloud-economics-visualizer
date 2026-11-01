# ☁ Cloud Economics Visualizer

An interactive, beginner-friendly learning dashboard that explains **TCO (Total Cost of Ownership)**, **CapEx (Capital Expenditure)** and **OpEx (Operational Expenditure)** — with animated diagrams, a live cost calculator, AWS examples and a buy-vs-cloud decision simulator.

> ⚠️ **All prices are illustrative estimates for learning. They are NOT live AWS pricing.** Use the official [AWS Pricing Calculator](https://calculator.aws/) for real quotes.

Built with **plain HTML, CSS, vanilla JavaScript and inline SVG** — no frameworks, no backend, no paid APIs, no build tools.

---

## Features

| Area | What you get |
|---|---|
| **9 learning modules** | Introduction · Traditional IT costs · CapEx · OpEx · CapEx vs OpEx · TCO · Data center vs cloud · Real-world scenarios · Optimisation & takeaways |
| **Interactive visuals** | Clickable data-center cost map, depreciation charts, usage-based billing chart, cumulative break-even chart, TCO iceberg, animated fixed-vs-elastic capacity simulation |
| **TCO calculator** | Hardware, software, networking, electricity, cooling, maintenance, staffing vs cloud compute, storage, data transfer. Adjustable size, duration and pricing assumptions; stacked bars, cumulative line, donuts, breakdown table, break-even month and break-even utilisation |
| **Scenario switcher** | Startup · College · Small Business · Enterprise presets |
| **AWS Lab** | EC2, S3, RDS, Lambda and CloudWatch usage-based bill estimator with on-prem equivalents |
| **Decision simulator** | 36-month simulation (steady / growth / seasonal / spiky demand): buy capacity or use cloud, see profit, idle capacity and lost sales, plus a rule-of-thumb decision advisor |
| **UX** | Beginner / Technical mode, glossary tooltips, searchable glossary, 5-question quiz with instant feedback, light/dark theme, progress tracking, responsive layout (desktop, tablet, mobile), keyboard accessible, respects reduced-motion |

## Project structure

```
cloud-economics-visualizer/
├── index.html   # page shell and navigation
├── style.css    # themes, layout, components, SVG/animation styles
├── script.js    # cost model, charts, lesson modules, views, app logic
└── README.md
```

`script.js` is organised in clearly separated sections: Util · Glossary · Cost model (`calc`) · Charts (SVG generators) · Controls · Lesson modules · Views · App.

## Run locally

No installation is needed.

**Option 1 — open the file:** double-click `index.html`.

**Option 2 — tiny local server (recommended):**

```bash
cd cloud-economics-visualizer
python3 -m http.server 8000
# then open http://localhost:8000
```

### Check the JavaScript

```bash
node --check script.js
```

## Deploy to GitHub Pages

1. **Create a repository** on GitHub (for example `cloud-economics-visualizer`). Keep it public (or use a plan that supports private Pages).
2. **Push the project** (files must be at the repository root):

   ```bash
   cd cloud-economics-visualizer
   git init
   git add .
   git commit -m "Add Cloud Economics Visualizer"
   git branch -M main
   git remote add origin https://github.com/<your-username>/cloud-economics-visualizer.git
   git push -u origin main
   ```
3. On GitHub open **Settings → Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Select branch **`main`**, folder **`/ (root)`**, and click **Save**.
6. Wait about a minute. Your site will be live at:

   ```
   https://<your-username>.github.io/cloud-economics-visualizer/
   ```

All asset paths are relative (`style.css`, `script.js`), so the site works from the repository sub-path with no configuration. If you unzip the project from the provided ZIP, push the *contents* of the `cloud-economics-visualizer` folder so `index.html` is at the repository root.

## How the cost model works (simplified)

The calculator iterates month by month:

- **On-premises:** hardware and networking gear are bought on day 1 and again at every refresh cycle (CapEx); licences, circuit fees, electricity (`servers × kW × 730 h × price`), cooling (`power × (PUE − 1)`), maintenance (% of hardware per year) and staffing (`max(0.2, servers ÷ servers-per-admin)` FTE) recur monthly.
- **Cloud:** compute (`servers × hourly rate × 730 × run% × (1 − discount)`), storage (growing monthly), data transfer out, and a reduced cloud-operations staffing cost.
- Outputs: totals per category, CapEx/OpEx split, cumulative curves, crossover month and the utilisation at which both options cost the same.

Limitations: no taxes, resale value, discounting (NPV), migration cost or free tiers; one "server-equivalent" is a simplification of capacity.

## Customising

- Scenario presets live in `SCENARIOS` in `script.js`.
- Default assumptions are in `BASE`.
- AWS example prices are in `AWSP`.
- Colours and themes are CSS variables at the top of `style.css`.

## License

Free to use for learning and teaching. Sample numbers are illustrative; nothing here is financial advice.
