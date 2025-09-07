from fastapi import FastAPI, HTTPException, UploadFile, File as FastAPIFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.files import FileInfo
from databricks.sdk.service.sql import StatementState
import os
import yaml
from dotenv import load_dotenv
from typing import List
import tempfile
import shutil
import io

try:
    import pandas as pd
    import mdpd
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False

def load_yaml_config():
    """Load configuration from app.yaml file"""
    try:
        with open('app.yaml', 'r') as file:
            config = yaml.safe_load(file)
            # Convert env array to a dictionary for easy access
            yaml_config = {}
            if 'env' in config:
                for env_var in config['env']:
                    yaml_config[env_var['name']] = env_var['value']
            return yaml_config
    except Exception as e:
        print(f"Warning: Could not load app.yaml config: {e}")
        return {}

# Load YAML configuration
YAML_CONFIG = load_yaml_config()

load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ParseRequest(BaseModel):
    text: str


# Add new Pydantic models after existing ones
class WriteToTableRequest(BaseModel):
    file_paths: List[str]
    limit: int = 10

class QueryDeltaTableRequest(BaseModel):
    file_paths: List[str] = []
    limit: int = 10

# Helper functions
def get_uc_volume_path() -> str:
    """Get the current UC Volume path"""
    return current_volume_path or "/Volumes/main/default/ai_functions_demo"

def get_delta_table_path() -> str:
    """Get the current Delta table path"""  
    return current_delta_table_path or "main.default.ai_functions_demo_documents"

# Initialize Databricks client - uses automatic authentication in Databricks Apps
try:
    w = WorkspaceClient()  # Automatic authentication
    warehouse_id = os.getenv("DATABRICKS_WAREHOUSE_ID", YAML_CONFIG.get("DATABRICKS_WAREHOUSE_ID"))
    print(f"✅ Databricks client initialized with warehouse: {warehouse_id}")
except Exception as e:
    print(f"⚠️ Databricks client initialization failed: {e}")
    w = None
    warehouse_id = None

# Global variables to store dynamic configuration
current_warehouse_id = warehouse_id
current_volume_path = os.getenv("DATABRICKS_VOLUME_PATH", YAML_CONFIG.get("DATABRICKS_VOLUME_PATH"))
current_delta_table_path = os.getenv("DATABRICKS_DELTA_TABLE_PATH", YAML_CONFIG.get("DATABRICKS_DELTA_TABLE_PATH"))

class WarehouseConfigRequest(BaseModel):
    warehouse_id: str

class VolumePathConfigRequest(BaseModel):
    volume_path: str

class DeltaTablePathConfigRequest(BaseModel):
    delta_table_path: str


class ParseDocumentRequest(BaseModel):
    file_path: str

class GenerateExcelRequest(BaseModel):
    file_paths: List[str]


@app.get("/api/warehouse-config")
def get_warehouse_config():
    """Get current warehouse configuration"""
    return {
        "warehouse_id": current_warehouse_id,
        "default_warehouse_id": warehouse_id
    }

@app.post("/api/warehouse-config")
def update_warehouse_config(request: WarehouseConfigRequest):
    """Update warehouse configuration"""
    global current_warehouse_id
    current_warehouse_id = request.warehouse_id
    print(f"🔧 Warehouse ID updated to: {current_warehouse_id}")
    return {
        "success": True,
        "warehouse_id": current_warehouse_id,
        "message": "Warehouse ID updated successfully"
    }

@app.get("/api/volume-path-config")
def get_volume_path_config():
    """Get current volume path configuration"""
    default_path = YAML_CONFIG.get("DATABRICKS_VOLUME_PATH", "/Volumes/fins_genai/unstructured_documents/pdf_tpg/")
    return {
        "volume_path": current_volume_path or default_path,
        "default_volume_path": default_path
    }

@app.post("/api/volume-path-config")
def update_volume_path_config(request: VolumePathConfigRequest):
    """Update volume path configuration"""
    global current_volume_path
    current_volume_path = request.volume_path
    print(f"🔧 Volume path updated to: {current_volume_path}")
    return {
        "success": True,
        "volume_path": current_volume_path,
        "message": "Volume path updated successfully"
    }

@app.get("/api/delta-table-path-config")
def get_delta_table_path_config():
    """Get current delta table path configuration"""
    default_path = YAML_CONFIG.get("DATABRICKS_DELTA_TABLE_PATH", "/fins_genai.unstructured_documents.files_parsed")
    return {
        "delta_table_path": current_delta_table_path or default_path,
        "default_delta_table_path": default_path
    }

