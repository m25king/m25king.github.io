export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { message } = await req.json();
    // 这里读取的虽然叫 GEMINI_API_KEY，但实际上填的是 DeepSeek 的 key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 });

    // 1. 构造 DeepSeek (OpenAI 格式) 的请求
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // 使用 DeepSeek V3 模型
        messages: [
          { role: "system", content: "你是一个专业的考研辅导助教，擅长英语、数学和计算机408。请简短、清晰地回答学生的问题。" },
          { role: "user", content: message }
        ],
        stream: false
      })
    });

    const data = await response.json();

    // 2. 错误检查
    if (data.error) {
       console.error("DeepSeek Error:", data.error);
       return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });
    }

    // 3. 【关键步骤】数据格式转换 (Adapter Pattern)
    // DeepSeek 返回的是 OpenAI 格式，但你的前端网页还在等 Gemini 格式
    // 所以我们在这里把它“伪装”成 Gemini 的样子发回去，这样你就不用改前端代码了！
    const deepSeekText = data.choices[0].message.content;

    const fakeGeminiResponse = {
      candidates: [{
        content: {
          parts: [{ text: deepSeekText }]
        }
      }]
    };

    return new Response(JSON.stringify(fakeGeminiResponse), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `Server Error: ${error.message}` }), { status: 500 });
  }
}
