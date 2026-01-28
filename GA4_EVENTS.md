# Paytrace MVP GA4 이벤트 측정 가이드

본 문서는 Paytrace MVP 프로토타입에 적용된 GA4(Google Analytics 4) 이벤트 측정 규격을 정리한 문서입니다. 모든 이벤트는 GA4의 **권장 이벤트(Recommended Events)** 표준을 우선적으로 따르며, 서비스 특화 행동은 커스텀 이벤트로 정의되었습니다.

---

## 1. 표준 전환 및 행동 이벤트 (Recommended Events)

사용자의 주요 전환 단계는 GA4 표준 규격에 매핑되어 전송됩니다.

| GA4 이벤트명 | 매핑된 내부 액션 | 발생 시점 | 포함 파라미터 |
| :--- | :--- | :--- | :--- |
| **`generate_lead`** | `contact_submit` | 이름/이메일 입력 후 최종 제출 시 | `session_id` |
| **`share`** | `pdf_share_success` | 리포트 PDF 공유가 완료되었을 때 | `method`(file/url), `content_type`, `item_id` |
| **`file_download`** | `pdf_download_click` | 리포트 PDF 다운로드 버튼 클릭 시 | `file_extension`("pdf"), `file_name` |
| **`view_item`** | `score_view` / `report_view` | PayScore 결과 화면 또는 전체 리포트 조회 시 | `item_id`, `item_name`, `item_category` |
| **`view_item_list`** | `recommendation_view` | 추천 금융 상품 리스트가 화면에 노출될 때 | `item_list_id`, `items`(상품 리스트) |
| **`select_item`** | `recommendation_click` | 추천 금융 상품의 '상세보기' 클릭 시 | `item_list_id`, `items`(상품명, 카테고리) |
| **`select_content`** | `btn-start` 클릭 | 랜딩 페이지에서 시작하기 버튼 클릭 시 | `content_type`("button"), `content_id` |

---

## 2. 화면 전환 및 흐름 추적 (Funnel Tracking)

각 뷰(View)의 진입을 추적하여 이탈률 및 퍼널 분석을 가능하게 합니다.

| GA4 이벤트명 | 파라미터 (`view_name`) | 설명 |
| :--- | :--- | :--- |
| **`view_change`** | `landing` | 서비스 메인 랜딩 페이지 도달 |
| | `form` | 주거비 및 고정비 정보 입력 화면 |
| | `match` | 입력 정보 확인 결과 화면 |
| | `score` | PayScore 산출 결과 화면 |
| | `report-processing` | 리포트 생성 중 (프로그레스 바) |
| | `report-complete` | 리포트 전송 완료 안내 화면 |
| | `report-preview` | 웹 리포트 미리보기/가이드 화면 |
| | `pdf-preview` | 실제 PDF 원문 미리보기 화면 |

---

## 3. 서비스 특화 및 실패 추적 (Custom Events)

사용자 경험의 병목 구간과 시스템 오류를 파악하기 위한 커스텀 이벤트입니다.

| GA4 이벤트명 | 설명 | 주요 파라미터 |
| :--- | :--- | :--- |
| **`form_validation_fail`** | 입력 폼 유효성 검사 실패 (유저 실수 파악) | `errors`(에러 항목 리스트) |
| **`score_result_success`** | PayScore 산출 성공 | `payscore`, `rule_version` |
| **`score_result_fail`** | PayScore 산출 실패 | `reason_code` |
| **`pdf_share_error`** | PDF 공유 중 시스템 오류 발생 | `error`(오류 메시지) |
| **`report_fail`** | 리포트 생성 서버 오류 | `reason_code` |

---

## 4. 공통 파라미터 (Common Parameters)

모든 이벤트에는 분석의 정합성을 위해 다음 파라미터가 기본으로 포함될 수 있습니다.

*   `session_id`: `sess_{timestamp}_{random}` 형식의 고유 세션 ID
*   `timestamp`: 이벤트 발생 시각 (ISO 8601)
*   `utm_source / medium / campaign`: 유입 경로 정보 (URL 파라미터 존재 시)

---

## 5. 데이터 프라이버시 가이드

*   사용자의 **이름, 이메일 주소 등 개인식별정보(PII)**는 절대 GA4로 전송하지 않습니다.
*   `contact_submit` 이벤트 발생 시에도 실제 개인정보 내용은 제외하고 `generate_lead`라는 전환 신호만 기록합니다.
