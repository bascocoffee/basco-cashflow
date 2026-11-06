import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export const app = express();
app.use(express.json());

// Helper function to handle Gemini content generation with multi-model fallback
async function generateContentWithFallback(
  ai: any,
  contents: any,
  config: any,
) {
  const models = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
  ];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(
        `[AI-Analyst] Attempting generateContent with model: ${model}`,
      );
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      if (response && response.text) {
        console.log(`[AI-Analyst] Success with model: ${model}`);
        return response;
      }
    } catch (err: any) {
      console.warn(
        `[AI-Analyst] Model ${model} failed with error:`,
        err.message || err,
      );
      lastError = err;
    }
  }
  throw lastError;
}

// API Route for Gemini analysis
app.post("/api/gemini/summary", async (req, res) => {
  try {
    const { stats, metrics, categorySpend, monthlyData } = req.body;

    // Handle missing API key gracefully
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "API Key Gemini belum dikonfigurasi. Harap tambahkan GEMINI_API_KEY di Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const formatCurr = (num: number) => {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(num);
    };

    const categorySpendListStr =
      categorySpend && categorySpend.length > 0
        ? categorySpend
            .map(
              (c: any) =>
                `- ${c.category}: ${formatCurr(c.amount)} (${c.percentage}%)`,
            )
            .join("\n")
        : "Tidak ada data kategori pengeluaran.";

    const monthlyTrendListStr =
      monthlyData && monthlyData.length > 0
        ? monthlyData
            .map(
              (m: any) =>
                `- ${m.monthLong || m.month}: Pemasukan ${formatCurr(m.debit)}, Pengeluaran ${formatCurr(m.kredit)}, Profit/Loss ${formatCurr(m.saldo)}`,
            )
            .join("\n")
        : "Tidak ada data tren bulanan.";

    const prompt = `Hasilkan laporan performa keuangan bulanan dan analisis pengeluaran untuk 'ArusKas Cafetaria'.
Berikut data kinerja keuangan yang terpilih saat ini:
- Ringkasan Kas:
  * Total Pemasukan (Omset): ${formatCurr(stats?.totalDebit || 0)}
  * Total Pengeluaran (Biaya): ${formatCurr(stats?.totalKredit || 0)}
  * Saldo Bersih (Profit/Loss): ${formatCurr(stats?.saldo || 0)}
- Rasio Bisnis F&B:
  * Margin Laba Bersih: ${metrics?.netProfitMargin || 0}%
  * Rasio Bahan Baku (COGS) Keseluruhan: ${metrics?.cogsRatio || 0}% (${formatCurr(metrics?.totalCOGS || 0)})
    - HPP Minuman (Beverages): ${metrics?.cogsDrinkRatio || 0}% (${formatCurr(metrics?.totalCOGSDrink || 0)})
    - HPP Food (Makanan): ${metrics?.cogsFoodRatio || 0}% (${formatCurr(metrics?.totalCOGSFood || 0)})
    - HPP Snack (Cemilan): ${metrics?.cogsSnackRatio || 0}% (${formatCurr(metrics?.totalCOGSSnack || 0)})
  * Rasio Gaji Staff: ${metrics?.wagesRatio || 0}%
  * Rasio Operasional: ${metrics?.operasionalRatio || 0}%
- Pengeluaran per Kategori Utama:
${categorySpendListStr}
- Tren Arus Kas Bulanan:
${monthlyTrendListStr}

Instruksi Laporan:
1. Berikan **Evaluasi Singkat** mengenai profitabilitas saat ini (apakah surplus/defisit, sehat atau dalam zona risiko berdasarkan standar rasio F&B).
2. **Analisis Pengeluaran & HPP Detail**: Identifikasi kategori pengeluaran tertinggi dan analisis juga proporsi HPP sub-kategori (Minuman, Food, Snack) jika relevan, serta berikan insight taktis bagaimana mengoptimalkannya (misalnya, jika COGS > 35%, sarankan negosiasi supplier atau penyesuaian resep; jika HPP salah satu kategori terlalu tinggi, beri rekomendasi spesifik).
3. **Saran Taktis**: Berikan 2-3 langkah operasional konkrit yang bisa segera dilakukan oleh manajemen kafe untuk meningkatkan margin keuntungan atau mengendalikan kas.`;

    const response = await generateContentWithFallback(ai, prompt, {
      systemInstruction:
        "Anda adalah analis keuangan bisnis kafe dan restoran 'ArusKas AI Analyst'. Selalu berikan analisis dalam bahasa Indonesia yang profesional, ramah, dan solutif. Gunakan poin-poin tebal dan list yang sangat rapi untuk dibaca. Hindari kata pengantar basa-basi seperti 'Tentu, berikut analisisnya' atau sejenisnya.",
      temperature: 0.7,
    });

    const summaryText = response.text || "Gagal memproses narasi.";
    res.json({ summary: summaryText });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res
      .status(500)
      .json({
        error: error.message || "Gagal memproses data melalui Gemini AI.",
      });
  }
});

