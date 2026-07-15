const express = require(‘express’);
const { createClient } = require(‘webdav’);
const axios = require(‘axios’);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// سماح بالوصول من أي مكان (CORS)
app.use((req, res, next) => {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Headers’, ’*’);
next();
});

// دالة مساعدة لتشفير وفك تشفير البيانات الممررة بالرابط لأسباب أمنية
function encodeConfig(config) {
return Buffer.from(JSON.stringify(config)).toString(‘base64url’);
}

function decodeConfig(encoded) {
try {
return JSON.parse(Buffer.from(encoded, ‘base64url’).toString(‘utf-8’));
} catch (e) {
return null;
}
}

// دالة البحث التعاودي في FebBox
async function findFileInFebBox(client, directoryPath, searchTitle) {
try {
const items = await client.getDirectoryContents(directoryPath);
for (const item of items) {
if (item.type === ‘file’) {
const filenameLower = item.basename.toLowerCase();
const searchTitleLower = searchTitle.toLowerCase();

            if (filenameLower.includes(searchTitleLower) && (filenameLower.endsWith('.mp4') || filenameLower.endsWith('.mkv'))) {
                return item;
            }
        } else if (item.type === 'directory') {
            const found = await findFileInFebBox(client, item.filename, searchTitle);
            if (found) return found;
        }
    }
} catch (err) {
    console.error(`Error searching directory ${directoryPath}:`, err.message);
}
return null;

}

