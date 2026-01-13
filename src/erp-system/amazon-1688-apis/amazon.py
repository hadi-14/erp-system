import ast
from datetime import date, datetime, timedelta
import gzip
import json
import time
from io import StringIO
import uuid

import pandas as pd
import requests
from tqdm import tqdm
from sp_api.base import Marketplaces
from sp_api.api import Orders, Inventories, ReportsV2, ProductFees, Products, ProductTypeDefinitions
from sp_api.util import throttle_retry, load_all_pages

from config import dump_to_sql, engine
# ===== DATE RANGE =====
MARKET_PLACE = Marketplaces.AE
startDate = date(2025, 1, 1)
# startDate = date(2025, 11, 1)   
endDate = date.today()
# endDate = date(2024, 7, 1)

credentials = dict(
    refresh_token='Atzr|IwEBILSY6X3bz4DRP_mW3kh8RZ_T5c-RAypa4QY1BiI3Z99VKiCuj5OZUYYCS2ZwTaOY6FscVdNqxZrSbxxis5vyfulPeQ_sU1_844L0r6AsZOScbDaOKHTb-bny3FzNylJ6d4jJATfJ_Lne_WS_HgecmG3YTWpD6TNMab0xwPPrAOBBK-3KkLVN0DPy0sIuGvwGoudzl4KtbhC5zmJlDMvxdFj6Vd-jAn2frjqbRLDzZjgpOyfVzYFNwlsSCbY8lSTY_G_BAna5JpvsiregQzHi7qcW1UPGmUYqYKwr8j150A1bpfvsKgLJIbUxegeTWYPtZB0egJhC1khwfcwuMwvvfhto',
    lwa_app_id='amzn1.application-oa2-client.272ba9bb3ac845b9b41972cb1b47e977',  # From Seller Central, named CLIENT IDENTIFIER on website.
    lwa_client_secret='amzn1.oa2-cs.v1.2b9a7d96ec4321332017df23909c32445c2cb8115b2a8ef528b562ee95dcadbd',  # From Seller Central, named CLIENT SECRET on website.
)

Reports = ReportsV2(credentials=credentials,
                    refresh_token=credentials["refresh_token"],
                    marketplace=MARKET_PLACE)
headers = Reports.headers
print(headers)

# ===== HELPERS =====
def chunk_date_ranges(start, end, max_days=30):
    """Yield (chunk_start, chunk_end) pairs with max_days window."""
    current = start
    while current < end:
        chunk_end = min(current + timedelta(days=max_days - 1), end)
        yield current, chunk_end
        current = chunk_end + timedelta(days=1)


@throttle_retry(delay=15, tries=10)
def create_report(reportType: str, dataStartTime: date=None, dataEndTime: date=None, **kwargs):
    """Create a report and return its ID."""
    report_id = Reports.create_report(
        reportType=reportType,
        dataStartTime=dataStartTime.isoformat() if dataStartTime else None,
        dataEndTime=dataEndTime.isoformat() if dataEndTime else None,
        **kwargs
    ).payload['reportId']
    return report_id

@throttle_retry()
def get_report_document(reportDocumentId):
    """Fetch the report document."""
    return Reports.get_report_document(reportDocumentId=reportDocumentId).payload

def get_bulk_reports(report_type, start, end, max_days=30, **kwargs):
    """Fetch bulk reports in parallel (max 30-day chunks)."""
    # 1. Submit all report requests
    requests_info = []
    for s, e in chunk_date_ranges(start, end, max_days=max_days):
        print(f"Requesting report for {s} -> {e}")
        report_id = create_report(
            reportType=report_type,
            dataStartTime=s,
            dataEndTime=e,
            **kwargs
        )
        requests_info.append(dict(start=s, end=e, report_id=report_id, ready=False))
        time.sleep(50)

    # 2. Poll until all reports are ready
    while not all(r.get("ready") for r in requests_info):
        time.sleep(15)
        for r in requests_info:
            if not r["ready"]:
                status = Reports.get_report(reportId=r["report_id"]).payload
                # print(status)
                if "reportDocumentId" in status:
                    r["doc_id"] = status["reportDocumentId"]
                    r["ready"] = True
                    print(f"✅ Report ready for {r['start']} -> {r['end']}")

    # 3. Download all reports
    dfs = []
    for r in requests_info:
        report_doc = get_report_document(r["doc_id"])
        url = report_doc["url"]
        resp = requests.get(url)
        # print(url)

        if report_doc.get("compressionAlgorithm") == "GZIP":
            try:
                raw_data = gzip.decompress(resp.content).decode("utf-8")
            except:
                raw_data = gzip.decompress(resp.content).decode("latin-1")
                
        else:
            raw_data = resp.text
        try:
            df = pd.json_normalize(json.loads(raw_data)['dataByAsin'])
        except:
            df = pd.read_csv(StringIO(raw_data), sep="\t")
        dfs.append(df)

    # 4. Merge and dump
    full_df = pd.concat(dfs, ignore_index=True)
    print(f"📦 Bulk {report_type} fetched: {len(full_df)} rows across {len(dfs)} reports")
    return full_df