// API Route for Gemini Chat Assistant
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { messages, context } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "API Key Gemini belum dikonfigurasi. Harap tambahkan GEMINI_API_KEY di Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const systemInstruction = `Anda adalah 'Basco Cashflow AI Analyst', asisten analis keuangan pintar dan interaktif untuk kafe dan bisnis Basco.
Selalu berikan jawaban dalam bahasa Indonesia yang sangat ramah, profesional, taktis, dan mudah dipahami oleh pemilik kafe.
Gunakan markdown formatting dengan poin-poin tebal (bold), tabel ringkas, atau visualisasi teks untuk mempercantik respons Anda.
Jangan berbelit-belit dan hindari basa-basi panjang.

Berikut adalah ringkasan data transaksi terbaru di database kafe saat ini:
- Total Pemasukan: Rp ${context?.totalDebit?.toLocaleString("id-ID") || 0}
- Total Pengeluaran: Rp ${context?.totalKredit?.toLocaleString("id-ID") || 0}
- Keuntungan Bersih: Rp ${context?.saldo?.toLocaleString("id-ID") || 0}
- Margin Keuntungan Bersih (NPM): ${context?.netProfitMargin || 0}%
- Rasio HPP (COGS) Keseluruhan: ${context?.cogsRatio || 0}%
  * HPP Minuman: Rp ${context?.totalCOGSDrink?.toLocaleString("id-ID") || 0} (${context?.cogsDrinkRatio || 0}%)
  * HPP Makanan (Food): Rp ${context?.totalCOGSFood?.toLocaleString("id-ID") || 0} (${context?.cogsFoodRatio || 0}%)
  * HPP Cemilan (Snack): Rp ${context?.totalCOGSSnack?.toLocaleString("id-ID") || 0} (${context?.cogsSnackRatio || 0}%)
- Rasio Gaji Karyawan: ${context?.wagesRatio || 0}%
- Rasio Operasional & Sewa: ${context?.operasionalRatio || 0}%

Jika pengguna bertanya tentang transaksi tertentu, analisis pengeluaran, saran penghematan, atau strategi bisnis, jawablah dengan mengacu pada data finansial di atas dan tawarkan solusi finansial F&B yang konkret.`;

    const formattedContents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const response = await generateContentWithFallback(ai, formattedContents, {
      systemInstruction,
      temperature: 0.7,
    });

    res.json({
      reply:
        response.text || "Maaf, saya tidak dapat merumuskan jawaban saat ini.",
    });
  } catch (error: any) {
    console.error("Gemini Chat API Error:", error);
    res
      .status(500)
      .json({ error: error.message || "Gagal berkomunikasi dengan AI." });
  }
});

// API Route for Gemini COGS Analysis
app.post("/api/gemini/cogs-analysis", async (req, res) => {
  try {
    const { monthLabel, cogsSummary, transactionsList } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "API Key Gemini belum dikonfigurasi. Harap tambahkan GEMINI_API_KEY di Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `Analisis data rincian HPP (COGS) untuk periode: ${monthLabel || "Seluruh Periode"}

