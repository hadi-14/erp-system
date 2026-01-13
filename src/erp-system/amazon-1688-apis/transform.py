import ast
import json
from config import dump_to_sql, engine
import pandas as pd

# Read from source table
df = pd.read_sql_table("1688_order_list_en", engine, columns=["baseInfo.id", "approved?"])
ids_approved = df[df["approved?"] == True]["baseInfo.id"].tolist()
# ids_approved = []
df = pd.read_sql_table("1688_orders_en", engine)

# List of order-related columns
order_cols = [
    "orderRateInfo.sellerRateStatus",
    "orderRateInfo.buyerRateStatus",
    "tradeTerms.phase",
    "tradeTerms.payWayDesc",
    "tradeTerms.expressPay",
    "tradeTerms.payTime",
    "tradeTerms.payStatusDesc",
    "tradeTerms.payWay",
    "tradeTerms.cardPay",
    "tradeTerms.payStatus",
    "tradeTerms.phasAmount",
    "nativeLogistics.zip",
    "nativeLogistics.area",
    "nativeLogistics.address",
    "nativeLogistics.town",
    "nativeLogistics.city",
    "nativeLogistics.townCode",
    "nativeLogistics.contactPerson",
    "nativeLogistics.areaCode",
    "nativeLogistics.province",
    "nativeLogistics.privacyProtection",
    "baseInfo.businessType",
    "baseInfo.buyerID",
    "baseInfo.createTime",
    "baseInfo.id",  # unique order id
    "baseInfo.modifyTime",
    "baseInfo.payTime",
    "baseInfo.refund",
    "baseInfo.sellerID",
    "baseInfo.shippingFee",
    "baseInfo.status",
    "baseInfo.totalAmount",
    "baseInfo.discount",
    "baseInfo.buyerContact.phone",
    "baseInfo.buyerContact.email",
    "baseInfo.buyerContact.imInPlatform",
    "baseInfo.buyerContact.name",
    "baseInfo.buyerContact.companyName",
    "baseInfo.sellerContact.phone",
    "baseInfo.sellerContact.imInPlatform",
    "baseInfo.sellerContact.name",
    "baseInfo.sellerContact.mobile",
    "baseInfo.sellerContact.companyName",
    "baseInfo.sellerContact.email",
    "baseInfo.tradeType",
    "baseInfo.refundPayment",
    "baseInfo.idOfStr",
    "baseInfo.alipayTradeId",
    "baseInfo.receiverInfo.toDivisionCode",
    "baseInfo.receiverInfo.toTownCode",
    "baseInfo.receiverInfo.toFullName",
    "baseInfo.receiverInfo.toArea",
    "baseInfo.receiverInfo.toPost",
    "baseInfo.buyerLoginId",
    "baseInfo.sellerLoginId",
    "baseInfo.buyerUserId",
    "baseInfo.sellerUserId",
    "baseInfo.buyerAlipayId",
    "baseInfo.sellerAlipayId",
    "baseInfo.sumProductPayment",
    "baseInfo.stepPayAll",
    "baseInfo.overSeaOrder",
    "baseInfo.allDeliveredTime",
    "baseInfo.completeTime",
    "baseInfo.closeReason",
    "baseInfo.remark",
    "baseInfo.buyerFeedback",
    "orderBizInfo.odsCyd",
    "orderBizInfo.creditOrder",
    "orderBizInfo.creditOrderDetail.payAmount",
    "orderBizInfo.creditOrderDetail.createTime",
    "orderBizInfo.creditOrderDetail.status",
    "orderBizInfo.creditOrderDetail.statusStr",
    "orderBizInfo.creditOrderDetail.restRepayAmount",
    "orderBizInfo.dropshipping",
    "orderBizInfo.shippingInsurance",
    "orderBizInfo.fz",
    "orderBizInfo.tgOfficialPickUp",
]

# Product-related columns
product_cols = [
    "productItems.itemAmount",
    "productItems.name",
    "productItems.price",
    "productItems.productID",
    "productItems.productImgUrl",
    "productItems.productSnapshotUrl",
    "productItems.quantity",
    "productItems.refund",
    "productItems.skuID",
    "productItems.status",
    "productItems.subItemID",
    "productItems.type",
    "productItems.unit",
    "productItems.guaranteesTerms",
    "productItems.productCargoNumber",
    "productItems.skuInfos",
    "productItems.entryDiscount",
    "productItems.specId",
    "productItems.quantityFactor",
    "productItems.statusStr",
    "productItems.sharePostage",
    "productItems.cargoNumber",
]