@app.post("/api/delta-table-path-config")
def update_delta_table_path_config(request: DeltaTablePathConfigRequest):
    """Update delta table path configuration"""
    global current_delta_table_path
    current_delta_table_path = request.delta_table_path
    print(f"🔧 Delta table path updated to: {current_delta_table_path}")
    return {
        "success": True,
        "delta_table_path": current_delta_table_path,
        "message": "Delta table path updated successfully"
    }


@app.post("/api/upload-to-uc")
async def upload_to_uc(files: List[UploadFile] = FastAPIFile(...)):
    """Upload files to Databricks UC Volume"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    try:
        uploaded_files = []
        
        for file in files:
            # Create a temporary file to store the uploaded content
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                # Copy file content to temporary file
                shutil.copyfileobj(file.file, temp_file)
                temp_file_path = temp_file.name
            
            try:
                # Upload to UC Volume - fix double slash issue
                base_path = get_uc_volume_path().rstrip('/')  # Remove trailing slash
                uc_file_path = f"{base_path}/{file.filename}"
                
                # Upload to UC Volume using the Files API with file handle
                with open(temp_file_path, 'rb') as f:
                    w.files.upload(
                        file_path=uc_file_path,
                        contents=f,
                        overwrite=True
                    )
                
                # Get file size for response
                file_size = os.path.getsize(temp_file_path)
                
                uploaded_files.append({
                    "name": file.filename,
                    "path": uc_file_path,
                    "size": file_size
                })
                
            finally:
                # Clean up temporary file
                os.unlink(temp_file_path)
        
        return {
            "success": True,
            "uploaded_files": uploaded_files,
            "message": f"Successfully uploaded {len(uploaded_files)} files to UC Volume"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/api/test-ai-functions")
def test_ai_functions():
    """Test if AI Functions are available and working"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")
    
    try:
        # Test basic AI function availability with simple text
        test_query = """
        SELECT 
            ai_extract('This is a test document about John Doe from ACME Corp', 
                      ARRAY('person_name', 'company_name')) as extracted_info
        """
        
        print(f"Testing AI Functions availability: {test_query}")
        
        result = w.statement_execution.execute_statement(
            statement=test_query,
            warehouse_id=current_warehouse_id,
            wait_timeout='30s'
        )
        
        print(f"AI Functions test result status: {result.status}")
        
        if result.result and result.result.data_array:
            return {
                "success": True,
                "message": "AI Functions are working",
                "test_result": result.result.data_array[0][0] if result.result.data_array[0] else None
            }
        else:
            return {
                "success": False,
                "message": "AI Functions test returned no data"
            }
            
    except Exception as e:
        print(f"AI Functions test error: {e}")
        error_msg = str(e)
        
        if "FUNCTION_NOT_FOUND" in error_msg or "ai_extract" in error_msg:
            error_msg = "AI Functions not available - ensure they are enabled for your warehouse"
        elif "PERMISSION_DENIED" in error_msg:
            error_msg = "Permission denied - check warehouse permissions for AI Functions"
            
        return {
            "success": False,
            "message": error_msg,
            "error_type": type(e).__name__
        }