Ringkasan HPP/COGS yang terdeteksi:
- Total HPP Minuman (Beverages): Rp ${cogsSummary?.totalDrink?.toLocaleString("id-ID") || 0} (${cogsSummary?.drinkPercent || 0}% dari total pengeluaran COGS)
- Total HPP Makanan (Food): Rp ${cogsSummary?.totalFood?.toLocaleString("id-ID") || 0} (${cogsSummary?.foodPercent || 0}% dari total pengeluaran COGS)
- Total HPP Cemilan (Snack): Rp ${cogsSummary?.totalSnack?.toLocaleString("id-ID") || 0} (${cogsSummary?.snackPercent || 0}% dari total pengeluaran COGS)
- Total Seluruh HPP (COGS): Rp ${cogsSummary?.totalCogs?.toLocaleString("id-ID") || 0}

Transaksi COGS teratas/sampel:
${
  transactionsList && transactionsList.length > 0
    ? transactionsList
        .slice(0, 15)
        .map(
          (t: any) =>
            `- [${t.category}] ${t.keterangan || t.categoryName || ""}: Rp ${t.amount.toLocaleString("id-ID")} (${t.tanggal})`,
        )
        .join("\n")
    : "Tidak ada data rincian transaksi."
}

Instruksi Analisis:
1. Berikan **Evaluasi Struktur COGS**: Apakah rasio distribusi COGS (Minuman, Makanan, Cemilan) ini ideal untuk sebuah cafe?
2. Berikan **Temuan Menarik**: Soroti pengeluaran COGS yang tampak tidak biasa atau cukup signifikan (seperti belanja minyak, sumpit, air galon, lpg, dsb. jika ada).
3. Berikan **Rekomendasi Taktis & Efisiensi**: Tuliskan 2-3 langkah konkrit untuk menekan biaya bahan baku tanpa mengorbankan kualitas rasa/porsi (contoh: negosiasi bulk buying, penataan standar porsi, kontrol pemborosan gas LPG/air galon).`;

    const response = await generateContentWithFallback(ai, prompt, {
      systemInstruction:
        "Anda adalah asisten konsultan keuangan kafe senior 'Basco COGS Consultant'. Berikan laporan analisis yang tajam, sangat solutif, profesional, dan dalam bahasa Indonesia yang ringkas.",
      temperature: 0.7,
    });

    res.json({ analysis: response.text || "Gagal memproses analisis HPP." });
  } catch (error: any) {
    console.error("Gemini COGS Analysis Error:", error);
    res
      .status(500)
      .json({ error: error.message || "Gagal memproses analisis HPP." });
  }
});

// API Route for Gemini Fixed Cost Simulation
app.post("/api/gemini/fixed-cost-analysis", async (req, res) => {
  try {
    const { fixedCosts, totalFixedCost, revenueContext } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "API Key Gemini belum dikonfigurasi. Harap tambahkan GEMINI_API_KEY di Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `Analisis struktur Biaya Tetap (Fixed Cost) Bulanan berikut:

Rincian Biaya Tetap:
${
  fixedCosts && fixedCosts.length > 0
    ? fixedCosts
        .map(
          (f: any) =>
            `- ${f.name} (${f.category}): Rp ${f.amount.toLocaleString("id-ID")}`,
        )
        .join("\n")
    : "Belum ada biaya tetap yang dimasukkan."
}
  
Total Biaya Tetap Bulanan: Rp ${totalFixedCost?.toLocaleString("id-ID") || 0}