// ==========================================
// 1. واجهة المستخدم الرسومية (Configure Page)
// ==========================================
app.get(’/’, (req, res) => {
res.send(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>إعداد مكتشف FebBox الذكي 🔍</title>
<style>
body {
font-family: ‘Segoe UI’, Tahoma, Geneva, Verdana, sans-serif;
background-color: #0f0c1b;
color: #ffffff;
display: flex;
justify-content: center;
align-items: center;
min-height: 100vh;
margin: 0;
}
.container {
background: #16122c;
padding: 30px;
border-radius: 12px;
box-shadow: 0 8px 24px rgba(0,0,0,0.5);
width: 90%;
max-width: 450px;
border: 1px solid #31285c;
}
h2 { text-align: center; color: #a176ff; margin-bottom: 20px; }
.form-group { margin-bottom: 15px; }
label { display: block; margin-bottom: 8px; font-size: 14px; color: #bca8ff; }
input {
width: 100%;
padding: 12px;
border-radius: 6px;
border: 1px solid #31285c;
background: #0f0c1b;
color: #fff;
font-size: 14px;
box-sizing: border-box;
}
input:focus { outline: none; border-color: #8247ff; }
button {
width: 100%;
padding: 14px;
border: none;
border-radius: 6px;
background: linear-gradient(135deg, #8247ff, #6313ff);
color: white;
font-size: 16px;
font-weight: bold;
cursor: pointer;
transition: transform 0.2s, background 0.3s;
margin-top: 10px;
}
button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(130,71,255,0.4); }
.footer { text-align: center; margin-top: 15px; font-size: 11px; color: #695e93; }
</style>
</head>
<body>
<div class="container">
<h2>إعداد مكتشف FebBox الذكي 🔍</h2>
<div class="form-group">
<label>رابط WebDAV الخاص بـ FebBox:</label>
<input type="text" id="webdav_url" value="https://webdav.febbox.com" placeholder="https://webdav.febbox.com">
</div>
<div class="form-group">
<label>اسم المستخدم (البريد الإلكتروني):</label>
<input type="text" id="username" placeholder="example@email.com">
</div>
<div class="form-group">
<label>كلمة مرور الـ WebDAV (وليس حسابك الأساسي):</label>
<input type="password" id="password" placeholder="أدخل كلمة مرور الـ WebDAV">
</div>
<button onclick="installAddon()">تثبيت الإضافة في Stremio 🚀</button>
<button onclick="copyManifest()" style="background: #1f1b3d; color: #bca8ff; margin-top: 8px;">نسخ الرابط لـ Nuvio 📋</button>
<div class="footer">صنع بكل حب لتجربة مشاهدة مستقرة وحرة 🎬</div>
</div>

    <script>
        function getManifestUrl() {
            let webdavUrl = document.getElementById('webdav_url').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();

            if(!username || !password) {
                alert('فضلاً قم بملء جميع الحقول أولاً!');
                return null;
            }

            // إزالة أي / زائدة في نهاية الرابط لتفادي أخطاء المسار لاحقًا
            webdavUrl = webdavUrl.replace(/\\/+$/, '');

            const config = { url: webdavUrl, user: username, pass: password };
            const json = JSON.stringify(config);
            const encoded = btoa(unescape(encodeURIComponent(json)))
                            .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, ''); // Base64url safe

            const host = window.location.host;
            const protocol = window.location.protocol;
            return protocol + '//' + host + '/' + encoded + '/manifest.json';
        }

        function installAddon() {
            const url = getManifestUrl();
            if(url) {
                const stremioUrl = url.replace('https://', 'stremio://').replace('http://', 'stremio://');
                window.location.href = stremioUrl;
            }
        }

        function copyManifest() {
            const url = getManifestUrl();
            if(url) {
                navigator.clipboard.writeText(url).then(() => {
                    alert('تم نسخ الرابط بنجاح! يمكنك الآن لصقه في تطبيق Nuvio.');
                }).catch(() => {
                    alert('تعذر نسخ الرابط تلقائيًا، انسخه يدويًا:\\n' + url);
                });
            }
        }
    </script>
</body>
</html>
`);

});

// ==========================================
// 2. تفعيل الـ Manifest المخصص المشفر بالبيانات
// ==========================================
app.get(’/:config/manifest.json’, (req, res) => {
const config = decodeConfig(req.params.config);
if (!config || !config.url || !config.user || !config.pass) {
return res.status(400).json({ err: “بيانات الاعتماد غير صالحة” });
}

const manifest = {
    id: "community.aseel.febbox.custom",
    version: "1.2.0",
    name: "مكتشف FebBox الخاص بك 🔍",
    description: `أداة البحث التلقائي لـ FebBox - متصل بـ ${config.user}`,
    resources: ["stream"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: []
};
res.json(manifest);


});

// ==========================================
// 3. محرك البحث والبث الذكي لروابط الفيلم
// ==========================================
app.get(’/:config/stream/:type/:id.json’, async (req, res) => {
const { config: encodedConfig, type, id } = req.params;
const config = decodeConfig(encodedConfig);


if (!config || !config.url || !config.user || !config.pass) {
    return res.json({ streams: [] });
}

try {
    // إنشاء اتصال WebDAV ديناميكي بناءً على البيانات المشفرة بالرابط
    const client = createClient(config.url, {
        username: config.user,
        password: config.pass
    });

    // جلب اسم الفيلم أو المسلسل من Stremio Cinemeta
    const metaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
    const metaResponse = await axios.get(metaUrl, { timeout: 10000 });
    const metaData = metaResponse.data && metaResponse.data.meta;

    if (!metaData || !metaData.name) {
        console.log(`لم يتم العثور على بيانات وصفية لـ ${type}/${id}`);
        return res.json({ streams: [] });
    }

    const movieTitle = metaData.name;
    console.log(`جاري البحث عن: "${movieTitle}" لحساب ${config.user}...`);

    // البحث داخل حساب FebBox
    const matchedFile = await findFileInFebBox(client, "/", movieTitle);

    if (matchedFile) {
        console.log(`🎉 تم العثور على الملف: ${matchedFile.filename}`);

        // بناء رابط تشغيل مباشر صحيح (مسار الملف فقط + دومين الـ WebDAV)
        const baseUrl = config.url.replace(/\/+$/, '');
        const filePath = matchedFile.filename.startsWith('/') ? matchedFile.filename : `/${matchedFile.filename}`;
        const streamUrl = `${baseUrl}${filePath.split('/').map(encodeURIComponent).join('/')}`;

        return res.json({
            streams: [
                {
                    name: "FebBox الشخصي ⚡",
                    title: `${matchedFile.basename}\nتشغيل مباشر من سحابتك`,
                    url: streamUrl,
                    behaviorHints: {
                        notWebReady: true,
                        proxyHeaders: {
                            request: {
                                "Authorization": `Basic ${Buffer.from(`${config.user}:${config.pass}`).toString('base64')}`
                            }
                        }
                    }
                }
            ]
        });
    }

    console.log(`❌ لم يتم العثور على: "${movieTitle}"`);
    res.json({ streams: [] });

} catch (error) {
    if (error.response && error.response.status === 401) {
        console.error("خطأ: بيانات اعتماد WebDAV غير صحيحة (401 Unauthorized)");
    } else {
        console.error("خطأ أثناء جلب الرابط:", error.message);
    }
    res.json({ streams: [] });
}


});

// تشغيل السيرفر
app.listen(PORT, () => {
console.log(`السيرفر يعمل الآن على المنفذ: ${PORT}`);
});
