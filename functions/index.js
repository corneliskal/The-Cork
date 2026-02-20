const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Get API keys from Firebase environment config
// Set these with: firebase functions:config:set gemini.key="AIza..."
const getGeminiKey = () => functions.config().gemini?.key;
const getSerperKey = () => functions.config().serper?.key;

// Serper.dev web search — used as cheap RAG alternative to Gemini grounding
async function serperWebSearch(query, serperKey, num = 5) {
    const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num })
    });
    if (!response.ok) return null;
    const data = await response.json();
    return formatSearchResults(data);
}

function formatSearchResults(data) {
    const parts = [];
    if (data.knowledgeGraph) {
        const kg = data.knowledgeGraph;
        parts.push(`[Knowledge Graph] ${kg.title || ''}: ${kg.description || ''}`);
        if (kg.attributes) {
            Object.entries(kg.attributes).forEach(([k, v]) => parts.push(`  ${k}: ${v}`));
        }
    }
    if (data.answerBox) {
        parts.push(`[Answer] ${data.answerBox.title || ''}: ${data.answerBox.answer || data.answerBox.snippet || ''}`);
    }
    if (data.organic) {
        data.organic.forEach((r, i) => {
            parts.push(`[${i + 1}] ${r.title}\n${r.snippet || ''}\nURL: ${r.link}`);
        });
    }
    return parts.join('\n\n') || null;
}

// Middleware to verify Firebase Auth
const verifyAuth = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized - No token provided' });
        return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Unauthorized - Invalid token' });
        return null;
    }
};

// ================================
// Gemini Vision API - Analyze Wine Label
// ================================
exports.analyzeWineLabel = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Verify user is authenticated
    const user = await verifyAuth(req, res);
    if (!user) return;

    const geminiKey = getGeminiKey();
    if (!geminiKey) {
        res.status(500).json({ error: 'Gemini API not configured' });
        return;
    }

    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) {
            res.status(400).json({ error: 'No image provided' });
            return;
        }

        // Initialize Gemini
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Extract base64 data (remove data URL prefix if present)
        let base64Data = imageBase64;
        let mimeType = 'image/jpeg';
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            }
        }

        const prompt = `Analyze this wine label image and extract the following information in JSON format:
{
    "name": "cuvée or wine name (the specific cuvée, vineyard, or wine name — NOT the producer/domaine. E.g. Domaine Achillée Rittersberg Riesling → 'Rittersberg', Cloudy Bay Sauvignon Blanc → 'Sauvignon Blanc')",
    "producer": "producer/house name (château, domaine, winery or estate name - never use legal entity names like Société Civile, S.A., M.L.P., SRL, GmbH etc.)",
    "year": year as number or null,
    "region": "region, country",
    "grape": "grape variety/varieties",
    "type": "red/white/rosé/sparkling/dessert",
    "characteristics": {
        "boldness": 1-5,
        "tannins": 1-5,
        "acidity": 1-5
    },
    "notes": "brief tasting notes or description based on the wine style",
    "drinking_window": {
        "canDrinkFrom": year as number,
        "bestFrom": year as number,
        "peakFrom": year as number,
        "peakUntil": year as number,
        "bestUntil": year as number,
        "canDrinkUntil": year as number
    }
}

For drinking_window, estimate based on wine type, grape variety, region, and vintage:
- canDrinkFrom/canDrinkUntil: the full possible drinking range
- bestFrom/bestUntil: when the wine is drinking well
- peakFrom/peakUntil: the optimal sweet spot (middle third of best range)
Guidelines:
- Simple white/rosé wines: best 1-3 years, can drink ±1 year buffer
- Quality white wines (Burgundy, Riesling): best 3-10 years, can drink ±2 years
- Light red wines (Beaujolais, Pinot Noir): best 2-7 years, can drink ±2 years
- Medium red wines (Chianti, Rioja): best 5-15 years, can drink ±3 years
- Full-bodied reds (Bordeaux, Barolo): best 10-30+ years, can drink ±5 years
- Sparkling wines: best 1-5 years (vintage Champagne: 10-20 years)
- Dessert wines: best 5-50+ years depending on quality

Naming examples:
- Château Pétrus label → name: "Pétrus", producer: "Château Pétrus"
- Tenuta San Guido Sassicaia → name: "Sassicaia", producer: "Tenuta San Guido"
- Domaine de la Romanée-Conti → name: "Romanée-Conti", producer: "Domaine de la Romanée-Conti"
- Opus One by Mondavi & Rothschild → name: "Opus One", producer: "Opus One Winery"

If you cannot determine a value, use null. For type, make your best guess based on the wine name/region.
Only respond with the JSON, no other text.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            }
        ]);

        const content = result.response.text();
        console.log('Gemini response:', content);

        // Parse JSON from response
        let wineData;
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                wineData = JSON.parse(jsonMatch[0]);
            } else {
                wineData = JSON.parse(content);
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            res.status(500).json({ error: 'Failed to parse wine data', raw: content });
            return;
        }

        res.json({ success: true, data: wineData });

    } catch (error) {
        console.error('Gemini error:', error);
        res.status(500).json({ error: 'Failed to analyze image', message: error.message });
    }
});

// ================================
// Quick Wine Label Scan - Fast extraction of basic label info
// ================================
exports.quickAnalyzeWineLabel = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const user = await verifyAuth(req, res);
    if (!user) return;

    const geminiKey = getGeminiKey();
    if (!geminiKey) {
        res.status(500).json({ error: 'Gemini API not configured' });
        return;
    }

    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            res.status(400).json({ error: 'No image provided' });
            return;
        }

        // Extract base64 data (remove data URL prefix if present)
        let base64Data = imageBase64;
        let mimeType = 'image/jpeg';
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                base64Data = matches[2];
            }
        }

        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

        const prompt = `Read this wine label and extract ONLY these 6 fields as JSON:
{
    "name": "cuvée or wine name (NOT the producer/domaine name)",
    "producer": "domaine, château, house, or winery name",
    "year": year as number or null,
    "region": "region, country",
    "grape": "grape variety",
    "type": "red/white/rosé/sparkling/dessert"
}
Rules:
- "name" is the cuvée, vineyard, or specific wine name — NOT the domaine/producer.
- "producer" is the domaine, château, maison, winery, or estate.
- Examples: Domaine Achillée "Rittersberg" Riesling → name: "Rittersberg", producer: "Domaine Achillée". Château Pétrus → name: "Pétrus", producer: "Château Pétrus". Cloudy Bay Sauvignon Blanc → name: "Sauvignon Blanc", producer: "Cloudy Bay".
- If only one name is visible and it's clearly a domaine/château, use it as producer and set name to the grape or appellation.
Only JSON, no other text.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            }
        ]);

        const content = result.response.text();
        console.log('Quick scan response:', content);

        let wineData;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                wineData = JSON.parse(jsonMatch[0]);
            } else {
                wineData = JSON.parse(content);
            }
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            res.status(500).json({ error: 'Failed to parse response', raw: content });
            return;
        }

        res.json({ success: true, data: wineData });

    } catch (error) {
        console.error('Quick scan error:', error);
        res.status(500).json({ error: 'Failed to analyze image', message: error.message });
    }
});