def get_single_report(report_type):
    """Fetch a single report (no date ranges)."""
    # 1. Create report request
    print(f"Requesting single report: {report_type}")
    report_id = create_report(reportType=report_type)

    # 2. Poll until report is ready
    while True:
        time.sleep(15)
        status = Reports.get_report(reportId=report_id).payload
        if "reportDocumentId" in status:
            doc_id = status["reportDocumentId"]
            print(f"✅ Report ready: {report_type}")
            break

    # 3. Download report
    report_doc = get_report_document(doc_id)
    url = report_doc["url"]
    resp = requests.get(url)

    if report_doc.get("compressionAlgorithm") == "GZIP":
        raw_data = gzip.decompress(resp.content).decode("utf-16")
    else:
        raw_data = resp.text

    df = pd.read_csv(StringIO(raw_data), sep="\t")
    print(f"📦 Single {report_type} fetched: {len(df)} rows")
    return df


@load_all_pages(next_token_param='NextToken')
@throttle_retry()
def load_all_orders(**kwargs):
    return Orders(credentials=credentials,
                  refresh_token=credentials['refresh_token'],
                  marketplace=MARKET_PLACE).get_orders(**kwargs)


def get_orders(start, end):
    """Fetch paginated Orders API data."""
    orders_list = []
    for page in load_all_orders(
        CreatedAfter=start.isoformat(),
        CreatedBefore=end.isoformat(),
        MaxResultsPerPage=100
    ):
        for order in page.payload.get('Orders', []):
            orders_list.append(order)

    df = pd.json_normalize(orders_list)
    df.to_excel("orders.xlsx", index=False)
    dump_to_sql(df, "AMZN_orders", date_col="PurchaseDate")
    print(f"Orders saved to orders.xlsx with {len(df)} rows.")
    return df


@throttle_retry()
def get_order_items(order_id):
    return Orders(credentials=credentials,
                  refresh_token=credentials['refresh_token'],
                  marketplace=MARKET_PLACE).get_order_items(order_id=order_id)

@throttle_retry()
def get_competitive_pricing_for_asins(asin_list):
    return Products(credentials=credentials,
                  refresh_token=credentials['refresh_token'],
                  marketplace=MARKET_PLACE).get_competitive_pricing_for_asins(asin_list=asin_list)
    
@throttle_retry()
def get_competitive_pricing_for_skus(seller_sku_list):
    return Products(credentials=credentials,
                  refresh_token=credentials['refresh_token'],
                  marketplace=MARKET_PLACE).get_competitive_pricing_for_skus(seller_sku_list=seller_sku_list)

@throttle_retry()
def get_product_fees_estimate_for_sku(seller_sku_list):
    return ProductFees(credentials=credentials,
                  refresh_token=credentials['refresh_token'],
                  marketplace=MARKET_PLACE).get_product_fees_estimate_for_sku(seller_sku_list=seller_sku_list)


def fetch_order_items(order_df):
    """Fetch order items for each order and save to SQL."""
    all_items = []
    for order_id in tqdm(order_df['AmazonOrderId'].unique(), desc="Fetching order items"):
        resp = get_order_items(order_id)
        items = resp.payload.get("OrderItems", [])
        for item in items:
            item["AmazonOrderId"] = order_id
            all_items.append(item)

    order_items_df = pd.json_normalize(all_items)
    dump_to_sql(order_items_df, "AMZN_orders_items", ids_col='OrderItemId')
    return order_items_df


