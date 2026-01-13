import os
import time
import pandas as pd
import requests
import hashlib
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
import hmac
from dotenv import load_dotenv

load_dotenv()

# ===== CONFIG =====
APP_KEY = os.getenv('APP_KEY')
APP_SECRET = os.getenv('APP_SECRET')
MAX_LIMIT = os.getenv('MAX_LIMIT', None)
if MAX_LIMIT is not None:
    MAX_LIMIT = int(MAX_LIMIT)
MAX_WORKERS = int(os.getenv('MAX_WORKERS', 5))

# ===== SIGNATURE =====
def generate_signature(params, secret, url):
    """Generate request signature"""
    sorted_params = sorted(params.items(), key=lambda x: x[0])
    concatenated = "".join(f"{k}{v}" for k, v in sorted_params)
    sign_str = url + concatenated
    h = hmac.new(secret.encode("utf-8"), sign_str.encode("utf-8"), hashlib.sha1)
    return h.hexdigest().upper()

# ===== UNIVERSAL API CALLER =====
def call_api(access_token: str, api_name: str, version: str = "1", retries: int = 3, **kwargs):
    """
    General function to call any 1688 API with retries.
    Example: call_api(token, "com.alibaba.trade/alibaba.trade.getBuyerOrderList", pageNo=1, pageSize=50)
    """
    base_path = f"param2/{version}/{api_name}/{APP_KEY}"
    base_url = f"https://gw.open.1688.com/openapi/{base_path}"

    params = {"access_token": access_token, **kwargs}
    params["_aop_signature"] = generate_signature(params, APP_SECRET, base_path)

    for attempt in range(1, retries + 1):
        try:
            res = requests.get(base_url, params=params, timeout=15)
            res.raise_for_status()
            return res.json()
        except Exception as e:
            if attempt < retries:
                wait = 2 ** attempt  # exponential backoff
                print(f"API call failed (attempt {attempt}), retrying in {wait}s... Error: {e}")
                time.sleep(wait)
            else:
                print(f"API call failed after {retries} attempts. Error: {e}")
                raise

# ===== PAGINATION WRAPPER =====
def paginate(api_func):
    """Sequential pagination wrapper"""
    def wrapper(*args, **kwargs):
        page = kwargs.get("pageNo", 1)
        page_size = kwargs.get("pageSize", 50)
        all_results, total_record, pbar = [], None, None

        while True:
            kwargs.update({"pageNo": page, "pageSize": page_size})
            data = api_func(*args, **kwargs)
            records = data.get("result", {})

            if not records:
                break

            if total_record is None:
                total_record = min(data["totalRecord"], MAX_LIMIT) if MAX_LIMIT else data["totalRecord"]
                pbar = tqdm(total=total_record, desc="[INFO] Sequential Fetching", unit="items")

            all_results.extend(records)
            pbar.update(len(records))

            if len(all_results) >= total_record:
                break
            page += 1

        if pbar: pbar.close()
        return pd.DataFrame(all_results[:total_record])
    return wrapper

# ===== MULTITHREADING WRAPPER =====
def multithreaded(api_func):
    """Concurrent pagination wrapper"""
    def wrapper(*args, **kwargs):
        access_token = args[0] if args else kwargs.get("access_token")
        page_size = kwargs.get("pageSize", 50)

        # Remove pageSize from kwargs to avoid duplicate
        kwargs_no_pagesize = dict(kwargs)
        kwargs_no_pagesize.pop("pageSize", None)

        # First call for total count
        first_call = api_func(access_token, pageNo=1, pageSize=page_size, **kwargs_no_pagesize)
        total_record = min(first_call.get("totalRecord", first_call['result'].get("totalCount") if isinstance(first_call['result'], dict) else 0), MAX_LIMIT) if MAX_LIMIT else first_call.get("totalRecord", first_call['result'].get("totalCount") if isinstance(first_call['result'], dict) else 0)
        total_pages = (total_record + page_size - 1) // page_size

        all_results = []
        pbar = tqdm(total=total_record, desc="[INFO] Multi-thread Fetching", unit="items")

        def fetch_page(page):
            return api_func(access_token, pageNo=page, pageSize=page_size, **kwargs_no_pagesize)

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = [executor.submit(fetch_page, page) for page in range(1, total_pages + 1)]
            for future in as_completed(futures):
                data = future.result()
                records = data.get("result", {})
                records = records if isinstance(records, list) else records.get("opOrderRefundModels", [])
                all_results.extend(records)
                pbar.update(len(records))

        pbar.close()
        return pd.DataFrame(all_results[:total_record])
    return wrapper


def multithreaded_ids(api_func):
    """Concurrent pagination wrapper for ID-based APIs"""
    def wrapper(*args, **kwargs):
        access_token = args[0] if args else kwargs.get("access_token")
        ids = kwargs.get("ids", [])

        all_results = []
        pbar = tqdm(total=len(ids), desc="[INFO] Multi-thread Fetching by IDs", unit="items")
        kwargs.pop("ids", None)

        def fetch_id(id_):
            return api_func(access_token, orderId=id_, **kwargs)

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(fetch_id, id_): id_ for id_ in ids}
            for future in as_completed(futures):
                data = future.result()
                records = data.get("result", {})
                records = records if isinstance(records, list) else records.get("opOrderRefundModels", [])
                all_results.extend(records)
                pbar.update(len(records))

        pbar.close()
        return pd.DataFrame(all_results)
    return wrapper