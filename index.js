import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send("Server is up and running!");
});

app.get('/start-puppeteer', async (req, res) => {
    try {
        const flipkartUrl = req.query.url;

        if (!flipkartUrl) {
            return res.status(400).send('Flipkart URL is required.');
        }

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.goto(flipkartUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Ensure selectors are correct
        await page.waitForSelector('._6EBuvT', { timeout: 10000 });
        const extractedText = await page.evaluate(() => {
            const element = document.querySelector('._6EBuvT');
            return element ? element.innerText : 'Product name not found';
        });

        await page.waitForSelector('.Nx9bqj.CxhGGd', { timeout: 10000 });
        const extractedPrice = await page.evaluate(() => {
            const priceElement = document.querySelector('.Nx9bqj.CxhGGd');
            return priceElement ? priceElement.innerText : 'Price not found';
        });

        const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
        await page.goto(amazonUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        const results = await page.evaluate(() => {
            const items = [];
            const priceElements = document.querySelectorAll('.a-price-whole');
            const ratingElements = document.querySelectorAll('.a-icon-alt');
            const linkElements = document.querySelectorAll('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal');

            for (let i = 0; i < Math.min(3, priceElements.length); i++) {
                const price = priceElements[i]?.innerText || "No price available";
                const rating = ratingElements[i]?.innerText?.slice(0, 3) || "No rating available";
                const link = linkElements[i]?.href ? `https://www.amazon.in${linkElements[i].href}` : "No link available";

                items.push({ price, rating, link });
            }

            return items;
        });

        await browser.close();
        res.json({ results: [{ extractedText, extractedPrice, ...results }] });
    } catch (error) {
        console.error("Error running Puppeteer:", error);
        res.status(500).send("Failed to run Puppeteer script: " + error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
