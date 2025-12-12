import hmac
import requests
import hashlib
import webbrowser

# ===== CONFIG =====
APP_KEY = "3561254"  # Your App Key
APP_SECRET = "XGJTtcYh7wVX"  # Your App Secret
REDIRECT_URI = "http://localhost"  # Same as in your Alibaba app settings
PRODUCT_ID = "890777764623"  # Example product ID

# # ===== STEP 1: Get Authorization Code =====
# def get_auth_code():
#     auth_url = f"https://auth.1688.com/oauth/authorize?client_id={APP_KEY}&site=china&redirect_uri={REDIRECT_URI}&state=test"
#     print("\n[INFO] Opening browser for authorization...")
#     print("If the browser doesn't open, visit this URL manually:\n", auth_url)
#     webbrowser.open(auth_url)
#     code = input("\n[INPUT] Paste the 'code' from the redirected URL: ").strip()
#     return code

# # ===== STEP 2: Exchange Code for Access Token =====
# def get_access_token(auth_code):
#     token_url = f"https://gw.open.1688.com/openapi/param2/1/system.oauth2/getToken/{APP_KEY}"
#     params = {
#         "grant_type": "authorization_code",
#         "need_refresh_token": "true",
#         "client_id": APP_KEY,
#         "client_secret": APP_SECRET,
#         "redirect_uri": REDIRECT_URI,
#         "code": auth_code
#     }
#     res = requests.post(token_url, data=params)
#     data = res.json()
#     print("\n[INFO] Access Token Response:", data)
#     if "access_token" not in data:
#         raise Exception("[ERROR] Failed to get access token.")
#     return data["access_token"]

# ===== STEP 3: Generate MD5 Signature =====
def generate_signature(params, secret, url):
    # 1. Sort parameters alphabetically
    sorted_params = sorted(params.items(), key=lambda x: x[0])
    # 2. Concatenate key+value
    concatenated = "".join(f"{k}{v}" for k, v in sorted_params)
    print("\n[INFO] Concatenated Params:", concatenated)
    
    # 3. Add secret at start and end
    sign_str = url + concatenated
    print("[INFO] Signature String:", sign_str)
    # 4. HMAC-SHA1 & uppercase
    h = hmac.new(secret.encode("utf-8"), sign_str.encode("utf-8"), hashlib.sha1)
    return h.hexdigest().upper()

# ===== STEP 4: Get Product Details =====
def get_product_details(access_token):
    api_name = "com.alibaba.product/alibaba.product.list.get"
    version = "1"
    base_url = f"https://gw.open.1688.com/openapi/param2/{version}/{api_name}/{APP_KEY}"

    params = {
        "access_token": access_token,
        # "productIdList": '[860298268418]',
        # "offerPoolId": '866762428727',
        # "taskId": 1,
        "pageNo": 1,
        "pageSize": 10,
        
    }

    # Generate and attach signature
    params["_aop_signature"] = generate_signature(params, APP_SECRET, f'param2/{version}/{api_name}/{APP_KEY}')

    print("\n[INFO] Final Request Params:", params)
    res = requests.get(base_url, params=params)
    return res.json()

# ===== MAIN SCRIPT =====
if __name__ == "__main__":
    # auth_code = get_auth_code()
    # token = get_access_token(auth_code)
    token = '1bc73edd-2423-437d-8ebe-257b5c321b81'
    product_data = get_product_details(token)
    print("\n[INFO] Product Data:", product_data)
