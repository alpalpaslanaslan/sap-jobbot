const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.options("*", cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/search', async (req, res) => {
  const { modules, locations, experience, extras } = req.body;
  const mods = (modules || ["SD","MM"]).join(", ");
  const locs = (locations || ["United Kingdom"]).join(", ");
  const expTxt = experience === "senior" ? "senior 7+ years" : "all levels";
  const extraTxt = extras || "visa sponsorship, minimum 40000 GBP";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: `You are a UK SAP job search assistant. Find REAL job listings using web search. Return ONLY valid JSON: {"jobs":[{"id":"1","title":"...","company":"...","location":"city, UK","platform":"LinkedIn/Indeed UK/Reed.co.uk","url":"REAL URL","salary":"...","posted":"X days ago","sponsorship":true,"description":"2-3 sentences","requirements":["req1"],"matchScore":85,"matchReasons":["reason1"]}]}`,
        messages: [{ role: "user", content: `Search SAP jobs UK: Modules: ${mods}, Locations: ${locs}, Experience: ${expTxt}, Requirements: ${extraTxt}. Find 5-8 real jobs with direct URLs. JSON only.` }]
      })
    });

    const data = await response.json();
    let txt = "";
    for (const b of (data.content || [])) { if (b.type === "text") txt += b.text; }
    const m = txt.replace(/```json|```/gi, "").match(/\{[\s\S]*\}/);
    if (!m) throw new Error("No JSON");
    const parsed = JSON.parse(m[0]);
    const jobs = (parsed.jobs || []).map(j => ({
      ...j,
      isDirectUrl: /currentJobId=\d{7,}|\/view\/\d{7,}|jk=[a-z0-9]{14,}|\/\d{7,}(?:[/?#]|$)/i.test(j.url || "")
    }));
    res.json({ jobs, total: jobs.length });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message, jobs: [] });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SAP JobBot backend running on port ${PORT}`));
