module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image_base64, media_type } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'No image provided' });

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    // Log image size for debugging
    const sizeKB = Math.round(image_base64.length * 0.75 / 1024);
    console.log(`Image size: ${sizeKB} KB, type: ${media_type}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image_base64 }
            },
            {
              type: 'text',
              text: 'You are a medical OCR specialist for Thai/English health checkup documents.\n\nAnalyze the image and extract ALL information. Return ONLY valid JSON — no markdown, no explanation:\n\n{"patient_name":"string or null","report_date":"YYYY-MM-DD or null","hospital":"string or null","overall_confidence":0.95,"items":[{"name_th":"ชื่อภาษาไทย","name_en":"English name","value":"ตัวเลข","unit":"หน่วย","reference_range":"เช่น 70-100","status":"normal|high|low|unknown","confidence":0.95}]}\n\nRules:\n- patient_name: read full name from document\n- report_date: read exam date, convert to YYYY-MM-DD (convert Buddhist Era to Christian Era if needed)\n- hospital: read hospital/clinic name from document\n- items: extract every test result found\n- status: high=above range, low=below range, normal=within range, unknown=no reference\n- Return ONLY the JSON object, nothing else'
            }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log('Anthropic status:', response.status);

    if (!response.ok) {
      console.log('Anthropic error:', JSON.stringify(data));
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error', detail: data });
    }

    const raw = data.content?.[0]?.text || '';
    console.log('Raw response length:', raw.length);

    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      return res.status(200).json(parsed);
    } catch(e) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: raw.substring(0, 500) });
    }
  } catch (err) {
    console.log('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};