Konteks Bisnis (Omset Opsional):
- Perkiraan Omset Bulanan: Rp ${revenueContext?.monthlyRevenue?.toLocaleString("id-ID") || "Belum ditentukan"}
- Perkiraan Margin Kontribusi Kotor (%): ${revenueContext?.contributionMargin || 65}% (Berapa persen sisa omset setelah dikurangi COGS/Biaya Variabel)

Instruksi Analisis:
1. **Analisis Beban Fixed Cost**: Hitung berapa Break-Even Point (BEP) dalam bentuk omset minimal berdasarkan Total Biaya Tetap ini dan Margin Kontribusi (BEP Omset = Biaya Tetap / Margin Kontribusi %).
2. **Penilaian Efisiensi**: Berikan penilaian apakah total fixed cost ini sehat untuk perkiraan omset tersebut (misalnya, biaya sewa tempat idealnya < 15% dari omset, gaji staff < 25%, dsb.).
3. **Simulasi Penghematan**: Berikan rekomendasi area biaya tetap mana yang bisa dinegosiasi ulang atau dioptimalkan (misalnya paket langganan wifi/internet, efisiensi penugasan shift karyawan untuk menekan upah tetap, dsb.).`;

    const response = await generateContentWithFallback(ai, prompt, {
      systemInstruction:
        "Anda adalah analis keuangan bisnis 'Basco Fixed Cost Advisor'. Berikan analisis terperinci, akurat dengan perhitungan BEP matematis yang jelas, dan saran taktis peningkatan efisiensi operasional.",
      temperature: 0.7,
    });

    res.json({
      analysis: response.text || "Gagal memproses analisis fixed cost.",
    });
  } catch (error: any) {
    console.error("Gemini Fixed Cost Analysis Error:", error);
    res
      .status(500)
      .json({ error: error.message || "Gagal memproses analisis fixed cost." });
  }
});

// API Route for Gemini Menu Margin & Price Optimization Analysis
app.post("/api/gemini/menu-margin-analysis", async (req, res) => {
  try {
    const { menuCatalog, targetMarginPercent = 65 } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "API Key Gemini belum dikonfigurasi. Harap tambahkan GEMINI_API_KEY di Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const prompt = `Analisis Kesehatan Margin & Rekomendasi Harga Ideal untuk Katalog Menu F&B Cafe / Kedai Kopi berikut:

Target Margin Kotor Ideal: minimal ${targetMarginPercent}% (Target COGS maksimal ${100 - targetMarginPercent}%)

Daftar Menu & Katalog HPP Terdaftar:
${
  menuCatalog && menuCatalog.length > 0
    ? menuCatalog
        .map(
          (m: any, idx: number) =>
            `${idx + 1}. [${m.kategori}] ${m.nama}: Harga Jual Rp ${(m.hargaJual || 0).toLocaleString("id-ID")} | HPP (COGS) Rp ${(m.hpp || 0).toLocaleString("id-ID")} | Profit Margin Rp ${(m.margin || 0).toLocaleString("id-ID")} (${(m.marginPct || 0).toFixed(1)}%)`,
        )
        .join("\n")
    : "Belum ada data menu."
}

Instruksi Analisis AI:
1. **Rangkuman Evaluasi Margin Katalog**:
   - Berikan skor kesehatan margin katalog keseluruhan.
   - Soroti menu mana yang memiliki margin paling baik (Star) vs menu yang marginnya di bawah standar industri F&B (< 60%).
2. **Identifikasi Menu Berisiko (COGS Terlalu Tinggi)**:
   - Sebutkan menu spesifik yang membebankan HPP tinggi relatif terhadap harga jualnya.
3. **Rekomendasi Harga Jual Ideal & Penyesuaian HPP**:
   - Untuk setiap menu yang marginnya di bawah ${targetMarginPercent}%, berikan usulan Harga Jual Baru yang direkomendasikan agar mencapai margin ideal >= ${targetMarginPercent}%.
   - Berikan saran konkret jika harga jual tidak ingin dinaikkan (misal: substitusi bahan baku, negosiasi harga supplier, penyesuaian porsi/takaran).
