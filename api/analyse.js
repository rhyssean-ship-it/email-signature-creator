export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const { imageBase64, imageMime } = req.body;
  if (!imageBase64 || !imageMime) {
    return res.status(400).json({ error: 'Missing image data.' });
  }

  const prompt = `Analyse this email signature image and extract ALL visible information.
Return ONLY a valid JSON object (no markdown, no explanation) with these exact fields:
{
  "name": "full name or empty string",
  "title": "job title or empty string",
  "company": "company name or empty string",
  "email": "email address or empty string",
  "website": "website URL with https:// prefix or empty string",
  "phones": ["phone1", "phone2"],
  "social": [{"platform": "LinkedIn|Twitter/X|Facebook|Instagram|YouTube|TikTok", "url": "full URL"}],
  "hasLogo": true or false,
  "logoDescription": "brief description of logo"
}
Extract exactly what is visible. Include full URLs for social media. For website, prepend https:// if not already present.`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: imageMime, data: imageBase64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      return res.status(upstream.status).json({ error: err.error?.message || `Anthropic error ${upstream.status}` });
    }

    const data = await upstream.json();
    const text = data.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Could not parse Anthropic response.' });

    return res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