@app.post("/api/write-to-delta-table")
def write_to_delta_table(request: WriteToTableRequest):
    """Write processed documents to delta table using ai_parse_document - replaces entire table"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")

    if not request.file_paths:
        raise HTTPException(status_code=400, detail="file_paths is required")
    
    # Validate we have exactly one file
    if len(request.file_paths) != 1:
        raise HTTPException(status_code=400, detail="Only one file can be processed at a time")

    try:
        # Get the single file path
        file_path = request.file_paths[0]
        
        # Get the existing delta table path
        destination_table = get_delta_table_path()
        print(f"Working with delta table: {destination_table}")
        print(f"Processing single file: {file_path}")
        
        # Check if table exists and get its schema
        check_table_query = f"""
        DESCRIBE IDENTIFIER('{destination_table}')
        """
        
        print("Checking table schema...")
        try:
            # Check if table has new schema
            has_new_schema = False
            if not has_new_schema:
                print("Table has old schema or doesn't exist. Creating/recreating table...")
                
                # First drop the table
                drop_query = f"DROP TABLE IF EXISTS IDENTIFIER('{destination_table}')"
                
                drop_result = w.statement_execution.execute_statement(
                    statement=drop_query,
                    warehouse_id=current_warehouse_id,
                    wait_timeout='30s'
                )
                
                if drop_result.status and drop_result.status.state == StatementState.FAILED:
                    raise Exception(f"Failed to drop table: {drop_result.status}")
                
                # Then create the table with new schema
                create_query = f"""
                CREATE TABLE IDENTIFIER('{destination_table}') (
                    path STRING,
                    table_id BIGINT,
                    table STRING,
                    page_id INT,
                    table_name STRING,
                    header STRING,
                    footer STRING
                ) USING DELTA
                """
                
                create_result = w.statement_execution.execute_statement(
                    statement=create_query,
                    warehouse_id=current_warehouse_id,
                    wait_timeout='30s'
                )
                
                if create_result.status and create_result.status.state == StatementState.FAILED:
                    raise Exception(f"Failed to create table: {create_result.status}")
                    
                print("Table recreated with new schema")
            else:
                print("Table already has correct schema")
                
        except Exception as e:
            if "TABLE_OR_VIEW_NOT_FOUND" in str(e):
                print("Table doesn't exist, creating new table...")
                create_table_query = f"""
                CREATE TABLE IDENTIFIER('{destination_table}') (
                    path STRING,
                    table_id BIGINT,
                    table STRING,
                    page_id INT,
                    table_name STRING,
                    header STRING,
                    footer STRING
                ) USING DELTA
                """
                
                create_result = w.statement_execution.execute_statement(
                    statement=create_table_query,
                    warehouse_id=current_warehouse_id,
                    wait_timeout='30s'
                )
                
                if create_result.status and create_result.status.state == StatementState.FAILED:
                    raise Exception(f"Failed to create table: {create_result.status}")
            else:
                raise e
        
        print("Table exists with correct schema, replacing all data...")
        
        # Convert to dbfs format for the path column
        if file_path.startswith('/Volumes/'):
            dbfs_path = 'dbfs:' + file_path
        else:
            dbfs_path = file_path
        
        print(f"DBFS path will be: {dbfs_path}")
        
        # TRUNCATE entire table - delete ALL existing records
        truncate_query = f"""
        DELETE FROM IDENTIFIER('{destination_table}')
        """
        
        print(f"Truncating entire table...")
        truncate_result = w.statement_execution.execute_statement(
            statement=truncate_query,
            warehouse_id=current_warehouse_id,
            wait_timeout='30s'
        )
        
        if truncate_result.status and truncate_result.status.state == StatementState.FAILED:
            print(f"Truncate operation failed: {truncate_result.status}")
        else:
            print("Table truncated successfully")
        
        # Then insert new records from the single file with deterministic table IDs
        insert_query = f"""
        INSERT INTO IDENTIFIER('{destination_table}')
        WITH file_data AS (
          SELECT 
            path,
            content
          FROM READ_FILES('{dbfs_path}', format => 'binaryFile')
        ),
        processed_data AS (
          SELECT
              path,
              ai_parse_document(content) as parsed_result,
              content
          FROM file_data
        ),
        context as 
        (
          select
              path,
              ifnull(page_value:header, 'None') as header,
              page_value:footer as footer,
              cast(page_value:id as string) as page_id
          from
          (
              SELECT 
                  path,
                  parsed_result,
                  e.value as page_value
              FROM processed_data,
              LATERAL variant_explode(parsed_result:document:pages) AS e
          )
        ),
        tables as (
            select
                path,
                monotonically_increasing_id() + 1 as table_id,
                cast(element_value:content as string)as table,
                cast(element_value:page_id as int) as page_id,
                concat('table_' || table_id || '_page_' || page_id) as table_name
            from
            (
                SELECT 
                    path,
                    parsed_result,
                    e.value as element_value
                FROM processed_data,
                LATERAL variant_explode(parsed_result:document:elements) AS e
            )
            where
                variant_get(
                    element_value,
                    '$.type',
                    'STRING'
                ) = 'table'
        )
        select
            t.path, 
            t.table_id,
            t.table,
            cast(t.page_id as int) as page_id,
            t.table_name,
            c.header,
            c.footer
        from tables t 
        left join context c on t.path = c.path and t.page_id = c.page_id
        """
        
        print(f"Executing INSERT for {file_path}")
        
        insert_result = w.statement_execution.execute_statement(
            statement=insert_query,
            warehouse_id=current_warehouse_id,
            wait_timeout='50s'
        )
        
        print(f"INSERT result: {insert_result.status}")
        
        # If the operation is still pending or running, wait for it to complete
        if insert_result.status and insert_result.status.state in [StatementState.PENDING, StatementState.RUNNING]:
            print(f"INSERT operation is pending, waiting for completion...")
            try:
                # Wait for the statement to complete
                final_result = w.statement_execution.get_statement(insert_result.statement_id)
                
                # Keep checking until it's no longer pending or running (up to additional 30 seconds)
                import time
                max_wait = 300
                waited = 0
                while final_result.status.state in [StatementState.PENDING, StatementState.RUNNING] and waited < max_wait:
                    time.sleep(2)
                    waited += 2
                    final_result = w.statement_execution.get_statement(insert_result.statement_id)
                    print(f"Waiting for INSERT completion... ({waited}s) - Status: {final_result.status.state}")
                
                print(f"Final INSERT result: {final_result.status}")
                insert_result = final_result
                
            except Exception as wait_error:
                print(f"Error waiting for INSERT completion: {wait_error}")
        
        if insert_result.status and insert_result.status.state == StatementState.SUCCEEDED:
            print(f"Successfully processed: {file_path} (read from: {dbfs_path})")
            
            return {
                "success": True,
                "destination_table": destination_table,
                "processed_files": [file_path],
                "message": f"Successfully extracted tables from document and replaced entire table"
            }
        else:
            error_msg = f"Failed to process {file_path}"
            if insert_result.status and insert_result.status.error:
                error_msg += f": {insert_result.status.error}"
            print(error_msg)
            
            return {
                "success": False,
                "destination_table": destination_table,
                "processed_files": [file_path],
                "processed_paths": [],
                "data": [],
                "total_results": 0,
                "message": error_msg
            }

    except Exception as e:
        print(f"Delta table write error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to write to delta table: {str(e)}")

@app.post("/api/query-delta-table")
def query_delta_table(request: QueryDeltaTableRequest):
    """Query delta table results for specific documents"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")

    try:
        # Get the delta table path
        destination_table = get_delta_table_path()
        print(f"Querying delta table: {destination_table}")
        
        # Build the query with optional file filtering
        where_clause = ""
        if request.file_paths:
            # Convert to dbfs: format for filtering
            dbfs_file_paths = []
            for fp in request.file_paths:
                if fp.startswith('/Volumes/'):
                    dbfs_path = 'dbfs:' + fp
                else:
                    dbfs_path = fp
                dbfs_file_paths.append(dbfs_path)
            
            # Use exact path matching instead of LIKE with filename
            path_conditions = ", ".join([f"'{fp}'" for fp in dbfs_file_paths])
            where_clause = f"WHERE path IN ({path_conditions})"
        
        query = f"""
        SELECT
            path,
            table_id,
            table,
            page_id,
            table_name,
            header,
            footer
        FROM IDENTIFIER('{destination_table}')
        {where_clause}
        ORDER BY page_id
        LIMIT {request.limit}
        """
        
        print(f"Executing query: {query}")
        
        result = w.statement_execution.execute_statement(
            statement=query,
            warehouse_id=current_warehouse_id,
            wait_timeout='30s'
        )

        if result.result and result.result.data_array:
            delta_results = []
            for row in result.result.data_array:
                delta_results.append({
                    "path": row[0] if len(row) > 0 else "",
                    "table_id": row[1] if len(row) > 1 else None,
                    "table": row[2] if len(row) > 2 else "",
                    "page_id": row[3] if len(row) > 3 else None,
                    "table_name": row[4] if len(row) > 4 else "",
                    "header": row[5] if len(row) > 5 else "",
                    "footer": row[6] if len(row) > 6 else ""
                })
            
            print(f"Returning {len(delta_results)} results from delta table")
            return {
                "success": True,
                "data": delta_results,
                "table_name": destination_table,
                "total_results": len(delta_results)
            }
        else:
            print("No data returned from query")
            return {
                "success": True,
                "data": [],
                "message": "No results found in delta table"
            }

    except Exception as e:
        print(f"Delta table query error: {e}")
        return {
            "success": False,
            "data": [],
            "error": f"Failed to query delta table: {str(e)}"
        }

