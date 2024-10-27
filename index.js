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

        console.log(`Starting Puppeteer for URL: ${flipkartUrl}`);

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        console.log('Navigating to Flipkart...');
        await page.goto(flipkartUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        console.log('Waiting for product name selector...');
        await page.waitForSelector('._6EBuvT', { timeout: 10000 });
        const extractedText = await page.evaluate(() => {
            const element = document.querySelector('._6EBuvT');
            return element ? element.innerText : 'Product name not found';
        });
        console.log(`Extracted product name: ${extractedText}`);

        // Continue with the rest of your code...
    } catch (error) {
        console.error("Error running Puppeteer:", error);
        res.status(500).json({ message: "Failed to run Puppeteer script", error: error.toString() });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
