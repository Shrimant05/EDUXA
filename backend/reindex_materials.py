import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from rag_chain import index_document
import pypdf
import docx
from dotenv import load_dotenv

load_dotenv()

async def reindex_all():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_uri)
    db = client.eduxa
    
    # 1. Get all materials from DB
    cursor = db.materials.find()
    materials = await cursor.to_list(length=1000)
    
    print(f"Found {len(materials)} materials to re-index.")
    
    for mat in materials:
        classroom_id = mat["classroom_id"]
        file_path = mat["path"]
        name = mat["name"]
        
        if not os.path.exists(file_path):
            print(f"File missing: {file_path}")
            continue
            
        print(f"Indexing {name} for classroom {classroom_id}...")
        
        try:
            content = ""
            if name.lower().endswith('.pdf'):
                with open(file_path, 'rb') as f:
                    reader = pypdf.PdfReader(f)
                    for page in reader.pages:
                        content += page.extract_text() + "\n"
            elif name.lower().endswith('.docx'):
                doc = docx.Document(file_path)
                for para in doc.paragraphs:
                    content += para.text + "\n"
            else:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
            
            if content.strip():
                index_document(classroom_id, file_path, content)
                print(f"Done: {name}")
            else:
                print(f"Empty content for {name}")
                
        except Exception as e:
            print(f"Failed to index {name}: {e}")
            
    print("Re-indexing complete.")
    client.close()

if __name__ == "__main__":
    asyncio.run(reindex_all())
