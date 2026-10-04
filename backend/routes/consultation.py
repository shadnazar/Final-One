"""
Consultation Routes - API endpoints for online consultation system
"""
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from typing import List, Optional
from models.consultation import (
    ConsultationCreate, ConsultationAnswers, ConsultationEvent,
    AGE_LABELS, SKIN_TYPE_LABELS, CONCERN_LABELS, SUN_EXPOSURE_LABELS,
    SUNSCREEN_LABELS, LIFESTYLE_LABELS, SKINCARE_LABELS
)

router = APIRouter(prefix="/consultation", tags=["Consultation"])

# Database and service will be set by main app
db = None
consultation_service = None


def set_db(database):
    global db, consultation_service
    db = database
    from services.consultation_service import ConsultationService
    consultation_service = ConsultationService(db)


class ConsultationSubmit(BaseModel):
    answers: ConsultationAnswers
    phone: str
    face_images: Optional[List[str]] = []
    language: str = "en"
    session_id: str


class EventTrack(BaseModel):
    session_id: str
    event_type: str
    step: Optional[int] = None
    page: Optional[str] = None


@router.get("/labels")
async def get_labels(lang: str = Query("en", description="Language code: en, hi, ml")):
    """Get all question labels for the selected language"""
    return {
        "age": {k: v.get(lang, v["en"]) for k, v in AGE_LABELS.items()},
        "skin_type": {k: v.get(lang, v["en"]) for k, v in SKIN_TYPE_LABELS.items()},
        "concerns": {k: v.get(lang, v["en"]) for k, v in CONCERN_LABELS.items()},
        "sun_exposure": {k: v.get(lang, v["en"]) for k, v in SUN_EXPOSURE_LABELS.items()},
        "sunscreen": {k: v.get(lang, v["en"]) for k, v in SUNSCREEN_LABELS.items()},
        "lifestyle": {k: v.get(lang, v["en"]) for k, v in LIFESTYLE_LABELS.items()},
        "skincare": {k: v.get(lang, v["en"]) for k, v in SKINCARE_LABELS.items()}
    }


