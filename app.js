import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';

dotenv.config();
const app = express();
app.use(cors());  // Enable CORS for all requests

app.get('/', async(req,res) =>{
    res.send("Working!!!");
})

// Route to accept Flipkart URL as a query parameter
app.get('/start-puppeteer', async (req, res) => {
    try {
        console.log("Flipkart URL: " + req.query.url);
        const flipkartUrl = req.query.url;
        
        if (!flipkartUrl) {
            return res.status(400).send('Flipkart URL is required.');
        }

        const browser = await puppeteer.launch({
            headless: true, // Run in headless mode on EC2
            args: ['--no-sandbox',
                '--disable-setuid-sandbox'], // Recommended for running in cloud environments
        });

        const page = await browser.newPage();

        // Navigate to the Flipkart page
        await page.goto(flipkartUrl, { waitUntil: 'networkidle2' });

        // Wait for the product name element
        await page.waitForSelector('._6EBuvT');
        const extractedText = await page.evaluate(() => {
            const element = document.querySelector('._6EBuvT');
            return element ? element.innerText : 'Element not found';
        });

        // Wait for the price element
        await page.waitForSelector('.Nx9bqj.CxhGGd');
        const extractedPrice = await page.evaluate(() => {
            const price = document.querySelector('.Nx9bqj.CxhGGd');
            return price ? price.innerText : 'Element not found';
        });

        console.log('Extracted Price:', extractedPrice);
        console.log('Extracted Text:', extractedText);

        // Amazon search with extracted text
        const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
        await page.goto(amazonUrl, { waitUntil: 'networkidle2' });

        const results = await page.evaluate((extractedPrice) => {
            const items = [];
            const priceElements = document.querySelectorAll('.a-price-whole');
            const ratingElements = document.querySelectorAll('.a-icon-alt');
            const linkElements = document.querySelectorAll('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal');

            for (let i = 0; i < 3; i++) {
                const price = priceElements[i]?.innerText || "No price available";
                const rating = ratingElements[i]?.innerText?.slice(0, 3) || "No rating available";
                const link = linkElements[i]?.href || "No Link Available";

                items.push({ price, rating, link, extractedPrice });
            }

            return items;
        }, extractedPrice);

        console.log("Amazon Results:", results);
        await browser.close();

        // Respond with extracted data
        res.json({ results });
    } catch (error) {
        console.error("Error running Puppeteer:", error);
        res.status(500).send("Failed to run Puppeteer script.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on Port:${PORT}`);
});