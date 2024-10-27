// Import necessary modules
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Create an Express application
const app = express();

// Enable CORS for all requests
app.use(cors());

// Define a simple route to verify server status
app.get('/', (req, res) => {
    res.send("Server is up and running!");
});

// Route to accept Flipkart URL as a query parameter and use Puppeteer for scraping
app.get('/start-puppeteer', async (req, res) => {
    try {
        console.log("Received Flipkart URL:", req.query.url);
        
        // Get the Flipkart URL from the query parameter
        const flipkartUrl = req.query.url;
        
        // Validate the URL
        if (!flipkartUrl) {
            return res.status(400).send('Flipkart URL is required.');
        }

        // Launch Puppeteer browser instance
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        // Open a new page in the browser
        const page = await browser.newPage();

        // Navigate to the provided Flipkart URL
        await page.goto(flipkartUrl, { waitUntil: 'networkidle2' });

        // Scrape the product name
        await page.waitForSelector('._6EBuvT');
        const extractedText = await page.evaluate(() => {
            const element = document.querySelector('._6EBuvT');
            return element ? element.innerText : 'Product name not found';
        });

        // Scrape the product price
        await page.waitForSelector('.Nx9bqj.CxhGGd');
        const extractedPrice = await page.evaluate(() => {
            const priceElement = document.querySelector('.Nx9bqj.CxhGGd');
            return priceElement ? priceElement.innerText : 'Price not found';
        });

        console.log('Extracted Product:', extractedText);
        console.log('Extracted Price:', extractedPrice);

        // Perform a search on Amazon using the extracted product name
        const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
        await page.goto(amazonUrl, { waitUntil: 'networkidle2' });

        // Scrape product details from Amazon search results
        const results = await page.evaluate((extractedPrice) => {
            const items = [];
            const priceElements = document.querySelectorAll('.a-price-whole');
            const ratingElements = document.querySelectorAll('.a-icon-alt');
            const linkElements = document.querySelectorAll('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal');

            // Loop through top results and extract price, rating, and link
            for (let i = 0; i < Math.min(3, priceElements.length); i++) {
                const price = priceElements[i]?.innerText || "No price available";
                const rating = ratingElements[i]?.innerText?.slice(0, 3) || "No rating available";
                const link = linkElements[i]?.href ? `https://www.amazon.in${linkElements[i].href}` : "No link available";

                items.push({ price, rating, link, extractedPrice });
            }

            return items;
        }, extractedPrice);

        console.log("Amazon Results:", results);
        
        // Close the browser
        await browser.close();

        // Send the extracted data as a response
        res.json({ results });
    } catch (error) {
        console.error("Error running Puppeteer:", error);
        res.status(500).send("Failed to run Puppeteer script.");
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
