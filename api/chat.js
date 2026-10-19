export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { message, image, mimeType, dataAnak } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // Mengambil dari Vercel Environment Variables

  if (!apiKey) {
    return res.status(500).json({ error: 'API key belum dikonfigurasi di server.' });
  }

  const { nama = "Anak", tb = 0, bb = 0, tglLahir } = dataAnak || {};
  let umurInfo = "Umur tidak diketahui";
  if(tglLahir) {
      const today = new Date(); const birth = new Date(tglLahir);
      let y = today.getFullYear() - birth.getFullYear();
      let m = today.getMonth() - birth.getMonth();
      if (m < 0) { y--; m += 12; }
      umurInfo = `${y} Thn ${m} Bln`;
  }

  const systemPrompt = `
  Role: Ahli Gizi Anak & Spesialis Tumbuh Kembang.
  Data Anak: Nama ${nama}, Umur ${umurInfo}, Tinggi Badan ${tb}cm, Berat Badan ${bb}kg.
  Input Ibu: "${message}"

  TUGAS:
  1. Analisis status gizi, tumbuh kembang, dan visual (jika ada foto makanan/fisik).
  2. Berikan rekomendasi menu makan & saran kesehatan praktis.
  3. JANGAN BASA-BASI. OUTPUT WAJIB DALAM FORMAT JSON MURNI DENGAN SKEMA BERIKUT:
  {
      "is_relevant": true,
      "chat_reply": "Jawaban yang ramah dan solutif untuk Ibu...",
      "malnutrition_status": "aman", 
      "malnutrition_text": "Penjelasan detail status nutrisi & perkembangannya...",
      "analysis": {
          "gizi": { "status": "Normal", "desc": "Penjelasan status gizi..." },
          "vitamin": { "status": "Cukup", "desc": "Saran pemenuhan vitamin..." },
          "tidur": { "status": "Baik", "desc": "Pola tidur yang disarankan..." },
          "fisik": { "status": "Aktif", "desc": "Aktivitas fisik anak..." }
      },
      "menu": [
          {"name": "Makan Pagi", "time": "07:00", "nutrients": "Karbohidrat & Protein", "cal": "250 kkal"},
          {"name": "Makan Siang", "time": "12:00", "nutrients": "Protein Hewani & Serat", "cal": "350 kkal"},
          {"name": "Makan Malam", "time": "18:00", "nutrients": "Protein Lengkap & Lemak Sehat", "cal": "300 kkal"}
      ],
      "report_summary": "Ringkasan laporan medis & perkembangan anak hari ini..."
  }
  `;

  const requestParts = [{ text: systemPrompt }];
  if (image && mimeType) {
      requestParts.push({ inlineData: { mimeType: mimeType, data: image } });
  }

  try {
    const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: requestParts }] })
    });

    const data = await apiResponse.json();
    if (data.error) throw new Error(data.error.message);

    let rawText = data.candidates[0].content.parts[0].text;
    let aiData;
    try {
        let cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        aiData = JSON.parse(cleanText);
    } catch (e) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        aiData = jsonMatch ? JSON.parse(jsonMatch[0]) : { chat_reply: rawText };
    }

    return res.status(200).json(aiData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}