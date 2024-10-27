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
    let browser;
    try {
        const flipkartUrl = req.query.url;

        if (!flipkartUrl) {
            return res.status(400).send('Flipkart URL is required.');
        }

        console.log(`Starting Puppeteer for URL: ${flipkartUrl}`);

        // Launch Puppeteer with specific configurations for compatibility
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        
        console.log('Navigating to Flipkart...');
        await page.goto(flipkartUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        console.log('Checking for product name selector...');
        // Attempt to wait for selector with error handling
        const productNameSelector = '._6EBuvT';
        const isSelectorPresent = await page.waitForSelector(productNameSelector, { timeout: 10000 }).catch(() => null);
        
        if (!isSelectorPresent) {
            throw new Error("Product name selector not found. The page structure might have changed.");
        }

        console.log('Extracting product name...');
        const extractedText = await page.evaluate((selector) => {
            const element = document.querySelector(selector);
            return element ? element.innerText : 'Product name not found';
        }, productNameSelector);

        console.log(`Extracted product name: ${extractedText}`);
        
        // Respond with extracted product name
        res.json({ productName: extractedText });
    } catch (error) {
        console.error("Error running Puppeteer:", error);
        res.status(500).json({ message: "Failed to run Puppeteer script", error: error.toString() });
    } finally {
        if (browser) {
            await browser.close(); // Ensure the browser is closed even if an error occurs
            console.log("Browser closed successfully.");
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
