"""
Amazon Rating Scraper - Playwright (Faster than Selenium)
- Real browser (works with blocked IPs)
- Faster than Selenium
- Better stealth
"""

import pandas as pd
from playwright.sync_api import sync_playwright, Page, Browser
import time
from typing import List, Dict, Optional
from tqdm import tqdm
import random

# ============================================================
# CONFIGURATION
# ============================================================
PAGE_TIMEOUT = 10000      # 10 seconds in milliseconds
CONCURRENT_PAGES = 3      # Multiple tabs in same browser
MIN_DELAY = 0.3
MAX_DELAY = 0.8

# Global browser
browser: Optional[Browser] = None
context = None


# ============================================================
# BROWSER MANAGEMENT
# ============================================================
def init_browser(playwright):
    """Initialize browser with stealth settings"""
    global browser, context
    
    browser = playwright.chromium.launch(
        headless=True,
        args=[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
        ]
    )
    
    # Create context with realistic settings
    context = browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale='en-US',
        timezone_id='Asia/Dubai',
        geolocation={'latitude': 25.2048, 'longitude': 55.2708},  # Dubai
        permissions=['geolocation'],
    )
    
    # Add stealth scripts
    context.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
        Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
        window.chrome = {runtime: {}};
    """)
    
    return browser, context


def close_browser():
    """Close browser"""
    global browser, context
    if context:
        context.close()
    if browser:
        browser.close()


# ============================================================
# SCRAPING
# ============================================================
def extract_rating(page: Page) -> Optional[str]:
    """Extract rating from page"""
    selectors = [
        "#acrPopover span.a-icon-alt",
        "#averageCustomerReviews span.a-icon-alt",
        ".reviewCountTextLinkedHistogram span.a-icon-alt",
        "i.a-icon-star span.a-icon-alt",
    ]
    
    for selector in selectors:
        try:
            elem = page.query_selector(selector)
            if elem:
                text = elem.inner_text()
                if text and "out of" in text.lower():
                    return text.strip()
        except:
            continue
    return None


def scrape_asin(page: Page, asin: str, domain: str = "amazon.ae") -> Dict:
    """Scrape single ASIN"""
    url = f"https://www.{domain}/dp/{asin}"
    
    try:
        # Navigate with short timeout
        page.goto(url, timeout=PAGE_TIMEOUT, wait_until='domcontentloaded')
        
        # Wait for product title (indicates page loaded)
        title = "N/A"
        try:
            page.wait_for_selector("#productTitle", timeout=5000)
            title_elem = page.query_selector("#productTitle")
            if title_elem:
                title = title_elem.inner_text().strip()
        except:
            # Check for captcha
            if page.query_selector("input[name='captcha']") or "captcha" in page.content().lower():
                return {
                    "asin": asin,
                    "rating": None,
                    "title": "N/A",
                    "status": "captcha"
                }
        
        # Extract rating
        rating = extract_rating(page)
        
        status = "success" if rating else ("no_rating" if title != "N/A" else "page_load_failed")
        
        return {
            "asin": asin,
            "rating": rating,
            "title": title,
            "status": status
        }
    
    except Exception as e:
        return {
            "asin": asin,
            "rating": None,
            "title": "N/A",
            "status": f"error: {str(e)[:30]}"
        }


def process_asins(asins: List[str], domain: str = "amazon.ae") -> List[Dict]:
    """Process all ASINs"""
    results = []
    failed = []
    captcha_count = 0
    
    with sync_playwright() as playwright:
        print("🚀 Starting browser...", end=" ", flush=True)
        init_browser(playwright)
        print("✅")
        
        # Warm up - visit homepage
        print("🌐 Visiting Amazon homepage...", end=" ", flush=True)
        page = context.new_page()
        page.goto(f"https://www.{domain}", wait_until='domcontentloaded')
        time.sleep(2)
        print("✅\n")
        
        # Process ASINs
        for asin in tqdm(asins, desc="Scraping", unit="asin"):
            result = scrape_asin(page, asin, domain)
            results.append(result)
            
            if result["status"] == "captcha":
                captcha_count += 1
                tqdm.write(f"⚠️  Captcha on {asin}")
                
                # If too many captchas, wait longer
                if captcha_count >= 3:
                    tqdm.write("☕ Too many captchas, taking a break...")
                    time.sleep(30)
                    captcha_count = 0
                    # Reload homepage
                    page.goto(f"https://www.{domain}", wait_until='domcontentloaded')
                    time.sleep(2)
                    
            elif result["status"] not in ["success", "no_rating"]:
                failed.append(asin)
                tqdm.write(f"❌ {asin}: {result['status']}")
            
            # Small delay
            time.sleep(random.uniform(MIN_DELAY, MAX_DELAY))
        
        page.close()
        close_browser()
    
    # Summary
    success = sum(1 for r in results if r["status"] == "success")
    no_rating = sum(1 for r in results if r["status"] == "no_rating")
    
    print(f"\n📊 Results: ✅ {success} | ⚪ {no_rating} | ❌ {len(failed)}")
    
    return results


# ============================================================
# MAIN
# ============================================================
def main():
    from config import dump_to_sql, engine
    
    total_start = time.time()
    
    # YOUR PRODUCTS
    print("="*60)
    print("📦 Processing YOUR PRODUCTS")
    print("="*60)
    
    query = """SELECT DISTINCT asin1 FROM "AMZN_PRODUCT_LIST" apl"""
    products_list = pd.read_sql(query, con=engine)['asin1'].tolist()
    print(f"Found {len(products_list)} ASINs\n")
    
    start = time.time()
    results = process_asins(products_list, "amazon.ae")
    df = pd.DataFrame(results)[['asin', 'rating']]
    dump_to_sql(df, "amazon_ratings", safe_drop=True)
    print(f"⏱️  Time: {(time.time() - start)/60:.1f} min\n")
    
    # COMPETITOR PRODUCTS
    print("="*60)
    print("🎯 Processing COMPETITOR PRODUCTS")
    print("="*60)
    
    query = """SELECT DISTINCT competitor_asin FROM "competitor_product_mappings" apl"""
    products_list = pd.read_sql(query, con=engine)['competitor_asin'].tolist()
    print(f"Found {len(products_list)} ASINs\n")
    
    start = time.time()
    results = process_asins(products_list, "amazon.ae")
    df = pd.DataFrame(results)[['asin', 'rating']]
    dump_to_sql(df, "competitor_ratings", safe_drop=True)
    print(f"⏱️  Time: {(time.time() - start)/60:.1f} min")
    
    total = (time.time() - total_start) / 60
    print("\n" + "="*60)
    print(f"🏁 TOTAL TIME: {total:.1f} minutes")
    print("="*60)


if __name__ == "__main__":
    main()