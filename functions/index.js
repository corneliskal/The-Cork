const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Get API keys from Firebase environment config
// Set these with: firebase functions:config:set gemini.key="AIza..."
const getGeminiKey = () => functions.config().gemini?.key;

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
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
    "name": "wine name (the official wine name only, without the producer name)",
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
    "drinkFrom": year as number (estimated optimal drinking window start),
    "drinkUntil": year as number (estimated optimal drinking window end)
}

For drinkFrom and drinkUntil, estimate based on wine type, grape variety, region, and vintage:
- Simple white/rosé wines: drink within 1-3 years of vintage
- Quality white wines (Burgundy, Riesling): 3-10 years
- Light red wines (Beaujolais, Pinot Noir): 2-7 years
- Medium red wines (Chianti, Rioja): 5-15 years
- Full-bodied reds (Bordeaux, Barolo): 10-30+ years
- Sparkling wines: 1-5 years (vintage Champagne: 10-20 years)
- Dessert wines: 5-50+ years depending on quality

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
            console.log('🍷 Gemini price lookup for:', searchTerms);

            // Initialize Gemini with Google Search grounding
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.0-flash',
                tools: [{
                    googleSearch: {}
                }]
            });

            const prompt = `Search for the current retail price of this wine: "${searchTerms}"

Look for prices on wine retailers, Vivino, Wine-Searcher, or other wine shops.
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

            const result = await model.generateContent(prompt);
            const content = result.response.text();
            console.log('Gemini price response:', content);

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
// Health check endpoint
// ================================
exports.health = functions.https.onRequest((req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.json({
        status: 'ok',
        geminiConfigured: !!getGeminiKey()
    });
});
