import pandas as pd
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import time
import csv
from typing import List, Dict, Optional
from tqdm import tqdm
from config import dump_to_sql, engine

# Global driver instance for reuse
driver = None

def initialize_driver():
    """Initialize a reusable driver instance"""
    global driver
    if driver is None:
        options = uc.ChromeOptions()
        options.add_argument("--headless=new")  # Add this
        options.add_argument("--no-sandbox")     # Add this for servers
        options.add_argument("--disable-setuid-sandbox")  # Add this
        options.add_argument("--no-first-run")
        options.add_argument("--no-default-browser-check")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument("--disable-gpu")
        options.add_argument("--disable-dev-shm-usage")
        options.page_load_strategy = 'none'
        
        driver = uc.Chrome(options=options, version_main=None)
        
        driver.execute_cdp_cmd('Network.emulateNetworkConditions', {
            "offline": False,
            "downloadThroughput": 500 * 1024 / 8,
            "uploadThroughput": 500 * 1024 / 8,
            "latency": 100
        })

        # Set implicit wait globally
        # driver.implicitly_wait(10)
    return driver


def close_driver():
    """Close the global driver instance"""
    global driver
    if driver:
        driver.quit()
        driver = None


def get_amazon_rating_undetected(asin: str, domain: str = "amazon.ae") -> Dict:
    """
    Scrape product rating using undetected-chromedriver with optimized waits
    """
    url = f"https://www.{domain}/dp/{asin}"
    
    try:
        driver = initialize_driver()
        driver.get(url)
        
        # Explicit wait for critical element to be present
        wait = WebDriverWait(driver, 0.1)
        
        # Get product title
        title = "N/A"
        for _ in range(25):
            try:
                # Wait for page title to load - indicates page is ready
                title_elem = wait.until(EC.presence_of_element_located((By.XPATH, "//span[@id='productTitle']")))
                if title_elem:
                    break
                title = title_elem.text.strip()
            except (NoSuchElementException, TimeoutException):
                pass

                
        # Wait for element with short timeout
        try:
            rating = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".reviewCountTextLinkedHistogram.noUnderline > span > a > span"))).text
        except (NoSuchElementException, TimeoutException):
            rating = None
                
        return {
            "asin": asin,
            "rating": rating,
            "title": title,
            "url": url,
            "status": "success"
        }
    
    except Exception as e:
        return {
            "asin": asin,
            "rating": "Error",
            "title": "N/A",
            "url": url,
            "status": str(e)
        }


def process_asin_list_undetected(asins: List[str], domain: str = "amazon.ae", delay: int = 2) -> List[Dict]:
    """
    Process multiple ASINs with optimized waits and reduced delay
    delay: seconds to wait between requests (reduced from 5 to 2)
    """
    results = []
    
    try:
        initialize_driver()
        
        for asin in tqdm(asins, desc="Processing ASINs", unit="asin"):
            result = get_amazon_rating_undetected(asin, domain)
            results.append(result)
            
            # Print only if error
            if result["status"] != "success":
                tqdm.write(f"❌ Error for {asin}: {result['status']}")
            
            # Reduced delay between requests
            if asins[-1] != asin:
                time.sleep(delay)
    
    finally:
        close_driver()
    
    return results

def load_asins_from_csv(file_path: str) -> List[str]:
    """
    Load ASINs from a CSV file
    CSV should have a column named 'asin'
    """
    asins = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                asin = row.get('asin', '').strip()
                if asin:
                    asins.append(asin)
        print(f"✅ Loaded {len(asins)} ASINs from {file_path}")
    except Exception as e:
        print(f"❌ Error reading file: {e}")
    
    return asins


start_time = time.time()

# Option 2: Multiple ASINs from list
query = """
    SELECT DISTINCT asin1 
    FROM "AMZN_PRODUCT_LIST" apl 
"""
products_list = pd.read_sql(query, con=engine)['asin1'].tolist()
results = process_asin_list_undetected(products_list, "amazon.ae", delay=0)
df = pd.DataFrame(results)[['asin', 'rating']]
dump_to_sql(df, "amazon_ratings", safe_drop=True)


query = """
    SELECT DISTINCT competitor_asin 
    FROM "competitor_product_mappings" apl 
"""
products_list = pd.read_sql(query, con=engine)['competitor_asin'].tolist()
results = process_asin_list_undetected(products_list, "amazon.ae", delay=0)
df = pd.DataFrame(results)[['asin', 'rating']]
dump_to_sql(df, "competitor_ratings", safe_drop=True)

elapsed = time.time() - start_time
print(f"\n⏱️  Total time: {elapsed:.2f}s")