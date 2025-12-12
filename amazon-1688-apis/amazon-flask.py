from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import json
from datetime import datetime
import time
from sp_api.api import Products
from sp_api.api import ProductFees
from sp_api.base import Marketplaces
from sp_api.util import throttle_retry
from config import dump_to_sql, engine
from sqlalchemy.sql import text

app = Flask(__name__)

# Enable CORS for all routes
CORS(app, origins=['http://localhost:3000', 'http://127.0.0.1:3000', 'http://212.85.24.65:3000', 'https://eazeway.com'])

# Your existing credentials
credentials = dict(
    refresh_token='Atzr|IwEBILSY6X3bz4DRP_mW3kh8RZ_T5c-RAypa4QY1BiI3Z99VKiCuj5OZUYYCS2ZwTaOY6FscVdNqxZrSbxxis5vyfulPeQ_sU1_844L0r6AsZOScbDaOKHTb-bny3FzNylJ6d4jJATfJ_Lne_WS_HgecmG3YTWpD6TNMab0xwPPrAOBBK-3KkLVN0DPy0sIuGvwGoudzl4KtbhC5zmJlDMvxdFj6Vd-jAn2frjqbRLDzZjgpOyfVzYFNwlsSCbY8lSTY_G_BAna5JpvsiregQzHi7qcW1UPGmUYqYKwr8j150A1bpfvsKgLJIbUxegeTWYPtZB0egJhC1khwfcwuMwvvfhto',
    lwa_app_id='amzn1.application-oa2-client.272ba9bb3ac845b9b41972cb1b47e977',
    lwa_client_secret='amzn1.oa2-cs.v1.2b9a7d96ec4321332017df23909c32445c2cb8115b2a8ef528b562ee95dcadbd',
)

MARKET_PLACE = Marketplaces.AE

product_fees = ProductFees(credentials=credentials,
            refresh_token=credentials['refresh_token'],
            marketplace=MARKET_PLACE)

@throttle_retry()
def get_competitive_pricing_for_asins(asin_list):
    return Products(credentials=credentials,
                  refresh_token=credentials['refresh_token'],
                  marketplace=MARKET_PLACE).get_competitive_pricing_for_asins(asin_list=asin_list)

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

def save_competitive_pricing_data(processed_data, prefix="", identifier="api_call"):
    """Save processed competitive pricing data to database with proper foreign key handling."""
    
    # Save main table first and get the actual database IDs
    main_df = processed_data['main'].copy()
    
    if not main_df.empty:
        # Store the temp_id mapping before removing it
        temp_ids = main_df['temp_id'].tolist()
        
        # Remove the temp_id before saving to database
        main_df_save = main_df.drop('temp_id', axis=1)
        
        # Save main table
        dump_to_sql(main_df_save, f"AMZN_competitive_pricing_main_competitors{prefix}", append=True)
        print(f"✅ Main competitive pricing data saved for {identifier}: {len(main_df_save)} records")
        
        # Get the actual database IDs after insertion
        try:
            # Read back the inserted data with database-generated IDs
            # Use a more specific query to get only the recently inserted records
            with engine.connect() as conn:
                query = text(f"""
                    SELECT id, "SellerSKU", "created_at" 
                    FROM "AMZN_competitive_pricing_main_competitors{prefix}" 
                    WHERE "created_at" >= :created_after 
                    ORDER BY id DESC 
                    LIMIT :limit_count
                """)
                result = conn.execute(query, {
                    'created_after': datetime.now().replace(minute=0, second=0, microsecond=0), 
                    'limit_count': len(main_df_save)
                })
                db_rows = result.fetchall()
                
            print(f"Retrieved {len(db_rows)} records from database for ID mapping")
                
            # Create mapping from temp_id to actual database ID
            # Reverse the order since we got them in DESC order
            db_rows = list(reversed(db_rows))
            id_mapping = {}
            
            for i, (db_id, seller_sku, created_at) in enumerate(db_rows):
                # Find temp_id that maps to this index
                for temp_index, temp_id in enumerate(temp_ids):
                    if temp_index == i:
                        id_mapping[temp_id] = db_id
                        break
                        
            print(f"Created ID mapping for {len(id_mapping)} records")
                            
        except Exception as e:
            print(f"Error retrieving database IDs for foreign key mapping: {e}")
            print(f"Error type: {type(e)}")
            
            # Alternative approach: Use a different method to get IDs
            try:
                print("Trying alternative approach using pandas...")
                # Read the table back using pandas with recent timestamp filter
                query = f"""
                    SELECT * FROM "AMZN_competitive_pricing_main_competitors{prefix}" 
                    WHERE "created_at" >= '{datetime.now().replace(minute=0, second=0, microsecond=0).isoformat()}'
                    ORDER BY id DESC 
                    LIMIT {len(main_df_save)}
                """
                saved_df = pd.read_sql(query, con=engine)
                
                if len(saved_df) != len(main_df_save):
                    print(f"Warning: Row count mismatch. Expected {len(main_df_save)}, got {len(saved_df)}")
                
                # Reverse order to match insertion order
                saved_df = saved_df.iloc[::-1].reset_index(drop=True)
                
                # Create mapping based on order (assuming same insertion order)
                id_mapping = {}
                for i, row in saved_df.iterrows():
                    if i < len(temp_ids):
                        # Find the temp_id that corresponds to this position
                        for temp_index, temp_id in enumerate(temp_ids):
                            if temp_index == i:
                                id_mapping[temp_id] = row['id']
                                break
                
                print(f"Alternative method: Created ID mapping for {len(id_mapping)} records")
                
            except Exception as e2:
                print(f"Alternative approach also failed: {e2}")
                print("Cannot proceed with child table inserts - foreign key mapping failed")
                return False
    
    else:
        print("No main table data to save")
        return True
    
    # Save child tables with proper foreign key references
    success_count = 0
    total_tables = 3
    
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
                try:
                    dump_to_sql(df_copy, f"AMZN_{table_name}_competitors{prefix}", append=True)
                    print(f"✅ {table_name.replace('_', ' ').title()} data saved for {identifier}: {len(df_copy)} records")
                    success_count += 1
                except Exception as e:
                    print(f"❌ Error saving {table_name} for {identifier}: {str(e)}")
            else:
                print(f"⚠️  No {table_name} data to save after ID mapping for {identifier}")
                success_count += 1  # Count as success since no data is not an error
        else:
            print(f"No {table_name} data for {identifier}")
            success_count += 1  # Count as success since no data is not an error
    
    # Return True if main table and all child tables were processed successfully
    return success_count == total_tables

