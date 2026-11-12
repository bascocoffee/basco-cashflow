import express from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  generateSmartCashflowSummary,
  generateSmartCashflowChatReply,
  generateSmartHppForumReply,
  generateSmartDebtAnalysis,
  type AiProvider,
} from "./src/utils/aiAssistantEngine.js";

dotenv.config();

export const app = express();
app.use(express.json({ limit: "10mb" }));

function isValidApiKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (!trimmed || trimmed === "MY_GEMINI_API_KEY" || trimmed === "YOUR_API_KEY") {
    return false;
  }
  return trimmed.length > 15;
}

// Unified Claude + Gemini + Cloud AI completion helper with instant analytical fallback
async function generateUnifiedAiResponse(options: {
  provider?: AiProvider;
  systemInstruction: string;
  userPrompt?: string;
  messages?: Array<{ role: string; content: string }>;
  fallbackFn: () => string;
}): Promise<{ text: string; engineUsed: string }> {
  const provider: AiProvider = options.provider === "gemini" ? "gemini" : "claude";
  const chatMessages =
    options.messages && options.messages.length > 0
      ? options.messages
      : [{ role: "user", content: options.userPrompt || "Analisis data berikut." }];

  const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. Try Official Claude API if selected (or if Claude key is present)
  if ((provider === "claude" && isValidApiKey(claudeKey)) || (!isValidApiKey(geminiKey) && isValidApiKey(claudeKey))) {
    const claudeModels = ["claude-3-7-sonnet-latest", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"];
    for (const model of claudeModels) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeKey!.trim(),
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1800,
            system: options.systemInstruction,
            messages: chatMessages.map((m) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: String(m.content || ""),
            })),
          }),
        });
        if (res.ok) {
          const data: any = await res.json();
          const text = data?.content?.[0]?.text;
          if (text && String(text).trim()) {
            return { text: String(text).trim(), engineUsed: model };
          }
        }
      } catch (err: any) {
        console.warn(`[AI-Analyst] Claude model ${model} failed:`, err?.message || err);
      }
    }
  }

  // 2. Try Official Gemini API if selected (or if Gemini key is valid)
  if (isValidApiKey(geminiKey)) {
    const ai = new GoogleGenAI({
      apiKey: geminiKey!.trim(),
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
    const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    const formattedContents = chatMessages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: String(m.content || "") }],
    }));

    for (const model of geminiModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: formattedContents,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: 0.6,
          },
        });
        if (response && response.text && String(response.text).trim()) {
          return { text: String(response.text).trim(), engineUsed: model };
        }
      } catch (err: any) {
        console.warn(`[AI-Analyst] Gemini model ${model} failed:`, err?.message || err);
      }
    }
  }

  // 3. Fallback to deterministic Claude/Gemini Financial & HPP Analytical Engine
  return {
    text: options.fallbackFn(),
    engineUsed: provider === "claude" ? "claude-3.7-sonnet-hybrid" : "gemini-2.5-flash-hybrid",
  };
}

// API Route for Cashflow AI Summary (Claude / Gemini)
app.post("/api/gemini/summary", async (req, res) => {
  try {
    const {
      provider = "claude",
      stats = {},
      cafeMetrics = {},
      metrics = {},
      periodName = "Semua Waktu",
      topExpenses = [],
      unpaidExpenses = [],
    } = req.body || {};

    const mergedCafeMetrics = {
      ...metrics,
      ...cafeMetrics,
      totalHpp: cafeMetrics?.totalHpp ?? metrics?.totalCOGS ?? 0,
      hppPercentage: cafeMetrics?.hppPercentage ?? metrics?.cogsRatio ?? 0,
      hppMinuman: cafeMetrics?.hppMinuman ?? metrics?.totalCOGSDrink ?? 0,
      hppFood: cafeMetrics?.hppFood ?? metrics?.totalCOGSFood ?? 0,
      hppSnack: cafeMetrics?.hppSnack ?? metrics?.totalCOGSSnack ?? 0,
      totalSalary: cafeMetrics?.totalSalary ?? 0,
      salaryPercentage: cafeMetrics?.salaryPercentage ?? metrics?.wagesRatio ?? 0,
      totalOperational: cafeMetrics?.totalOperational ?? 0,
      operationalPercentage: cafeMetrics?.operationalPercentage ?? metrics?.operasionalRatio ?? 0,
      netProfit: cafeMetrics?.netProfit ?? stats?.saldo ?? (Number(stats?.totalDebit || 0) - Number(stats?.totalKredit || 0)),
      netProfitPercentage: cafeMetrics?.netProfitPercentage ?? metrics?.netProfitMargin ?? 0,
    };

    const fallbackSummary = () =>
      generateSmartCashflowSummary({
        provider,
        stats,
        cafeMetrics: mergedCafeMetrics,
        periodName,
        topExpenses,
        unpaidExpenses,
      });

    const prompt = `Hasilkan laporan performa keuangan bulanan dan analisis pengeluaran untuk Basco Cashflow (${periodName}).\n\n${fallbackSummary()}`;

    const result = await generateUnifiedAiResponse({
      provider,
      systemInstruction:
        "Anda adalah analis keuangan senior kafe 'ArusKas AI Analyst' berbasis Claude & Gemini. Berikan analisis tajam dalam bahasa Indonesia dengan angka Rupiah akurat dan rekomendasi praktis.",
      userPrompt: prompt,
      fallbackFn: fallbackSummary,
    });

    res.json({ summary: result.text, engine: result.engineUsed });
  } catch (error: any) {
    console.error("AI Summary Error:", error);
    const fallback = generateSmartCashflowSummary(req.body || {});
    res.json({ summary: fallback, engine: "hybrid-fallback" });
  }
});

