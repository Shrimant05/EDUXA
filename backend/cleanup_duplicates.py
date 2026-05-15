from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client.eduxa

# Find duplicates
pipeline = [
    {"$group": {"_id": "$email", "count": {"$sum": 1}, "ids": {"$push": "$_id"}}},
    {"$match": {"count": {"$gt": 1}}}
]

duplicates = list(db.users.aggregate(pipeline))
print(f"Found {len(duplicates)} duplicate emails.")

for dup in duplicates:
    # Keep the first one, delete the rest
    to_delete = dup['ids'][1:]
    db.users.delete_many({"_id": {"$in": to_delete}})
    print(f"Deleted {len(to_delete)} duplicates for {dup['_id']}")

print("Cleanup complete.")
