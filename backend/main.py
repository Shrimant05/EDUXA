import os
import random
import string
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Body, Depends, status, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorClient
from jose import JWTError, jwt
import bcrypt
import certifi
import pypdf
import docx
import io
import shutil
from fastapi.responses import FileResponse
from bson import ObjectId
from dotenv import load_dotenv
load_dotenv()

from models import UserCreate, ClassroomCreate, QueryLog, Role, UserInDB, ClassroomInDB, ChatRequest
from rag_chain import get_rag_chain, index_document

# Configuration
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI(title="EDUXA API")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGO_URI, tlsCAFile=certifi.where())
db = client.eduxa

@app.on_event("startup")
async def startup_db_client():
    # Create unique index for email
    await db.users.create_index("email", unique=True)

# --- Utility ---
def generate_join_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# --- Auth Helpers ---
def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Auth Endpoints ---
@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"email": form_data.username})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
        )
    
    access_token = create_access_token(data={"sub": user["email"], "role": user["role"]})
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user": {
            "email": user["email"], 
            "role": user["role"], 
            "id": str(user["_id"]),
            "username": user.get("username", user["email"].split("@")[0])
        }
    }

@app.post("/register")
async def register_user(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.dict()
    user_dict["password_hash"] = get_password_hash(user.password)
    del user_dict["password"]
    
    result = await db.users.insert_one(user_dict)
    return {"id": str(result.inserted_id), "msg": "User created"}

# --- Classroom Endpoints ---
@app.post("/classrooms")
async def create_classroom(classroom: ClassroomCreate):
    # Only HOD/Faculty can create
    # (Mocked auth check)
    code = generate_join_code()
    classroom_dict = classroom.dict()
    classroom_dict["join_code"] = code
    classroom_dict["student_ids"] = []
    
    result = await db.classrooms.insert_one(classroom_dict)
    return {"id": str(result.inserted_id), "join_code": code}

@app.post("/classrooms/join")
async def join_classroom(student_id: str, code: str):
    classroom = await db.classrooms.find_one({"join_code": code})
    if not classroom:
        raise HTTPException(status_code=404, detail="Invalid join code")
    
    await db.classrooms.update_one(
        {"_id": classroom["_id"]},
        {"$addToSet": {"student_ids": student_id}}
    )
    return {"msg": "Joined successfully", "classroom_id": str(classroom["_id"]), "name": classroom["name"]}

@app.post("/classrooms/{classroom_id}/exit")
async def exit_classroom(classroom_id: str, student_id: str):
    await db.classrooms.update_one(
        {"_id": ObjectId(classroom_id)},
        {"$pull": {"student_ids": student_id}}
    )
    return {"msg": "Exited successfully"}

@app.delete("/classrooms/{classroom_id}")
async def delete_classroom(classroom_id: str):
    # 1. Delete materials from DB
    await db.materials.delete_many({"classroom_id": classroom_id})
    
    # 2. Delete query logs
    await db.query_logs.delete_many({"classroom_id": classroom_id})
    
    # 3. Delete physical files
    upload_dir = os.path.join("uploads", classroom_id)
    if os.path.exists(upload_dir):
        shutil.rmtree(upload_dir)
        
    # 4. Delete from classrooms collection
    res = await db.classrooms.delete_one({"_id": ObjectId(classroom_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    return {"msg": "Classroom deleted successfully"}

@app.get("/users/{user_id}/classrooms")
async def get_user_classrooms(user_id: str):
    # Find classrooms where user is a student OR faculty
    cursor = db.classrooms.find({
        "$or": [
            {"student_ids": user_id},
            {"faculty_id": user_id}
        ]
    })
    classrooms = await cursor.to_list(length=100)
    return [{"id": str(c["_id"]), "name": c["name"], "join_code": c.get("join_code")} for c in classrooms]

@app.get("/classrooms/{classroom_id}/participants")
async def get_classroom_participants(classroom_id: str):
    classroom = await db.classrooms.find_one({"_id": ObjectId(classroom_id)})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    # Get faculty
    faculty = await db.users.find_one({"_id": ObjectId(classroom["faculty_id"])})
    
    # Get students
    student_ids = [ObjectId(sid) for sid in classroom.get("student_ids", [])]
    students_cursor = db.users.find({"_id": {"$in": student_ids}})
    students = await students_cursor.to_list(length=100)
    
    return {
        "faculty": {"id": str(faculty["_id"]), "username": faculty["username"]},
        "students": [{"id": str(s["_id"]), "username": s["username"]} for s in students]
    }


# --- RAG / Chat Endpoint ---
@app.post("/chat")
async def socratic_chat(req: ChatRequest):
    try:
        # 1. Get the Socratic Chain for this classroom
        chain = get_rag_chain(req.classroom_id)
        
        # 2. Run the chain
        response_data = chain(req.query)
        
        # 3. Log to MongoDB
        log_entry = {
            "student_id": req.student_id,
            "classroom_id": req.classroom_id,
            "query": req.query,
            "response": response_data["answer"],
            "citations": response_data["citations"],
            "is_out_of_scope": response_data["is_out_of_scope"],
            "timestamp": datetime.utcnow()
        }
        await db.query_logs.insert_one(log_entry)
        
        return response_data
    except Exception as e:
        print(f"Chat endpoint error: {e}")
        return {
            "answer": "I'm currently unable to process your request because the AI backend is unreachable. Please ensure Ollama is running locally with the required models.",
            "citations": [],
            "is_out_of_scope": False
        }

# --- Faculty Dashboard Endpoints ---
@app.get("/analytics/stats/{classroom_id}")
async def get_classroom_stats(classroom_id: str):
    total_queries = await db.query_logs.count_documents({"classroom_id": classroom_id})
    out_of_scope = await db.query_logs.count_documents({"classroom_id": classroom_id, "is_out_of_scope": True})
    
    # Simple "Confusion Points" logic: count unique queries that appear more than once
    pipeline = [
        {"$match": {"classroom_id": classroom_id}},
        {"$group": {"_id": "$query", "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$count": "total"}
    ]
    cursor = db.query_logs.aggregate(pipeline)
    result = await cursor.to_list(length=1)
    confusion_points = result[0]["total"] if result else 0
    
    return {
        "total_queries": total_queries,
        "out_of_scope": out_of_scope,
        "confusion_points": confusion_points
    }

@app.get("/analytics/heatmap/{classroom_id}")
async def get_confusion_heatmap(classroom_id: str):
    # Aggregate "Out-of-Scope" or frequent queries
    # In a real scenario, we might use NLP to group similar queries into "Concepts"
    # Here we'll aggregate based on simple keyword frequency or out-of-scope flags
    pipeline = [
        {"$match": {"classroom_id": classroom_id}},
        {"$group": {
            "_id": "$query", 
            "count": {"$sum": 1},
            "is_out_of_scope": {"$first": "$is_out_of_scope"}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    cursor = db.query_logs.aggregate(pipeline)
    results = await cursor.to_list(length=10)
    
    return [{"concept": r["_id"], "count": r["count"], "is_out_of_scope": r["is_out_of_scope"]} for r in results]

# --- File Upload (Re-indexing & Storage) ---
@app.post("/upload")
async def upload_material(classroom_id: str, file: UploadFile = File(...)):
    filename = file.filename
    content = ""
    
    # Prepare isolated storage
    upload_dir = os.path.join("uploads", classroom_id)
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    file_path = os.path.join(upload_dir, filename)
    
    try:
        file_bytes = await file.read()
        
        # 1. Save physical file
        with open(file_path, "wb") as buffer:
            buffer.write(file_bytes)
            
        # 2. Extract text for indexing
        if filename.endswith(".pdf"):
            pdf_reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            for page in pdf_reader.pages:
                extracted = page.extract_text()
                if extracted:
                    content += extracted + "\n"
        elif filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                content += para.text + "\n"
        elif filename.endswith(".txt"):
            content = file_bytes.decode("utf-8")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
            
        if not content.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from file")
            
        # 3. Store metadata in MongoDB
        material_doc = {
            "classroom_id": classroom_id,
            "name": filename,
            "type": filename.split(".")[-1].upper(),
            "path": file_path,
            "created_at": datetime.utcnow()
        }
        await db.materials.insert_one(material_doc)
            
        # 4. Index in Vector DB
        index_document(classroom_id, filename, content)
        
        return {"msg": "Document indexed and stored", "filename": filename}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")

@app.get("/classrooms/{classroom_id}/materials")
async def get_classroom_materials(classroom_id: str):
    cursor = db.materials.find({"classroom_id": classroom_id})
    materials = []
    async for doc in cursor:
        materials.append({
            "id": str(doc["_id"]),
            "name": doc["name"],
            "type": doc["type"],
            "created_at": doc["created_at"].isoformat() if "created_at" in doc else None
        })
    return materials

@app.get("/materials/{material_id}/download")
async def download_material(material_id: str):
    try:
        doc = await db.materials.find_one({"_id": ObjectId(material_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Material not found")
        
        file_path = doc["path"]
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File missing on server")
            
        return FileResponse(path=file_path, filename=doc["name"])
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail="Invalid ID or server error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
