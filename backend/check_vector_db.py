from rag_chain import get_vectorstore
import os

classroom_id = "6a00204cb715f0e12dd72912" 
vectorstore = get_vectorstore(classroom_id)

try:
    data = vectorstore.get()
    print(f"Total documents in collection: {len(data['documents'])}")
    for i, doc in enumerate(data['documents'][:5]):
        print(f"Doc {i}: {doc[:100]}...")
except Exception as e:
    print(f"Error: {e}")