// ================================
// Gemini Price Lookup - Get wine price using Google Search grounding
// ================================
exports.lookupWinePrice = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        // Verify user is authenticated
        const user = await verifyAuth(req, res);
        if (!user) return;

        const geminiKey = getGeminiKey();
        if (!geminiKey) {
            res.json({ success: true, data: null, message: 'Gemini API not configured' });
            return;
        }

        try {
            const { name, producer, year, region } = req.body;
            if (!name) {
                res.status(400).json({ error: 'Wine name is required' });
                return;
            }

            // Build search query
            const searchTerms = [producer, name, year, region].filter(Boolean).join(' ');
            console.log('🍷 Price lookup for:', searchTerms);

            const genAI = new GoogleGenerativeAI(geminiKey);
            const serperKey = getSerperKey();

            const pricePrompt = `Extract the current retail price of this wine from the search results below.
Focus on European/Dutch prices in EUR (€).

Return ONLY a JSON object with this format, no other text:
{
    "price": number (average price in EUR, just the number without currency symbol),
    "priceRange": "€X - €Y" (price range if found),
    "source": "where you found the price",
    "confidence": "high/medium/low"
}

If you cannot find a reliable price, return:
{"price": null, "source": "not found", "confidence": "low"}`;

            let content;

            // Try Serper RAG first (cheap), fallback to Gemini grounding
            if (serperKey) {
                const priceQuery = `${searchTerms} wine price EUR buy`;
                console.log('🔎 Serper price search:', priceQuery);
                const searchResults = await serperWebSearch(priceQuery, serperKey, 5);

                if (searchResults) {
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const ragPrompt = `Wine: "${searchTerms}"\n\nWEB SEARCH RESULTS:\n${searchResults}\n\n${pricePrompt}`;
                    const result = await model.generateContent(ragPrompt);
                    content = result.response.text();
                    console.log('Serper RAG price response:', content);
                }
            }

            if (!content) {
                // Fallback: Gemini grounding
                console.log('🔎 Fallback: Gemini grounding for price');
                const model = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    tools: [{ googleSearch: {} }]
                });
                const prompt = `Search for the current retail price of this wine: "${searchTerms}"\n\nLook for prices on wine retailers, Vivino, Wine-Searcher, or other wine shops.\nFocus on European/Dutch prices in EUR (€).\n\n${pricePrompt}`;
                const result = await model.generateContent(prompt);
                content = result.response.text();
                console.log('Gemini grounded price response:', content);
            }

            // Parse JSON from response
            let priceData = null;
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    priceData = JSON.parse(jsonMatch[0]);
                }
            } catch (parseError) {
                console.error('Price JSON parse error:', parseError);
            }

            res.json({
                success: true,
                data: priceData,
                searchTerms: searchTerms
            });

        } catch (error) {
            console.error('Gemini price lookup error:', error);
            res.json({ success: true, data: null, message: error.message });
        }
    });
});

