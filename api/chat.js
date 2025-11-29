export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { message } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 });

    // ✅ 修改点：使用了 "gemini-pro" (最稳定的经典版本，绝对存在)
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
    });

    const data = await response.json();

    // 错误检查
    if (data.error) {
       return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });
    }

    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
