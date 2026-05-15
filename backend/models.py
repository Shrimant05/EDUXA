from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from datetime import datetime
from enum import Enum
from bson import ObjectId

class Role(str, Enum):
    HOD = "HOD"
    FACULTY = "FACULTY"
    STUDENT = "STUDENT"

class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: Role

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: str = Field(alias="_id")
    password_hash: str

class ClassroomBase(BaseModel):
    name: str
    faculty_id: str

class ClassroomCreate(ClassroomBase):
    pass

class ClassroomInDB(ClassroomBase):
    id: str = Field(alias="_id")
    join_code: str # 6-digit code
    student_ids: List[str] = []

class Citation(BaseModel):
    file: str
    page: Optional[str] = "N/A"

class QueryLog(BaseModel):
    student_id: str
    classroom_id: str
    query: str
    response: str
    citations: List[Citation]
    is_out_of_scope: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ConfusionHeatmapItem(BaseModel):
    concept: str
    count: int
    is_out_of_scope: bool

class ChatRequest(BaseModel):
    student_id: str
    classroom_id: str
    query: str