// ================================
// Serper.dev Image Search - Find wine product photo
// ================================
exports.searchWineImage = functions.https.onRequest(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const user = await verifyAuth(req, res);
    if (!user) return;

    const serperKey = getSerperKey();
    if (!serperKey) {
        res.json({ success: true, data: null, message: 'Serper API not configured' });
        return;
    }

    try {
        const { name, producer, year, type } = req.body;
        if (!name) {
            res.status(400).json({ error: 'Wine name is required' });
            return;
        }

        const query = [name, producer, type, 'wine bottle png'].filter(Boolean).join(' ');
        console.log('🖼️ Serper image search for:', query);

        const response = await fetch('https://google.serper.dev/images', {
            method: 'POST',
            headers: {
                'X-API-KEY': serperKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: query, num: 10 })
        });

        if (!response.ok) {
            console.error('Serper API error:', response.status);
            res.json({ success: true, data: null, message: 'Serper API error' });
            return;
        }

        const data = await response.json();
        console.log('🖼️ Serper results:', data.images?.length || 0, 'images');

        // Find suitable images (large enough, not from vivino)
        const candidates = data.images?.filter(img =>
            img.imageUrl &&
            img.imageWidth > 200 &&
            img.imageHeight > 200 &&
            !img.imageUrl.includes('vivino.com')
        ) || [];

        // Try to fetch image server-side to avoid CORS issues
        let imageBase64 = null;
        let usedImage = null;
        for (const img of candidates.slice(0, 5)) {
            try {
                const imgResponse = await fetch(img.imageUrl, { redirect: 'follow' });
                if (!imgResponse.ok) continue;
                const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
                if (!contentType.startsWith('image/')) continue;
                const buffer = await imgResponse.arrayBuffer();
                if (buffer.byteLength > 2 * 1024 * 1024) continue; // skip > 2MB
                imageBase64 = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
                usedImage = img;
                break;
            } catch (e) {
                console.log('Failed to fetch image:', img.imageUrl, e.message);
            }
        }

        res.json({
            success: true,
            data: {
                imageUrl: usedImage?.imageUrl || null,
                imageBase64: imageBase64,
                source: usedImage?.source || null
            }
        });

    } catch (error) {
        console.error('Serper image search error:', error);
        res.json({ success: true, data: null, message: error.message });
    }
});

