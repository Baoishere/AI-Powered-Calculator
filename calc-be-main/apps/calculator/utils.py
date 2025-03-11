import google.generativeai as genai
import ast
import json
from PIL import Image
from constants import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

def analyze_image(img: Image, dict_of_vars: dict):
    model = genai.GenerativeModel(model_name="gemini-2.0-flash")
    dict_of_vars_str = json.dumps(dict_of_vars, ensure_ascii=False)
    prompt = (
        "Bạn là hệ thống xử lý công thức toán học từ ảnh. Hãy phân tích hình ảnh đầu vào và trả về kết quả dưới dạng JSON array hợp lệ theo các quy tắc sau:\n\n"
        
        "### QUY TẮC PHÂN LOẠI & XỬ LÝ:\n"
        "1. **Biểu thức đơn giản** (VD: 2 + 3*4, 5/(6-2)):\n"
        "   - Áp dụng PEMDAS: Dấu ngoặc → Số mũ → Nhân/Chia → Cộng/Trừ\n"
        "   - Kết quả: [{'expr': '2 + 3 * 4', 'result': 14}]\n\n"
        
        "2. **Hệ phương trình** (VD: x^2 + 2x + 1 = 0, 3y = 4x):\n"
        "   - Giải từng biến và trả về nghiệm\n"
        "   - Kết quả: [{'expr': 'x', 'result': -1}, {'expr': 'y', 'result': 4/3}]\n\n"
        
        "3. **Gán giá trị biến** (VD: x = 5, y = π):\n"
        "   - Lưu vào từ điển biến và thêm key 'assign': True\n"
        "   - Kết quả: [{'expr': 'x', 'result': 5, 'assign': True}]\n\n"
        "   - Không hiện kết quả là (VD: a = 5 = 5)"

        
        "4. **Bài toán đồ thị/hình ảnh** (Va chạm cơ học, bài toán lượng giác):\n"
        "   - Mô tả bằng text trong 'expr', kết quả tính toán trong 'result'\n"
        "   - VD: [{'expr': 'Quãng đường vật A di chuyển', 'result': 25.3}]\n\n"
        
        "5. **Khái niệm trừu tượng** (Tình yêu, lịch sử, trích dẫn):\n"
        "   - 'expr': Mô tả hình ảnh, 'result': Khái niệm\n"
        "   - VD: [{'expr': 'Trái tim với mũi tên xuyên qua', 'result': 'Tình yêu'}]\n\n"
        
        "### YÊU CẦU KỸ THUẬT:\n"
        "- Đáp án luôn trả về bằng ngôn ngữ Tiếng Việt(Vietnamese)"
        "- Luôn trả về JSON array (không markdown/backticks)\n"
        "- Escape ký tự đặc biệt: \\\\n, \\\\t, \\\\\"\n"
        "- Sử dụng từ điển biến người dùng: {{dict_of_vars_str}}\n"
        "- Đảm bảo số thực có dấu . (VD: 3.0 thay vì 3)\n"
        "- Nếu không xác định được loại bài toán, trả về [{'error': 'Mô tả lỗi cụ thể'}]"
    )
    response = model.generate_content([prompt, img])
    print("Kết quả: ",response.text)
    answers = []
    clean_text = response.text.strip().strip("```json").strip("```")
    try:
        answers = json.loads(clean_text)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response: {e}")
    for answer in answers:
        if 'assign' in answer:
            answer['assign'] = True
        else:
            answer['assign'] = False
    return answers

# import requests
# import json
# from PIL import Image
# from constants import GEMINI_API_KEY

# # API URL của OpenRouter
# OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# def analyze_image(img: Image, dict_of_vars: dict):
#     headers = {
#         "Authorization": f"Bearer {GEMINI_API_KEY}",  # Thay GEMINI_API_KEY bằng API Key của OpenRouter
#         "Content-Type": "application/json"
#     }

#     dict_of_vars_str = json.dumps(dict_of_vars, ensure_ascii=False)

#     prompt = (
#         f"Bạn là một AI chuyên giải toán. Bạn sẽ nhận được một hình ảnh có chứa bài toán hoặc biểu thức toán học và bạn cần giải nó một cách chính xác.\n\n"
#         f"⚡ **Quy tắc tính toán**:\n"
#         f"1️⃣ Sử dụng quy tắc **PEMDAS** (ngoặc trước, lũy thừa, nhân/chia, cộng/trừ từ trái sang phải).\n"
#         f"2️⃣ Đối với phương trình, hãy giải tất cả các biến và trả về dưới dạng JSON.\n"
#         f"3️⃣ Nếu có các biến trong biểu thức, hãy thay thế giá trị từ danh sách đã cho: {dict_of_vars_str}.\n"
#         f"4️⃣ Nếu là bài toán hình học hoặc đồ thị, hãy phân tích và tìm ra kết quả chính xác.\n\n"
#         f"🚀 **Ví dụ bài toán và cách trả về JSON**:\n"
#         f"🔹 *Bài toán 1*: `2 + 3 * 4` → Trả về: `{{'expr': '2 + 3 * 4', 'result': 14}}`\n"
#         f"🔹 *Bài toán 2*: `x^2 + 2x - 3 = 0` → Trả về: `[{ {'expr': 'x', 'result': 1}, {'expr': 'x', 'result': -3} }]`\n"
#         f"🔹 *Bài toán 3*: `x = 5, y = x + 3` → Trả về: `[{ {'expr': 'x', 'result': 5, 'assign': True}, {'expr': 'y', 'result': 8, 'assign': True} }]`\n"
#         f"🔹 *Bài toán 4*: Hình vẽ mô tả tam giác vuông có hai cạnh góc vuông dài 3 và 4, tìm cạnh huyền → Trả về: `[{ {'expr': 'c', 'result': 5} }]`\n\n"
#         f"📌 **Yêu cầu**:\n"
#         f"- Chỉ trả về JSON hợp lệ **KHÔNG có markdown (` ``` `) hoặc văn bản thừa**.\n"
#         f"- Định dạng kết quả phải đúng, có thể parse bằng Python `json.loads()`.\n\n"
#         f"📷 **Dữ liệu hình ảnh sẽ được phân tích ngay bây giờ!**\n"
#     )

#     payload = {
#         "model": "google/gemini-exp-1206:free",
#         "messages": [
#             {"role": "system", "content": "You are a math-solving assistant."},
#             {"role": "user", "content": prompt}
#         ],
#         "stream": False
#     }

#     try:
#         response = requests.post(OPENROUTER_API_URL, headers=headers, json=payload)
#         response.raise_for_status()  # Kiểm tra lỗi HTTP (nếu có)
#         data = response.json()

#         # Lấy nội dung text từ phản hồi của API
#         response_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")

#         # Loại bỏ ký tự không mong muốn và chuyển đổi sang JSON
#         clean_text = response_text.strip().strip("```json").strip("```")
#         answers = json.loads(clean_text)

#         # Xử lý thêm thông tin 'assign'
#         for answer in answers:
#             answer['assign'] = 'assign' in answer
        
#         return answers
    
#     except requests.exceptions.RequestException as e:
#         print(f"HTTP Error: {e}")
#         return []
#     except json.JSONDecodeError as e:
#         print(f"Error parsing JSON response: {e}")
#         return []