4. **Strategi Menu Engineering & Bundling**:
   - Berikan 2 ide paket bundling (kombinasi Makanan + Minuman / Snack) untuk mendongkrak margin rata-rata per transaksi pelanggan.`;

    const response = await generateContentWithFallback(ai, prompt, {
      systemInstruction:
        "Anda adalah konsultan F&B Pricing & Profitability Strategist berpengalaman 'Basco F&B Profit Consultant'. Berikan laporan analisis yang tajam, bernomor terstruktur, ramah, profesional, dan kaya dengan data matematis angka rupiah yang akurat.",
      temperature: 0.7,
    });

    res.json({
      analysis: response.text || "Gagal memproses analisis margin menu.",
    });
  } catch (error: any) {
    console.error("Gemini Menu Margin Analysis Error:", error);
    res
      .status(500)
      .json({
        error: error.message || "Gagal memproses analisis margin menu.",
      });
  }
});

// API Route for Gemini HPP Database & Sales Forum Chat
app.post("/api/gemini/hpp-forum", async (req, res) => {
  try {
    const { messages, selectedMenu, hppContext } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "API Key Gemini belum dikonfigurasi. Harap tambahkan GEMINI_API_KEY di Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const menuCatalogStr =
      hppContext?.menuCatalog && hppContext.menuCatalog.length > 0
        ? hppContext.menuCatalog
            .map((m: any, idx: number) => {
              const recipeStr =
                m.resep && m.resep.length > 0
                  ? m.resep
                      .map(
                        (r: any) =>
                          `    * ${r.namaBahan}: ${r.jumlahTakaran} ${r.satuanTakaran} (Biaya: Rp ${Math.round(r.biayaAtauHargaUnit || 0).toLocaleString("id-ID")})`,
                      )
                      .join("\n")
                  : "    * Tidak ada rincian resep.";
              return `${idx + 1}. [${m.kategori || "Umum"}] ${m.nama}
  - Harga Jual: Rp ${(m.hargaJual || 0).toLocaleString("id-ID")}
  - Calculated HPP (COGS): Rp ${(m.hpp || 0).toLocaleString("id-ID")}
  - Margin Profit: Rp ${(m.margin || 0).toLocaleString("id-ID")} (${(m.marginPct || 0).toFixed(1)}%)
  - Rincian Resep & Bahan per Porsi:
${recipeStr}`;
            })
            .join("\n\n")
        : "Belum ada menu terdaftar di katalog.";

    const rawIngredientsStr =
      hppContext?.ingredientsList && hppContext.ingredientsList.length > 0
        ? hppContext.ingredientsList
            .map(
              (ing: any, idx: number) =>
                `${idx + 1}. ${ing.namaBahan || ing.nama}: Beli Rp ${(ing.hargaBeli || 0).toLocaleString("id-ID")} / ${ing.satuanBeli || "-"} (Harga per ${ing.satuanTakaran || "unit"}: Rp ${Math.round(ing.hargaPerUnitTakaran || ing.hargaPerUnit || 0).toLocaleString("id-ID")})`,
            )
            .join("\n")
        : "Belum ada bahan baku di master library.";

    const salesSummaryStr = hppContext?.salesSummary
      ? `Total Penjualan: ${hppContext.salesSummary.totalItemsSold || 0} porsi | Total Omset Penjualan: Rp ${(hppContext.salesSummary.totalOmset || 0).toLocaleString("id-ID")} | Total COGS Penjualan: Rp ${(hppContext.salesSummary.totalCogs || 0).toLocaleString("id-ID")} | Profit Kotor Penjualan: Rp ${(hppContext.salesSummary.totalProfit || 0).toLocaleString("id-ID")}`
      : "Belum ada rekap penjualan harian.";

    const selectedMenuContext = selectedMenu
      ? `\nPengguna secara khusus memilih untuk membahas menu: '${selectedMenu.nama}' (Kategori: ${selectedMenu.kategori}, Harga Jual: Rp ${(selectedMenu.hargaJual || 0).toLocaleString("id-ID")}, HPP: Rp ${(selectedMenu.hpp || 0).toLocaleString("id-ID")}, Margin: ${(selectedMenu.marginPct || 0).toFixed(1)}%).\n`
      : "";

    const systemInstruction = `Anda adalah 'Basco HPP & Sales AI Expert', konsultan spesialis Penjualan Menu, Resep F&B, dan Analisis HPP (COGS) Kafe.