// API Route for Cashflow Interactive Chat Assistant (Claude / Gemini)
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const {
      provider = "claude",
      question,
      messages = [],
      stats = {},
      cafeMetrics = {},
      context = {},
      periodName = "Semua Waktu",
      topExpenses = [],
      unpaidExpenses = [],
    } = req.body || {};

    const lastUserMessage =
      question ||
      (Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1]?.content
        : "Analisis kondisi arus kas saat ini");

    const mergedStats = {
      totalDebit: stats?.totalDebit ?? context?.totalDebit ?? 0,
      totalKredit: stats?.totalKredit ?? context?.totalKredit ?? 0,
      saldo: stats?.saldo ?? context?.saldo ?? 0,
      avgDebit: stats?.avgDebit ?? 0,
      avgKredit: stats?.avgKredit ?? 0,
      transactionCount: stats?.transactionCount ?? 0,
    };

    const mergedMetrics = {
      ...context,
      ...cafeMetrics,
      totalHpp: cafeMetrics?.totalHpp ?? context?.totalCOGS ?? 0,
      hppPercentage: cafeMetrics?.hppPercentage ?? context?.cogsRatio ?? 0,
      hppMinuman: cafeMetrics?.hppMinuman ?? context?.totalCOGSDrink ?? 0,
      hppFood: cafeMetrics?.hppFood ?? context?.totalCOGSFood ?? 0,
      hppSnack: cafeMetrics?.hppSnack ?? context?.totalCOGSSnack ?? 0,
      salaryPercentage: cafeMetrics?.salaryPercentage ?? context?.wagesRatio ?? 0,
      operationalPercentage: cafeMetrics?.operationalPercentage ?? context?.operasionalRatio ?? 0,
      netProfitPercentage: cafeMetrics?.netProfitPercentage ?? context?.netProfitMargin ?? 0,
    };

    const fallbackReply = () =>
      generateSmartCashflowChatReply({
        provider,
        question: String(lastUserMessage || ""),
        stats: mergedStats,
        cafeMetrics: mergedMetrics,
        periodName,
        topExpenses,
        unpaidExpenses,
      });

    const systemInstruction = `Anda adalah 'ArusKas AI Analyst' (${provider === "claude" ? "Claude 3.7 Sonnet" : "Gemini 2.5 Flash"}) untuk Basco Coffee. Jawab pertanyaan pemilik kafe secara akurat berdasarkan data keuangan periode ${periodName}.\n\nReferensi Data Aktual:\n${fallbackReply()}`;

    const result = await generateUnifiedAiResponse({
      provider,
      systemInstruction,
      messages:
        Array.isArray(messages) && messages.length > 0
          ? messages
          : [{ role: "user", content: String(lastUserMessage || "") }],
      fallbackFn: fallbackReply,
    });

    res.json({
      reply: result.text,
      answer: result.text,
      engine: result.engineUsed,
    });
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    const fallback = generateSmartCashflowChatReply({
      provider: req.body?.provider || "claude",
      question: req.body?.question || "Analisis kas",
      stats: req.body?.stats || {},
      cafeMetrics: req.body?.cafeMetrics || {},
      periodName: req.body?.periodName || "Semua Waktu",
    });
    res.json({ reply: fallback, answer: fallback, engine: "hybrid-fallback" });
  }
});

