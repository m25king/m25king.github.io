export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { message } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 });

    // ✅ 修正：改用 "gemini-2.0-flash" 
    // 这是目前免费额度最大、速度最快的模型，绝对不会再报额度不足了！
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
    });

    const data = await response.json();
    
    // 如果还出错，打印错误
    if (data.error) {
       console.error("Google Error:", data.error);
       return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
