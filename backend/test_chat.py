import requests
import json

url = "http://localhost:8000/chat"
data = {
    "student_id": "69f9be3fd5e5f7155e139f6e",
    "classroom_id": "69ff50f10ae48b442be1ed77",
    "query": "What is Python?"
}

try:
    response = requests.post(url, json=data)
    print(response.status_code)
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
