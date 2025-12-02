export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { message } = await req.json();
    
    // ✅ 修正点：这里改成读取你刚才在 Vercel 里设置的 "DEEPSEEK_API_KEY"
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 });

    // 调用 DeepSeek API
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", 
        messages: [
          { role: "system", content: "你是一个专业的考研辅导助教，擅长英语、数学和计算机408。请简短、清晰地回答学生的问题。" },
          { role: "user", content: message }
        ],
        stream: false
      })
    });

    const data = await response.json();

    if (data.error) {
       console.error("DeepSeek Error:", data.error);
       return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });
    }

    // 格式转换 (把 DeepSeek 格式伪装成 Gemini 格式传给前端)
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