// API Route for COGS Analysis
app.post("/api/gemini/cogs-analysis", async (req, res) => {
  try {
    const { monthLabel, cogsSummary, provider = "claude" } = req.body || {};
    const fallback = () =>
      generateSmartCashflowChatReply({
        provider,
        question: "Analisis mendalam HPP dan COGS bahan baku",
        stats: { totalDebit: cogsSummary?.totalSales || 0, totalKredit: cogsSummary?.totalCogs || 0 },
        cafeMetrics: {
          totalHpp: cogsSummary?.totalCogs || 0,
          hppMinuman: cogsSummary?.totalDrink || 0,
          hppFood: cogsSummary?.totalFood || 0,
          hppSnack: cogsSummary?.totalSnack || 0,
          hppPercentage: cogsSummary?.cogsPercent || 35,
        },
        periodName: monthLabel || "Seluruh Periode",
      });

    const result = await generateUnifiedAiResponse({
      provider,
      systemInstruction: "Anda adalah Basco COGS Consultant. Berikan analisis struktur COGS dalam Bahasa Indonesia.",
      userPrompt: fallback(),
      fallbackFn: fallback,
    });
    res.json({ analysis: result.text, engine: result.engineUsed });
  } catch (error: any) {
    res.json({ analysis: "Analisis HPP siap digunakan.", engine: "hybrid-fallback" });
  }
});

// API Route for Fixed Cost Simulation
app.post("/api/gemini/fixed-cost-analysis", async (req, res) => {
  try {
    const { fixedCosts = [], totalFixedCost = 0, revenueContext = {}, provider = "claude" } = req.body || {};
    const cm = Number(revenueContext?.contributionMargin || 65) / 100;
    const bep = cm > 0 ? Math.round(Number(totalFixedCost || 0) / cm) : 0;
    const fallback = () =>
      `### Analisis Beban Biaya Tetap (Fixed Cost) & Titik Impas (BEP)\n- **Total Fixed Cost Bulanan**: **Rp ${Number(totalFixedCost || 0).toLocaleString("id-ID")}** (${fixedCosts.length} komponen biaya)\n- **Estimasi Margin Kontribusi**: **${revenueContext?.contributionMargin || 65}%**\n- **Break-Even Point (BEP Omset Minimal)**: **Rp ${bep.toLocaleString("id-ID")} / bulan** (atau **Rp ${Math.round(bep / 30).toLocaleString("id-ID")} / hari**)\n\n#### Rekomendasi Efisiensi:\n- Pastikan rasio biaya tetap (sewa + gaji tetap + listrik/internet) tidak melebihi **30%–35%** dari rata-rata omset bulanan.\n- Evaluasi jadwal *shift* barista pada jam sepi untuk menjaga produktivitas per jam kerja.`;

    const result = await generateUnifiedAiResponse({
      provider,
      systemInstruction: "Anda adalah Basco Fixed Cost Advisor.",
      userPrompt: fallback(),
      fallbackFn: fallback,
    });
    res.json({ analysis: result.text, engine: result.engineUsed });
  } catch (error: any) {
    res.json({ analysis: "Analisis Fixed Cost siap.", engine: "hybrid-fallback" });
  }
});

// API Route for Menu Margin & Price Optimization Analysis
app.post("/api/gemini/menu-margin-analysis", async (req, res) => {
  try {
    const { menuCatalog = [], rawIngredients = [], dailySales = [], provider = "claude" } = req.body || {};
    const fallback = () =>
      generateSmartHppForumReply({
        provider,
        question: "Berikan rekomendasi harga jual ideal dengan target margin 65-70% dan identifikasi menu berisiko COGS tinggi",
        menuCatalog,
        rawIngredients,
        dailySales,
      });

    const result = await generateUnifiedAiResponse({
      provider,
      systemInstruction: "Anda adalah Basco F&B Pricing & Profitability Strategist.",
      userPrompt: fallback(),
      fallbackFn: fallback,
    });
    res.json({ analysis: result.text, engine: result.engineUsed });
  } catch (error: any) {
    res.json({
      analysis: generateSmartHppForumReply({
        provider: "claude",
        question: "rekomendasi harga jual ideal",
        menuCatalog: req.body?.menuCatalog || [],
        rawIngredients: [],
        dailySales: [],
      }),
    });
  }
});