// ================================
// Deep Wine Analysis - Search based on text input
// ================================
exports.deepAnalyzeWineLabel = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const user = await verifyAuth(req, res);
    if (!user) return;

    const geminiKey = getGeminiKey();
    if (!geminiKey) {
        res.status(500).json({ error: 'Gemini API not configured' });
        return;
    }

    try {
        const { name, producer, year, grape, region } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Wine name is required' });
            return;
        }

        console.log('🔍 Wine search for:', name, producer, year, grape, region);

        const genAI = new GoogleGenerativeAI(geminiKey);
        const searchTerms = [name, producer, year, grape, region].filter(Boolean).join(' ');

        const basePrompt = `Wine: "${searchTerms}"

GOAL: Extract expert data into JSON.
RULES:
1. Sources: Prioritize Wine Advocate, Vinous, Jancis Robinson, Suckling.
2. Logic: If experts vary, use latest 'From' and earliest 'Until'.
3. NV Wine: Use most recent disgorgement/base year.
4. Calculations:
   - bestFrom/Until = Expert stated range.
   - peakFrom/Until = Middle 33% of best range.
   - canDrinkFrom/Until = best range +/- 3 years.
5. Missing Data: Omit 'expert_ratings' if no professional reviews found; estimate traits from terroir/varietal.
6. Name: Use the cuvée/vineyard/wine name, NOT the producer. E.g. Domaine Achillée Rittersberg Riesling → name: "Rittersberg", producer: "Domaine Achillée".
7. Producer: Château, domaine, winery or estate name. Never use legal entity names (Société Civile, S.A., M.L.P., SRL, GmbH etc.).

OUTPUT: Minified JSON only. No prose.
Schema: {"name":"","producer":"","year":0,"region":"","grape":"","type":"red/white/rosé/sparkling/dessert","expert_ratings":[{"source":"","score":"","window":""}],"characteristics":{"boldness":1,"tannins":1,"acidity":1,"alcohol_pct":""},"notes":"","drinking_window":{"canDrinkFrom":0,"bestFrom":0,"peakFrom":0,"peakUntil":0,"bestUntil":0,"canDrinkUntil":0},"confidence":0}`;

        // Step 1: Try WITHOUT grounding (cheap)
        const modelLight = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const promptStep1 = basePrompt + `\n\nconfidence: 0-100 integer reflecting how certain you are about the data (especially expert_ratings and drinking_window). 90+ = well-known wine with reliable data. <70 = obscure/uncertain.`;

        console.log('⚡ Step 1: without grounding...');
        const result1 = await modelLight.generateContent(promptStep1);
        const content1 = result1.response.text();
        console.log('Step 1 response:', content1);

        let wineData;
        try {
            const jsonMatch1 = content1.match(/\{[\s\S]*\}/);
            wineData = JSON.parse(jsonMatch1 ? jsonMatch1[0] : content1);
        } catch (parseError) {
            console.error('Step 1 JSON parse error:', parseError);
            res.status(500).json({ error: 'Failed to parse wine data', raw: content1 });
            return;
        }

        const confidence = wineData.confidence || 0;
        let grounded = false;

        // Step 2: If low confidence, use Serper RAG (or fallback to grounding)
        if (confidence < 70) {
            const serperKey = getSerperKey();
            let searchResults = null;

            if (serperKey) {
                console.log(`🔎 Step 2: confidence ${confidence} < 70, searching with Serper...`);
                const wineQuery = `${searchTerms} wine expert rating drinking window review`;
                searchResults = await serperWebSearch(wineQuery, serperKey, 5);
                if (searchResults) console.log('Serper results length:', searchResults.length, 'chars');
            }

            if (searchResults) {
                // RAG: feed search results as context to Gemini (no grounding needed)
                const ragPrompt = basePrompt.replace('confidence":0}', '"}') + `\n\nWEB SEARCH RESULTS:\n${searchResults}`;
                const result2 = await modelLight.generateContent(ragPrompt);
                const content2 = result2.response.text();
                console.log('Step 2 Serper RAG response:', content2);

                try {
                    const jsonMatch2 = content2.match(/\{[\s\S]*\}/);
                    wineData = JSON.parse(jsonMatch2 ? jsonMatch2[0] : content2);
                    grounded = true;
                } catch (parseError2) {
                    console.error('Step 2 RAG parse error, using step 1 result:', parseError2);
                }
            } else {
                // Fallback: use Gemini grounding if Serper unavailable
                console.log(`🔎 Step 2: Serper unavailable, falling back to Gemini grounding...`);
                const modelGrounded = genAI.getGenerativeModel({
                    model: 'gemini-2.5-flash',
                    tools: [{ googleSearch: {} }]
                });

                const result2 = await modelGrounded.generateContent(basePrompt);
                const content2 = result2.response.text();
                console.log('Step 2 grounded response:', content2);

                try {
                    const jsonMatch2 = content2.match(/\{[\s\S]*\}/);
                    wineData = JSON.parse(jsonMatch2 ? jsonMatch2[0] : content2);
                    grounded = true;
                } catch (parseError2) {
                    console.error('Step 2 grounding parse error, using step 1 result:', parseError2);
                }
            }
        } else {
            console.log(`✅ Step 1 sufficient: confidence ${confidence}`);
        }

        delete wineData.confidence;
        res.json({ success: true, data: wineData, grounded });

    } catch (error) {
        console.error('Wine search error:', error);
        res.status(500).json({ error: 'Search failed', message: error.message });
    }
});

// ================================
// Health check endpoint
// ================================
exports.health = functions.https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
        status: 'ok',
        geminiConfigured: !!getGeminiKey(),
        serperConfigured: !!getSerperKey()
    });
});
