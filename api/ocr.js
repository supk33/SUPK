export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image_base64, media_type } = req.body;
    if (!image_base64) return res.status(400).json({ error: 'No image provided' });

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
              text: `You are a medical OCR specialist for Thai/English health checkup documents.

Analyze the image and extract ALL information. Return ONLY valid JSON — no markdown, no explanation:

{
  "patient_name": "ชื่อผู้ป่วย หรือ null",
  "report_date": "YYYY-MM-DD หรือ null",
  "hospital": "ชื่อโรงพยาบาล หรือ null",
  "overall_confidence": 0.95,
  "items": [
    {
      "name_th": "ชื่อภาษาไทย",
      "name_en": "English name",
      "value": "ตัวเลข",
      "unit": "หน่วย",
      "reference_range": "เช่น 70-100 หรือ <200",
      "status": "normal|high|low|unknown",
      "confidence": 0.95
    }
  ]
}

Rules:
- patient_name: อ่านชื่อ-นามสกุลจากเอกสาร เก็บเป็นภาษาไทยหรืออังกฤษตามที่ระบุในเอกสาร
- report_date: อ่านวันที่ตรวจจากเอกสาร แปลงเป็น YYYY-MM-DD (รองรับพุทธศักราชด้วย ให้แปลงเป็นคริสต์ศักราช)
- hospital: อ่านชื่อโรงพยาบาลหรือสถานพยาบาลจากเอกสาร
- items: ดึงทุกค่าตรวจที่เจอ
- status: high=เกินค่าอ้างอิงสูงสุด, low=ต่ำกว่าค่าอ้างอิงต่ำสุด, normal=ปกติ, unknown=ไม่มีค่าอ้างอิง
- Return ONLY the JSON object`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic API error' });
    }

    const raw = data.content?.[0]?.text || '';
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      return res.status(200).json(parsed);
    } catch {
      return res.status(500).json({ error: 'Failed to parse AI response', raw });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
