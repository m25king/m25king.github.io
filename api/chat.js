export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 1. 只允许 POST 请求
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // 2. 获取前端发来的消息
    const { message } = await req.json();

    // 3. 读取环境变量里的 API Key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 });
    }

    // 4. 发送请求给 Google
    // ✅ 这里改成了 gemini-1.5-flash-latest 来修复 404 报错
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    });

    const data = await response.json();

    // 5. 返回结果给前端
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
