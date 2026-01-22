import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@/components/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Loader2, Phone, User, Briefcase, CheckCircle, Lock, Eye, EyeOff, Mail } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'signup';
  const returnTo = searchParams.get('returnTo');

  const { sendOTP, verifyOTP, loginWithPassword, resetPassword, profile, isAuthenticated } = useUser();

  // Steps:
  // Signup: 'role' -> 'details' -> 'otp' -> 'success'
  // Login: 'login' -> 'success'
  // Forgot Password: 'forgot' -> 'forgot-otp' -> 'new-password' -> 'success'
  const [step, setStep] = useState(mode === 'login' ? 'login' : 'role');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [selectedRole, setSelectedRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedMarketing, setAcceptedMarketing] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);

  const otpInputRefs = useRef([]);

  useEffect(() => {
    if (isAuthenticated() && profile?.user_role) {
      redirectToApp();
    }
  }, [profile]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const redirectToApp = (profileData = profile) => {
    const p = profileData || profile;

    // If there's a returnTo URL, use it
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    // Otherwise, use default routing
    if (p?.user_role === 'business_owner') {
      navigate(p.business_id ? "/BusinessDashboard" : "/BusinessSetup");
    } else {
      navigate(p?.joined_business_id ? "/ClientDashboard" : "/JoinBusiness");
    }
  };

  // ===== SIGNUP FLOW =====

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setStep('details');
    setError('');
  };

  // Signup: Submit details and send OTP for verification
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) return setError('נא להזין שם מלא');
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) return setError('נא להזין מספר טלפון תקין');

    // Email is required for business owners
    if (selectedRole === 'business_owner') {
      if (!email.trim()) return setError('נא להזין כתובת אימייל');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return setError('נא להזין כתובת אימייל תקינה');
      if (email.toLowerCase() !== confirmEmail.toLowerCase()) return setError('כתובות האימייל לא תואמות');
    }

    if (!password || password.length < 6) return setError('סיסמה חייבת להכיל לפחות 6 תווים');
    if (password !== confirmPassword) return setError('הסיסמאות לא תואמות');
    if (!acceptedTerms) return setError('נא לאשר את תנאי השימוש');

    setLoading(true);
    try {
      await sendOTP(phone, false); // false = don't check if exists (new signup)
      setStep('otp');
      setCountdown(60);
    } catch (err) {
      setError(err.message || 'שגיאה בשליחת קוד האימות');
    } finally {
      setLoading(false);
    }
  };

  // Verify phone OTP and complete signup
  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) return setError('נא להזין קוד בן 6 ספרות');

    setLoading(true);
    try {
      // Verify phone OTP and create account
      const result = await verifyOTP(phone, code, {
        fullName,
        email: selectedRole === 'business_owner' ? email.toLowerCase() : null,
        password,
        userRole: selectedRole,
        acceptedTerms,
        acceptedMarketing,
      });

      if (result.success) {
        setStep('success');
        setTimeout(() => {
          if (result.isNewUser) {
            navigate(selectedRole === 'business_owner' ? "/BusinessSetup" : "/JoinBusiness");
          } else {
            redirectToApp(result.profile);
          }
        }, 1500);
      }
    } catch (err) {
      setError(err.message || 'קוד שגוי, נסה שוב');
      setOtpCode(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ===== LOGIN FLOW =====

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) return setError('נא להזין מספר טלפון תקין');
    if (!password) return setError('נא להזין סיסמה');

    setLoading(true);
    try {
      const result = await loginWithPassword(phone, password);
      if (result.success) {
        setStep('success');
        setTimeout(() => redirectToApp(result.profile), 1500);
      }
    } catch (err) {
      setError(err.message || 'מספר טלפון או סיסמה שגויים');
    } finally {
      setLoading(false);
    }
  };

  // ===== FORGOT PASSWORD FLOW =====

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) return setError('נא להזין מספר טלפון תקין');

    setLoading(true);
    try {
      await sendOTP(phone, true); // true = check if user exists first
      setStep('forgot-otp');
      setCountdown(60);
    } catch (err) {
      setError(err.message || 'שגיאה בשליחת קוד האימות');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyForgotOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) return setError('נא להזין קוד בן 6 ספרות');

    setLoading(true);
    try {
      // Just verify the OTP is correct, don't log in
      const result = await verifyOTP(phone, code, { verifyOnly: true });
      if (result.success) {
        setStep('new-password');
        setOtpCode(['', '', '', '', '', '']);
      }
    } catch (err) {
      setError(err.message || 'קוד שגוי, נסה שוב');
      setOtpCode(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) return setError('סיסמה חייבת להכיל לפחות 6 תווים');
    if (newPassword !== confirmNewPassword) return setError('הסיסמאות לא תואמות');

    setLoading(true);
    try {
      const result = await resetPassword(phone, newPassword);
      if (result.success) {
        setStep('success');
        setTimeout(() => redirectToApp(result.profile), 1500);
      }
    } catch (err) {
      setError(err.message || 'שגיאה באיפוס הסיסמה');
    } finally {
      setLoading(false);
    }
  };

  // ===== OTP HELPERS =====

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otpCode];
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit;
      });
      setOtpCode(newOtp);
      const lastIndex = Math.min(index + digits.length, 5);
      otpInputRefs.current[lastIndex]?.focus();
    } else {
      const newOtp = [...otpCode];
      newOtp[index] = value.replace(/\D/g, '');
      setOtpCode(newOtp);
      if (value && index < 5) otpInputRefs.current[index + 1]?.focus();
    }
    setError('');
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Auto-verify when all digits entered
  useEffect(() => {
    if (otpCode.every(digit => digit !== '')) {
      if (step === 'otp') {
        handleVerifyOtp();
      } else if (step === 'forgot-otp') {
        handleVerifyForgotOtp();
      }
    }
  }, [otpCode, step]);

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    try {
      await sendOTP(phone, step === 'forgot-otp');
      setCountdown(60);
      setOtpCode(['', '', '', '', '', '']);
    } catch (err) {
      setError(err.message || 'שגיאה בשליחת קוד');
    } finally {
      setLoading(false);
    }
  };

  // ===== GO BACK LOGIC =====

  const handleBack = () => {
    setError('');
    setOtpCode(['', '', '', '', '', '']);

    switch (step) {
      case 'details':
        setStep('role');
        break;
      case 'otp':
        setStep('details');
        break;
      case 'forgot':
        setStep('login');
        break;
      case 'forgot-otp':
        setStep('forgot');
        break;
      case 'new-password':
        setStep('forgot');
        break;
      default:
        navigate("/Welcome");
    }
  };

  // ===== SUCCESS SCREEN =====

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="w-14 h-14 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            {step === 'success' && mode === 'login' ? 'התחברת בהצלחה!' : 'נרשמת בהצלחה!'}
          </h2>
          <p className="text-[#94A3B8]">מעביר אותך...</p>
        </div>
      </div>
    );
  }

  // ===== RENDER UI =====

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-6 pt-safe flex flex-col">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors"
      >
        <ArrowRight className="w-5 h-5" />
        <span>חזרה</span>
      </button>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">

          {/* ===== ROLE SELECTION (Signup) ===== */}
          {step === 'role' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">הרשמה</h1>
                <p className="text-[#94A3B8]">בחר את סוג החשבון שלך</p>
              </div>

              <button
                onClick={() => handleRoleSelect('client')}
                className="w-full bg-[#1A1F35] rounded-2xl p-5 text-right transition-all hover:scale-105 hover:border-[#FF6B35] border-2 border-gray-800"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">אני לקוח</h3>
                    <p className="text-[#94A3B8] text-sm">רוצה לקבוע תורים</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleRoleSelect('business_owner')}
                className="w-full bg-[#1A1F35] rounded-2xl p-5 text-right transition-all hover:scale-105 hover:border-[#FF6B35] border-2 border-gray-800"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF6B35] to-[#FF1744] flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">אני בעל עסק</h3>
                    <p className="text-[#94A3B8] text-sm">רוצה לנהל את העסק שלי</p>
                  </div>
                </div>
              </button>

              <p className="text-center text-[#94A3B8] text-sm pt-4">
                כבר יש לך חשבון?{' '}
                <button onClick={() => navigate('/Auth?mode=login')} className="text-[#FF6B35] font-semibold hover:underline">
                  התחבר
                </button>
              </p>
            </div>
          )}

          {/* ===== DETAILS (Signup) ===== */}
          {step === 'details' && (
            <form onSubmit={handleDetailsSubmit} className="space-y-5">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">פרטי הרשמה</h1>
                <p className="text-[#94A3B8]">מלא את הפרטים כדי להמשיך</p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">שם מלא</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="השם המלא שלך"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 h-12 rounded-xl"
                    dir="rtl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">מספר טלפון</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05X-XXXXXXX"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 h-12 rounded-xl"
                    dir="ltr"
                  />
                </div>
                <p className="text-xs text-[#64748B] mt-1">
                  נדרש לשליחת תזכורות והודעות WhatsApp על תורים
                </p>
              </div>

              {/* Email fields - required for business owners */}
              {selectedRole === 'business_owner' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-white">אימייל</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="bg-[#1A1F35] border-gray-800 text-white pr-10 h-12 rounded-xl"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">אימות אימייל</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="email"
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        placeholder="הזן שוב את האימייל"
                        className="bg-[#1A1F35] border-gray-800 text-white pr-10 h-12 rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-xs text-[#94A3B8]">האימייל ישמש לזיהוי תשלומים ולקבלת חשבוניות</p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-white">סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="לפחות 6 תווים"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 pl-10 h-12 rounded-xl"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#94A3B8]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">אימות סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="הזן שוב את הסיסמה"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 h-12 rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={acceptedTerms}
                    onCheckedChange={setAcceptedTerms}
                    className="mt-1 border-gray-600 data-[state=checked]:bg-[#FF6B35] data-[state=checked]:border-[#FF6B35]"
                  />
                  <label htmlFor="terms" className="text-sm text-[#94A3B8] cursor-pointer">
                    אני מאשר/ת את{' '}
                    <a href="/terms" className="text-[#FF6B35] hover:underline">תנאי השימוש</a>
                    {' '}ו
                    <a href="/privacy" className="text-[#FF6B35] hover:underline">מדיניות הפרטיות</a>
                  </label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="marketing"
                    checked={acceptedMarketing}
                    onCheckedChange={setAcceptedMarketing}
                    className="mt-1 border-gray-600 data-[state=checked]:bg-[#FF6B35] data-[state=checked]:border-[#FF6B35]"
                  />
                  <label htmlFor="marketing" className="text-sm text-[#94A3B8] cursor-pointer">
                    אני מעוניין/ת לקבל עדכונים והצעות במייל
                  </label>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-xl text-white font-bold text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'המשך לאימות'}
              </Button>
            </form>
          )}

          {/* ===== OTP VERIFICATION (Signup) ===== */}
          {step === 'otp' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">אימות טלפון</h1>
                <p className="text-[#94A3B8]">
                  שלחנו קוד בן 6 ספרות ל-<span className="text-white font-semibold" dir="ltr">{phone}</span>
                </p>
              </div>

              <div className="flex justify-center gap-2" dir="ltr">
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpInputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-[#1A1F35] border-2 border-gray-800 rounded-xl text-white focus:border-[#FF6B35] focus:outline-none transition-colors"
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-[#94A3B8] text-sm">
                    ניתן לשלוח שוב בעוד <span className="text-white font-semibold">{countdown}</span> שניות
                  </p>
                ) : (
                  <button
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-[#FF6B35] font-semibold hover:underline"
                  >
                    שלח קוד שוב
                  </button>
                )}
              </div>

              {loading && (
                <div className="flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
                </div>
              )}
            </div>
          )}

          {/* ===== LOGIN ===== */}
          {step === 'login' && (
            <form onSubmit={handlePasswordLogin} className="space-y-5">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">התחברות</h1>
                <p className="text-[#94A3B8]">הזן את פרטי ההתחברות שלך</p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">מספר טלפון</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05X-XXXXXXX"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 h-12 rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="הסיסמה שלך"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 pl-10 h-12 rounded-xl"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#94A3B8]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('forgot')}
                className="text-[#FF6B35] text-sm hover:underline"
              >
                שכחתי סיסמה
              </button>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-xl text-white font-bold text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'התחבר'}
              </Button>

              <p className="text-center text-[#94A3B8] text-sm pt-4">
                אין לך חשבון?{' '}
                <button onClick={() => navigate('/Auth?mode=signup')} className="text-[#FF6B35] font-semibold hover:underline">
                  הרשם עכשיו
                </button>
              </p>
            </form>
          )}

          {/* ===== FORGOT PASSWORD - Enter Phone ===== */}
          {step === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">שכחתי סיסמה</h1>
                <p className="text-[#94A3B8]">הזן את מספר הטלפון שלך לקבלת קוד אימות</p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">מספר טלפון</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="05X-XXXXXXX"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 h-12 rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-xl text-white font-bold text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'שלח קוד אימות'}
              </Button>
            </form>
          )}

          {/* ===== FORGOT PASSWORD - OTP ===== */}
          {step === 'forgot-otp' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">אימות טלפון</h1>
                <p className="text-[#94A3B8]">
                  שלחנו קוד בן 6 ספרות ל-<span className="text-white font-semibold" dir="ltr">{phone}</span>
                </p>
              </div>

              <div className="flex justify-center gap-2" dir="ltr">
                {otpCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpInputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-[#1A1F35] border-2 border-gray-800 rounded-xl text-white focus:border-[#FF6B35] focus:outline-none transition-colors"
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-[#94A3B8] text-sm">
                    ניתן לשלוח שוב בעוד <span className="text-white font-semibold">{countdown}</span> שניות
                  </p>
                ) : (
                  <button
                    onClick={handleResendOtp}
                    disabled={loading}
                    className="text-[#FF6B35] font-semibold hover:underline"
                  >
                    שלח קוד שוב
                  </button>
                )}
              </div>

              {loading && (
                <div className="flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#FF6B35]" />
                </div>
              )}
            </div>
          )}

          {/* ===== NEW PASSWORD ===== */}
          {step === 'new-password' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-white mb-2">סיסמה חדשה</h1>
                <p className="text-[#94A3B8]">הזן את הסיסמה החדשה שלך</p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">סיסמה חדשה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="לפחות 6 תווים"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 pl-10 h-12 rounded-xl"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#94A3B8]"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">אימות סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="הזן שוב את הסיסמה"
                    className="bg-[#1A1F35] border-gray-800 text-white pr-10 h-12 rounded-xl"
                    dir="ltr"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-xl text-white font-bold text-lg"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'עדכן סיסמה והתחבר'}
              </Button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}