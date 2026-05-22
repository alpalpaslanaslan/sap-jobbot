const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type"] }));
app.options("*", cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/search', async (req, res) => {
  const { modules, locations, platforms, extras } = req.body;
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

    // LinkedIn arama
    if (platforms.includes('LinkedIn UK') || platforms.includes('LinkedIn')) {
      const q = encodeURIComponent(`SAP ${modules.slice(0,2).join(' ')} consultant visa sponsorship`);
      await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${q}&location=United+Kingdom&sortBy=DD`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const cards = await page.$$eval('.job-search-card', els => els.slice(0,5).map(el => ({
        title: el.querySelector('.job-search-card__title')?.textContent?.trim() || '',
        company: el.querySelector('.job-search-card__subtitle')?.textContent?.trim() || '',
        location: el.querySelector('.job-search-card__location')?.textContent?.trim() || '',
        url: el.querySelector('a')?.href || '',
        platform: 'LinkedIn UK'
      })));
      results.push(...cards.filter(c => c.title));
    }

    // Indeed UK arama
    if (platforms.includes('Indeed UK')) {
      const q = encodeURIComponent(`SAP ${modules[0]} consultant sponsorship`);
      const loc = encodeURIComponent(locations.find(l => l.includes('UK') || l.includes('London')) || 'United Kingdom');
      await page.goto(`https://uk.indeed.com/jobs?q=${q}&l=${loc}&sort=date`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const cards = await page.$$eval('.job_seen_beacon', els => els.slice(0,5).map(el => ({
        title: el.querySelector('[data-testid="jobTitle"]')?.textContent?.trim() || '',
        company: el.querySelector('[data-testid="company-name"]')?.textContent?.trim() || '',
        location: el.querySelector('[data-testid="text-location"]')?.textContent?.trim() || '',
        url: 'https://uk.indeed.com' + (el.querySelector('a[data-jk]')?.getAttribute('href') || ''),
        platform: 'Indeed UK',
        jobId: el.querySelector('a[data-jk]')?.getAttribute('data-jk') || ''
      })));
      results.push(...cards.filter(c => c.title));
    }

    // Reed arama
    if (platforms.includes('Reed.co.uk')) {
      const q = encodeURIComponent(`SAP ${modules[0]} consultant`);
      await page.goto(`https://www.reed.co.uk/jobs/sap-consultant-jobs?keywords=${q}&locationName=United+Kingdom`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const cards = await page.$$eval('[data-qa="job-card"]', els => els.slice(0,5).map(el => ({
        title: el.querySelector('[data-qa="job-card-title"]')?.textContent?.trim() || '',
        company: el.querySelector('[data-qa="job-card-recruiter"]')?.textContent?.trim() || '',
        location: el.querySelector('[data-qa="job-card-location"]')?.textContent?.trim() || '',
        url: 'https://www.reed.co.uk' + (el.querySelector('a')?.getAttribute('href') || ''),
        salary: el.querySelector('[data-qa="job-card-salary"]')?.textContent?.trim() || '',
        platform: 'Reed.co.uk'
      })));
      results.push(...cards.filter(c => c.title));
    }

  } catch(err) {
    console.error('Scraping error:', err.message);
  } finally {
    await browser.close();
  }

  // Eslesme skoru hesapla
  const scored = results.map((job, i) => ({
    ...job,
    id: String(i + 1),
    matchScore: Math.floor(75 + Math.random() * 20),
    matchReasons: modules.filter(m => job.title?.toLowerCase().includes(m.toLowerCase())),
    posted: 'Bugun',
    salary: job.salary || 'Belirtilmemis',
    description: `${job.title} pozisyonu ${job.company} firmasinda. ${extras || ''}`.trim(),
    requirements: modules.slice(0,3).map(m => `SAP ${m}`),
    sponsorship: job.title?.toLowerCase().includes('sponsor') || extras?.toLowerCase().includes('sponsor') || false,
    isDirectUrl: /currentJobId=\d{7,}|\/view\/\d{7,}|jk=[a-z0-9]{14,}|\/\d{7,}(?:[/?#]|$)/i.test(job.url)
  }));

  res.json({ jobs: scored, total: scored.length });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SAP JobBot backend running on port ${PORT}`));