Tugas Anda adalah menjawab pertanyaan pengguna dengan mengacu secara AKURAT pada Database HPP & Katalog Menu yang diberikan berikut ini.

=== DATABASE MASTER BAHAN BAKU (INGREDIENTS) ===
${rawIngredientsStr}

=== KATALOG MENU, HARGA JUAL, HPP & RINCIAN RESEP ===
${menuCatalogStr}

=== SUMMARY REKAP PENJUALAN HARIAN ===
${salesSummaryStr}
${selectedMenuContext}
Instruksi Menjawab:
1. Selalu utamakan hitungan angka Rupiah, persentase margin, dan rincian resep ASLI yang ada di database HPP di atas.
2. Jika pengguna bertanya tentang menu tertentu (misal: "Kenapa HPP Es Kopi Susu tinggi?"), uraikan bahan baku mana dari resepnya yang biayanya paling dominan, dan berikan opsi efisiensi (misal ganti/kurangi takaran, atau ubah supplier).
3. Jika pengguna bertanya tentang penyesuaian harga jual atau strategi profit penjualan, berikan angka rekomendasi harga ideal secara persis berdasarkan target margin F&B (65-70%).
4. Gunakan bahasa Indonesia yang ramah, profesional, mudah dimengerti pemilik kafe, dan rapi dengan format markdown (tebal, bullet points, angka, atau tabel ringkas).`;

    const formattedContents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const response = await generateContentWithFallback(ai, formattedContents, {
      systemInstruction,
      temperature: 0.7,
    });

    res.json({
      reply:
        response.text ||
        "Maaf, saya tidak dapat merumuskan analisis HPP saat ini.",
    });
  } catch (error: any) {
    console.error("Gemini HPP Forum API Error:", error);
    res
      .status(500)
      .json({
        error: error.message || "Gagal berkomunikasi dengan AI Forum HPP.",
      });
  }
});

// API Route for Gemini Debt & Liabilities Safety Analysis
app.post("/api/gemini/debt-analysis", async (req, res) => {
  try {
    const { debtSummary, financialContext } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error:
          "API Key Gemini belum dikonfigurasi. Harap tambahkan GEMINI_API_KEY di Settings > Secrets.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const debtsListStr =
      debtSummary?.debtsList && debtSummary.debtsList.length > 0
        ? debtSummary.debtsList
            .map(
              (d: any, idx: number) =>
                `${idx + 1}. [${d.category || "Hutang"}] ${d.name} (${d.lenderName || "Kreditur"})
   - Tipe: ${d.debtType === "monthly" ? "Cicilan Bulanan" : d.debtType === "annual" ? "Beban Tahunan" : "Tempo"}
   - Angsuran Bulanan: Rp ${(d.monthlyInstallment || 0).toLocaleString("id-ID")}
   - Sisa Pokok Hutang: Rp ${(d.remainingAmount || 0).toLocaleString("id-ID")}
   - Tanggal Jatuh Tempo Tiap Bulan: Tanggal ${d.dueDayOfMonth || "-"}
   - Tenor: Angsuran ${d.paidMonths || 0} dari ${d.tenorMonths || 0} bulan
   - Status: ${d.status === "active" ? "Aktif Berjalan" : "Lunas"}`,
            )
            .join("\n\n")
        : "Belum ada daftar hutang aktif.";

    const prompt = `Analisis Risiko Hutang & Kelayakan Finansial Berhutang Bisnis Kafe (Basco Coffee):