@app.route('/api/get-price-estimation', methods=['GET'])
def get_price_estimation():    
    asin = request.args.get('asin')
    price = request.args.get('price')
    currency = request.args.get('currency')
    # print(f"Getting price estimation for ASIN: {asin}, Price: {price}, Currency: {currency}")

    estimate = product_fees.get_product_fees_estimate_for_asin(asin=asin, price=price, currency=currency)

    return jsonify({
        'success': True,
        'data': estimate.payload
    })
    
# Match the route that your frontend is calling
@app.route('/api/fetch-competitor-data', methods=['POST', 'OPTIONS'])
def fetch_competitor_data():
    """
    Flask endpoint to fetch competitive pricing data for a specific ASIN
    and save it to the database.
    
    Expected JSON payload:
    {
        "asin": "B07ZG5NTPJ",
        "mapping_id": 123  # Optional: ID of the competitor mapping that triggered this
    }
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
        
    try:
        # Get data from request - handle different content types
        if request.content_type == 'application/json':
            data = request.get_json()
        else:
            # Try to get JSON data anyway (some clients don't set content-type correctly)
            try:
                data = request.get_json(force=True)
            except Exception as json_error:
                return jsonify({
                    'success': False, 
                    'message': f'Invalid JSON data or missing Content-Type header. Received Content-Type: {request.content_type}'
                }), 400
        
        if not data or 'asin' not in data:
            return jsonify({
                'success': False, 
                'message': 'ASIN is required'
            }), 400
        
        asin = data['asin'].strip()
        mapping_id = data.get('mapping_id')
        
        # Validate ASIN format (basic validation)
        if not asin or len(asin) != 10:
            return jsonify({
                'success': False, 
                'message': 'Invalid ASIN format'
            }), 400
        
        print(f"Fetching competitive pricing data for ASIN: {asin}")
        
        # Fetch competitive pricing data from Amazon API
        response = get_competitive_pricing_for_asins([asin])
        
        if not response or not response.payload:
            return jsonify({
                'success': False, 
                'message': 'No data received from Amazon API'
            }), 500
        
        # Convert to DataFrame
        df = pd.json_normalize(response.payload)
        
        if df.empty:
            print(f"No competitive pricing data found for ASIN: {asin}")
            return jsonify({
                'success': True, 
                'message': f'No competitive pricing data available for ASIN {asin}',
                'data_fetched': False
            }), 200
        
        # Process the data into normalized tables
        processed_data = process_competitive_pricing_data(df)
        
        # Save to database
        success = save_competitive_pricing_data(processed_data, identifier=f"ASIN_{asin}")
        
        if success:
            # Update the competitor mapping table with last check timestamp if mapping_id provided
            if mapping_id:
                try:
                    with engine.connect() as conn:
                        query = text("""
                            UPDATE competitor_product_mappings 
                            SET last_price_check = :timestamp 
                            WHERE id = :mapping_id
                        """)
                        conn.execute(query, {'timestamp': datetime.now(), 'mapping_id': mapping_id})
                        conn.commit()
                    print(f"Updated mapping {mapping_id} with last check timestamp")
                    
                except Exception as e:
                    print(f"Warning: Could not update mapping timestamp: {str(e)}")
            
            return jsonify({
                'success': True,
                'message': f'Competitive pricing data successfully fetched and saved for ASIN {asin}',
                'data_fetched': True,
                'records_saved': {
                    'main': len(processed_data['main']),
                    'sales_rankings': len(processed_data['sales_rankings']),
                    'offer_listings': len(processed_data['offer_listings']),
                    'competitive_prices': len(processed_data['competitive_prices'])
                }
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': f'Failed to save competitive pricing data for ASIN {asin}'
            }), 500
            
    except Exception as e:
        print(f"Error in fetch_competitor_data endpoint: {str(e)}")
        return jsonify({
            'success': False, 
            'message': f'Internal server error: {str(e)}'
        }), 500

@app.route('/api/fetch-multiple-competitor-data', methods=['POST', 'OPTIONS'])
def fetch_multiple_competitor_data():
    """
    Flask endpoint to fetch competitive pricing data for multiple ASINs
    and save them to the database. Processes up to 20 ASINs at once (Amazon API limit).
    
    Expected JSON payload:
    {
        "asins": ["B07ZG5NTPJ", "B08XYZ1234", ...],
        "source": "bulk_update"  # Optional: source identifier
    }
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
        
    try:
        # Get data from request - handle different content types
        if request.content_type == 'application/json':
            data = request.get_json()
        else:
            # Try to get JSON data anyway (some clients don't set content-type correctly)
            try:
                data = request.get_json(force=True)
            except Exception as json_error:
                return jsonify({
                    'success': False, 
                    'message': f'Invalid JSON data or missing Content-Type header. Received Content-Type: {request.content_type}'
                }), 400
        
        if not data or 'asins' not in data or not isinstance(data['asins'], list):
            return jsonify({
                'success': False, 
                'message': 'ASINs list is required'
            }), 400
        
        asins = [asin.strip() for asin in data['asins'] if asin and len(asin.strip()) == 10]
        source = data.get('source', 'api_call')
        
        if not asins:
            return jsonify({
                'success': False, 
                'message': 'No valid ASINs provided'
            }), 400
        
        # Limit to 20 ASINs per request (Amazon API limitation)
        if len(asins) > 20:
            asins = asins[:20]
            print(f"Limited request to first 20 ASINs")
        
        print(f"Fetching competitive pricing data for {len(asins)} ASINs")
        
        # Fetch competitive pricing data from Amazon API
        response = get_competitive_pricing_for_asins(asins)
        
        if not response or not response.payload:
            return jsonify({
                'success': False, 
                'message': 'No data received from Amazon API'
            }), 500
        
        # Convert to DataFrame
        df = pd.json_normalize(response.payload)
        
        if df.empty:
            return jsonify({
                'success': True, 
                'message': f'No competitive pricing data available for provided ASINs',
                'data_fetched': False
            }), 200
        
        # Process the data into normalized tables
        processed_data = process_competitive_pricing_data(df)
        
        # Add source information to main table
        if not processed_data['main'].empty:
            processed_data['main']['data_source'] = source
        
        # Save to database with bulk suffix
        success = save_competitive_pricing_data(processed_data, identifier=f"bulk_{len(asins)}_asins_{source}")
        
        if success:
            return jsonify({
                'success': True,
                'message': f'Competitive pricing data successfully fetched and saved for {len(asins)} ASINs',
                'data_fetched': True,
                'asins_processed': len(asins),
                'records_saved': {
                    'main': len(processed_data['main']),
                    'sales_rankings': len(processed_data['sales_rankings']),
                    'offer_listings': len(processed_data['offer_listings']),
                    'competitive_prices': len(processed_data['competitive_prices'])
                }
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': f'Failed to save competitive pricing data'
            }), 500
            
    except Exception as e:
        print(f"Error in fetch_multiple_competitor_data endpoint: {str(e)}")
        return jsonify({
            'success': False, 
            'message': f'Internal server error: {str(e)}'
        }), 500

# Add a test endpoint
@app.route('/api/test', methods=['GET'])
def test():
    return jsonify({
        'success': True,
        'message': 'Flask API is working!',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    # Install flask-cors if not already installed: pip install flask-cors
    app.run(debug=True, host='0.0.0.0', port=5000)