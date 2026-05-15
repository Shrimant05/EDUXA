import motor.motor_asyncio
import asyncio

async def f():
    client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.eduxa
    classrooms = await db.classrooms.find().to_list(length=10)
    for c in classrooms:
        print(f"ID: {c['_id']}, Name: {c['name']}, Code: {c['join_code']}")
    client.close()

if __name__ == "__main__":
    asyncio.run(f())