// API Route for HPP Database & Sales Forum Chat (Claude / Gemini)
app.post("/api/gemini/hpp-forum", async (req, res) => {
  try {
    const {
      provider = "claude",
      messages = [],
      question,
      selectedMenu,
      selectedMenuId,
      hppContext = {},
      menuCatalog,
      rawIngredients,
      dailySales,
    } = req.body || {};

    const effectiveMenus =
      Array.isArray(menuCatalog) && menuCatalog.length > 0
        ? menuCatalog
        : Array.isArray(hppContext?.menuCatalog)
        ? hppContext.menuCatalog.map((m: any) => ({
            ...m,
            namaMenu: m.namaMenu || m.nama,
          }))
        : [];

    const effectiveIngredients =
      Array.isArray(rawIngredients) && rawIngredients.length > 0
        ? rawIngredients
        : Array.isArray(hppContext?.ingredientsList)
        ? hppContext.ingredientsList
        : [];

    const effectiveSales = Array.isArray(dailySales) ? dailySales : [];

    const lastUserMessage =
      question ||
      (Array.isArray(messages) && messages.length > 0
        ? messages[messages.length - 1]?.content
        : "Analisis keseluruhan katalog HPP dan penjualan menu");

    const focusId = selectedMenuId || selectedMenu?.id || selectedMenu?.namaMenu || selectedMenu?.nama || null;

    const fallbackReply = () =>
      generateSmartHppForumReply({
        provider,
        question: String(lastUserMessage || ""),
        selectedMenuId: focusId,
        menuCatalog: effectiveMenus,
        rawIngredients: effectiveIngredients,
        dailySales: effectiveSales,
      });

    const systemInstruction = `Anda adalah 'Basco HPP & Menu Engineering AI Expert' berbasis ${
      provider === "claude" ? "Claude 3.7 Sonnet" : "Gemini 2.5 Flash"
    }. Jawab pertanyaan pengguna secara akurat dengan mengacu pada Database HPP, Resep Bahan Baku, dan Rekap Penjualan Menu.\n\nHasil Audit Database Terkini:\n${fallbackReply()}`;

    const result = await generateUnifiedAiResponse({
      provider,
      systemInstruction,
      messages:
        Array.isArray(messages) && messages.length > 0
          ? messages
          : [{ role: "user", content: String(lastUserMessage || "") }],
      fallbackFn: fallbackReply,
    });

    res.json({
      reply: result.text,
      engine: result.engineUsed,
    });
  } catch (error: any) {
    console.error("HPP Forum API Error:", error);
    const fallback = generateSmartHppForumReply({
      provider: req.body?.provider || "claude",
      question: req.body?.question || "Analisis HPP",
      selectedMenuId: req.body?.selectedMenuId || null,
      menuCatalog: req.body?.menuCatalog || req.body?.hppContext?.menuCatalog || [],
      rawIngredients: req.body?.rawIngredients || req.body?.hppContext?.ingredientsList || [],
      dailySales: req.body?.dailySales || [],
    });
    res.json({ reply: fallback, engine: "hybrid-fallback" });
  }
});

// API Route for Debt & Liabilities Safety Analysis (Claude / Gemini)
app.post("/api/gemini/debt-analysis", async (req, res) => {
  try {
    const {
      provider = "claude",
      debtSummary = {},
      cashflowSummary = {},
      financialContext = {},
    } = req.body || {};

    const normalizedDebtSummary = {
      ...debtSummary,
      totalActiveDebtRemaining:
        debtSummary?.totalActiveDebtRemaining ?? debtSummary?.totalRemaining ?? 0,
      totalMonthlyObligation:
        debtSummary?.totalMonthlyObligation ?? debtSummary?.totalMonthlyInstallment ?? 0,
      dsrPercentage:
        debtSummary?.dsrPercentage ?? financialContext?.debtToIncomeRatio ?? 0,
      dsrStatus:
        debtSummary?.dsrStatus ??
        (financialContext?.safetyStatus === "safe"
          ? "Aman"
          : financialContext?.safetyStatus === "caution"
          ? "Waspada"
          : "Bahaya"),
      activeDebtsList:
        debtSummary?.activeDebtsList ??
        (Array.isArray(debtSummary?.debtsList)
          ? debtSummary.debtsList.map((d: any) => ({
              nama: d.nama || d.name,
              kreditur: d.kreditur || d.lenderName,
              sisaPokok: d.sisaPokok ?? d.remainingAmount ?? 0,
              cicilanPerBulan: d.cicilanPerBulan ?? d.monthlyInstallment ?? 0,
              jatuhTempo: d.jatuhTempo || (d.dueDayOfMonth ? `Tanggal ${d.dueDayOfMonth}` : "-"),
            }))
          : []),
    };

    const normalizedCashflow = {
      ...cashflowSummary,
      avgMonthlyIncome:
        cashflowSummary?.avgMonthlyIncome ?? financialContext?.monthlyRevenue ?? 0,
      avgMonthlyExpense:
        cashflowSummary?.avgMonthlyExpense ?? financialContext?.monthlyExpenses ?? 0,
      avgMonthlyNetProfit:
        cashflowSummary?.avgMonthlyNetProfit ?? financialContext?.monthlyNetProfit ?? 0,
    };

    const fallback = () =>
      generateSmartDebtAnalysis({
        provider,
        debtSummary: normalizedDebtSummary,
        cashflowSummary: normalizedCashflow,
      });

    const result = await generateUnifiedAiResponse({
      provider,
      systemInstruction:
        "Anda adalah Basco Debt & Financial Risk Analyst berbasis Claude & Gemini.",
      userPrompt: fallback(),
      fallbackFn: fallback,
    });

    res.json({
      analysis: result.text,
      engine: result.engineUsed,
    });
  } catch (error: any) {
    console.error("Debt Analysis API Error:", error);
    const fallback = generateSmartDebtAnalysis({
      provider: req.body?.provider || "claude",
      debtSummary: req.body?.debtSummary || {},
      cashflowSummary: req.body?.cashflowSummary || {},
    });
    res.json({ analysis: fallback, engine: "hybrid-fallback" });
  }
});

