import motor.motor_asyncio
import asyncio

async def f():
    client = motor.motor_asyncio.AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.eduxa
    materials = await db.materials.find().to_list(length=100)
    print(f"Total materials in DB: {len(materials)}")
    for m in materials:
        print(f"Classroom: {m['classroom_id']}, Name: {m['name']}")
    client.close()

if __name__ == "__main__":
    asyncio.run(f())
