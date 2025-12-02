export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 1. 只允许 POST 请求
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { message } = await req.json();
    
    // 读取你在 Vercel 里填的 Key
    // ⚠️ 确保你在 Vercel 里的变量名也是 DEEPSEEK_API_KEY
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 });

    // 2. 发送请求给“硅基流动” (SiliconFlow)
    // 卖家给的 URL 是 https://api.siliconflow.cn/v1，我们需要在后面加上 /chat/completions
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` // 这里的 Key 会自动从 Vercel 读取
      },
      body: JSON.stringify({
        // 卖家提供的模型名字
        model: "deepseek-ai/DeepSeek-V3", 
        messages: [
          { role: "system", content: "你是一个专业的考研辅导助教，擅长英语、数学和计算机408。请简短、清晰地回答学生的问题。" },
          { role: "user", content: message }
        ],
        stream: false
      })
    });

    const data = await response.json();

    // 3. 错误检查
    if (data.error) {
       console.error("API Error:", data); 
       return new Response(JSON.stringify({ error: data.error.message || "Unknown Error" }), { status: 500 });
    }

    // 4. 格式转换 (适配前端网页)
    // 硅基流动返回的是标准 OpenAI 格式，我们把它伪装成 Gemini 格式发回给前端
    const aiText = data.choices?.[0]?.message?.content || "AI 没有返回内容";
    
    const fakeGeminiResponse = {
      candidates: [{
        content: {
          parts: [{ text: aiText }]
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
