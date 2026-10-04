"""
Consultation Service - Handles consultation logic, result generation, and storage
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from models.consultation import (
    ConsultationAnswers, ConsultationResult, AgingLevel,
    SkinType, SkinConcern, SunExposure, SunscreenUsage, Lifestyle, SkincareUsage, AgeGroup
)
from services.ai_skin_analyzer import ai_skin_analyzer


class ConsultationService:
    def __init__(self, db):
        self.db = db
    
    def calculate_aging_level(self, answers: ConsultationAnswers) -> AgingLevel:
        """Calculate aging level based on answers"""
        score = 0
        
        # Age factor
        if answers.age_group == AgeGroup.OVER_40:
            score += 3
        elif answers.age_group == AgeGroup.AGE_30_40:
            score += 2
        elif answers.age_group == AgeGroup.AGE_25_30:
            score += 1
        
        # Sun exposure
        if answers.sun_exposure == SunExposure.MORE_2_HRS:
            score += 2
        elif answers.sun_exposure == SunExposure.ONE_TO_TWO_HRS:
            score += 1
        
        # Sunscreen usage
        if answers.sunscreen_usage == SunscreenUsage.NEVER:
            score += 3
        elif answers.sunscreen_usage == SunscreenUsage.SOMETIMES:
            score += 1
        
        # Lifestyle
        if answers.lifestyle == Lifestyle.POOR:
            score += 2
        elif answers.lifestyle == Lifestyle.MODERATE:
            score += 1
        
        # Skincare usage
        if answers.skincare_usage == SkincareUsage.NONE:
            score += 2
        elif answers.skincare_usage == SkincareUsage.BASIC:
            score += 1
        
        # Concerns add to score
        score += len(answers.concerns)
        
        if score >= 8:
            return AgingLevel.HIGH
        elif score >= 4:
            return AgingLevel.MODERATE
        else:
            return AgingLevel.LOW
    
    def identify_causes(self, answers: ConsultationAnswers) -> List[str]:
        """Identify aging causes based on answers"""
        causes = []
        
        if answers.sun_exposure in [SunExposure.ONE_TO_TWO_HRS, SunExposure.MORE_2_HRS]:
            causes.append("High sun exposure is accelerating skin aging")
        
        if answers.sunscreen_usage in [SunscreenUsage.NEVER, SunscreenUsage.SOMETIMES]:
            causes.append("Inadequate sun protection is causing UV damage")
        
        if answers.lifestyle == Lifestyle.POOR:
            causes.append("Stress and unhealthy habits are affecting skin health")
        elif answers.lifestyle == Lifestyle.MODERATE:
            causes.append("Lifestyle factors may be contributing to skin concerns")
        
        if answers.skincare_usage == SkincareUsage.NONE:
            causes.append("Lack of proper skincare routine is leaving skin unprotected")
        elif answers.skincare_usage == SkincareUsage.BASIC:
            causes.append("Basic skincare may not be addressing anti-aging needs")
        
        if SkinConcern.FINE_LINES in answers.concerns:
            causes.append("Natural collagen decline is causing fine lines")
        
        if SkinConcern.PIGMENTATION in answers.concerns:
            causes.append("Sun damage and hormonal changes causing pigmentation")
        
        # Return max 3 causes
        return causes[:3]
    
    def get_morning_routine(self, answers: ConsultationAnswers, lang: str = "en") -> List[str]:
        """Generate morning routine"""
        routines = {
            "en": [
                "Gentle cleanser to remove overnight buildup",
                "Lightweight moisturizer for hydration",
                "SPF 30+ sunscreen (ESSENTIAL - apply generously)"
            ],
            "hi": [
                "रात की गंदगी हटाने के लिए सौम्य क्लींजर",
                "हाइड्रेशन के लिए हल्का मॉइस्चराइज़र",
                "SPF 30+ सनस्क्रीन (ज़रूरी - भरपूर मात्रा में लगाएं)"
            ],
            "ml": [
                "രാത്രിയിലെ അഴുക്ക് നീക്കാൻ സൗമ്യമായ ക്ലെൻസർ",
                "ഹൈഡ്രേഷനായി ലഘു മോയ്സ്ചറൈസർ",
                "SPF 30+ സൺസ്ക്രീൻ (അത്യാവശ്യം - ധാരാളമായി പുരട്ടുക)"
            ]
        }
        return routines.get(lang, routines["en"])
    
    def get_night_routine(self, answers: ConsultationAnswers, lang: str = "en") -> List[str]:
        """Generate night routine with personalized product recommendation"""
        aging_level = self.calculate_aging_level(answers)
        
        base_routines = {
            "en": [
                "Double cleanse to remove sunscreen and impurities",
                "Apply Celesta Glow Anti-Aging Serum (2-3 drops)",
                "Follow with a nourishing night cream"
            ],
            "hi": [
                "सनस्क्रीन और अशुद्धियों को हटाने के लिए डबल क्लींज़",
                "सेलेस्टा ग्लो एंटी-एजिंग सीरम लगाएं (2-3 बूंदें)",
                "पौष्टिक नाइट क्रीम से फॉलो करें"
            ],
            "ml": [
                "സൺസ്ക്രീനും അശുദ്ധികളും നീക്കാൻ ഡബിൾ ക്ലെൻസ്",
                "സെലസ്റ്റ ഗ്ലോ ആന്റി-ഏജിംഗ് സെറം പുരട്ടുക (2-3 തുള്ളി)",
                "പോഷകമുള്ള നൈറ്റ് ക്രീം ഉപയോഗിച്ച് പിന്തുടരുക"
            ]
        }
        
        routine = base_routines.get(lang, base_routines["en"])
        
        # Add retinol recommendation based on aging level
        if aging_level in [AgingLevel.MODERATE, AgingLevel.HIGH]:
            retinol_tip = {
                "en": "Use retinol 2-3 times per week (alternate nights)",
                "hi": "रेटिनॉल सप्ताह में 2-3 बार उपयोग करें (बारी-बारी से)",
                "ml": "ആഴ്ചയിൽ 2-3 തവണ റെറ്റിനോൾ ഉപയോഗിക്കുക (മാറിമാറി)"
            }
            routine.append(retinol_tip.get(lang, retinol_tip["en"]))
        
        return routine
    
    def get_rules(self, answers: ConsultationAnswers, lang: str = "en") -> List[str]:
        """Get skincare rules based on skin type and concerns"""
        rules = {
            "en": [
                "Use Celesta Glow serum at NIGHT only for best results",
                "Sunscreen is NON-NEGOTIABLE - reapply every 2-3 hours outdoors",
                "Avoid direct sun exposure during peak hours (10 AM - 4 PM)",
                "Wait 60 seconds between each product application"
            ],
            "hi": [
                "सर्वोत्तम परिणामों के लिए सेलेस्टा ग्लो सीरम केवल रात में उपयोग करें",
                "सनस्क्रीन अनिवार्य है - बाहर हर 2-3 घंटे में दोबारा लगाएं",
                "पीक आवर्स (सुबह 10 - शाम 4) में सीधी धूप से बचें",
                "हर प्रोडक्ट लगाने के बीच 60 सेकंड रुकें"
            ],
            "ml": [
                "മികച്ച ഫലങ്ങൾക്ക് സെലസ്റ്റ ഗ്ലോ സെറം രാത്രി മാത്രം ഉപയോഗിക്കുക",
                "സൺസ്ക്രീൻ നിർബന്ധമാണ് - പുറത്ത് ഓരോ 2-3 മണിക്കൂറിലും വീണ്ടും പുരട്ടുക",
                "പീക്ക് സമയങ്ങളിൽ (രാവിലെ 10 - വൈകുന്നേരം 4) നേരിട്ട് വെയിൽ ഒഴിവാക്കുക",
                "ഓരോ ഉൽപ്പന്നവും പുരട്ടുന്നതിനിടയിൽ 60 സെക്കൻഡ് കാത്തിരിക്കുക"
            ]
        }
        
        base_rules = rules.get(lang, rules["en"])
        
        # Add skin-type specific rule
        if answers.skin_type == SkinType.SENSITIVE:
            sensitive_rule = {
                "en": "Patch test new products before full application",
                "hi": "पूरी तरह लगाने से पहले नए प्रोडक्ट्स का पैच टेस्ट करें",
                "ml": "പൂർണ്ണമായി പുരട്ടുന്നതിന് മുമ്പ് പുതിയ ഉൽപ്പന്നങ്ങൾ പാച്ച് ടെസ്റ്റ് ചെയ്യുക"
            }
            base_rules.append(sensitive_rule.get(lang, sensitive_rule["en"]))
        
        return base_rules
    
    def get_diet_tips(self, lang: str = "en") -> List[str]:
        """Get diet recommendations"""
        tips = {
            "en": [
                "Eat antioxidant-rich fruits (berries, oranges, papaya)",
                "Drink 2-3 liters of water daily for hydration",
                "Reduce sugar intake - it accelerates skin aging",
                "Include omega-3 fatty acids (fish, nuts, seeds)"
            ],
            "hi": [
                "एंटीऑक्सीडेंट युक्त फल खाएं (बेरी, संतरा, पपीता)",
                "हाइड्रेशन के लिए रोज़ 2-3 लीटर पानी पिएं",
                "चीनी कम करें - यह त्वचा की उम्र बढ़ाती है",
                "ओमेगा-3 फैटी एसिड शामिल करें (मछली, नट्स, बीज)"
            ],
            "ml": [
                "ആന്റിഓക്സിഡന്റ് സമ്പന്നമായ പഴങ്ങൾ കഴിക്കുക (ബെറി, ഓറഞ്ച്, പപ്പായ)",
                "ഹൈഡ്രേഷനായി ദിവസവും 2-3 ലിറ്റർ വെള്ളം കുടിക്കുക",
                "പഞ്ചസാര കുറയ്ക്കുക - ഇത് ത്വക്കിന്റെ പ്രായമാകൽ ത്വരിതപ്പെടുത്തുന്നു",
                "ഒമേഗ-3 ഫാറ്റി ആസിഡുകൾ ഉൾപ്പെടുത്തുക (മത്സ്യം, നട്സ്, വിത്തുകൾ)"
            ]
        }
        return tips.get(lang, tips["en"])
    
    def get_exercise_tips(self, lang: str = "en") -> List[str]:
        """Get exercise recommendations"""
        tips = {
            "en": [
                "Walk 20-30 minutes daily for blood circulation",
                "Practice yoga or light stretching for stress relief",
                "Facial exercises can help tone facial muscles"
            ],
            "hi": [
                "रक्त संचार के लिए रोज़ 20-30 मिनट टहलें",
                "तनाव मुक्ति के लिए योग या हल्की स्ट्रेचिंग करें",
                "चेहरे की एक्सरसाइज़ से मांसपेशियां टोन होती हैं"
            ],
            "ml": [
                "രക്തചംക്രമണത്തിനായി ദിവസവും 20-30 മിനിറ്റ് നടക്കുക",
                "സമ്മർദ്ദ ലഘൂകരണത്തിനായി യോഗ അല്ലെങ്കിൽ ലഘു സ്ട്രെച്ചിംഗ് ചെയ്യുക",
                "മുഖ വ്യായാമങ്ങൾ മുഖ പേശികൾ ടോൺ ചെയ്യാൻ സഹായിക്കും"
            ]
        }
        return tips.get(lang, tips["en"])
    
    def get_personalized_product_usage(self, answers: ConsultationAnswers, lang: str = "en") -> str:
        """Generate personalized product usage instructions based on skin profile"""
        aging_level = self.calculate_aging_level(answers)
        
        # Base recommendation - night use only
        if aging_level == AgingLevel.HIGH:
            usage = {
                "en": f"Based on your skin profile, we recommend using Celesta Glow serum EVERY NIGHT. Your skin needs consistent anti-aging support. Apply 2-3 drops after cleansing, focusing on areas with fine lines. As your skin shows signs of aging, daily nighttime use will help restore elasticity and reduce visible wrinkles within 4-6 weeks.",
                "hi": f"आपकी त्वचा प्रोफाइल के आधार पर, हम हर रात सेलेस्टा ग्लो सीरम का उपयोग करने की सलाह देते हैं। आपकी त्वचा को लगातार एंटी-एजिंग सपोर्ट की ज़रूरत है। क्लींजिंग के बाद 2-3 बूंदें लगाएं, फाइन लाइन्स वाले क्षेत्रों पर फोकस करें। 4-6 सप्ताह में परिणाम दिखेंगे।",
                "ml": f"നിങ്ങളുടെ ത്വക്ക് പ്രൊഫൈൽ അടിസ്ഥാനമാക്കി, എല്ലാ രാത്രിയും സെലസ്റ്റ ഗ്ലോ സെറം ഉപയോഗിക്കാൻ ഞങ്ങൾ ശുപാർശ ചെയ്യുന്നു. നിങ്ങളുടെ ത്വക്കിന് സ്ഥിരമായ ആന്റി-ഏജിംഗ് പിന്തുണ ആവശ്യമാണ്. ക്ലെൻസിംഗിന് ശേഷം 2-3 തുള്ളി പുരട്ടുക. 4-6 ആഴ്ചയ്ക്കുള്ളിൽ ഫലങ്ങൾ കാണാം."
            }
        elif aging_level == AgingLevel.MODERATE:
            usage = {
                "en": f"Your skin is at a crucial stage where prevention meets correction. Use Celesta Glow serum 4-5 nights per week. Apply 2-3 drops focusing on forehead, under-eyes, and smile lines. On alternate nights, you can use a simple moisturizer. With your moderate aging signs, you should see improvement in skin texture within 3-4 weeks.",
                "hi": f"आपकी त्वचा एक महत्वपूर्ण स्थिति में है। सेलेस्टा ग्लो सीरम सप्ताह में 4-5 रातें उपयोग करें। माथे, आंखों के नीचे और स्माइल लाइन्स पर 2-3 बूंदें लगाएं। 3-4 सप्ताह में त्वचा की बनावट में सुधार देखें।",
                "ml": f"നിങ്ങളുടെ ത്വക്ക് നിർണ്ണായക ഘട്ടത്തിലാണ്. ആഴ്ചയിൽ 4-5 രാത്രികൾ സെലസ്റ്റ ഗ്ലോ സെറം ഉപയോഗിക്കുക. നെറ്റി, കണ്ണുകൾക്ക് താഴെ, പുഞ്ചിരി വരകൾ എന്നിവയിൽ 2-3 തുള്ളി പുരട്ടുക. 3-4 ആഴ്ചയ്ക്കുള്ളിൽ ത്വക്കിന്റെ ഘടനയിൽ മെച്ചപ്പെടൽ കാണാം."
            }
        else:
            usage = {
                "en": f"Great news! Your skin is in good condition. For prevention, use Celesta Glow serum 3 nights per week. Apply 2-3 drops all over face after cleansing. This preventive approach will help maintain your youthful skin and delay early aging signs. You'll notice enhanced glow within 2-3 weeks.",
                "hi": f"अच्छी खबर! आपकी त्वचा अच्छी स्थिति में है। रोकथाम के लिए, सप्ताह में 3 रातें सेलेस्टा ग्लो सीरम का उपयोग करें। यह आपकी जवां त्वचा को बनाए रखेगा। 2-3 सप्ताह में बेहतर चमक देखें।",
                "ml": f"നല്ല വാർത്ത! നിങ്ങളുടെ ത്വക്ക് നല്ല അവസ്ഥയിലാണ്. പ്രതിരോധത്തിനായി, ആഴ്ചയിൽ 3 രാത്രികൾ സെലസ്റ്റ ഗ്ലോ സെറം ഉപയോഗിക്കുക. ഇത് നിങ്ങളുടെ യൗവനമുള്ള ത്വക്ക് നിലനിർത്താൻ സഹായിക്കും. 2-3 ആഴ്ചയ്ക്കുള്ളിൽ മെച്ചപ്പെട്ട തിളക്കം കാണാം."
            }
        
        return usage.get(lang, usage["en"])
    
    def generate_result(self, answers: ConsultationAnswers, lang: str = "en") -> ConsultationResult:
        """Generate complete consultation result"""
        aging_level = self.calculate_aging_level(answers)
        causes = self.identify_causes(answers)
        
        return ConsultationResult(
            aging_level=aging_level,
            causes=causes,
            morning_routine=self.get_morning_routine(answers, lang),
            night_routine=self.get_night_routine(answers, lang),
            rules=self.get_rules(answers, lang),
            diet_tips=self.get_diet_tips(lang),
            exercise_tips=self.get_exercise_tips(lang),
            product_usage=self.get_personalized_product_usage(answers, lang)
        )
    
    async def save_consultation(
        self, 
        answers: ConsultationAnswers, 
        phone: str, 
        face_images: List[str],
        location: dict,
        language: str = "en"
    ) -> dict:
        """Save consultation to database and return result with AI skin analysis"""
        result = self.generate_result(answers, language)
        
        consultation_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Perform AI skin analysis if images are provided
        ai_analysis = None
        if face_images and len(face_images) > 0:
            try:
                # Prepare images for analysis
                image_data = []
                positions = ["front", "left", "right"]
                for i, img in enumerate(face_images[:3]):
                    if img and len(img) > 100:  # Basic check for valid base64
                        # Remove data URL prefix if present
                        base64_data = img
                        if "base64," in img:
                            base64_data = img.split("base64,")[1]
                        image_data.append({
                            "base64": base64_data,
                            "position": positions[i] if i < len(positions) else "front"
                        })
                
                if image_data:
                    ai_analysis = await ai_skin_analyzer.analyze_multiple_images(image_data)
            except Exception as e:
                import logging
                logging.error(f"AI skin analysis failed: {str(e)}")
                ai_analysis = ai_skin_analyzer._get_combined_default()
        
        consultation_doc = {
            "id": consultation_id,
            "phone": phone,
            "answers": answers.model_dump(),
            "result": result.model_dump(),
            "face_images": face_images,
            "ai_skin_analysis": ai_analysis,
            "location": location,
            "language": language,
            "created_at": now,
            "pdf_downloaded": False
        }
        
        await self.db.consultations.insert_one(consultation_doc)
        
        # Return without _id
        if "_id" in consultation_doc:
            del consultation_doc["_id"]
        return consultation_doc
    
    async def get_consultation(self, consultation_id: str) -> Optional[dict]:
        """Get consultation by ID"""
        consultation = await self.db.consultations.find_one(
            {"id": consultation_id}, 
            {"_id": 0}
        )
        return consultation
    
    async def get_consultation_by_phone(self, phone: str) -> Optional[dict]:
        """Get latest consultation by phone number"""
        consultation = await self.db.consultations.find_one(
            {"phone": phone}, 
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        return consultation
    
    async def mark_pdf_downloaded(self, consultation_id: str) -> bool:
        """Mark consultation PDF as downloaded"""
        result = await self.db.consultations.update_one(
            {"id": consultation_id},
            {"$set": {"pdf_downloaded": True}}
        )
        return result.modified_count > 0
    
    async def get_all_consultations(self, limit: int = 100) -> List[dict]:
        """Get all consultations for admin"""
        consultations = await self.db.consultations.find(
            {}, 
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        return consultations
    
    async def get_consultation_stats(self) -> dict:
        """Get consultation statistics"""
        total = await self.db.consultations.count_documents({})
        pdf_downloaded = await self.db.consultations.count_documents({"pdf_downloaded": True})
        
        # Count by aging level
        high_aging = await self.db.consultations.count_documents({"result.aging_level": "high"})
        moderate_aging = await self.db.consultations.count_documents({"result.aging_level": "moderate"})
        low_aging = await self.db.consultations.count_documents({"result.aging_level": "low"})
        
        return {
            "total_consultations": total,
            "pdf_downloads": pdf_downloaded,
            "by_aging_level": {
                "high": high_aging,
                "moderate": moderate_aging,
                "low": low_aging
            }
        }
    
    async def track_event(self, session_id: str, event_type: str, step: int = None, page: str = None):
        """Track consultation funnel event"""
        event_doc = {
            "id": str(uuid.uuid4()),
            "session_id": session_id,
            "event_type": event_type,
            "step": step,
            "page": page,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.db.consultation_events.insert_one(event_doc)
    
    async def get_funnel_stats(self) -> dict:
        """Get consultation funnel statistics"""
        pipeline = [
            {"$group": {
                "_id": "$event_type",
                "count": {"$sum": 1}
            }}
        ]
        
        results = await self.db.consultation_events.aggregate(pipeline).to_list(100)
        
        stats = {r["_id"]: r["count"] for r in results}
        
        started = stats.get("started", 0)
        completed = stats.get("completed", 0)
        
        return {
            "started": started,
            "completed": completed,
            "completion_rate": round((completed / started * 100) if started > 0 else 0, 1),
            "drop_off_rate": round(((started - completed) / started * 100) if started > 0 else 0, 1),
            "pdf_downloads": stats.get("pdf_downloaded", 0),
            "by_step": {
                "step_1": stats.get("step_1_completed", 0),
                "step_2": stats.get("step_2_completed", 0),
                "step_3": stats.get("step_3_completed", 0),
                "step_4": stats.get("step_4_completed", 0),
                "step_5": stats.get("step_5_completed", 0),
                "step_6": stats.get("step_6_completed", 0),
                "face_upload": stats.get("face_uploaded", 0),
                "phone_entered": stats.get("phone_entered", 0)
            }
        }