@throttle_retry()
@load_all_pages(next_token_param='nextToken', use_rate_limit_header=True)
def get_inventory_summary_marketplace(**kwargs):
    return Inventories(credentials=credentials,
                       refresh_token=credentials['refresh_token'],
                       marketplace=MARKET_PLACE).get_inventory_summary_marketplace(**kwargs)
    
def getItemReviewTopics(asin):
    print(f"https://sellingpartnerapi-na.amazon.com/customerFeedback/2024-06-01/items/{asin}/reviews/topics?marketplaceId={MARKET_PLACE.value[1]}&sortBy=STAR_RATING_IMPACT")
    response = requests.get(f"https://sellingpartnerapi-na.amazon.com/customerFeedback/2024-06-01/items/{asin}/reviews/topics?marketplaceId={MARKET_PLACE.value}&sortBy=STAR_RATING_IMPACT", headers=headers)
    return response.json()


def get_inventory():
    """Fetch inventory summary (last 365 days)."""
    inventory_list = []
    for page in get_inventory_summary_marketplace(
        startDateTime=(datetime.utcnow() - timedelta(days=365)).isoformat(),
        details=True
    ):
        for item in page.payload.get('inventorySummaries', []):
            inventory_list.append(item)

    df = pd.json_normalize(inventory_list)
    df.to_excel("inventory.xlsx", index=False)
    dump_to_sql(df, "AMZN_inventory")
    print(f"Inventory saved to inventory.xlsx with {len(df)} rows.")
    return df


def process_competitive_pricing_data(df):
    """Process competitive pricing data to match Prisma schema structure."""
    
    # 1. Create main competitive pricing table with unique identifiers
    main_columns = [
        'SellerSKU', 'status',
        'Product.Identifiers.SKUIdentifier.MarketplaceId',
        'Product.Identifiers.SKUIdentifier.SellerId',
        'Product.Identifiers.SKUIdentifier.SellerSKU',
        'Product.Identifiers.MarketplaceASIN.MarketplaceId',
        'Product.Identifiers.MarketplaceASIN.ASIN'
    ]
    
    # Filter to only include columns that exist in the dataframe
    available_main_columns = [col for col in main_columns if col in df.columns]
    competitive_pricing_main = df[available_main_columns].copy()
    
    # Add created_at timestamp
    competitive_pricing_main['created_at'] = datetime.now()
    
    # Add a unique identifier for each row to handle foreign key relationships
    competitive_pricing_main['temp_id'] = range(len(competitive_pricing_main))
    
    # 2. Process Sales Rankings into separate table
    sales_rankings_data = []
    for idx, row in df.iterrows():
        temp_id = idx  # Use dataframe index as temporary ID
        seller_sku = row.get('SellerSKU', '')
        
        if 'Product.SalesRankings' in df.columns.to_list():
            rankings = row['Product.SalesRankings']
            if isinstance(rankings, list):
                for ranking in rankings:
                    if isinstance(ranking, dict):
                        sales_rankings_data.append({
                            'temp_id': temp_id,
                            'seller_sku': seller_sku,
                            'product_category_id': ranking.get('ProductCategoryId'),
                            'rank': ranking.get('Rank'),
                            'created_at': datetime.now()
                        })
    
    sales_rankings_df = pd.DataFrame(sales_rankings_data)
    
    # 3. Process Number of Offer Listings into separate table
    offer_listings_data = []
    for idx, row in df.iterrows():
        temp_id = idx  # Use dataframe index as temporary ID
        seller_sku = row.get('SellerSKU', '')

        if 'Product.CompetitivePricing.NumberOfOfferListings' in df.columns.to_list():
            listings = row['Product.CompetitivePricing.NumberOfOfferListings']
            if isinstance(listings, list):
                for listing in listings:
                    if isinstance(listing, dict):
                        offer_listings_data.append({
                            'temp_id': temp_id,
                            'seller_sku': seller_sku,
                            'condition': listing.get('condition'),
                            'count': listing.get('Count'),
                            'created_at': datetime.now()
                        })
    
    offer_listings_df = pd.DataFrame(offer_listings_data)
    
    # 4. Process Competitive Prices into separate table
    competitive_prices_data = []
    for idx, row in df.iterrows():
        temp_id = idx  # Use dataframe index as temporary ID
        seller_sku = row.get('SellerSKU', '')
        
        if 'Product.CompetitivePricing.CompetitivePrices' in df.columns.to_list():
            prices = row['Product.CompetitivePricing.CompetitivePrices']
            if isinstance(prices, list):
                for price in prices:
                    if isinstance(price, dict):
                        # Handle nested Price structure
                        price_info = price.get('Price', {})
                        listing_price = price_info.get('ListingPrice', {})
                        shipping_info = price_info.get('Shipping', {})
                        
                        competitive_prices_data.append({
                            'temp_id': temp_id,
                            'seller_sku': seller_sku,
                            'belongs_to_requester': price.get('belongsToRequester'),
                            'condition': price.get('condition'),
                            'fulfillment_channel': price.get('fulfillmentChannel'),
                            'offer_type': price.get('offerType'),
                            'price_amount': listing_price.get('Amount'),
                            'price_currency': listing_price.get('CurrencyCode'),
                            'shipping_amount': shipping_info.get('Amount'),
                            'shipping_currency': shipping_info.get('CurrencyCode'),
                            'subcategory': price.get('subcategory'),
                            'created_at': datetime.now()
                        })
    
    competitive_prices_df = pd.DataFrame(competitive_prices_data)
    
    return {
        'main': competitive_pricing_main,
        'sales_rankings': sales_rankings_df,
        'offer_listings': offer_listings_df,
        'competitive_prices': competitive_prices_df
    }

