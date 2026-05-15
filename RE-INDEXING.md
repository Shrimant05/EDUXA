# EDUXA Re-indexing Logic

When a Faculty member updates or uploads a new PDF to a classroom, the system performs the following steps to ensure the RAG pipeline is up-to-date and isolated.

## 1. Triggering the Update
The Faculty dashboard sends a POST request to the `/upload` endpoint with the `classroom_id`, `filename`, and the file content.

## 2. Chunking with Sliding Window
The backend uses a `RecursiveCharacterTextSplitter` configured with a **sliding window strategy**:
- **Chunk Size**: 512 characters (~tokens).
- **Overlap**: 51 characters (10% overlap).
- **Purpose**: Overlap ensures that context is not lost at the boundaries of chunks, which is critical for the AI to understand continuity in pedagogical materials.

## 3. Namespace Isolation
Each classroom has its own dedicated **Vector Namespace** (Collection in ChromaDB). 
- When indexing, the system targets the collection named `classroom_{classroom_id}`.
- This ensures that Student A in Classroom X never retrieves notes uploaded for Classroom Y.

## 4. Metadata Attachment
Every chunk is tagged with metadata:
- `source`: The filename (e.g., "Lecture_1.pdf").
- `page`: The page number (extracted during PDF processing).
- This metadata is later used to generate the required `citations` schema in the AI's response.

## 5. Upsert / Re-indexing
- If a document with the same filename already exists, the system can either append or replace.
- In the current implementation, we use `vectorstore.add_documents()`, which appends. To "update," the system would first delete existing chunks with that `source` metadata before re-indexing.

## 6. Real-time Availability
Once `vectorstore.persist()` is called, the new chunks are immediately available for the `/chat` endpoint to retrieve.