# Process Orders Table
# Keep only order columns
orders_df = df[order_cols]
orders_df = orders_df.drop_duplicates(subset=["baseInfo.id"])
orders_df.reset_index(drop=True, inplace=True)
orders_df['approved?'] = orders_df["baseInfo.id"].isin(ids_approved)
dump_to_sql(orders_df, "1688_order_list_en", safe_drop=True)

# Process Products Table
# Extract unique products from product items
products_df = df[product_cols].copy()
# Remove rows where productID is null
products_df = products_df.dropna(subset=["productItems.productID"])
# Keep only unique products based on productID
products_df = products_df.drop_duplicates(subset=["productItems.productID"])
products_df.reset_index(drop=True, inplace=True)
products_df['productItems.productImgUrl'] = products_df['productItems.productImgUrl'].apply(lambda x: ast.literal_eval(x)[0] if isinstance(x, str) and x.startswith('[') else x)


# Rename columns to match the product_list_en schema
products_df = products_df.rename(columns={
    "productItems.productID": "productID",
    "productItems.name": "name", 
    "productItems.price": "price",
    "productItems.productImgUrl": "productImgUrl",
    "productItems.productSnapshotUrl": "productSnapshotUrl",
    "productItems.unit": "unit"
})

# Keep only the columns that exist in product_list_en
product_list_cols = ["productID", "name", "price", "productImgUrl", "productSnapshotUrl", "unit"]
products_final_df = products_df[product_list_cols]

# Dump products to the database
dump_to_sql(products_final_df, "1688_product_list_en", safe_drop=True)

# Process Orders by Products Table (Junction table)
# Create one record per order-product combination
orders_products_list = []


# Keep only unique products based on productID
df = df.drop_duplicates(subset=["baseInfo.id", "productItems.productID"])
df.reset_index(drop=True, inplace=True)

for idx, row in df.iterrows():
    # Get order data
    order_data = {}
    for col in order_cols:
        if col in df.columns:
            order_data[col] = row[col]
    
    # Add product data
    product_data = {}
    for col in product_cols:
        if col in df.columns:
            product_data[col] = row[col]
    
    # Only create record if productID exists
    if pd.notna(product_data.get("productItems.productID")):
        # Combine order and product data
        combined_data = {**order_data, **product_data}
        combined_data['approved?'] = row["baseInfo.id"] in ids_approved if pd.notna(row.get("baseInfo.id")) else False
        orders_products_list.append(combined_data)


# Create DataFrame for orders_by_products
if orders_products_list:
    orders_by_products_df = pd.DataFrame(orders_products_list)
    dump_to_sql(orders_by_products_df, "1688_orders_by_products", safe_drop=True)
    print(f"Created {len(orders_by_products_df)} order-product records")

print("Processing completed:")
print(f"- Orders: {len(orders_df)} unique orders")
print(f"- Products: {len(products_final_df)} unique products") 
if orders_products_list:
    print(f"- Order-Product relationships: {len(orders_by_products_df)} records")
    
    
# === 1688 ===
df = pd.read_sql_table("1688_orders_en", engine)
product_cols = [
    "productItems.productID",
    "productItems.name",
    "productItems.price",
    "productItems.productImgUrl",
    "productItems.productSnapshotUrl",
    "productItems.unit",
]

products_df = df[product_cols]
products_df = products_df.drop_duplicates()
products_df = products_df.drop_duplicates(subset=["productItems.productID"])
products_df['productItems.productImgUrl'] = products_df['productItems.productImgUrl'].apply(lambda x: ast.literal_eval(x)[0] if isinstance(x, str) and x.startswith('[') else x)
products_df.reset_index(drop=True, inplace=True)
products_df.columns = [col.replace("productItems.", "") for col in products_df.columns]
dump_to_sql(products_df, "1688_product_list_en", safe_drop=True)


# === Amazon ===
df = pd.read_sql_table("AMZN_GET_MERCHANT_LISTINGS_ALL_DATA", engine)
# Select product-related columns
product_cols = [
    "listing-id",
    "item-name",
    "item-description",
    "seller-sku",
    "price",
    "quantity",
    "open-date",
    "image-url",
    "item-is-marketplace",
    "product-id",
    "product-id-type",
    "asin1",
    "asin2",
    "asin3",
    "item-condition",
    "zshop-category1",
    "zshop-browse-path",
    "zshop-storefront-feature",
    "will-ship-internationally",
    "expedited-shipping",
    "fulfillment-channel",
    "status"
]


products_df = df[product_cols]
products_df = products_df.drop_duplicates()
products_df = products_df.drop_duplicates(subset=["listing-id"])
products_df.reset_index(drop=True, inplace=True)
dump_to_sql(products_df, "AMZN_PRODUCT_LIST", safe_drop=True)