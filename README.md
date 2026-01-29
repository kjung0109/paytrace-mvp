# 💳 PayTrace (MVP)
<img width="1176" height="483" alt="image" src="https://github.com/user-attachments/assets/ef512f1c-ec55-4d32-8264-e5d1e772638a" />


> **"월세 납부, 신용에 도움 될까요?"**
>
> **숨겨진 납부 내역으로 실제 금융 생활을 편리하게 만드는 대안 신용 리포트 서비스**

PayTrace는 금융 이력이 부족한 Thin-Filer(사회초년생, 프리랜서)들이 자신의 월세 및 고정비 성실 납부 내역을 통해 신용도를 입증할 수 있도록 돕는 서비스입니다. 사용자가 입력한 데이터를 분석하여 자체 신용 성실도 지표인 **PayScore**를 산출하고, 금융기관 제출용 리포트(PDF)를 생성합니다.

🔗 **Live Demo:** [https://paytrace-mvp.vercel.app/](https://paytrace-mvp.vercel.app/)

---

## 🚩 Project Background (Problem & Solution)

### 😟 Problem (The Pain Point)
*   **금융 이력 부족 (Thin-file):** 2030 사회초년생과 프리랜서는 연체 없이 성실하게 살아가지만, 신용카드 발급이나 대출 심사에서 불이익을 받습니다.
*   **데이터의 사각지대:** 월세는 가계 지출의 큰 비중을 차지하지만, 기존 신용평가 시스템(CB)에는 반영되지 않습니다.
*   **복잡한 소명 절차:** 금융기관에 소득이나 성실성을 증명하기 위해 재직증명서 등 복잡한 서류가 필요합니다.

### 💡 Solution (Value Proposition)
*   **성실 납부의 자산화:** 월세, 관리비, 구독료 등 정기 지출 내역을 '신뢰 데이터'로 전환합니다.
*   **PayScore:** 자체 알고리즘을 통해 납부 성실도를 0~100점 척도로 점수화합니다.
*   **공식 리포트:** 은행/카드사에 보조 자료로 제출 가능한 PDF 리포트를 발급합니다.

---

## 🛠 Key Features (MVP Scope)

### 1. 고정 지출 정보 입력 (Data Input)
*   **임대차 정보:** 계약 기간(1~36개월), 월세 금액, 관리비 포함 여부 입력 및 유효성 검증.
*   **고정비 내역:** OTT, 음악 스트리밍 등 정기 구독 서비스 납부 내역 입력 (행 추가 기능).
*   **Opt-in 방식:** 사용자가 직접 제출하고 싶은 정보만 선택적으로 입력하여 개인정보 거부감 완화.

### 2. PayScore 분석 및 산출 (Analysis Engine)
*   **Rule-based Scoring:** 입력된 데이터를 3가지 차원에서 분석하여 점수 산출.
    *   **기간 (50%):** 납부 지속 기간
    *   **규모 (30%):** 월 평균 납부 금액
    *   **다양성 (20%):** 지출 항목의 다양성
*   **신용점수 시뮬레이션:** PayScore 구간에 따라 NICE/KCB 신용점수 예상 상승 폭 매핑.

### 3. 리포트 생성 및 Lead Gen (Action)
*   **결과 확인:** PayScore 등급(새싹/성실/마스터 납부러) 및 점수 시각화.
*   **리포트 발급:** 이메일 입력(Lead Gen) 후 금융기관 제출용 PDF 리포트 생성 및 다운로드.
*   **금융 상품 추천:** 산출된 점수 기반 맞춤형 카드/대출 상품 추천.

---

## 📐 Architecture & Logic

### 📊 PayScore Rating System
PayScore는 총 100점 만점으로 계산되며, 점수에 따라 3단계 등급과 예상 신용점수 상승폭을 제공합니다.

| PayScore 구간 | 등급 명칭 | KCB/NICE 예상 상승폭 |
| :--- | :--- | :--- |
| **0 ~ 40점** | 🌱 새싹 납부러 | +3 ~ 7점 |
| **41 ~ 70점** | 🏅 성실 납부러 | +10 ~ 20점 |
| **71 ~ 100점** | 👑 마스터 납부러 | +25 ~ 35점 |

### 🔄 User Flow
1.  **Landing:** 서비스 가치 제안 및 시작 유도 ("고정 지출 정보 입력 시작")
2.  **Input:** 월세/관리비/고정비 정보 수기 입력 (MVP 검증용 Opt-in)
3.  **Process:** 데이터 검증 → PayScore 산출 → 리포트 생성 (3단계 Progress Bar)
4.  **Result:** 점수 확인 및 리포트 생성을 위한 이메일 제출 (Lead Gen)
5.  **Report:** PDF 미리보기 및 다운로드, 추천 상품 확인

### ⚡ Tech Constraints (Vercel)
*   **Serverless Function Limit:** PDF 생성 및 분석 로직은 Vercel 실행 제한 시간(10초) 내에 처리되도록 최적화.
*   **Event Logging:** 주요 사용자 행동(랜딩 조회, CTA 클릭, 제출 등)을 세션 ID 기반으로 로깅하여 퍼널 분석.

---

## 📈 Marketing Test & Metrics

본 MVP는 시장의 니즈(PMF)를 검증하기 위해 다음과 같은 핵심 지표를 추적합니다.

1.  **가치 인지 전환율:** 방문자 대비 '입력 시작' 버튼 클릭률 (Target: 30% 이상)
2.  **핵심 가치 행동 전환율:** 입력 완료 및 점수 확인 도달률 (Input Funnel 최적화 지표)
3.  **관계 형성 전환율 (Lead Gen):** 점수 확인 후 '이메일 제출' 비율 (리포트 소장 니즈 검증)

> **Current Status (Test Result):**
> *   방문자 유입 대비 입력 시작 전환율 **31%** 달성 (가치 입증)
> *   점수 확인 유저 중 55%가 리포트 생성을 시도함 (높은 관여도 확인)

---

## 🚀 Future Roadmap (ver 2.0)

*   **📄 OCR 검증 도입:** 임대차 계약서 이미지 업로드를 통한 정보 자동 입력 및 신뢰도 강화.
*   **🏦 마이데이터 연동:** 수기 입력 대신 계좌 내역 자동 분석을 통한 편의성 증대.
*   **🔗 API 제휴:** 금융사와 직접 연동하여 PayScore를 실제 심사에 반영하는 프로세스 구축.

---

## 📝 License & Contact

*   **Version:** 1.0.0 (MVP)
*   **Team:** PayTrace

Copyright © 2026 PayTrace. All rights reserved.