@router.get("/questions")
async def get_questions(lang: str = Query("en", description="Language code: en, hi, ml")):
    """Get all questions with options for the consultation flow"""
    questions = {
        "en": [
            {
                "id": 1,
                "question": "What's your age group?",
                "type": "single",
                "options": [
                    {"value": "under_25", "label": "Under 25"},
                    {"value": "25_30", "label": "25-30"},
                    {"value": "30_40", "label": "30-40"},
                    {"value": "40_plus", "label": "40+"}
                ]
            },
            {
                "id": 2,
                "question": "What's your skin type?",
                "type": "single",
                "options": [
                    {"value": "oily", "label": "Oily"},
                    {"value": "dry", "label": "Dry"},
                    {"value": "combination", "label": "Combination"},
                    {"value": "sensitive", "label": "Sensitive"},
                    {"value": "not_sure", "label": "Not Sure"}
                ]
            },
            {
                "id": 3,
                "question": "What are your main skin concerns?",
                "subtitle": "Select up to 2",
                "type": "multiple",
                "max_select": 2,
                "options": [
                    {"value": "fine_lines", "label": "Fine Lines & Wrinkles"},
                    {"value": "pigmentation", "label": "Pigmentation & Dark Spots"},
                    {"value": "dull_skin", "label": "Dull & Tired Skin"},
                    {"value": "uneven_texture", "label": "Uneven Texture"}
                ]
            },
            {
                "id": 7,
                "question": "What is your MAJOR skin issue right now?",
                "subtitle": "Select the one that bothers you most",
                "type": "single",
                "options": [
                    {"value": "aging", "label": "Aging & Wrinkles", "desc": "Fine lines, sagging, loss of firmness"},
                    {"value": "acne", "label": "Acne & Breakouts", "desc": "Pimples, blackheads, oily skin"},
                    {"value": "dullness", "label": "Dull & Lifeless Skin", "desc": "Lack of glow, tired appearance"},
                    {"value": "pigmentation", "label": "Dark Spots & Uneven Tone", "desc": "Sun spots, melasma, discoloration"},
                    {"value": "sensitivity", "label": "Sensitivity & Redness", "desc": "Easily irritated, rosacea"}
                ]
            },
            {
                "id": 4,
                "question": "How much time do you spend in the sun daily?",
                "type": "single",
                "options": [
                    {"value": "less_30_min", "label": "Less than 30 minutes"},
                    {"value": "1_2_hrs", "label": "1-2 hours"},
                    {"value": "more_2_hrs", "label": "More than 2 hours"}
                ],
                "followup": {
                    "question": "How often do you use sunscreen?",
                    "options": [
                        {"value": "daily", "label": "Daily"},
                        {"value": "sometimes", "label": "Sometimes"},
                        {"value": "never", "label": "Never"}
                    ]
                }
            },
            {
                "id": 5,
                "question": "How would you describe your lifestyle?",
                "type": "single",
                "options": [
                    {"value": "healthy", "label": "Healthy", "desc": "Good sleep, balanced diet"},
                    {"value": "moderate", "label": "Moderate", "desc": "Some stress, irregular habits"},
                    {"value": "poor", "label": "Poor", "desc": "High stress, unhealthy habits"}
                ]
            },
            {
                "id": 6,
                "question": "What's your current skincare routine?",
                "type": "single",
                "options": [
                    {"value": "none", "label": "None", "desc": "Just water or soap"},
                    {"value": "basic", "label": "Basic", "desc": "Cleanser & moisturizer"},
                    {"value": "active", "label": "Active", "desc": "Serums & treatments"}
                ]
            }
        ],
        "hi": [
            {
                "id": 1,
                "question": "आपकी उम्र क्या है?",
                "type": "single",
                "options": [
                    {"value": "under_25", "label": "25 से कम"},
                    {"value": "25_30", "label": "25-30"},
                    {"value": "30_40", "label": "30-40"},
                    {"value": "40_plus", "label": "40+"}
                ]
            },
            {
                "id": 2,
                "question": "आपकी त्वचा का प्रकार क्या है?",
                "type": "single",
                "options": [
                    {"value": "oily", "label": "तैलीय"},
                    {"value": "dry", "label": "रूखी"},
                    {"value": "combination", "label": "मिश्रित"},
                    {"value": "sensitive", "label": "संवेदनशील"},
                    {"value": "not_sure", "label": "पता नहीं"}
                ]
            },
            {
                "id": 3,
                "question": "आपकी मुख्य त्वचा समस्याएं क्या हैं?",
                "subtitle": "अधिकतम 2 चुनें",
                "type": "multiple",
                "max_select": 2,
                "options": [
                    {"value": "fine_lines", "label": "महीन रेखाएं और झुर्रियां"},
                    {"value": "pigmentation", "label": "पिगमेंटेशन और काले धब्बे"},
                    {"value": "dull_skin", "label": "बेजान और थकी त्वचा"},
                    {"value": "uneven_texture", "label": "असमान बनावट"}
                ]
            },
            {
                "id": 7,
                "question": "अभी आपकी सबसे बड़ी त्वचा समस्या क्या है?",
                "subtitle": "वह चुनें जो आपको सबसे ज्यादा परेशान करती है",
                "type": "single",
                "options": [
                    {"value": "aging", "label": "उम्र बढ़ना और झुर्रियां", "desc": "महीन रेखाएं, ढीलापन"},
                    {"value": "acne", "label": "मुंहासे और दाने", "desc": "पिंपल्स, ब्लैकहेड्स"},
                    {"value": "dullness", "label": "बेजान त्वचा", "desc": "चमक की कमी, थकी दिखती"},
                    {"value": "pigmentation", "label": "काले धब्बे", "desc": "सन स्पॉट्स, मेलास्मा"},
                    {"value": "sensitivity", "label": "संवेदनशील त्वचा", "desc": "आसानी से जलन"}
                ]
            },
            {
                "id": 4,
                "question": "आप रोज़ धूप में कितना समय बिताते हैं?",
                "type": "single",
                "options": [
                    {"value": "less_30_min", "label": "30 मिनट से कम"},
                    {"value": "1_2_hrs", "label": "1-2 घंटे"},
                    {"value": "more_2_hrs", "label": "2 घंटे से अधिक"}
                ],
                "followup": {
                    "question": "आप कितनी बार सनस्क्रीन लगाते हैं?",
                    "options": [
                        {"value": "daily", "label": "रोज़ाना"},
                        {"value": "sometimes", "label": "कभी-कभी"},
                        {"value": "never", "label": "कभी नहीं"}
                    ]
                }
            },
            {
                "id": 5,
                "question": "आपकी जीवनशैली कैसी है?",
                "type": "single",
                "options": [
                    {"value": "healthy", "label": "स्वस्थ", "desc": "अच्छी नींद, संतुलित आहार"},
                    {"value": "moderate", "label": "मध्यम", "desc": "कुछ तनाव, अनियमित आदतें"},
                    {"value": "poor", "label": "खराब", "desc": "अधिक तनाव, अस्वस्थ आदतें"}
                ]
            },
            {
                "id": 6,
                "question": "आपकी वर्तमान स्किनकेयर रूटीन क्या है?",
                "type": "single",
                "options": [
                    {"value": "none", "label": "कुछ नहीं", "desc": "सिर्फ पानी या साबुन"},
                    {"value": "basic", "label": "बुनियादी", "desc": "क्लींजर और मॉइस्चराइज़र"},
                    {"value": "active", "label": "सक्रिय", "desc": "सीरम और ट्रीटमेंट"}
                ]
            }
        ],
        "ml": [
            {
                "id": 1,
                "question": "നിങ്ങളുടെ പ്രായം എത്രയാണ്?",
                "type": "single",
                "options": [
                    {"value": "under_25", "label": "25-ൽ താഴെ"},
                    {"value": "25_30", "label": "25-30"},
                    {"value": "30_40", "label": "30-40"},
                    {"value": "40_plus", "label": "40+"}
                ]
            },
            {
                "id": 2,
                "question": "നിങ്ങളുടെ ത്വക്ക് തരം എന്താണ്?",
                "type": "single",
                "options": [
                    {"value": "oily", "label": "എണ്ണമയമുള്ള"},
                    {"value": "dry", "label": "വരണ്ട"},
                    {"value": "combination", "label": "കോമ്പിനേഷൻ"},
                    {"value": "sensitive", "label": "സെൻസിറ്റീവ്"},
                    {"value": "not_sure", "label": "ഉറപ്പില്ല"}
                ]
            },
            {
                "id": 3,
                "question": "നിങ്ങളുടെ പ്രധാന ത്വക്ക് പ്രശ്നങ്ങൾ എന്തൊക്കെയാണ്?",
                "subtitle": "പരമാവധി 2 തിരഞ്ഞെടുക്കുക",
                "type": "multiple",
                "max_select": 2,
                "options": [
                    {"value": "fine_lines", "label": "നേർത്ത വരകളും ചുളിവുകളും"},
                    {"value": "pigmentation", "label": "പിഗ്മെന്റേഷനും കറുത്ത പാടുകളും"},
                    {"value": "dull_skin", "label": "മങ്ങിയതും ക്ഷീണിച്ചതുമായ ത്വക്ക്"},
                    {"value": "uneven_texture", "label": "അസമമായ ടെക്സ്ചർ"}
                ]
            },
            {
                "id": 4,
                "question": "ദിവസവും എത്ര സമയം വെയിലത്ത് ചെലവഴിക്കുന്നു?",
                "type": "single",
                "options": [
                    {"value": "less_30_min", "label": "30 മിനിറ്റിൽ താഴെ"},
                    {"value": "1_2_hrs", "label": "1-2 മണിക്കൂർ"},
                    {"value": "more_2_hrs", "label": "2 മണിക്കൂറിൽ കൂടുതൽ"}
                ],
                "followup": {
                    "question": "എത്ര തവണ സൺസ്ക്രീൻ ഉപയോഗിക്കുന്നു?",
                    "options": [
                        {"value": "daily", "label": "ദിവസവും"},
                        {"value": "sometimes", "label": "ചിലപ്പോൾ"},
                        {"value": "never", "label": "ഒരിക്കലുമില്ല"}
                    ]
                }
            },
            {
                "id": 5,
                "question": "നിങ്ങളുടെ ജീവിതശൈലി എങ്ങനെയാണ്?",
                "type": "single",
                "options": [
                    {"value": "healthy", "label": "ആരോഗ്യകരം", "desc": "നല്ല ഉറക്കം, സമതുലിതമായ ഭക്ഷണം"},
                    {"value": "moderate", "label": "മിതമായ", "desc": "ചില സമ്മർദ്ദം, ക്രമരഹിതമായ ശീലങ്ങൾ"},
                    {"value": "poor", "label": "മോശം", "desc": "ഉയർന്ന സമ്മർദ്ദം, അനാരോഗ്യകരമായ ശീലങ്ങൾ"}
                ]
            },
            {
                "id": 6,
                "question": "നിങ്ങളുടെ നിലവിലെ സ്കിൻകെയർ റൂട്ടീൻ എന്താണ്?",
                "type": "single",
                "options": [
                    {"value": "none", "label": "ഒന്നുമില്ല", "desc": "വെള്ളം അല്ലെങ്കിൽ സോപ്പ് മാത്രം"},
                    {"value": "basic", "label": "അടിസ്ഥാനം", "desc": "ക്ലെൻസറും മോയ്സ്ചറൈസറും"},
                    {"value": "active", "label": "സജീവം", "desc": "സെറവും ട്രീറ്റ്മെന്റുകളും"}
                ]
            }
        ]
    }
    
    return {"questions": questions.get(lang, questions["en"])}


