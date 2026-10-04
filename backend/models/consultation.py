"""
Consultation Model and Schema
"""
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class AgeGroup(str, Enum):
    UNDER_25 = "under_25"
    AGE_25_30 = "25_30"
    AGE_30_40 = "30_40"
    OVER_40 = "40_plus"


class SkinType(str, Enum):
    OILY = "oily"
    DRY = "dry"
    COMBINATION = "combination"
    SENSITIVE = "sensitive"
    NOT_SURE = "not_sure"


class SkinConcern(str, Enum):
    FINE_LINES = "fine_lines"
    PIGMENTATION = "pigmentation"
    DULL_SKIN = "dull_skin"
    UNEVEN_TEXTURE = "uneven_texture"


class SunExposure(str, Enum):
    LESS_30_MIN = "less_30_min"
    ONE_TO_TWO_HRS = "1_2_hrs"
    MORE_2_HRS = "more_2_hrs"


class SunscreenUsage(str, Enum):
    DAILY = "daily"
    SOMETIMES = "sometimes"
    NEVER = "never"


class Lifestyle(str, Enum):
    HEALTHY = "healthy"
    MODERATE = "moderate"
    POOR = "poor"


class SkincareUsage(str, Enum):
    NONE = "none"
    BASIC = "basic"
    ACTIVE = "active"


class AgingLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class MajorIssue(str, Enum):
    AGING = "aging"
    ACNE = "acne"
    DULLNESS = "dullness"
    PIGMENTATION = "pigmentation"
    SENSITIVITY = "sensitivity"


class ConsultationAnswers(BaseModel):
    age_group: AgeGroup
    skin_type: SkinType
    concerns: List[SkinConcern] = Field(max_length=2)
    major_issue: Optional[MajorIssue] = MajorIssue.AGING
    sun_exposure: SunExposure
    sunscreen_usage: SunscreenUsage
    lifestyle: Lifestyle
    skincare_usage: SkincareUsage


class ConsultationCreate(BaseModel):
    answers: ConsultationAnswers
    phone: str
    face_images: Optional[List[str]] = []  # URLs of uploaded images
    language: str = "en"


class ConsultationResult(BaseModel):
    aging_level: AgingLevel
    causes: List[str]
    morning_routine: List[str]
    night_routine: List[str]
    rules: List[str]
    diet_tips: List[str]
    exercise_tips: List[str]
    product_usage: str  # Personalized product usage instruction


class ConsultationResponse(BaseModel):
    id: str
    phone: str
    answers: ConsultationAnswers
    result: ConsultationResult
    face_images: List[str] = []
    location: Optional[dict] = None
    language: str = "en"
    created_at: str
    pdf_downloaded: bool = False


class ConsultationEvent(BaseModel):
    session_id: str
    event_type: str  # started, step_completed, face_uploaded, phone_entered, completed, pdf_downloaded
    step: Optional[int] = None
    page: Optional[str] = None
    timestamp: Optional[str] = None


# Display labels for UI
AGE_LABELS = {
    "under_25": {"en": "Under 25", "hi": "25 से कम", "ml": "25-ൽ താഴെ"},
    "25_30": {"en": "25-30", "hi": "25-30", "ml": "25-30"},
    "30_40": {"en": "30-40", "hi": "30-40", "ml": "30-40"},
    "40_plus": {"en": "40+", "hi": "40+", "ml": "40+"}
}

SKIN_TYPE_LABELS = {
    "oily": {"en": "Oily", "hi": "तैलीय", "ml": "എണ്ണമയമുള്ള"},
    "dry": {"en": "Dry", "hi": "रूखी", "ml": "വരണ്ട"},
    "combination": {"en": "Combination", "hi": "मिश्रित", "ml": "കോമ്പിനേഷൻ"},
    "sensitive": {"en": "Sensitive", "hi": "संवेदनशील", "ml": "സെൻസിറ്റീവ്"},
    "not_sure": {"en": "Not Sure", "hi": "पता नहीं", "ml": "ഉറപ്പില്ല"}
}

CONCERN_LABELS = {
    "fine_lines": {"en": "Fine Lines & Wrinkles", "hi": "महीन रेखाएं और झुर्रियां", "ml": "നേർത്ത വരകളും ചുളിവുകളും"},
    "pigmentation": {"en": "Pigmentation & Dark Spots", "hi": "पिगमेंटेशन और काले धब्बे", "ml": "പിഗ്മെന്റേഷനും കറുത്ത പാടുകളും"},
    "dull_skin": {"en": "Dull & Tired Skin", "hi": "बेजान और थकी त्वचा", "ml": "മങ്ങിയതും ക്ഷീണിച്ചതുമായ ത്വക്ക്"},
    "uneven_texture": {"en": "Uneven Texture", "hi": "असमान बनावट", "ml": "അസമമായ ടെക്സ്ചർ"}
}

SUN_EXPOSURE_LABELS = {
    "less_30_min": {"en": "Less than 30 minutes", "hi": "30 मिनट से कम", "ml": "30 മിനിറ്റിൽ താഴെ"},
    "1_2_hrs": {"en": "1-2 hours", "hi": "1-2 घंटे", "ml": "1-2 മണിക്കൂർ"},
    "more_2_hrs": {"en": "More than 2 hours", "hi": "2 घंटे से अधिक", "ml": "2 മണിക്കൂറിൽ കൂടുതൽ"}
}

SUNSCREEN_LABELS = {
    "daily": {"en": "Daily", "hi": "रोज़ाना", "ml": "ദിവസവും"},
    "sometimes": {"en": "Sometimes", "hi": "कभी-कभी", "ml": "ചിലപ്പോൾ"},
    "never": {"en": "Never", "hi": "कभी नहीं", "ml": "ഒരിക്കലുമില്ല"}
}

LIFESTYLE_LABELS = {
    "healthy": {"en": "Healthy (Good sleep, balanced diet)", "hi": "स्वस्थ (अच्छी नींद, संतुलित आहार)", "ml": "ആരോഗ്യകരം (നല്ല ഉറക്കം, സമതുലിതമായ ഭക്ഷണം)"},
    "moderate": {"en": "Moderate (Some stress, irregular habits)", "hi": "मध्यम (कुछ तनाव, अनियमित आदतें)", "ml": "മിതമായ (ചില സമ്മർദ്ദം, ക്രമരഹിതമായ ശീലങ്ങൾ)"},
    "poor": {"en": "Poor (High stress, unhealthy habits)", "hi": "खराब (अधिक तनाव, अस्वस्थ आदतें)", "ml": "മോശം (ഉയർന്ന സമ്മർദ്ദം, അനാരോഗ്യകരമായ ശീലങ്ങൾ)"}
}

SKINCARE_LABELS = {
    "none": {"en": "None (Just water/soap)", "hi": "कुछ नहीं (सिर्फ पानी/साबुन)", "ml": "ഒന്നുമില്ല (വെള്ളം/സോപ്പ് മാത്രം)"},
    "basic": {"en": "Basic (Cleanser, moisturizer)", "hi": "बुनियादी (क्लींजर, मॉइस्चराइज़र)", "ml": "അടിസ്ഥാനം (ക്ലെൻസർ, മോയ്സ്ചറൈസർ)"},
    "active": {"en": "Active (Serums, treatments)", "hi": "सक्रिय (सीरम, ट्रीटमेंट)", "ml": "സജീവം (സെറം, ചികിത്സകൾ)"}
}
