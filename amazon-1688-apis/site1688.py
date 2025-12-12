from datetime import date, datetime, timedelta, timezone
import os
import time

import pandas as pd
from sqlalchemy import text
from config import dump_to_sql, engine
from utils import multithreaded, multithreaded_ids, paginate, call_api
from dotenv import load_dotenv

# ===== DATE RANGE =====
startDate = (datetime.now(timezone.utc) - timedelta(days=730)).astimezone()
# startDate = datetime(2025, 10, 1, 0, 0, 0, 0, tzinfo=startDate.tzinfo)
endDate = datetime.now(timezone.utc).astimezone()

# Format: YYYYMMDDHHMMSSmmm+ZZZZ
formattedStartDate = startDate.strftime("%Y%m%d%H%M%S") + f"{startDate.microsecond//1000:03d}" + startDate.strftime("%z")
formattedEndDate = endDate.strftime("%Y%m%d%H%M%S") + f"{endDate.microsecond//1000:03d}" + endDate.strftime("%z")

load_dotenv()

# ===== CONFIG =====
APP_KEY = os.getenv('APP_KEY')
APP_SECRET = os.getenv('APP_SECRET')
MAX_LIMIT = os.getenv('MAX_LIMIT', None)
if MAX_LIMIT is not None:
    MAX_LIMIT = int(MAX_LIMIT)
MAX_WORKERS = int(os.getenv('MAX_WORKERS', 5))

# ===== EXAMPLE: ORDERS API =====
@multithreaded
def get_orders(access_token, **kwargs):
    return call_api(access_token, "com.alibaba.trade/alibaba.trade.getBuyerOrderList", **kwargs)

@multithreaded
def get_refunded_orders(access_token, **kwargs):
    return call_api(access_token, "com.alibaba.trade/alibaba.trade.refund.buyer.queryOrderRefundList", **kwargs)

@multithreaded
def get_product_list(access_token, **kwargs):
    return call_api(access_token, "com.alibaba.product/alibaba.product.list.get", **kwargs)

@multithreaded_ids
def get_logistics_info(access_token, **kwargs):
    return call_api(access_token, "com.alibaba.logistics/alibaba.trade.ec.getLogisticsInfos.sellerView", **kwargs)




# ===== MAIN =====
if __name__ == "__main__":
    token = "8286faea-4325-46b5-81c1-dd6c584e7116"

    # Get orders
    df = get_orders(token, pageSize=50, createStartTime=formattedStartDate, createEndTime=formattedEndDate)

    df['tradeTerms'] = df['tradeTerms'].apply(lambda x: x[0] if isinstance(x, list) and len(x) > 0 else {})
    df = df.explode("productItems").reset_index(drop=True)
    df = pd.json_normalize(df.to_dict(orient="records"))
    for col in ["baseInfo.createTime", "baseInfo.modifyTime", "baseInfo.payTime", "baseInfo.allDeliveredTime", "baseInfo.completeTime"]:
        try:
            df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")
        except:
            pass
    
    dump_to_sql(df, "1688_orders_cn", startDate=startDate.date(), endDate=endDate.date(), date_col="baseInfo.createTime")
    print(f"[INFO] Inserted {len(df)} rows into Postgres → 1688_orders table")

    # # Get logistics info
    # query = text("""
    #     SELECT "baseInfo.id"
    #     FROM "1688_orders_cn"
    #     WHERE "baseInfo.createTime" BETWEEN :start_date AND :end_date
    # """)

    # ids = pd.read_sql(query, engine, params={
    #     "start_date": startDate.date().isoformat(),
    #     "end_date": endDate.date().isoformat()
    # })["baseInfo.id"].tolist()
    # print(f"[INFO] Found {len(ids)} order IDs to fetch logistics info")
    # print(ids)
    # df = get_logistics_info(token, ids=ids, website="1688")

    # # df['tradeTerms'] = df['tradeTerms'].apply(lambda x: x[0] if isinstance(x, list) and len(x) > 0 else {})
    # # df = df.explode("productItems").reset_index(drop=True)
    # df = pd.json_normalize(df.to_dict(orient="records"))
    # # for col in ["baseInfo.createTime", "baseInfo.modifyTime", "baseInfo.payTime", "baseInfo.allDeliveredTime", "baseInfo.completeTime"]:
    #     # df[col] = pd.to_datetime(df[col], format='%Y%m%d%H%M%S%f%z')
    
    # dump_to_sql(df, "1688_logistics_info_cn", ids_col="logisticsId")
    # print(f"[INFO] Inserted {len(df)} rows into Postgres → 1688_orders table")



    # df = get_product_list(token)
    # df = pd.json_normalize(df.to_dict(orient="records"))
    # dump_to_sql(df, "1688_product_list", ids_col="productID")
    # print(f"[INFO] Inserted {len(df)} rows into Postgres → 1688_product_list table")



    # Get refunded orders
    df = get_refunded_orders(token, pageSize=50, applyStartTime=formattedStartDate, applyEndTime=formattedEndDate)
    df = pd.json_normalize(df.to_dict(orient="records"))
    for col in ["gmtApply", "gmtCompleted", "gmtCreate", "gmtModified", "gmtTimeOut"]:
        df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")

    dump_to_sql(df, "1688_refunded_orders_cn", startDate=startDate.date(), endDate=endDate.date(), date_col="gmtCreate")