import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-6 pt-safe" dir="rtl">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-white hover:bg-[#1A1F35] h-12 w-12"
          >
            <ArrowRight className="w-6 h-6" />
          </Button>
          <h1 className="text-2xl font-bold text-white">תנאי שימוש</h1>
        </div>

        {/* Content */}
        <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800 space-y-6 text-[#94A3B8]">
          <p className="text-sm">עדכון אחרון: דצמבר 2024</p>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">1. תיאור השירות</h2>
            <p>
              LinedUp היא פלטפורמה לניהול תורים וזימון פגישות המחברת בין בעלי עסקים ללקוחות. 
              השירות מאפשר לבעלי עסקים לנהל את לוח הזמנים שלהם, ולקוחות לזמן תורים בקלות.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">2. אחריות המשתמש</h2>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>לספק מידע מדויק ועדכני בעת ההרשמה ובמהלך השימוש באפליקציה</li>
              <li>לשמור על סיסמה ופרטי התחברות בצורה מאובטחת</li>
              <li>להגיע לתורים שנקבעו או לבטל מראש בהתאם למדיניות העסק</li>
              <li>לא לעשות שימוש לרעה בפלטפורמה או לפגוע במשתמשים אחרים</li>
              <li>לא לזמן תורים ללא כוונה אמיתית להגיע</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">3. אחריות בעלי עסקים</h2>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>לספק מידע מדויק על השירותים, מחירים וזמני פעילות</li>
              <li>לכבד תורים שאושרו ולספק את השירות המובטח</li>
              <li>לטפל במידע של לקוחות באופן אחראי ובהתאם לחוקי הפרטיות</li>
              <li>לעדכן את מדיניות הביטולים בצורה ברורה</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">4. פרטיות ומידע</h2>
            <p>אנו אוספים ומשתמשים במידע הבא:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li><strong className="text-white">מידע אישי:</strong> שם, טלפון, כתובת אימייל</li>
              <li><strong className="text-white">מידע על תורים:</strong> היסטוריית הזמנות, העדפות</li>
              <li><strong className="text-white">שימוש:</strong> לצורך מתן השירות, שליחת תזכורות ועדכונים</li>
            </ul>
            <p>
              אנו משתמשים ב-WhatsApp לשליחת תזכורות ואישורים. ניתן לבטל קבלת הודעות בכל עת דרך ההגדרות.
            </p>
            <p>
              המידע שלך מאוחסן באופן מאובטח ולא יימסר לצדדים שלישיים ללא הסכמתך, למעט כנדרש על פי חוק.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">5. מדיניות ביטולים</h2>
            <p>
              כל עסק קובע את מדיניות הביטולים שלו. על המשתמשים לקרוא ולהבין את מדיניות הביטול של כל עסק לפני ביצוע הזמנה.
            </p>
            <p>
              אי-הגעה חוזרת לתורים ללא ביטול מראש עלולה לגרום להגבלת החשבון.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">6. הגבלת אחריות</h2>
            <p>
              LinedUp היא פלטפורמה המחברת בין בעלי עסקים ללקוחות. אנו לא אחראים על:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>איכות השירותים הניתנים על ידי בעלי העסקים</li>
              <li>סכסוכים בין לקוחות לבעלי עסקים</li>
              <li>נזקים ישירים או עקיפים הנובעים משימוש בפלטפורמה</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">7. סיום חשבון</h2>
            <p>
              אנו שומרים את הזכות להשעות או לסגור חשבונות המפרים את תנאי השימוש, כולל:
            </p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>שימוש לרעה בפלטפורמה</li>
              <li>מסירת מידע כוזב</li>
              <li>אי-הגעה חוזרת לתורים</li>
              <li>התנהגות פוגענית כלפי משתמשים אחרים</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">8. שינויים בתנאים</h2>
            <p>
              אנו עשויים לעדכן את תנאי השימוש מעת לעת. שינויים משמעותיים יפורסמו באפליקציה ו/או יישלחו בהתראה למשתמשים.
              המשך השימוש באפליקציה לאחר עדכון התנאים מהווה הסכמה לתנאים החדשים.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-white">9. יצירת קשר</h2>
            <p>
              לשאלות או בירורים בנוגע לתנאי השימוש, ניתן ליצור קשר דרך האפליקציה או במייל.
            </p>
          </section>

          <div className="pt-4 border-t border-gray-700">
            <p className="text-center text-sm">
              בשימוש באפליקציה, אתה מסכים לתנאי שימוש אלה.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}