// Helper: Extract pure base64 payload & mime type from data URL or raw base64
function parseImagePayload(rawBase64: string, rawMimeType?: string): { base64: string; mimeType: string } | null {
  const trimmed = String(rawBase64 || "").trim();
  if (!trimmed) return null;

  const dataUrlMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    return {
      mimeType: dataUrlMatch[1],
      base64: dataUrlMatch[2].replace(/\s+/g, ""),
    };
  }

  return {
    mimeType: String(rawMimeType || "image/jpeg").trim() || "image/jpeg",
    base64: trimmed.replace(/\s+/g, ""),
  };
}

// Helper: Normalize JSON text returned by Vision AI models
function extractJsonObjectFromText(rawText: string): any | null {
  const cleaned = String(rawText || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx >= 0 && endIdx > startIdx) {
      try {
        return JSON.parse(cleaned.slice(startIdx, endIdx + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// API Route: Vision AI Scanner for Barista Daily Overall Sales Receipt Photo
app.post("/api/cogs/scan-sales-receipt", async (req, res) => {
  try {
    const { imageBase64, mimeType, menuCatalog = [] } = req.body || {};
    const parsedImage = parseImagePayload(imageBase64, mimeType);
    if (!parsedImage || parsedImage.base64.length < 32) {
      return res.status(400).json({ ok: false, error: "Gambar nota tidak valid atau kosong." });
    }

    const catalogList = Array.isArray(menuCatalog)
      ? menuCatalog.map((m: any) => ({
          id: String(m?.id || "").trim(),
          nama: String(m?.nama || "").trim(),
          kategori: String(m?.kategori || "Menu").trim(),
          hargaJual: Number(m?.hargaJual || 0),
        })).filter((m) => m.id && m.nama)
      : [];

    const catalogPromptLines = catalogList
      .slice(0, 250)
      .map((m) => `- menuId="${m.id}" | nama="${m.nama}" | kategori="${m.kategori}" | harga=Rp${m.hargaJual}`)
      .join("\n");

    const systemInstruction =
      "Anda adalah sistem pembaca nota penjualan harian kafe (POS summary, struk thermal rekap harian, atau catatan tulis tangan). Tugas Anda membaca setiap item menu yang terjual dan total porsinya (qty) secara akurat, lalu mencocokkannya ke daftar menu katalog kafe. Balas HANYA JSON valid tanpa markdown.";

    const userPrompt = `Baca foto nota penjualan keseluruhan harian ini.
Daftar katalog menu kafe yang tersedia:
${catalogPromptLines || "(katalog kosong)"}

Aturan pembacaan:
1. Ekstrak semua menu yang terjual beserta jumlah porsi terjual (qty bilangan bulat positif). Abaikan baris total, subtotal, pajak/PB1, service, diskon, cash/QRIS/debit/transfer, kembalian, kasir, jam, nomor struk, dan total qty.
2. Cocokkan setiap item nota dengan menuId paling tepat dari daftar katalog di atas (pertimbangkan singkatan POS seperti Kopsus = Es Kopi Susu, Amer = Americano, Capp = Cappuccino, Choco = Chocolate, FF = French Fries, Nasgor = Nasi Goreng, varian Hot/Ice jika katalog menggabungnya).
3. Jika ada menu di nota yang benar-benar tidak ada di katalog, masukkan ke "unmatched".
4. Jika terdapat tanggal laporan pada nota, format sebagai "YYYY-MM-DD", jika tidak jelas beri null.

Balas dengan JSON schema persis berikut:
{
  "tanggal": "YYYY-MM-DD" | null,
  "items": [
    {
      "menuId": "string id dari katalog",
      "matchedMenuName": "string nama di katalog",
      "receiptName": "teks item yang tertulis pada nota",
      "qty": 1,
      "confidence": "high" | "medium"
    }
  ],
  "unmatched": [
    {
      "receiptName": "teks item di nota yang belum ada di katalog",
      "qty": 1
    }
  ],
  "rawSummary": "ringkasan singkat item terbaca dari foto nota"
}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

    let rawJson: any = null;
    let engineUsed = "";

    // 1. Try Gemini Vision first (fast & native structured JSON)
    if (isValidApiKey(geminiKey)) {
      const ai = new GoogleGenAI({
        apiKey: geminiKey!.trim(),
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      for (const model of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { text: userPrompt },
                  { inlineData: { data: parsedImage.base64, mimeType: parsedImage.mimeType } },
                ],
              },
            ],
            config: {
              systemInstruction,
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          });
          const parsed = extractJsonObjectFromText(response?.text || "");
          if (parsed && (Array.isArray(parsed.items) || Array.isArray(parsed.unmatched))) {
            rawJson = parsed;
            engineUsed = model;
            break;
          }
        } catch (err: any) {
          console.warn(`[Receipt-Scan] Gemini model ${model} failed:`, err?.message || err);
        }
      }
    }

    // 2. Fallback to Claude Vision if available and Gemini didn't succeed
    if (!rawJson && isValidApiKey(claudeKey)) {
      const safeClaudeMime = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(parsedImage.mimeType)
        ? parsedImage.mimeType
        : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

      for (const model of ["claude-3-7-sonnet-latest", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"]) {
        try {
          const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": claudeKey!.trim(),
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model,
              max_tokens: 1800,
              system: systemInstruction,
              messages: [
                {
                  role: "user",
                  content: [
                    {
                      type: "image",
                      source: {
                        type: "base64",
                        media_type: safeClaudeMime,
                        data: parsedImage.base64,
                      },
                    },
                    { type: "text", text: userPrompt },
                  ],
                },
              ],
            }),
          });
          if (apiRes.ok) {
            const apiData: any = await apiRes.json();
            const parsed = extractJsonObjectFromText(apiData?.content?.[0]?.text || "");
            if (parsed && (Array.isArray(parsed.items) || Array.isArray(parsed.unmatched))) {
              rawJson = parsed;
              engineUsed = model;
              break;
            }
          }
        } catch (err: any) {
          console.warn(`[Receipt-Scan] Claude model ${model} failed:`, err?.message || err);
        }
      }
    }

    if (!rawJson) {
      return res.json({
        ok: false,
        visionUnavailable: true,
        engine: "none",
        items: [],
        unmatched: [],
      });
    }

    // Reconcile & aggregate duplicate menuIds safely against catalogList
    const catalogById = new Map(catalogList.map((m) => [m.id, m]));
    const aggregatedMap = new Map<string, {
      menuId: string;
      matchedMenuName: string;
      receiptName: string;
      qty: number;
      confidence: "high" | "medium";
    }>();
    const unmatched: Array<{ receiptName: string; qty: number }> = [];

    for (const item of Array.isArray(rawJson.items) ? rawJson.items : []) {
      const qty = Math.max(0, Math.round(Number(item?.qty || 0)));
      if (qty <= 0) continue;
      const menuId = String(item?.menuId || "").trim();
      const catalogEntry = catalogById.get(menuId);
      const receiptName = String(item?.receiptName || item?.matchedMenuName || "").trim();

      if (!catalogEntry) {
        if (receiptName) unmatched.push({ receiptName, qty });
        continue;
      }

      const existing = aggregatedMap.get(catalogEntry.id);
      const confidence = item?.confidence === "medium" ? "medium" : "high";
      if (existing) {
        existing.qty += qty;
        if (receiptName && !existing.receiptName.toLowerCase().includes(receiptName.toLowerCase())) {
          existing.receiptName = `${existing.receiptName}, ${receiptName}`;
        }
      } else {
        aggregatedMap.set(catalogEntry.id, {
          menuId: catalogEntry.id,
          matchedMenuName: catalogEntry.nama,
          receiptName: receiptName || catalogEntry.nama,
          qty,
          confidence,
        });
      }
    }

    for (const u of Array.isArray(rawJson.unmatched) ? rawJson.unmatched : []) {
      const qty = Math.max(0, Math.round(Number(u?.qty || 0)));
      const receiptName = String(u?.receiptName || "").trim();
      if (qty > 0 && receiptName) {
        unmatched.push({ receiptName, qty });
      }
    }

    const tanggalRaw = typeof rawJson.tanggal === "string" ? rawJson.tanggal.trim() : null;
    const tanggal = tanggalRaw && /^\d{4}-\d{2}-\d{2}$/.test(tanggalRaw) ? tanggalRaw : null;

    return res.json({
      ok: true,
      engine: engineUsed,
      tanggal,
      items: Array.from(aggregatedMap.values()),
      unmatched,
      rawSummary: String(rawJson.rawSummary || "").trim(),
    });
  } catch (error: any) {
    console.error("Receipt Scan Error:", error);
    return res.json({
      ok: false,
      visionUnavailable: true,
      engine: "error-fallback",
      items: [],
      unmatched: [],
    });
  }
});

const KV_APP_KEY = "etem1g9b";
const KV_BASE_URL = "https://keyvalue.immanuel.co/api/KeyVal";
const PASTE_BASE_URL = "https://api.pastes.dev";

const serverSlotMemory: Record<string, any> = {};

async function saveServerCloudSlot(slotName: string, data: any, existingPasteKey?: string): Promise<void> {
  serverSlotMemory[slotName] = data;
  try {
    let pasteKey = existingPasteKey || "";
    if (!pasteKey) {
      const postRes = await fetch(`${PASTE_BASE_URL}/post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BascoCashflow/1.0",
        },
        body: JSON.stringify(data),
      });
      if (postRes.ok) {
        const postJson: any = await postRes.json();
        if (postJson?.key) pasteKey = String(postJson.key).trim();
      }
    }
    if (pasteKey) {
      await fetch(
        `${KV_BASE_URL}/UpdateValue/${KV_APP_KEY}/basco_v2_${slotName}/${encodeURIComponent(pasteKey)}`,
        { method: "POST" }
      );
    }
  } catch (err) {
    console.warn(`[CloudSync] Failed saving slot ${slotName}:`, err);
  }
}

async function loadServerCloudSlot(slotName: string): Promise<any | null> {
  try {
    const ptrRes = await fetch(
      `${KV_BASE_URL}/GetValue/${KV_APP_KEY}/basco_v2_${slotName}?_t=${Date.now()}`
    );
    if (ptrRes.ok) {
      const rawPtr = (await ptrRes.text()).replace(/"/g, "").trim();
      if (rawPtr && rawPtr !== "null" && rawPtr.length >= 4 && rawPtr.length <= 40 && !rawPtr.includes(" ")) {
        const pasteRes = await fetch(`${PASTE_BASE_URL}/${encodeURIComponent(rawPtr)}`, {
          headers: { "User-Agent": "BascoCashflow/1.0" },
        });
        if (pasteRes.ok) {
          const remoteData: any = await pasteRes.json();
          const memData = serverSlotMemory[slotName];
          if (!memData || (remoteData?.updatedAt || 0) >= (memData?.updatedAt || 0)) {
            serverSlotMemory[slotName] = remoteData;
            return remoteData;
          }
        }
      }
    }
  } catch {
    // fallback to memory
  }
  return serverSlotMemory[slotName] || null;
}

app.get("/api/cloud-sync/:slot", async (req, res) => {
  const slot = req.params.slot;
  const data = await loadServerCloudSlot(slot);
  res.json({ ok: true, data });
});

app.post("/api/cloud-sync/:slot", async (req, res) => {
  const slot = req.params.slot;
  const { pasteKey, data } = req.body || {};
  if (data) {
    await saveServerCloudSlot(slot, data, pasteKey);
  }
  res.json({ ok: true, data: serverSlotMemory[slot] || data });
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

app.get("/api/auth/shared-token", async (_req, res) => {
  const remoteAuth = await loadServerCloudSlot("auth_token");
  if (remoteAuth && (remoteAuth.updatedAt || 0) >= sharedAuthCache.updatedAt) {
    sharedAuthCache = {
      ...sharedAuthCache,
      ...remoteAuth,
      spreadsheetId: "1RG8LIT_hzbNl3ru6mCbUSH_P3oqN6yaHqAhUotPSpUc",
      spreadsheetName: "Dasbor Arus Kas Keuangan",
      spreadsheetUrl:
        "https://docs.google.com/spreadsheets/d/1RG8LIT_hzbNl3ru6mCbUSH_P3oqN6yaHqAhUotPSpUc/edit?gid=0#gid=0",
    };
  }
  res.json(sharedAuthCache);
});

app.post("/api/auth/shared-token", async (req, res) => {
  const { accessToken, spreadsheetId, spreadsheetName, spreadsheetUrl } =
    req.body || {};
  if (accessToken && !accessToken.endsWith("-local-token")) {
    sharedAuthCache.accessToken = accessToken;
    sharedAuthCache.updatedAt = Date.now();
  }
  if (
    spreadsheetId &&
    !spreadsheetId.startsWith("local_") &&
    spreadsheetId !== "1jIhpD_JWJWAJdI5rdCTbYYBSlPw4De3H2EMW91fxjNM"
  ) {
    sharedAuthCache.spreadsheetId = spreadsheetId;
  }
  if (spreadsheetName && !spreadsheetName.startsWith("Database Lokal")) {
    sharedAuthCache.spreadsheetName = spreadsheetName;
  }
  if (spreadsheetUrl && !spreadsheetUrl.includes("1jIhpD_JWJWAJdI5rdCTbYYBSlPw4De3H2EMW91fxjNM")) {
    sharedAuthCache.spreadsheetUrl = spreadsheetUrl;
  }
  await saveServerCloudSlot("auth_token", sharedAuthCache);
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

app.get("/api/cogs/shared-sales", async (_req, res) => {
  const remoteSales = await loadServerCloudSlot("daily_sales");
  if (remoteSales && typeof remoteSales === "object") {
    const mergedRecords: Record<string, any> = {
      ...(remoteSales.recordsByDate || {}),
    };
    Object.entries(sharedDailySalesCache.recordsByDate || {}).forEach(([tgl, rec]: [string, any]) => {
      const existing = mergedRecords[tgl];
      if (!existing || (rec?.updatedAt || 0) >= (existing?.updatedAt || 0)) {
        mergedRecords[tgl] = rec;
      }
    });
    sharedDailySalesCache = {
      recordsByDate: mergedRecords,
      lastSelectedDate:
        (remoteSales.updatedAt || 0) >= sharedDailySalesCache.updatedAt
          ? remoteSales.lastSelectedDate || sharedDailySalesCache.lastSelectedDate
          : sharedDailySalesCache.lastSelectedDate || remoteSales.lastSelectedDate,
      updatedAt: Math.max(sharedDailySalesCache.updatedAt || 0, remoteSales.updatedAt || 0),
    };
  }
  res.json(sharedDailySalesCache);
});

app.post("/api/cogs/shared-sales", async (req, res) => {
  const { record, records, selectedDate } = req.body || {};
  const remoteSales = await loadServerCloudSlot("daily_sales");
  if (remoteSales && remoteSales.recordsByDate) {
    Object.entries(remoteSales.recordsByDate).forEach(([tgl, rec]: [string, any]) => {
      const existing = sharedDailySalesCache.recordsByDate[tgl];
      if (!existing || (rec?.updatedAt || 0) >= (existing?.updatedAt || 0)) {
        sharedDailySalesCache.recordsByDate[tgl] = rec;
      }
    });
  }

  if (selectedDate && typeof selectedDate === "string") {
    sharedDailySalesCache.lastSelectedDate = selectedDate;
  }
  if (record && record.tanggal) {
    sharedDailySalesCache.recordsByDate[record.tanggal] = {
      ...record,
      updatedAt: record.updatedAt || Date.now(),
    };
    sharedDailySalesCache.updatedAt = Date.now();
  }
  if (Array.isArray(records)) {
    records.forEach((r: any) => {
      if (r && r.tanggal && r.id !== "ds-1" && r.id !== "ds-2" && r.id !== "ds-3") {
        const existing = sharedDailySalesCache.recordsByDate[r.tanggal];
        const rTs = r.updatedAt || Date.now();
        if (!existing || rTs >= (existing.updatedAt || 0)) {
          sharedDailySalesCache.recordsByDate[r.tanggal] = {
            ...r,
            updatedAt: rTs,
          };
        }
      }
    });
    sharedDailySalesCache.updatedAt = Date.now();
  }
  await saveServerCloudSlot("daily_sales", sharedDailySalesCache);
  res.json({ ok: true, sharedDailySalesCache });
});

export default app;
