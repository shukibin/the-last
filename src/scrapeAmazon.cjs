const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.amazon.com', { waitUntil: 'networkidle2' });

  const products = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.s-result-item')).map(item => ({
      title: item.querySelector('.a-text-normal') ? item.querySelector('.a-text-normal').innerText : null,
      price: item.querySelector('.a-price-whole') ? item.querySelector('.a-price-whole').innerText : null,
    }));
  });

  console.log(JSON.stringify(products, null, 2));
  await browser.close();
})();