def save_competitive_pricing_data(processed_data, prefix=""):
    """Save processed competitive pricing data to database with proper foreign key handling."""
    
    # Save main table first and get the actual database IDs
    main_df = processed_data['main'].copy()
    
    if not main_df.empty:
        # Remove the temp_id before saving to database
        temp_ids = main_df['temp_id'].tolist()
        main_df = main_df.drop('temp_id', axis=1)
        
        # Clear existing data and save main table
        table_name = f"AMZN_competitive_pricing_main{prefix}"  # Store table name
        dump_to_sql(main_df, table_name, safe_drop=True)
        print(f"✅ Main competitive pricing data saved: {len(main_df)} records")
        
        # Get the actual database IDs after insertion
        try:
            from sqlalchemy.sql import text
            
            # Read back the inserted data with database-generated IDs
            # CRITICAL FIX: Use the correct table name with prefix
            with engine.connect() as conn:
                query = text(f'SELECT id, "SellerSKU", "created_at" FROM "{table_name}" ORDER BY "id"')
                result = conn.execute(query)
                db_rows = result.fetchall()
                
            print(f"Retrieved {len(db_rows)} records from database for ID mapping")
                
            # Create mapping from temp_id to actual database ID
            id_mapping = {}
            for i, (db_id, seller_sku, created_at) in enumerate(db_rows):
                for temp_index, temp_id in enumerate(temp_ids):
                    if temp_index == i:
                        id_mapping[temp_id] = db_id
                        break
                        
            print(f"Created ID mapping for {len(id_mapping)} records")
                            
        except Exception as e:
            print(f"Error retrieving database IDs for foreign key mapping: {e}")
            print(f"Error type: {type(e)}")
            
            # Alternative approach using pandas
            try:
                print("Trying alternative approach using pandas...")
                # CRITICAL FIX: Use the correct table name with prefix
                saved_df = pd.read_sql_table(table_name, con=engine)
                
                if len(saved_df) != len(main_df):
                    print(f"Warning: Row count mismatch. Expected {len(main_df)}, got {len(saved_df)}")
                
                # Create mapping based on order
                id_mapping = {}
                for i, row in saved_df.iterrows():
                    if i < len(temp_ids):
                        for temp_index, temp_id in enumerate(temp_ids):
                            if temp_index == i:
                                id_mapping[temp_id] = row['id']
                                break
                
                print(f"Alternative method: Created ID mapping for {len(id_mapping)} records")
                
            except Exception as e2:
                print(f"Alternative approach also failed: {e2}")
                print("Cannot proceed with child table inserts - foreign key mapping failed")
                return
    
    # Save child tables with proper foreign key references
    for table_name, df_data in [
        ("sales_rankings", processed_data['sales_rankings']),
        ("offer_listings", processed_data['offer_listings']),
        ("competitive_prices", processed_data['competitive_prices'])
    ]:
        
        if not df_data.empty:
            # Replace temp_id with actual database ID
            df_copy = df_data.copy()
            df_copy['competitive_pricing_main_id'] = df_copy['temp_id'].map(id_mapping)
            
            # Remove rows where mapping failed
            df_copy = df_copy.dropna(subset=['competitive_pricing_main_id'])
            df_copy = df_copy.drop('temp_id', axis=1)
            
            # Convert to integer type
            df_copy['competitive_pricing_main_id'] = df_copy['competitive_pricing_main_id'].astype(int)
            
            if not df_copy.empty:
                dump_to_sql(df_copy, f"AMZN_{table_name}{prefix}", safe_drop=True)
                print(f"✅ {table_name.replace('_', ' ').title()} data saved: {len(df_copy)} records")
            else:
                print(f"⚠️  No {table_name} data to save after ID mapping")
                
