# Digital Body Twin Demo: AI + API + 3D

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/saadalim1978/DEMO)

مشروع demo لتوأم رقمي تعليمي للجسم البشري:

- واجهة 3D تفاعلية باستخدام Three.js المحلي داخل `public/vendor`.
- API محلي باستخدام Node.js بدون اعتماديات npm إضافية.
- مجسم جسم كامل يوضح الدماغ، القلب، الرئتين، البنكرياس، الكلى، والأوعية.
- سيناريوهات محاكاة: جسم مستقر، خطر السكري، ارتفاع ضغط الدم، خطر الجلطات، خطر السكتة، ومتلازمة أيضية.
- مساعد AI محلي مبني على قواعد تحليلية، مع دعم OpenAI اختياري عند توفر `OPENAI_API_KEY`.
- مؤشرات حيوية متغيرة: سكر الدم، السكر التراكمي، مقاومة الإنسولين، الضغط، النبض، الأكسجين، LDL، الدهون الثلاثية، BMI، قابلية التخثر، D-dimer، تدفق أوردة الساق، وظائف الكلى، وتروية الدماغ.
- يستخدم ملفات GLB جاهزة للأعضاء الداخلية من مشروع [Human Organs](https://github.com/code4fukui/human_organs)، المبني على بيانات NIH 3D Print Exchange.

> تنبيه: هذا demo تعليمي وليس جهازًا طبيًا أو أداة تشخيص أو توصية علاجية. أي أعراض حقيقية مثل ألم صدر، ضيق نفس، علامات سكتة، أو تورم/ألم ساق مفاجئ تحتاج تواصلًا فوريًا مع الطوارئ أو الطبيب.

## التشغيل

```powershell
npm run dev
```

في بيئة Codex الحالية يمكن استخدام Node المرفق:

```powershell
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.mjs
```

ثم افتح:

```text
http://127.0.0.1:4321
```

## النشر على Render

المشروع جاهز للنشر كـ Render Web Service من GitHub.

- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/twin`
- Node Version: `22.22.0`

يوجد ملف `render.yaml` في الجذر لتسهيل إنشاء الخدمة كـ Blueprint.

## API

```http
GET /api/twin
```

يعيد حالة التوأم الرقمي كاملة: السيناريو، التدخل المحاكى، المؤشرات الحيوية، الآفات البصرية، الأحداث، التنبؤات، والتوصيات التعليمية.

```http
POST /api/twin/simulate
Content-Type: application/json

{ "scenario": "diabetes_risk" }
```

القيم الممكنة:

```text
baseline, diabetes_risk, hypertension, thrombosis, stroke_risk, cardio_metabolic
```

```http
POST /api/twin/intervene
Content-Type: application/json

{ "intervention": "pressure_control" }
```

القيم الممكنة:

```text
observe, lifestyle, glucose_control, pressure_control, clot_pathway
```

```http
POST /api/ai/ask
Content-Type: application/json

{ "question": "حلل خطر السكري والضغط والجلطات الآن" }
```

## ربط OpenAI اختياريًا

```powershell
$env:OPENAI_API_KEY="your_api_key"
$env:OPENAI_MODEL="gpt-4o-mini"
& "C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.mjs
```

## مراجع عامة

- [Human Organs GLB data](https://github.com/code4fukui/human_organs) by Taisuke Fukuno, with organ data sourced from NIH 3D Print Exchange.
- [NIH 3D: Skin, Male](https://3d.nih.gov/entries/21016/1), used as the transparent GLB body shell in the 3D scene.
- [NIH 3D: Body, Male](https://3d.nih.gov/entries/21022/1.01), reviewed as a full HRA reference organ model; it is too large to commit directly to GitHub.
- [CDC: Preventing Type 2 Diabetes](https://www.cdc.gov/diabetes/prevention-type-2/index.html)
- [CDC: High Blood Pressure Risk Factors](https://www.cdc.gov/high-blood-pressure/risk-factors/index.html)
- [CDC: Risk Factors for Blood Clots](https://www.cdc.gov/blood-clots/risk-factors/index.html)
- [CDC: Signs and Symptoms of Stroke](https://www.cdc.gov/stroke/signs-symptoms/index.html)
