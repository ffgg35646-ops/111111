# إشعارات أصول الشخصيات ثلاثية الأبعاد

## Avatar Studio
النسخ الافتراضية من ملفات الشخصيات GLB المشار إليها في إعداد المحاكاة مأخوذة من مستودع Avatar Studio:
- المستودع: https://github.com/memoriesrohit/avatar-studio
- صفحة المشروع: https://memoriesrohit.github.io/avatar-studio/
- ملفات الشخصيات المستخدمة افتراضياً: models/daniel_formal.glb و models/aisha_formal.glb.

يوضح مستودع المصدر أن شيفرة الاستوديو مرخصة MIT، وأن الشخصيات والحركات مشتقة من Microsoft Rocketbox Avatar Library بترخيص MIT. يجب الاحتفاظ بنص الترخيص والإشعار عند نسخ الأصول أو إعادة توزيعها، ومراجعة ملفات LICENSE وTHIRD_PARTY_NOTICES في المستودع المصدر عند تحديث الأصول.

## Microsoft Rocketbox Avatar Library
- المصدر: https://github.com/microsoft/Microsoft-Rocketbox
- الترخيص المشار إليه في مستودع Avatar Studio: MIT، Copyright Microsoft Corporation.
- البحث العلمي: Gonzalez-Franco et al., The Rocketbox Library and the Utility of Freely Available Rigged Avatars, Frontiers in Virtual Reality (2020), DOI: https://doi.org/10.3389/frvir.2020.561558

## ملاحظات الاستخدام في المنصة
- ملفات الرجل والمرأة الافتراضية الحالية نماذج بشرية عامة وليست شخصيات سعودية مخصصة ولا ترتدي الثوب/الشماغ أو العباءة/الحجاب المحليين.
- لا توجد ضمن الملفات الافتراضية الحالية أصول أطفال أو مراهقين معتمدة.
- يوفر مسار المحاكاة تحميل ملف GLB مخصص للجلسة الحالية. أي أصل سعودي أو أصل مناسب للأطفال يجب أن يرفقه مالك الأصل بترخيص واضح يسمح بالاستخدام التجاري والتوزيع داخل تطبيق التدريب.
- يوصى بنسخ الأصول المعتمدة إلى مخزن ملفات أو CDN تملكه المؤسسة بدلاً من الاعتماد على عنوان الاستضافة الخارجي، مع الاحتفاظ بهذا الإشعار وملفات الترخيص المطلوبة.
- يجب عدم الإيحاء بأن شخصيات عامة تمثل مريضاً حقيقياً أو أنها صورة لشخص حقيقي. جميعها شخصيات محاكاة تعليمية.

## SCD-01 default web avatar

The current default web avatar is the male rigged Rocketbox model `daniel_formal.glb`, served from the pinned Avatar Studio revision:
- Source: https://github.com/memoriesrohit/avatar-studio
- Asset: https://cdn.jsdelivr.net/gh/memoriesrohit/avatar-studio@2fd9ec82fbe1613d40ae38aadcca3f410725f740/models/daniel_formal.glb
- Asset source licence: Microsoft Rocketbox MIT, as packaged by Avatar Studio. Keep the upstream MIT notice when redistributing the model.
- The model includes a humanoid rig, 52 ARKit facial shapes and motion clips including Idle, Talk, Think, Wave and other gestures.
- Important limitation: this is a generic adult male in office-formal clothing. It is an interim rigged base for the interaction pipeline; it is not yet the final Saudi-specific face, thobe and medical-coat design. Replace it using `NEXT_PUBLIC_SAUDI_DOCTOR_AVATAR_MODEL_URL` when the approved Saudi MetaHuman GLB is available.