@router.post("/submit")
async def submit_consultation(data: ConsultationSubmit):
    """Submit consultation and get result"""
    if not consultation_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    # Validate phone
    phone = data.phone.strip().replace(" ", "")
    if len(phone) != 10 or not phone.isdigit():
        raise HTTPException(status_code=400, detail="Invalid phone number")
    
    # Get location from IP (simplified - in production, use IP geolocation service)
    location = {"state": "India", "country": "IN"}
    
    # Save consultation
    result = await consultation_service.save_consultation(
        answers=data.answers,
        phone=phone,
        face_images=data.face_images,
        location=location,
        language=data.language
    )
    
    # Track completion event
    await consultation_service.track_event(
        session_id=data.session_id,
        event_type="completed"
    )
    
    return result


@router.get("/{consultation_id}")
async def get_consultation(consultation_id: str):
    """Get consultation result by ID"""
    if not consultation_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    consultation = await consultation_service.get_consultation(consultation_id)
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    return consultation


@router.post("/{consultation_id}/pdf-downloaded")
async def mark_pdf_downloaded(consultation_id: str, session_id: str = Query(...)):
    """Mark PDF as downloaded"""
    if not consultation_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    success = await consultation_service.mark_pdf_downloaded(consultation_id)
    
    # Track event
    await consultation_service.track_event(
        session_id=session_id,
        event_type="pdf_downloaded"
    )
    
    return {"success": success}


