export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 只允许 POST
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const { message } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) return new Response(JSON.stringify({ error: '没有配置 API Key' }), { status: 500 });

    // 1. 尝试调用最标准的 gemini-1.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] })
    });

    const data = await response.json();

    // =========== 诊断核心逻辑 ===========
    // 2. 如果成功，直接返回结果
    if (!data.error) {
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 3. 如果失败 (比如 404)，我们要去查查到底有哪些模型可用
    console.error("模型调用失败，开始诊断...", data.error);
    
    // 向 Google 查询当前 Key 可用的所有模型列表
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const listRes = await fetch(listUrl);
    const listData = await listRes.json();

    // 4. 返回详细的诊断报告给前端
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ 
            text: `⚠️ 连接成功，但模型名字不对。\n\nGoogle 返回报错: ${data.error.message}\n\n✅ 你的 Key 实际上支持以下模型 (请把其中一个复制给我):\n${listData.models ? listData.models.map(m => m.name).join('\n') : "没有查到任何可用模型，请检查 Google Cloud 项目是否真的开启了 API"}` 
          }]
        }
      }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: `代码执行错误: ${error.message}` }), { status: 500 });
  }
}
