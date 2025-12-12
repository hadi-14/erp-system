from datetime import date
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.sql import text
import urllib
import os

load_dotenv()

# ===== POSTGRES CONNECTION =====
# Make sure to set env variables: PGUSER, PGPASSWORD, PGHOST, PGPORT, PGDATABASE
pg_user = os.getenv("PGUSER")
pg_password = os.getenv("PGPASSWORD")
pg_host = os.getenv("PGHOST")
pg_port = os.getenv("PGPORT")
pg_db = os.getenv("PGDATABASE")
 
engine = create_engine(f"postgresql://{pg_user}:%s@{pg_host}:{pg_port}/{pg_db}" % urllib.parse.quote_plus(pg_password))

def DeleteOld(table, startDate, endDate, dateCol='date'):
    """Delete old rows in Postgres within a date range"""
    try:
        with engine.begin() as con:  # engine.begin() auto-commits
            statement = text(
                f"""
                DELETE FROM public."{table}"
                WHERE "{dateCol}" >= :start_date AND "{dateCol}" <= :end_date;
                """
            )
            con.execute(statement, {"start_date": startDate, "end_date": endDate})
            print(f"[INFO] Deleted old rows from {table} between {startDate} and {endDate}")
    except Exception as e:
        if e.orig and "does not exist" in e.orig.args[0]:
            print(f"[INFO] Table {table} does not exist, skipping delete")
        else:
            print(f"[ERROR] Delete failed: {e}")

def DeleteIDs(table, ids_col, ids):
    """Delete rows in Postgres by IDs"""
    try:
        with engine.begin() as con:  # engine.begin() auto-commits
            statement = text(
                f"""
                DELETE FROM public."{table}"
                WHERE "{ids_col}" IN :ids;
                """
            )
            con.execute(statement, {"ids": tuple(ids)})
            print(f"[INFO] Deleted rows from {table} with IDs: {ids}")
    except Exception as e:
        print(f"[ERROR] Delete failed: {e}")

def dump_to_sql(df: pd.DataFrame, table_name, startDate=None, endDate=None, date_col=None, ids_col=None, safe_drop=False, append=False):
    df = df.map(lambda x: str(x) if isinstance(x, (list, dict)) else x)
    try:
        if safe_drop:
            with engine.begin() as con:
                try:
                    # Try to disable foreign key constraints temporarily
                    con.execute(text('SET session_replication_role = REPLICA;'))
                    statement = text(f'DELETE FROM public."{table_name}";')
                    con.execute(statement)
                    # Re-enable foreign key constraints
                    con.execute(text('SET session_replication_role = DEFAULT;'))
                    con.commit()
                    print(f"[INFO] Safely dropped all rows from {table_name}")
                except Exception as inner_e:
                    print(f"[WARN] Could not disable foreign keys: {inner_e}. Attempting regular delete...")
                    statement = text(f'DELETE FROM public."{table_name}";')
                    con.execute(statement)
                    con.commit()
            df.to_sql(table_name, engine, if_exists='append', index=False)
        elif date_col and startDate and endDate:
            DeleteOld(table_name, startDate, endDate, dateCol=date_col)
            df.to_sql(table_name, engine, if_exists='append', index=False)
        elif ids_col:
            ids = df[ids_col].unique()
            DeleteIDs(table_name, ids_col, ids)
            df.to_sql(table_name, engine, if_exists='append', index=False)
        elif append:
            df.to_sql(table_name, engine, if_exists='append', index=False)
        else:
            df.to_sql(table_name, engine, if_exists='replace', index=False)
                    

    except Exception as e:
        print(f"[ERROR] Delete failed: {e}")