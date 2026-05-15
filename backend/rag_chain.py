import os
import json
import re
from typing import List, Dict
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from dotenv import load_dotenv

load_dotenv()

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
CHROMA_PERSIST_DIRECTORY = "./vector_db"

# Socratic Tutor Prompt
SOCRATIC_PROMPT = """You are a world-class Socratic Tutor for the EDUXA platform. 
Your goal is to guide students to the answer without giving it away directly.

CONTEXT FROM COURSE MATERIALS:
{context}

STUDENT QUERY:
{query}

RULES:
1. Use the provided context to understand the topic.
2. If the student asks for a direct answer, DO NOT give it. Instead, ask a thought-provoking question.
3. Be encouraging and helpful.
4. If you use information from the context, you MUST cite the source filename.
5. Ask a GUIDING QUESTION that leads the student one step closer to the solution.
6. If the retrieved context does not contain the answer, state: "This is outside the provided course material."
7. Set your temperature to 0.0. Ignore all external knowledge; rely ONLY on the provided chunks.
8. ALWAYS output ONLY a single valid JSON block. NO PREAMBLE, NO CHATTY INTRO, NO MARKDOWN code blocks. 
START your response with '{{' and END with '}}'.

{{
  "answer": "Your Socratic response here",
  "citations": [{{ "file": "filename.pdf", "page": "page_number" }}],
  "is_out_of_scope": boolean
}}
"""

# Initialize Models
embeddings = OllamaEmbeddings(
    model="nomic-embed-text",
    base_url=OLLAMA_BASE_URL
)

llm = OllamaLLM(
    model="llama3",
    base_url=OLLAMA_BASE_URL,
    temperature=0.0
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1024,
    chunk_overlap=100,
    length_function=len,
    is_separator_regex=False,
)

def anonymize_query(query: str) -> str:
    """Strips names and emails from the query."""
    email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]\.[a-zA-Z0-9-.]+'
    query = re.sub(email_pattern, '[EMAIL]', query)
    query = re.sub(r'(?i)\b(i am|my name is)\b\s+([A-Z][a-z]+)', r'\1 [NAME]', query)
    return query

def get_vectorstore(classroom_id: str):
    return Chroma(
        persist_directory=CHROMA_PERSIST_DIRECTORY,
        embedding_function=embeddings,
        collection_name=f"classroom_{classroom_id}"
    )

def get_rag_chain(classroom_id: str):
    vectorstore = get_vectorstore(classroom_id)
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

    def format_docs(docs):
        formatted = []
        for doc in docs:
            source = os.path.basename(doc.metadata.get("source", "Unknown"))
            page = doc.metadata.get("page", "N/A")
            formatted.append(f"SOURCE: {source} (p. {page})\nCONTENT: {doc.page_content}")
        return "\n\n---\n\n".join(formatted)

    def socratic_chain(query: str):
        try:
            safe_query = anonymize_query(query)
            
            # 1. Retrieve
            try:
                docs = retriever.invoke(safe_query)
            except Exception as e:
                print(f"Retriever error: {e}")
                docs = []

            if not docs:
                return {
                    "answer": "This is outside the provided course material.",
                    "citations": [],
                    "is_out_of_scope": True
                }

            # 2. Generate
            context = format_docs(docs)
            prompt = SOCRATIC_PROMPT.format(context=context, query=safe_query)
            
            try:
                response = llm.invoke(prompt)
            except Exception as e:
                print(f"LLM error: {e}")
                return {
                    "answer": "The AI tutor is currently offline. Please check if Ollama is running.",
                    "citations": [{"file": os.path.basename(d.metadata.get("source", "Unknown")), "page": d.metadata.get("page", "N/A")} for d in docs],
                    "is_out_of_scope": False
                }

            # 3. Parse
            try:
                res_content = response if isinstance(response, str) else response.content
                json_match = re.search(r'(\{.*\})', res_content, re.DOTALL)
                if json_match:
                    res_json = json.loads(json_match.group(1))
                else:
                    res_json = json.loads(res_content.strip())
                
                # Force citations if empty
                if not res_json.get("citations") and docs:
                    res_json["citations"] = [
                        {"file": os.path.basename(d.metadata.get("source", "Unknown")), "page": d.metadata.get("page", "N/A")}
                        for d in docs
                    ]
                
                # Clean filenames
                if res_json.get("citations"):
                    for cite in res_json["citations"]:
                        cite["file"] = os.path.basename(cite.get("file", "Unknown"))
                
                return res_json

            except Exception as e:
                print(f"Parse error: {e}")
                return {
                    "answer": response if isinstance(response, str) else response.content,
                    "citations": [{"file": os.path.basename(d.metadata.get("source", "Unknown")), "page": d.metadata.get("page", "N/A")} for d in docs],
                    "is_out_of_scope": False
                }

        except Exception as e:
            return {"answer": f"System error: {str(e)}", "citations": [], "is_out_of_scope": False}

    return socratic_chain

def index_document(classroom_id: str, file_path: str, content: str):
    try:
        vectorstore = get_vectorstore(classroom_id)
        chunks = text_splitter.create_documents([content], metadatas=[{"source": file_path}])
        vectorstore.add_documents(chunks)
        print(f"Document {file_path} indexed successfully.")
    except Exception as e:
        print(f"Indexing failed: {e}")