=== REKAP BEBAN HUTANG SAAT INI ===
- Total Pokok Hutang: Rp ${(debtSummary?.totalPrincipal || 0).toLocaleString("id-ID")}
- Total Sisa Pokok Hutang: Rp ${(debtSummary?.totalRemaining || 0).toLocaleString("id-ID")}
- Total Beban Cicilan Bulanan: Rp ${(debtSummary?.totalMonthlyInstallment || 0).toLocaleString("id-ID")} / bulan
- Total Beban Cicilan Tahunan: Rp ${(debtSummary?.totalAnnualInstallment || 0).toLocaleString("id-ID")} / tahun
- Jumlah Hutang Aktif: ${debtSummary?.activeDebtCount || 0} item

=== DATA PERFORMA KEUANGAN AKTUAL KAFE (DARI ARUS KAS) ===
- Rata-rata Omset Bulanan (Revenue): Rp ${(financialContext?.monthlyRevenue || 0).toLocaleString("id-ID")}
- Rata-rata Pengeluaran Bulanan: Rp ${(financialContext?.monthlyExpenses || 0).toLocaleString("id-ID")}
- Rata-rata Laba Bersih Bulanan (Net Profit): Rp ${(financialContext?.monthlyNetProfit || 0).toLocaleString("id-ID")}
- Margin Laba Bersih: ${(financialContext?.netProfitMargin || 0).toFixed(1)}%
- Saldo Kas Kumulatif Saat Ini: Rp ${(financialContext?.cashBalance || 0).toLocaleString("id-ID")}

=== INDIKATOR & KALKULASI OTOMATIS ===
- Debt Service Coverage Ratio (DSCR): ${financialContext?.dscr || 0}x (Standar aman F&B: > 1.5x - 2.0x)
- Beban Cicilan terhadap Omset (DSR to Revenue): ${(financialContext?.debtToIncomeRatio || 0).toFixed(1)}% (Standar ideal: < 15%)
- Sisa Laba Bersih setelah Cicilan (Free Cash Flow Cushion): Rp ${(financialContext?.freeCashFlowAfterDebt || 0).toLocaleString("id-ID")}
- Status Awal Formula: ${financialContext?.safetyStatus === "safe" ? "AMAN" : financialContext?.safetyStatus === "caution" ? "WASPADA" : "BAHAYA"}

=== RINCIAN DAFTAR HUTANG & JATUH TEMPO ===
${debtsListStr}

