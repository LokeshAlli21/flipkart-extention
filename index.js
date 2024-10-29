// moving to prev version --force
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';
import chromium from 'chrome-aws-lambda'; 

dotenv.config();

const app = express();
app.use(cors());  // Enable CORS for all requests

// Health check route
app.get('/', (req, res) => {
    res.send("Server is running!");
});

// Route to handle Flipkart URL input
app.get('/start-puppeteer', async (req, res) => { 
    const flipkartUrl = req.query.url;

    if (!flipkartUrl) {
        return res.status(400).send('Flipkart URL is required.');
    }

    try {
        const browser = await initializeBrowser();
        const productDetails = await scrapeFlipkartProduct(browser, flipkartUrl);
        const amazonResults = await searchAmazon(browser, productDetails.productName);
        
        await browser.close();
        
        res.json({
            productName: productDetails.productName,
            extractedPrice: productDetails.extractedPrice,
            amazonResults
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send(`An error occurred while processing your request: ${error.message}`);
    }
});

// Initialize Puppeteer browser
const initializeBrowser = async () => {
    return await puppeteer.launch({
        args: [...chromium.args],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: true,
    });
};

// Scrape product details from Flipkart
const scrapeFlipkartProduct = async (browser, url) => {
    const page = await browser.newPage();
    
    // Set user agent to mimic a regular browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');

    try {
        console.log('Navigating to URL:', url);
        await page.goto(url, { waitUntil: 'networkidle2' });
        console.log('Successfully navigated to URL.');
        
        const productName = await getProductName(page);
        const extractedPrice = await getProductPrice(page);

        console.log('Extracted Price:', extractedPrice);
        console.log('Extracted Product Name:', productName);

        return { productName, extractedPrice };
    } catch (error) {
        console.error('Error scraping product:', error);
        throw new Error('Failed to scrape product');
    }
};

// Get product name from Flipkart with alternative selectors
const getProductName = async (page) => {
    const selectors = ['._6EBuvT', 'span.B_NuCI'];  // Alternative selectors
    for (const selector of selectors) {
        try {
            await page.waitForSelector(selector, { timeout: 60000 });
            const productName = await page.evaluate(selector => {
                const element = document.querySelector(selector);
                return element ? element.innerText : null;
            }, selector);
            if (productName) return productName;
        } catch (error) {
            console.error(`Selector ${selector} not found for product name, trying next...`);
        }
    }
    return 'Product name not found';
};

// Get product price from Flipkart with alternative selectors
const getProductPrice = async (page) => {
    const selectors = ['.Nx9bqj.CxhGGd', 'span._16Jk6d'];  // Alternative selectors
    for (const selector of selectors) {
        try {
            await page.waitForSelector(selector, { timeout: 60000 });
            const productPrice = await page.evaluate(selector => {
                const element = document.querySelector(selector);
                return element ? element.innerText : null;
            }, selector);
            if (productPrice) return productPrice;
        } catch (error) {
            console.error(`Selector ${selector} not found for product price, trying next...`);
        }
    }
    return 'Price not found';
};

// Search for the product on Amazon based on the name
const searchAmazon = async (browser, productName) => {
    const page = await browser.newPage();
    const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(productName)}`;
    try {
        console.log('Searching Amazon for product:', productName);
        await page.goto(amazonUrl, { waitUntil: 'networkidle2' });
    } catch (error) {
        console.error('Error navigating to Amazon:', error);
    }

    return await extractAmazonResults(page);
};

// Extract product details from Amazon search results
const extractAmazonResults = async (page) => {
    return await page.evaluate(() => {
        const items = [];
        const priceElements = document.querySelectorAll('.a-price-whole');
        const ratingElements = document.querySelectorAll('.a-icon-alt');
        const linkElements = document.querySelectorAll('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal');

        for (let i = 0; i < Math.min(3, priceElements.length); i++) {
            const price = priceElements[i]?.innerText || "No price available";
            const rating = ratingElements[i]?.innerText?.slice(0, 3) || "No rating available";
            const link = linkElements[i]?.href ? `https://www.amazon.in${linkElements[i].getAttribute('href')}` : "No link available";

            items.push({ price, rating, link });
        }
        
        return items;
    });
};

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on Port: ${PORT}`);
});