@router.post("/track-event")
async def track_consultation_event(event: EventTrack):
    """Track consultation funnel events"""
    if not consultation_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    await consultation_service.track_event(
        session_id=event.session_id,
        event_type=event.event_type,
        step=event.step,
        page=event.page
    )
    
    return {"success": True}


# ==================== ADMIN ENDPOINTS ====================

# Reference to admin_sessions from server.py (will be set via set_admin_sessions)
admin_sessions = {}

def _admin_password() -> str:
    """Always read at call-time so env changes take effect without redeploy."""
    import os as _os
    return _os.environ.get("ADMIN_PASSWORD") or "celestaglow2024"

def set_admin_sessions(sessions_dict):
    """Set reference to admin_sessions from server.py"""
    global admin_sessions
    admin_sessions = sessions_dict

def verify_admin_token(x_admin_token: str = Header(None)):
    """Verify admin token - checks session tokens and the *active* admin password."""
    import hashlib
    from datetime import datetime, timezone
    from services.admin_auth import get_cached_active_admin_hash

    if not x_admin_token:
        raise HTTPException(status_code=401, detail="Admin token required")

    # First check if it's a valid session token
    if x_admin_token in admin_sessions:
        session = admin_sessions[x_admin_token]
        expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) < expires_at:
            return True
        else:
            # Remove expired session
            del admin_sessions[x_admin_token]

    # Plain password — must match the *active* admin hash.
    if hashlib.sha256(x_admin_token.encode()).hexdigest() == get_cached_active_admin_hash():
        return True

    raise HTTPException(status_code=403, detail="Invalid admin token")


@router.get("/admin/all")
async def get_all_consultations(
    x_admin_token: str = Header(None),
    limit: int = Query(100, ge=1, le=500)
):
    """Get all consultations for admin panel"""
    verify_admin_token(x_admin_token)
    
    if not consultation_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    consultations = await consultation_service.get_all_consultations(limit)
    return {"consultations": consultations, "count": len(consultations)}


@router.get("/admin/stats")
async def get_consultation_stats(x_admin_token: str = Header(None)):
    """Get consultation statistics"""
    verify_admin_token(x_admin_token)
    
    if not consultation_service:
        raise HTTPException(status_code=500, detail="Service not initialized")
    
    stats = await consultation_service.get_consultation_stats()
    funnel = await consultation_service.get_funnel_stats()
    
    return {
        "consultation_stats": stats,
        "funnel_stats": funnel
    }