Instruksi Laporan Analisis AI:
1. **Keputusan Utama**: Nyatakan dengan tegas apakah kondisi keuangan cafe saat ini **[🟢 AMAN]**, **[🟡 WASPADA]**, atau **[🔴 BAHAYA]** untuk memikul hutang yang ada atau menambah hutang baru, beserta alasan utamanya berdasarkan perbandingan omset dan laba bersih.
2. **Evaluasi Ketahanan Kas (Stress Test)**: Evaluasi apakah sisa laba bersih (free cash flow) sebesar Rp ${(financialContext?.freeCashFlowAfterDebt || 0).toLocaleString("id-ID")} cukup aman jika terjadi penurunan omset musiman (misal saat bulan puasa / libur semester sebesar 15-25%).
3. **Rekomendasi Plafon Berhutang Baru (Borrowing Capacity)**: Berikan taksiran nominal cicilan maksimal per bulan yang masih aman jika pemilik kafe ingin mengajukan pinjaman tambahan (misal untuk beli grinder, renovasi, atau membuka cabang kedua).
4. **Strategi Pelunasan & Mitigasi Risiko**: Berikan 2-3 langkah praktis pelunasan (misalnya urutan pelunasan dengan metode snowball/avalanche, pembagian pos dana khusus cicilan per minggu agar tidak kaget saat tanggal jatuh tempo, dan tips menjaga likuiditas harian).`;

    const response = await generateContentWithFallback(ai, prompt, {
      systemInstruction:
        "Anda adalah analis risiko perbankan dan konsultan keuangan senior F&B 'Basco Debt & Financial Risk Analyst'. Selalu berikan analisis dalam bahasa Indonesia yang objektif, bernas, profesional, dilengkapi angka rupiah yang konkrit, dan mudah dipahami oleh pemilik kafe.",
      temperature: 0.7,
    });

    res.json({
      analysis: response.text || "Gagal menghasilkan analisis hutang.",
    });
  } catch (error: any) {
    console.error("Gemini Debt Analysis Error:", error);
    res
      .status(500)
      .json({
        error:
          error.message ||
          "Gagal memproses analisis kelayakan hutang melalui AI.",
      });
  }
});

// Shared Google OAuth Token & Spreadsheet Config Sync across devices
let sharedAuthCache: {
  accessToken: string | null;
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  updatedAt: number;
} = {
  accessToken: null,
  spreadsheetId: "1RG8LIT_hzbNl3ru6mCbUSH_P3oqN6yaHqAhUotPSpUc",
  spreadsheetName: "Dasbor Arus Kas Keuangan",
  spreadsheetUrl:
    "https://docs.google.com/spreadsheets/d/1RG8LIT_hzbNl3ru6mCbUSH_P3oqN6yaHqAhUotPSpUc/edit?gid=0#gid=0",
  updatedAt: 0,
};

app.get("/api/auth/shared-token", (_req, res) => {
  res.json(sharedAuthCache);
});

app.post("/api/auth/shared-token", (req, res) => {
  const { accessToken, spreadsheetId, spreadsheetName, spreadsheetUrl } =
    req.body || {};
  if (accessToken && !accessToken.endsWith("-local-token")) {
    sharedAuthCache.accessToken = accessToken;
    sharedAuthCache.updatedAt = Date.now();
  }
  if (spreadsheetId && !spreadsheetId.startsWith("local_")) {
    sharedAuthCache.spreadsheetId = spreadsheetId;
  }
  if (spreadsheetName && !spreadsheetName.startsWith("Database Lokal")) {
    sharedAuthCache.spreadsheetName = spreadsheetName;
  }
  if (spreadsheetUrl) {
    sharedAuthCache.spreadsheetUrl = spreadsheetUrl;
  }
  res.json({ ok: true, sharedAuthCache });
});

// Shared Daily Sales & Jatah Sync across roles (Barista -> Owner & Manager)
let sharedDailySalesCache: {
  recordsByDate: Record<string, any>;
  lastSelectedDate: string | null;
  updatedAt: number;
} = {
  recordsByDate: {},
  lastSelectedDate: null,
  updatedAt: 0,
};

app.get("/api/cogs/shared-sales", (_req, res) => {
  res.json(sharedDailySalesCache);
});

app.post("/api/cogs/shared-sales", (req, res) => {
  const { record, records, selectedDate } = req.body || {};
  if (selectedDate && typeof selectedDate === "string") {
    sharedDailySalesCache.lastSelectedDate = selectedDate;
  }
  if (record && record.tanggal) {
    sharedDailySalesCache.recordsByDate[record.tanggal] = {
      ...record,
      updatedAt: Date.now(),
    };
    sharedDailySalesCache.updatedAt = Date.now();
  }
  if (Array.isArray(records)) {
    records.forEach((r: any) => {
      if (r && r.tanggal) {
        sharedDailySalesCache.recordsByDate[r.tanggal] = {
          ...r,
          updatedAt: r.updatedAt || Date.now(),
        };
      }
    });
    sharedDailySalesCache.updatedAt = Date.now();
  }
  res.json({ ok: true, sharedDailySalesCache });
});

export default app;
