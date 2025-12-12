import time
from deep_translator import GoogleTranslator
from config import dump_to_sql, engine
import pandas as pd

# Reusable translator
translator = GoogleTranslator(source='zh-CN', target='en')

# Function to translate unique values in one column
def translate_column(df: pd.DataFrame, col: str) -> pd.DataFrame:
    if col not in df.columns:
        return df

    # Extract unique non-null values
    unique_vals = df[col].dropna().unique()
    translation_map = {}

    for val in unique_vals:
        try:
            translation_map[val] = translator.translate(val)
        except Exception as e:
            translation_map[val] = f"Error: {e}"

    # Map back to DataFrame
    df[col] = df[col].map(translation_map).fillna(df[col])
    print(f"[INFO] Translated {col} column to English (unique={len(unique_vals)})")
    return df

# Function to handle multiple columns
def translate_multiple_cols(df: pd.DataFrame, cols: list) -> pd.DataFrame:
    for col in cols:
        df = translate_column(df, col)
    return df

# === Orders table ===
df = pd.read_sql_table("1688_orders_cn", engine)
for col in ["baseInfo.createTime", "baseInfo.modifyTime", "baseInfo.payTime", "baseInfo.allDeliveredTime", "baseInfo.completeTime"]:
    df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")
df = translate_multiple_cols(df, [
    "tradeTerms.phase",
    "tradeTerms.payStatusDesc",
    "nativeLogistics.area",
    "nativeLogistics.address",
    "nativeLogistics.town",
    "nativeLogistics.city",
    "nativeLogistics.contactPerson",
    "nativeLogistics.province",
    "baseInfo.buyerContact.name",
    "baseInfo.buyerContact.companyName",
    "baseInfo.sellerContact.imInPlatform",
    "baseInfo.sellerContact.name",
    "baseInfo.sellerContact.companyName",
    "baseInfo.receiverInfo.toFullName",
    "baseInfo.receiverInfo.toArea",
    "baseInfo.buyerLoginId",
    "orderBizInfo.creditOrderDetail.statusStr",
    "productItems.name",
    "productItems.unit",
    "productItems.guaranteesTerms",
    "productItems.productCargoNumber",
    "productItems.skuInfos",
    "productItems.statusStr",
    "productItems.cargoNumber",
    "baseInfo.remark"
])
dump_to_sql(df, "1688_orders_en")

# === Refunded Orders table ===
df = pd.read_sql_table("1688_refunded_orders_cn", engine)
for col in ["gmtApply", "gmtCompleted", "gmtCreate", "gmtModified", "gmtTimeOut"]:
    df[col] = pd.to_datetime(df[col], utc=True, errors="coerce")
df = translate_multiple_cols(df, [
    "applyReason",
    "productName",
    "extInfo.apply_reason_text",
    "extInfo.sellerDoRefundNick",
    "extInfo.refuse_reason_txt",
    "extInfo.refuse_reason_msg"
])
dump_to_sql(df, "1688_refunded_orders_en", safe_drop=True)