# ===== MAIN RUN =====
if __name__ == "__main__":
    
    df = get_bulk_reports("GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL", startDate, endDate)
    df['purchase-date'] = pd.to_datetime(df['purchase-date'])
    df['last-updated-date'] = pd.to_datetime(df['last-updated-date'])
    dump_to_sql(df, "AMZN_GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL", date_col="purchase-date")

        
    # TODO: "Product.Identifiers.MarketplaceASIN.ASIN" drop where null
    def get_competitive_prices():
        """Fetch and process competitive pricing data for SKUs and competitor ASINs."""
        # Get SKUs from existing data
        skus = pd.read_sql_table(
            "AMZN_GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL", 
            con=engine, 
            columns=['sku']
        )['sku'].unique().tolist()
        # skus = ['B07ZG5NTPJ']
        
        df = pd.DataFrame()
        print(f"Total unique SKUs to process: {len(skus)}")
        
        # Process SKUs in batches of 20
        for sku_start in range(0, len(skus), 20):
            skus_batch = skus[sku_start:sku_start+20]
            print(f"Processing batch {sku_start//20 + 1}: {len(skus_batch)} SKUs")

            try:
                # Get competitive pricing data
                req = get_competitive_pricing_for_skus(skus_batch)
                # print(req)
                batch_df = pd.json_normalize(req.payload)
                df = pd.concat([df, batch_df], ignore_index=True)
                print(f"Retrieved data for {len(batch_df)} products")            
            except Exception as e:
                print(f"Error processing batch {sku_start//20 + 1}: {str(e)}")
                continue

        if not df.empty:
            # Process the data into separate normalized tables
            processed_data = process_competitive_pricing_data(df)
            
            # Save to database following Prisma schema
            save_competitive_pricing_data(processed_data)
            
            print("\n" + "="*80)
            print("✅ COMPETITIVE PRICING DATA PROCESSING COMPLETE")
            print("="*80)
            print(f"Main table records: {len(processed_data['main'])}")
            print(f"Sales rankings records: {len(processed_data['sales_rankings'])}")
            print(f"Offer listings records: {len(processed_data['offer_listings'])}")
            print(f"Competitive prices records: {len(processed_data['competitive_prices'])}")
            print("="*80)
            
        else:
            print("❌ No competitive pricing data retrieved")


        # Get competitor ASINs from the mapping table
        try:
            competitor_mappings_df = pd.read_sql_table(
                "competitor_product_mappings", 
                con=engine,
                columns=['competitor_asin', 'our_seller_sku', 'is_active']
            )
            
            # Filter only active mappings
            active_mappings = competitor_mappings_df[competitor_mappings_df['is_active'] == True]
            competitor_asins = active_mappings['competitor_asin'].unique().tolist()
            
            print(f"Total active competitor mappings found: {len(active_mappings)}")
            print(f"Total unique competitor ASINs to process: {len(competitor_asins)}")
            
        except Exception as e:
            print(f"Warning: Could not load competitor mappings table: {str(e)}")
            print("Using fallback ASINs from existing competitive pricing data...")
            
            # Fallback: Get ASINs from existing competitive pricing data
            try:
                existing_cp_df = pd.read_sql_table(
                    "AMZN_competitive_pricing_main", 
                    con=engine,
                    columns=['Product_Identifiers_MarketplaceASIN_ASIN']
                )
                competitor_asins = existing_cp_df['Product_Identifiers_MarketplaceASIN_ASIN'].dropna().unique().tolist()[:100]  # Limit to 100 for testing
                print(f"Using {len(competitor_asins)} ASINs from existing competitive pricing data")
            except:
                print("❌ Could not load competitor ASINs. Skipping ASIN-based competitive pricing.")
                competitor_asins = []
                
        # print(competitor_asins[:10])  # Print first 10 ASINs for verification
        if competitor_asins:
            competitor_df = pd.DataFrame()
            
            # Process competitor ASINs in batches of 20 (Amazon API limit)
            for asin_start in range(0, len(competitor_asins), 20):
                asins_batch = competitor_asins[asin_start:asin_start+20]
                print(f"Processing competitor ASIN batch {asin_start//20 + 1}: {len(asins_batch)} ASINs")

                try:
                    # Get competitive pricing data for competitor ASINs
                    req = get_competitive_pricing_for_asins(asins_batch)
                    # print(f"API Response Status: {req}")
                    batch_df = pd.json_normalize(req.payload)
                    competitor_df = pd.concat([competitor_df, batch_df], ignore_index=True)
                    print(f"Retrieved competitor data for {len(batch_df)} products")
                    
                    # Add a small delay to avoid rate limiting
                    time.sleep(2)
                    
                except Exception as e:
                    print(f"Error processing competitor ASIN batch {asin_start//20 + 1}: {str(e)}")
                    continue
            
            # print(competitor_df)
            if not competitor_df.empty:
                # Process the competitor ASIN data into separate normalized tables
                competitor_processed_data = process_competitive_pricing_data(competitor_df)
                
                # Update competitor mapping table with last check timestamp
                try:
                    update_query = """
                    UPDATE competitor_product_mappings 
                    SET last_price_check = %s 
                    WHERE competitor_asin IN %s AND is_active = TRUE
                    """
                    
                    with engine.connect() as conn:
                        conn.execute(
                            update_query, 
                            (datetime.now(), tuple(competitor_asins[:len(competitor_df)]))
                        )
                        conn.commit()
                    print("✅ Updated competitor mapping timestamps")
                    
                except Exception as e:
                    print(f"Warning: Could not update mapping timestamps: {str(e)}")
                
                # Save to database following Prisma schema
                save_competitive_pricing_data(competitor_processed_data, prefix="_competitors")
                
                print("\n" + "="*80)
                print("✅ COMPETITOR ASIN-BASED COMPETITIVE PRICING DATA PROCESSING COMPLETE")
                print("="*80)
                print(f"Competitor main table records: {len(competitor_processed_data['main'])}")
                print(f"Competitor sales rankings records: {len(competitor_processed_data['sales_rankings'])}")
                print(f"Competitor offer listings records: {len(competitor_processed_data['offer_listings'])}")
                print(f"Competitor competitive prices records: {len(competitor_processed_data['competitive_prices'])}")
                print("="*80)
                
            else:
                print("❌ No competitor ASIN competitive pricing data retrieved")
        
        else:
            print("❌ No competitor ASINs found to process")
        
        print("\n" + "="*80)
        print("🎉 ALL COMPETITIVE PRICING PROCESSING COMPLETE")
        print("="*80)
        
    get_competitive_prices()
        
    
    
    # orders_df = get_orders(startDate, endDate)
    # order_items_df = fetch_order_items(orders_df)
    # inventory_df = get_inventory()

    # Order reports
    # permission error
    # df = get_bulk_reports("GET_FLAT_FILE_ORDER_REPORT_DATA_SHIPPING", startDate, endDate)
    # dump_to_sql(df, "AMZN_GET_FLAT_FILE_ORDER_REPORT_DATA_SHIPPING", date_col="purchase-date")
    
    # No Data
    # df = get_bulk_reports("GET_FLAT_FILE_PENDING_ORDERS_DATA", startDate, endDate)
    # df['purchase-date'] = pd.to_datetime(df['purchase-date'])
    # df['last-updated-date'] = pd.to_datetime(df['last-updated-date'])
    # dump_to_sql(df, "AMZN_GET_FLAT_FILE_PENDING_ORDERS_DATA")


    df = get_single_report("GET_FLAT_FILE_OPEN_LISTINGS_DATA")
    dump_to_sql(df, "AMZN_GET_FLAT_FILE_OPEN_LISTINGS_DATA")

    df = get_bulk_reports("GET_MERCHANT_LISTINGS_ALL_DATA", startDate, endDate)
    df['open-date'] = pd.to_datetime(df['open-date'])
    dump_to_sql(df, "AMZN_GET_MERCHANT_LISTINGS_ALL_DATA", date_col="open-date")



    # No Data
    # df = get_bulk_reports("GET_EASYSHIP_DOCUMENTS", startDate, endDate)
    # dump_to_sql(df, "AMZN_GET_EASYSHIP_DOCUMENTS", date_col="last-updated-date")

    df = get_bulk_reports("GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL", startDate, endDate)
    df["purchase-date"] = pd.to_datetime(df["purchase-date"])
    df["payments-date"] = pd.to_datetime(df["payments-date"])
    df["shipment-date"] = pd.to_datetime(df["shipment-date"])
    df["reporting-date"] = pd.to_datetime(df["reporting-date"])
    dump_to_sql(df, "AMZN_GET_AMAZON_FULFILLED_SHIPMENTS_DATA_GENERAL", date_col="shipment-date")
    
    df = get_bulk_reports("GET_FBA_FULFILLMENT_CUSTOMER_SHIPMENT_SALES_DATA", startDate, endDate)
    df['shipment-date'] = pd.to_datetime(df['shipment-date'])
    dump_to_sql(df, "AMZN_GET_FBA_FULFILLMENT_CUSTOMER_SHIPMENT_SALES_DATA", date_col="shipment-date")

    # 'processingStatus': 'FATAL'
    # df = get_bulk_reports("GET_FBA_FULFILLMENT_CUSTOMER_TAXES_DATA", startDate, endDate)
    # dump_to_sql(df, "AMZN_GET_FBA_FULFILLMENT_CUSTOMER_TAXES_DATA", date_col="last-updated-date")


    # Permission Required
    # df = get_bulk_reports("GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2", startDate, endDate)
    # dump_to_sql(df, "AMZN_GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2", date_col="last-updated-date")

    # Permission Required
    # df = get_bulk_reports("GET_DATE_RANGE_FINANCIAL_HOLDS_DATA", startDate, endDate)
    # dump_to_sql(df, "AMZN_GET_FBA_FULFILLMENT_CUSTOMER_TAXES_DATA", date_col="last-updated-date")
    
    
    # Permission Required
    # df = get_bulk_reports("GET_FLAT_FILE_SALES_TAX_DATA", startDate, endDate)
    # dump_to_sql(df, "AMZN_GET_FLAT_FILE_SALES_TAX_DATA", date_col="last-updated-date")



    df = get_bulk_reports("GET_BRAND_ANALYTICS_MARKET_BASKET_REPORT", startDate, endDate, max_days=7, reportOptions=dict(reportPeriod='WEEK'))
    df['startDate'] = pd.to_datetime(df['startDate'])
    df['endDate'] = pd.to_datetime(df['endDate'])
    dump_to_sql(df, "AMZN_BRAND_ANALYTICS_MARKET_BASKET_REPORT", date_col="startDate")

    brand_analytics_search_terms_report_df = get_bulk_reports("GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT", startDate, endDate)
    dump_to_sql(brand_analytics_search_terms_report_df, "AMZN_brand_analytics_search_terms_report", date_col="last-updated-date")

    brand_analytics_repeat_purchase_report_df = get_bulk_reports("GET_BRAND_ANALYTICS_REPEAT_PURCHASE_REPORT", startDate, endDate)
    dump_to_sql(brand_analytics_repeat_purchase_report_df, "AMZN_brand_analytics_repeat_purchase_report", date_col="last-updated-date")
