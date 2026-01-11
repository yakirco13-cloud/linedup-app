import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@/components/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowRight, Loader2, Phone, User, Briefcase, CheckCircle, Lock, Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'signup';
  
  const { sendOTP, verifyOTP, loginWithPassword, profile, isAuthenticated } = useUser();

  const [step, setStep] = useState(mode === 'login' ? 'login' : 'role');
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const [selectedRole, setSelectedRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (p?.user_role === 'business_owner') {
      navigate(p.business_id ? "/BusinessDashboard" : "/BusinessSetup");
    } else {
      navigate(p?.joined_business_id ? "/ClientDashboard" : "/JoinBusiness");
    }
  };

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setStep('details');
    setError('');
  };

  // Signup: Submit details and go to OTP
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) return setError('נא להזין שם מלא');
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) return setError('נא להזין מספר טלפון תקין');
    if (!password || password.length < 6) return setError('סיסמה חייבת להכיל לפחות 6 תווים');
    if (password !== confirmPassword) return setError('הסיסמאות לא תואמות');
    if (!acceptedTerms) return setError('נא לאשר את תנאי השימוש');

    setLoading(true);
    try {
      await sendOTP(phone);
      setStep('otp');
      setCountdown(60);
    } catch (err) {
      setError(err.message || 'שגיאה בשליחת קוד האימות');
    } finally {
      setLoading(false);
    }
  };

  // Login with password
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
      setError(err.message || 'שם משתמש או סיסמה שגויים');
    } finally {
      setLoading(false);
    }
  };

  // Login with OTP - send code
  const handleOtpLoginRequest = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) return setError('נא להזין מספר טלפון תקין');

    setLoading(true);
    try {
      await sendOTP(phone, true); // true = check exists first
      setStep('otp');
      setCountdown(60);
    } catch (err) {
      setError(err.message || 'שגיאה בשליחת קוד האימות');
    } finally {
      setLoading(false);
    }
  };

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

  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) return setError('נא להזין קוד בן 6 ספרות');

    setLoading(true);
    try {
      const result = await verifyOTP(phone, code, {
        fullName,
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

  useEffect(() => {
    if (otpCode.every(digit => digit !== '') && step === 'otp') {
      handleVerifyOtp();
    }
  }, [otpCode]);

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');
    try {
      await sendOTP(phone);
      setCountdown(60);
      setOtpCode(['', '', '', '', '', '']);
    } catch (err) {
      setError(err.message || 'שגיאה בשליחת קוד');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#0C0F1D] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="w-14 h-14 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            {mode === 'login' ? 'התחברת בהצלחה!' : 'נרשמת בהצלחה!'}
          </h2>
          <p className="text-[#94A3B8]">מעביר אותך...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0F1D] p-6 pt-safe flex flex-col">
      {/* Back button - fixed at top */}
      <button
        onClick={() => {
          if (step === 'otp') {
            if (mode === 'login') {
              setStep('login');
              setLoginMethod('otp');
            } else {
              setStep('details');
            }
          } else if (step === 'details') {
            setStep('role');
          } else {
            navigate("/Welcome");
          }
          setError('');
          setOtpCode(['', '', '', '', '', '']);
        }}
        className="flex items-center gap-2 text-[#94A3B8] mb-6 hover:text-white transition-colors"
      >
        <ArrowRight className="w-5 h-5" />
        <span>חזרה</span>
      </button>

      {/* Content - centered */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">

        {/* Step: Role Selection (Signup) */}
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

            <p className="text-center text-[#64748B] text-sm mt-6">
              כבר יש לך חשבון?{' '}
              <button onClick={() => navigate("/Auth?mode=login")} className="text-[#FF6B35] hover:underline">
                התחבר
              </button>
            </p>
          </div>
        )}

        {/* Step: Login */}
        {step === 'login' && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">התחברות</h1>
              <p className="text-[#94A3B8]">הזן את פרטי החשבון שלך</p>
            </div>

            {loginMethod === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="space-y-6">
                <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white">מספר טלפון</Label>
                    <div className="relative">
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="054-1234567"
                        className="bg-[#0C0F1D] border-gray-700 text-white h-14 rounded-xl pr-12 text-lg"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">סיסמה</Label>
                    <div className="relative">
                      <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="הסיסמה שלך"
                        className="bg-[#0C0F1D] border-gray-700 text-white h-14 rounded-xl pr-12 pl-12 text-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-400 text-sm text-center">
                    {error}
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

                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('otp');
                    setError('');
                  }}
                  className="w-full text-center text-[#94A3B8] text-sm hover:text-[#FF6B35]"
                >
                  שכחת סיסמה? התחבר עם קוד SMS
                </button>
              </form>
            ) : (
              <form onSubmit={handleOtpLoginRequest} className="space-y-6">
                <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
                  <div className="space-y-2">
                    <Label className="text-white">מספר טלפון</Label>
                    <div className="relative">
                      <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="054-1234567"
                        className="bg-[#0C0F1D] border-gray-700 text-white h-14 rounded-xl pr-12 text-lg"
                        dir="ltr"
                      />
                    </div>
                    <p className="text-[#64748B] text-xs">נשלח קוד אימות בוואטסאפ</p>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-400 text-sm text-center">
                    {error}
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

                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('password');
                    setError('');
                  }}
                  className="w-full text-center text-[#94A3B8] text-sm hover:text-[#FF6B35]"
                >
                  התחבר עם סיסמה
                </button>
              </form>
            )}

            <p className="text-center text-[#64748B] text-sm">
              אין לך חשבון?{' '}
              <button onClick={() => navigate("/Auth?mode=signup")} className="text-[#FF6B35] hover:underline">
                הרשם
              </button>
            </p>
          </div>
        )}

        {/* Step: Details (Signup) */}
        {step === 'details' && (
          <form onSubmit={handleDetailsSubmit} className="space-y-6">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-white mb-2">פרטי חשבון</h1>
              <p className="text-[#94A3B8] text-sm">מלא את הפרטים ליצירת חשבון</p>
            </div>

            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800 space-y-4">
              <div className="space-y-2">
                <Label className="text-white">שם מלא</Label>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="ישראל ישראלי"
                    className="bg-[#0C0F1D] border-gray-700 text-white h-14 rounded-xl pr-12 text-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">מספר טלפון</Label>
                <div className="relative">
                  <Phone className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="054-1234567"
                    className="bg-[#0C0F1D] border-gray-700 text-white h-14 rounded-xl pr-12 text-lg"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="לפחות 6 תווים"
                    className="bg-[#0C0F1D] border-gray-700 text-white h-14 rounded-xl pr-12 pl-12 text-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white">אימות סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="הזן שוב את הסיסמה"
                    className="bg-[#0C0F1D] border-gray-700 text-white h-14 rounded-xl pr-12 text-lg"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={acceptedTerms}
                  onCheckedChange={setAcceptedTerms}
                  className="mt-1 border-gray-600 data-[state=checked]:bg-[#FF6B35] data-[state=checked]:border-[#FF6B35]"
                />
                <label htmlFor="terms" className="text-[#94A3B8] text-sm leading-relaxed cursor-pointer">
                  קראתי ואני מסכים/ה ל
                  <button type="button" onClick={() => navigate("/TermsOfService")} className="text-[#FF6B35] hover:underline mx-1">
                    תנאי השימוש
                  </button>
                  ו
                  <button type="button" onClick={() => navigate("/TermsOfService")} className="text-[#FF6B35] hover:underline mx-1">
                    מדיניות הפרטיות
                  </button>
                </label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="marketing"
                  checked={acceptedMarketing}
                  onCheckedChange={setAcceptedMarketing}
                  className="mt-1 border-gray-600 data-[state=checked]:bg-[#FF6B35] data-[state=checked]:border-[#FF6B35]"
                />
                <label htmlFor="marketing" className="text-[#94A3B8] text-sm leading-relaxed cursor-pointer">
                  אני מאשר/ת לקבל עדכונים והודעות שיווקיות
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl text-white font-bold text-lg"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'המשך לאימות טלפון'}
            </Button>
          </form>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <p className="text-[#94A3B8] mb-2">שלחנו קוד אימות בוואטסאפ למספר</p>
              <p className="text-white text-xl font-bold" dir="ltr">{phone}</p>
            </div>

            <div className="bg-[#1A1F35] rounded-2xl p-6 border border-gray-800">
              <Label className="text-white text-center block mb-4">הזן את הקוד</Label>
              <div className="flex justify-center gap-2" dir="ltr">
                {otpCode.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => otpInputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold bg-[#0C0F1D] border-gray-700 text-white rounded-xl focus:border-[#FF6B35]"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 rounded-xl p-3 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-[#94A3B8] text-sm">שלח שוב בעוד {countdown} שניות</p>
              ) : (
                <button onClick={handleResendOtp} disabled={loading} className="text-[#FF6B35] hover:underline text-sm">
                  לא קיבלת? שלח שוב
                </button>
              )}
            </div>

            <Button
              onClick={handleVerifyOtp}
              disabled={loading || otpCode.some(d => !d)}
              className="w-full h-14 rounded-xl text-white font-bold text-lg"
              style={{ background: 'linear-gradient(135deg, #FF6B35, #FF1744)' }}
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'אמת קוד'}
            </Button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}