@app.post("/api/generate-excel")
def generate_excel(request: GenerateExcelRequest):
    """Generate Excel files from Delta table data for specified input files"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    if not current_warehouse_id:
        raise HTTPException(status_code=500, detail="DATABRICKS_WAREHOUSE_ID is not set.")
    
    if not EXCEL_AVAILABLE:
        raise HTTPException(status_code=500, detail="Excel dependencies not available. Install pandas, openpyxl, and mdpd.")

    if not request.file_paths:
        raise HTTPException(status_code=400, detail="file_paths is required")

    try:
        destination_table = get_delta_table_path()
        volume_path = current_volume_path or YAML_CONFIG.get("DATABRICKS_VOLUME_PATH", "/Volumes/fins_genai/unstructured_documents/pdf_tpg/")
        
        print(f"Generating Excel files for {len(request.file_paths)} input files")
        print(f"Reading from delta table: {destination_table}")
        print(f"Will upload Excel files to volume: {volume_path}")
        
        generated_files = []
        
        for original_file_path in request.file_paths:
            print(f"Processing file: {original_file_path}")
            
            # Convert to dbfs format for querying
            if original_file_path.startswith('/Volumes/'):
                dbfs_path = 'dbfs:' + original_file_path
            else:
                dbfs_path = original_file_path
            
            # Query Delta table for table data from this specific file
            query = f"""
            SELECT table_name, table, page_id, header, footer
            FROM IDENTIFIER('{destination_table}')
            WHERE path = '{dbfs_path}'
            ORDER BY page_id, table_name
            """
            
            print(f"Querying tables for {original_file_path}")
            result = w.statement_execution.execute_statement(
                statement=query,
                warehouse_id=current_warehouse_id,
                wait_timeout='30s'
            )
            
            if not result.result or not result.result.data_array:
                print(f"No table data found for {original_file_path}")
                continue
                
            # Create Excel file for this input file
            file_name = os.path.basename(original_file_path)
            name_without_ext = os.path.splitext(file_name)[0]
            excel_file_name = f"{name_without_ext}.xlsx"
            temp_path = f"/tmp/{excel_file_name}"
            
            print(f"Creating Excel file: {excel_file_name}")
            
            # Create Excel writer
            writer = pd.ExcelWriter(temp_path, engine='openpyxl')
            
            tables_processed = 0
            for row in result.result.data_array:
                table_name = row[0] if row[0] else f"table_{tables_processed + 1}"
                table_content = row[1] if row[1] else ""
                page_id = row[2] if row[2] else 0
                header = row[3] if row[3] else ""
                footer = row[4] if row[4] else ""
                
                # Clean table name for sheet name (Excel sheet names have restrictions)
                sheet_name = table_name.replace('/', '_').replace('\\', '_').replace(':', '_').replace('*', '_').replace('?', '_').replace('[', '_').replace(']', '_')
                sheet_name = sheet_name[:31]  # Excel sheet name limit
                
                try:
                    if table_content.strip():
                        # Parse markdown table content using mdpd
                        df_t = mdpd.from_md(table_content)
                        df_h = pd.DataFrame([[header]], columns=['header'])
                        df_f = pd.DataFrame([[footer]], columns=['footer'])
                        df_h.to_excel(writer, sheet_name=sheet_name, index=False, startrow=0)
                        df_t.to_excel(writer, sheet_name=sheet_name, index=False, startrow=len(df_h)+2)
                        df_f.to_excel(writer, sheet_name=sheet_name, index=False, startrow=len(df_t)+len(df_h)+4)
                        tables_processed += 1
                        print(f"Added sheet '{sheet_name}' with {len(df_t)} rows")
                    else:
                        print(f"Skipping empty table: {table_name}")
                except Exception as e:
                    print(f"Error parsing table {table_name}: {e}")
                    # Create a simple sheet with the error info
                    error_df = pd.DataFrame({'Error': [f"Failed to parse table: {str(e)}"], 'Content': [table_content[:200]]})
                    error_df.to_excel(writer, sheet_name=f"error_{sheet_name}", index=False)
                    continue
            
            writer.close()
            
            if tables_processed == 0:
                print(f"No valid tables found in {original_file_path}, skipping Excel generation")
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                continue
                
            print(f"Generated Excel file with {tables_processed} sheets")
            
            # Read the file as binary data
            with open(temp_path, "rb") as f:
                file_bytes = f.read()
            
            # Convert to BytesIO for upload
            binary_data = io.BytesIO(file_bytes)
            
            # Upload to Unity Catalog volume
            excel_uc_path = os.path.join(volume_path, excel_file_name).replace('\\', '/')
            print(f"Uploading Excel file to: {excel_uc_path}")
            
            w.files.upload(excel_uc_path, binary_data, overwrite=True)
            
            # Clean up temporary file
            os.remove(temp_path)
            
            generated_files.append({
                "original_file": original_file_path,
                "excel_file": excel_uc_path,
                "excel_name": excel_file_name,
                "tables_count": tables_processed
            })
            
            print(f"Successfully generated and uploaded: {excel_file_name}")
        
        if not generated_files:
            return {
                "success": False,
                "message": "No Excel files were generated. No table data found for the specified files.",
                "generated_files": []
            }
        
        return {
            "success": True,
            "message": f"Successfully generated {len(generated_files)} Excel file(s)",
            "generated_files": generated_files
        }
        
    except Exception as e:
        print(f"Excel generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel files: {str(e)}")

@app.get("/api/download-excel")
def download_excel(file_path: str):
    """Download an Excel file from UC Volume"""
    if not w:
        raise HTTPException(status_code=500, detail="Databricks connection is not configured.")
    
    if not file_path:
        raise HTTPException(status_code=400, detail="file_path parameter is required")
    
    try:
        print(f"Downloading Excel file: {file_path}")
        
        # Download the Excel file from UC Volume
        file_response = w.files.download(file_path=file_path)
        
        # Create a temporary file to store the downloaded content
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as temp_file:
            temp_file_path = temp_file.name
            
            # Handle different response types from Databricks SDK
            response_type = type(file_response).__name__
            print(f"Response type: {response_type}")
            
            try:
                # Check if it's a StreamingResponse from requests library or similar
                if response_type == 'StreamingResponse' or 'StreamingResponse' in response_type:
                    print(f"Handling StreamingResponse with attributes: {[attr for attr in dir(file_response) if not attr.startswith('_')][:10]}")
                    
                    # Try different methods to read from StreamingResponse
                    if hasattr(file_response, 'iter_content') and callable(getattr(file_response, 'iter_content')):
                        print("Using iter_content method")
                        for chunk in file_response.iter_content(chunk_size=8192):
                            if chunk:
                                temp_file.write(chunk)
                    elif hasattr(file_response, 'iter_bytes') and callable(getattr(file_response, 'iter_bytes')):
                        print("Using iter_bytes method")  
                        for chunk in file_response.iter_bytes(chunk_size=8192):
                            if chunk:
                                temp_file.write(chunk)
                    elif hasattr(file_response, '__iter__'):
                        print("Using direct iteration on StreamingResponse")
                        # Try to iterate directly on the response
                        chunk_count = 0
                        for chunk in file_response:
                            if isinstance(chunk, bytes):
                                temp_file.write(chunk)
                                chunk_count += 1
                            elif hasattr(chunk, 'encode'):
                                # If it's a string, encode it
                                temp_file.write(chunk.encode())
                                chunk_count += 1
                            else:
                                print(f"Unexpected chunk type: {type(chunk)}")
                        print(f"Wrote {chunk_count} chunks via direct iteration")
                    else:
                        # Try to get the underlying response
                        if hasattr(file_response, 'response'):
                            underlying = file_response.response
                            print(f"Found underlying response: {type(underlying)}")
                            if hasattr(underlying, 'iter_content'):
                                for chunk in underlying.iter_content(chunk_size=8192):
                                    if chunk:
                                        temp_file.write(chunk)
                        else:
                            raise Exception(f"Cannot read from StreamingResponse: no suitable method found")
                
                elif hasattr(file_response, 'iter_content') and callable(getattr(file_response, 'iter_content')):
                    print("Using iter_content method")
                    for chunk in file_response.iter_content(chunk_size=8192):
                        if chunk:
                            temp_file.write(chunk)
                elif hasattr(file_response, 'iter_bytes') and callable(getattr(file_response, 'iter_bytes')):
                    print("Using iter_bytes method")
                    for chunk in file_response.iter_bytes(chunk_size=8192):
                        temp_file.write(chunk)
                elif hasattr(file_response, 'content'):
                    print("Using content attribute")
                    content_bytes = getattr(file_response, 'content', b"")
                    if isinstance(content_bytes, bytes):
                        temp_file.write(content_bytes)
                    else:
                        print(f"Content is not bytes: {type(content_bytes)}")
                        raise Exception(f"Content attribute is not bytes: {type(content_bytes)}")
                elif hasattr(file_response, 'contents'):
                    print("Using contents attribute")
                    contents = getattr(file_response, 'contents')
                    print(f"Contents type: {type(contents)}")
                    
                    if isinstance(contents, bytes):
                        temp_file.write(contents)
                    else:
                        # It's a StreamingResponse, let's examine what methods it actually has
                        print(f"Contents has attributes: {[attr for attr in dir(contents) if not attr.startswith('_')]}")
                        
                        # Try different methods based on what's available
                        if hasattr(contents, 'iter_content') and callable(getattr(contents, 'iter_content')):
                            print("Contents has iter_content method")
                            for chunk in contents.iter_content(chunk_size=8192):
                                if chunk:
                                    temp_file.write(chunk)
                        elif hasattr(contents, 'iter_bytes') and callable(getattr(contents, 'iter_bytes')):
                            print("Contents has iter_bytes method")
                            for chunk in contents.iter_bytes(chunk_size=8192):
                                if chunk:
                                    temp_file.write(chunk)
                        elif hasattr(contents, 'content'):
                            print("Contents has content attribute")
                            inner_content = getattr(contents, 'content')
                            if isinstance(inner_content, bytes):
                                temp_file.write(inner_content)
                            else:
                                print(f"Inner content type: {type(inner_content)}")
                                raise Exception(f"Inner content is not bytes: {type(inner_content)}")
                        elif hasattr(contents, 'text'):
                            print("Contents has text attribute")
                            text_content = getattr(contents, 'text')
                            if isinstance(text_content, str):
                                temp_file.write(text_content.encode())
                            else:
                                temp_file.write(text_content)
                        elif hasattr(contents, 'read') and callable(getattr(contents, 'read')):
                            print("Contents has read method")
                            read_content = contents.read()
                            if isinstance(read_content, bytes):
                                temp_file.write(read_content)
                            elif hasattr(read_content, 'encode'):
                                temp_file.write(read_content.encode())
                            else:
                                print(f"Read content type: {type(read_content)}")
                                raise Exception(f"Read returned unexpected type: {type(read_content)}")
                        elif hasattr(contents, 'raw') and hasattr(contents.raw, 'read'):
                            print("Contents has raw.read method")
                            raw_content = contents.raw.read()
                            if isinstance(raw_content, bytes):
                                temp_file.write(raw_content)
                            else:
                                print(f"Raw content type: {type(raw_content)}")
                                raise Exception(f"Raw read returned unexpected type: {type(raw_content)}")
                        else:
                            # Try to access underlying response data
                            if hasattr(contents, '_content'):
                                print("Contents has _content attribute")
                                _content = getattr(contents, '_content')
                                if isinstance(_content, bytes):
                                    temp_file.write(_content)
                                else:
                                    print(f"_content type: {type(_content)}")
                                    raise Exception(f"_content is not bytes: {type(_content)}")
                            else:
                                raise Exception(f"StreamingResponse has no usable method. Available: {[attr for attr in dir(contents) if not attr.startswith('_')]}")
                elif hasattr(file_response, 'read') and callable(getattr(file_response, 'read')):
                    print("Using read method")
                    content_bytes = file_response.read()
                    if isinstance(content_bytes, bytes):
                        temp_file.write(content_bytes)
                    else:
                        print(f"Read result is not bytes: {type(content_bytes)}")
                        raise Exception(f"Read method returned non-bytes: {type(content_bytes)}")
                elif isinstance(file_response, bytes):
                    print("Direct bytes response")
                    temp_file.write(file_response)
                else:
                    raise Exception(f"Unsupported response type: {response_type}. Available methods: {[attr for attr in dir(file_response) if not attr.startswith('_')][:10]}")
                    
            except Exception as e:
                print(f"Error writing to temp file: {e}")
                os.unlink(temp_file_path)  # Clean up temp file
                raise Exception(f"Failed to process file response: {str(e)}")
        
        # Check if temp file has content
        file_size = os.path.getsize(temp_file_path)
        print(f"Temp file size: {file_size} bytes")
        
        if file_size == 0:
            os.unlink(temp_file_path)  # Clean up empty temp file
            raise HTTPException(status_code=404, detail="Excel file not found or empty")
        
        # Extract filename from path
        filename = os.path.basename(file_path)
        if not filename.endswith('.xlsx'):
            filename += '.xlsx'
        
        # Return the file as a download using FileResponse
        def cleanup_temp_file():
            """Clean up temp file after response is sent"""
            try:
                os.unlink(temp_file_path)
                print(f"Cleaned up temp file: {temp_file_path}")
            except:
                pass
        
        # Use FileResponse for better file handling
        response = FileResponse(
            path=temp_file_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=filename
        )
        
        # Schedule cleanup (note: this might not work in all environments)
        import atexit
        atexit.register(cleanup_temp_file)
        
        return response
        
    except Exception as e:
        print(f"Excel download error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to download Excel file: {str(e)}")

# Mount static files for Next.js assets (_next directory, favicon, etc.)
import os
# Use absolute path in Databricks Apps environment
if os.path.exists("/Workspace/Users/q.yu@databricks.com/databricks_apps/document-intelligence/static"):
    target_dir = "/Workspace/Users/q.yu@databricks.com/databricks_apps/document-intelligence/static"
elif os.path.exists("/Workspace/Users/q.yu@databricks.com/databricks_apps/document-intelligence/static"):
    target_dir = "/Workspace/Users/q.yu@databricks.com/databricks_apps/document-intelligence/static"
else:
    # Fallback for local development
    target_dir = "static"

print(f"📁 Serving static files from: {target_dir}")
print(f"📁 _next directory exists: {os.path.exists(f'{target_dir}/_next')}")

# Mount Next.js static assets with proper error handling
try:
    if os.path.exists(f"{target_dir}/_next"):
        app.mount("/_next", StaticFiles(directory=f"{target_dir}/_next"), name="nextjs-assets")
        print("✅ Successfully mounted /_next static files")
    else:
        print("❌ _next directory not found - static assets will not be served")
except Exception as e:
    print(f"❌ Failed to mount static files: {e}")

# Serve other static files with better error handling
@app.get("/favicon.ico")
def favicon():
    try:
        favicon_path = f"{target_dir}/favicon.ico"
        if os.path.exists(favicon_path):
            return FileResponse(favicon_path)
        else:
            print(f"❌ Favicon not found at {favicon_path}")
            raise HTTPException(status_code=404, detail="Favicon not found")
    except Exception as e:
        print(f"❌ Error serving favicon: {e}")
        raise HTTPException(status_code=500, detail="Error serving favicon")

@app.get("/file.svg")  
def file_svg():
    try:
        file_path = f"{target_dir}/file.svg"
        if os.path.exists(file_path):
            return FileResponse(file_path)
        else:
            print(f"❌ file.svg not found at {file_path}")
            raise HTTPException(status_code=404, detail="file.svg not found")
    except Exception as e:
        print(f"❌ Error serving file.svg: {e}")
        raise HTTPException(status_code=500, detail="Error serving file.svg")

# Add a catch-all route for static assets
@app.get("/{asset_path:path}")
def serve_static_asset(asset_path: str):
    """Serve static assets with fallback to main page"""
    # Handle static assets
    if any(asset_path.endswith(ext) for ext in ['.js', '.css', '.woff2', '.svg', '.png', '.ico']):
        static_file_path = f"{target_dir}/{asset_path}"
        if os.path.exists(static_file_path):
            print(f"✅ Serving static asset: {asset_path}")
            return FileResponse(static_file_path)
        else:
            print(f"❌ Static asset not found: {asset_path} at {static_file_path}")
            raise HTTPException(status_code=404, detail=f"Static asset not found: {asset_path}")
    
    # Handle page routes - continue with existing logic
    return serve_react_app(asset_path)

def serve_react_app(full_path: str):
    """Handle Next.js page routes - serve appropriate index.html"""
    # If the request is for a specific HTML file, serve it
    if full_path.endswith('.html'):
        file_path = f"{target_dir}/{full_path}"
        if os.path.exists(file_path):
            return FileResponse(file_path)
    
    
    # For the next-steps route, serve its specific page
    if full_path.startswith("next-steps"):
        file_path = f"{target_dir}/next-steps/index.html"
        if os.path.exists(file_path):
            return FileResponse(file_path)
    
    # For the document-intelligence route, serve its specific page
    if full_path.startswith("document-intelligence"):
        file_path = f"{target_dir}/document-intelligence/index.html"
        if os.path.exists(file_path):
            return FileResponse(file_path)
        
    # For all other routes, serve the main index.html
    return FileResponse(f"{target_dir}/index.html") 