# Supabase 이메일 템플릿 한글화 가이드

## 📍 접근 방법

1. **Supabase 대시보드** → [https://supabase.com/dashboard](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. 왼쪽 사이드바 → **Authentication** 클릭
4. 상단 탭 → **Email Templates** 클릭

---

## ✉️ 템플릿 1: 가입 확인 이메일 (Confirm signup)

**드롭다운에서 "Confirm signup" 선택 후 아래 내용으로 교체**

### Subject (제목)
```
[키즈밀] 회원가입을 환영합니다!
```

### Message Body (HTML)
```html
<div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 480px; margin: 0 auto; background: #F6FAF6; padding: 24px 16px;">
  <div style="background: white; border-radius: 24px; padding: 40px 32px; text-align: center;">
    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #2D6A4F, #52B788); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
      <span style="color: white; font-size: 28px; font-weight: bold;">K</span>
    </div>
    <h1 style="color: #1C2B1E; font-size: 20px; font-weight: bold; margin: 0 0 8px;">키즈밀 가족이 되신 것을 환영합니다 🌿</h1>
    <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 32px;">
      안녕하세요! 키즈밀 학부모 포털에 가입해주셔서 감사합니다.<br>
      아래 버튼을 클릭하여 이메일을 인증해주세요.
    </p>
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #2D6A4F; color: white; text-decoration: none; font-size: 15px; font-weight: bold; padding: 14px 40px; border-radius: 14px;">
      이메일 인증하기
    </a>
    <p style="color: #9CA3AF; font-size: 12px; margin: 24px 0 0;">
      이 링크는 24시간 후 만료됩니다.<br>
      본인이 요청하지 않은 경우 이 이메일을 무시해주세요.
    </p>
  </div>
  <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>
```

---

## ✉️ 템플릿 2: 비밀번호 재설정 (Reset Password)

**드롭다운에서 "Reset Password" 선택 후 아래 내용으로 교체**

### Subject (제목)
```
[키즈밀] 비밀번호 재설정 안내
```

### Message Body (HTML)
```html
<div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 480px; margin: 0 auto; background: #F6FAF6; padding: 24px 16px;">
  <div style="background: white; border-radius: 24px; padding: 40px 32px; text-align: center;">
    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #2D6A4F, #52B788); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
      <span style="color: white; font-size: 28px; font-weight: bold;">K</span>
    </div>
    <h1 style="color: #1C2B1E; font-size: 20px; font-weight: bold; margin: 0 0 8px;">비밀번호 재설정 안내</h1>
    <p style="color: #6B7280; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
      비밀번호 재설정 요청이 접수되었습니다.<br>
      아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
    </p>
    <p style="color: #F97316; font-size: 12px; margin: 0 0 32px;">⏱ 이 링크는 1시간 후 만료됩니다</p>
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #2D6A4F; color: white; text-decoration: none; font-size: 15px; font-weight: bold; padding: 14px 40px; border-radius: 14px;">
      비밀번호 재설정하기
    </a>
    <p style="color: #9CA3AF; font-size: 12px; margin: 24px 0 0;">
      본인이 요청하지 않은 경우 이 이메일을 무시해주세요.<br>
      계정은 안전하게 유지됩니다.
    </p>
  </div>
  <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 16px;">키즈밀 · 건강한 급식 솔루션</p>
</div>
```

---

## ✉️ 템플릿 3: 학부모 승인 완료 이메일 (앱에서 직접 발송)

> Supabase 기본 템플릿이 아닌, **관리자가 승인할 때 앱 코드에서 발송**하는 이메일입니다.
> 현재는 Supabase의 이메일 발송 기능(`supabase.auth.admin.sendEmail`)을 활용하거나
> 별도 SMTP(SendGrid/Resend 등) 연동이 필요합니다.

### 발송 타이밍
- `/board/admin/parents` 페이지에서 승인 버튼 클릭 시

### 발송 내용 예시
**제목:** `[키즈밀] 가입이 승인되었습니다! 🎉`

**본문:**
```
안녕하세요, {name}님!

키즈밀 학부모 포털 가입이 승인되었습니다.
지금 바로 아이의 급식 사진과 식단표를 확인해보세요 🥗

→ 포털 바로가기: https://kizmeal.com/parent/login
```

---

## 📋 단계별 설정 방법

1. Supabase Dashboard 접속
2. 좌측 메뉴 **Authentication** 클릭
3. 상단 **Email Templates** 탭 클릭
4. 드롭다운에서 템플릿 선택 (Confirm signup / Reset Password)
5. **Subject** 필드에 제목 입력
6. **Message Body** 필드에 위 HTML 붙여넣기
7. **Save** 버튼 클릭

> **팁:** 우측 미리보기로 이메일 레이아웃을 확인할 수 있습니다.
> `{{ .ConfirmationURL }}` 변수는 Supabase가 자동으로 실제 링크로 교체합니다.
