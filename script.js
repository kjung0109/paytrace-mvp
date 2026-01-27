/* PayScore MVP prototype (vanilla JS)
   - P0-only UI behaviors
   - Local "server" simulation for matching + scoring
*/

const RULES = {
  rentWarningRange: { min: 50_000, max: 5_000_000 }, // FE 경고(제출 허용)
  matchRuleRange: { min: 50_000, max: 5_000_000 }, // 서버 판정용(고정 룰셋)
  ruleVersionMatch: "ref-rule-set-v1",
  ruleVersionScore: "payscore-rule-v1",
};

const REASON_TEXT = {
  RENT_OUT_OF_RANGE: "월세 금액이 기준 범위를 벗어나 추가 확인이 필요합니다.",
  MGMT_OUT_OF_RANGE: "관리비 금액이 기준 범위를 벗어나 추가 확인이 필요합니다.",
  INSUFFICIENT_MONTHS: "납부 개월 수가 부족해 산출할 수 없습니다.",
  NO_RENT_ITEM: "월세 항목이 없어 산출할 수 없습니다.",
  INVALID_AMOUNT: "금액 정보가 유효하지 않아 산출할 수 없습니다.",
};

const FIXED_TYPES = [
  { key: "OTT", label: "OTT" },
  { key: "MUSIC", label: "음악 스트리밍" },
  { key: "EBOOK", label: "전자책 구독" },
];

const state = {
  sessionId: cryptoRandomId("sess"),
  utm: parseUtmParams(),
  lastContractPayload: null,
  selectionId: null,
  match: null,
  selection: null,
  score: { status: "IDLE", result: null, reason_code: null },
  report: { inProgress: false, completed: false, reportId: null, email: null, loggedComplete: false },
  ui: { lastScoreClickAt: 0 },
  events: [],
};

document.addEventListener("DOMContentLoaded", () => {
  bindLanding();
  bindForm();
  bindMatch();
  bindErrorScreens();
  bindScore();
  bindReportFail();
  bindReportSendFail();
  bindReportComplete();
  bindReportPreview();
  bindPdfPreview();
  bindModals();
  bindToast();

  setView("landing");
  logEvent("landing_view", {
    timestamp: new Date().toISOString(),
    session_id: state.sessionId,
    utm: state.utm,
  });
});

function $(id) {
  return document.getElementById(id);
}

function setView(name) {
  const views = [
    "landing",
    "form",
    "match",
    "error-server",
    "error-timeout",
    "score-loading",
    "score",
    "report-processing",
    "report-fail",
    "report-send-fail",
    "report-complete",
    "report-preview",
    "pdf-preview",
  ];
  for (const v of views) {
    const el = $(`view-${v}`);
    if (!el) continue;
    el.classList.toggle("hidden", v !== name);
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function logEvent(name, payload) {
  const evt = { name, ...payload };
  state.events.push(evt);
  // prototype: 콘솔 로깅만 수행
  console.log("[event]", evt);
}

function bindLanding() {
  $("btn-start").addEventListener("click", () => {
    logEvent("landing_to_start_click", { session_id: state.sessionId, timestamp: new Date().toISOString() });
    setView("form");
    updateContractSubmitButton();
    $("startDate").focus();
  });
}

function bindForm() {
  const form = $("contract-form");

  $("startDate").addEventListener("change", onContractDatesChanged);
  $("endDate").addEventListener("change", onContractDatesChanged);

  $("rentAmount").addEventListener("input", (e) => {
    e.target.value = digitsOnly(e.target.value);
    renderRentWarning();
  });

  for (const radio of document.querySelectorAll('input[name="mgmtIncluded"]')) {
    radio.addEventListener("change", onMgmtIncludedChanged);
  }

  $("mgmtAmount").addEventListener("input", (e) => {
    e.target.value = digitsOnly(e.target.value);
  });

  for (const cb of document.querySelectorAll('input[name="fixedType"]')) {
    cb.addEventListener("change", () => {
      const wrap = $(`fixed-${cb.value}`);
      wrap.classList.toggle("hidden", !cb.checked);
      const label = cb.closest("label");
      if (label) label.classList.toggle("is-checked", cb.checked);
      if (cb.checked) ensureFixedHasRow(cb.value);
      // 선택 해제 시 입력값 유지(요구사항 없음) — 단, 재제출 시 미선택이면 서버에 포함되지 않음.
    });
  }

  bindFixedRowsInteraction();

  form.addEventListener("input", updateContractSubmitButton);
  form.addEventListener("change", updateContractSubmitButton);
  updateContractSubmitButton();

  const formBack = $("btn-form-back");
  if (formBack) formBack.addEventListener("click", () => setView("landing"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAllFieldErrors();

    const payload = buildContractPayload();
    state.lastContractPayload = payload;

    const { errors, firstErrorId, firstErrorEl } = validateContractPayload(payload);
    if (Object.keys(errors).length > 0) {
      showFieldErrors(errors);
      if (firstErrorEl) {
        scrollToFirstErrorEl(firstErrorEl);
      } else {
        scrollToFirstError(firstErrorId);
      }
      return;
    }
    if (firstErrorEl) {
      // 고정비 행 에러 등(필드 맵 외)
      scrollToFirstErrorEl(firstErrorEl);
      return;
    }

    setSubmitLoading(true);

    try {
      const res = await withTimeout(simulateContractSubmit(payload), 6000);
      state.match = { status: res.status, reasonCodes: res.reasonCodes, rule_version: res.rule_version };
      state.selection = res.selection;
      state.selectionId = res.selection_id;
      renderMatchResult();
      setView("match");
    } catch (err) {
      const now = new Date().toISOString();
      if (err && err.code === "TIMEOUT") {
        $("err-timeout-time").textContent = now;
        setView("error-timeout");
      } else {
        $("err-server-time").textContent = now;
        setView("error-server");
      }
    } finally {
      setSubmitLoading(false);
    }
  });
}

function bindFixedRowsInteraction() {
  const view = $("view-form");
  if (!view) return;

  // add/delete row
  view.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.dataset.action;
    const type = btn.dataset.fixedType;
    if (!action || !type) return;
    if (action === "add-row") {
      addFixedRow(type);
    }
    if (action === "del-row") {
      const row = btn.closest(".fixed-row");
      if (!row) return;
      removeFixedRow(type, row);
    }
  });

  // digits-only for dynamic inputs
  view.addEventListener("input", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.matches('input[data-fixed-field="amount"], input[data-fixed-field="months"]')) return;
    input.value = digitsOnly(input.value);
  });
}

function getFixedRowsContainer(type) {
  return document.querySelector(`.fixed-rows[data-fixed-type="${type}"]`);
}

function ensureFixedHasRow(type) {
  const container = getFixedRowsContainer(type);
  if (!container) return;
  if (container.querySelectorAll(".fixed-row").length === 0) {
    addFixedRow(type);
  } else {
    updateFixedRowDeleteButtons(type);
  }
}

function addFixedRow(type) {
  const container = getFixedRowsContainer(type);
  if (!container) return;

  const row = document.createElement("div");
  row.className = "fixed-row";
  row.dataset.fixedType = type;
  row.innerHTML = `
    <div class="input-suffix">
      <input type="text" inputmode="numeric" autocomplete="off" placeholder="0" data-fixed-type="${escapeHtml(
        type,
      )}" data-fixed-field="amount" />
      <span class="suffix" aria-hidden="true">원</span>
    </div>
    <div class="input-suffix">
      <input type="text" inputmode="numeric" autocomplete="off" placeholder="0" data-fixed-type="${escapeHtml(
        type,
      )}" data-fixed-field="months" />
      <span class="suffix" aria-hidden="true">개월</span>
    </div>
    <button type="button" class="btn-del-row" data-action="del-row" data-fixed-type="${escapeHtml(
      type,
    )}" aria-label="행 삭제">×</button>
    <p class="row-error error" role="alert" aria-live="polite"></p>
  `;
  container.appendChild(row);
  updateFixedRowDeleteButtons(type);
}

function removeFixedRow(type, rowEl) {
  const container = getFixedRowsContainer(type);
  if (!container) return;
  const rows = Array.from(container.querySelectorAll(".fixed-row"));
  if (rows.length <= 1) return; // 최소 1행 유지(선택 상태에서 빈 값 방지)
  rowEl.remove();
  updateFixedRowDeleteButtons(type);
}

function updateFixedRowDeleteButtons(type) {
  const container = getFixedRowsContainer(type);
  if (!container) return;
  const rows = Array.from(container.querySelectorAll(".fixed-row"));
  const disable = rows.length <= 1;
  for (const row of rows) {
    const btn = row.querySelector(".btn-del-row");
    if (btn) btn.disabled = disable;
  }
}

function scrollToFirstErrorEl(el) {
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top, behavior: "smooth" });
  try {
    el.focus?.({ preventScroll: true });
  } catch {
    // ignore
  }
}

function bindMatch() {
  const matchBack = $("btn-match-back");
  if (matchBack) matchBack.addEventListener("click", () => {
    setView("form");
    updateContractSubmitButton();
  });

  $("btn-to-score").addEventListener("click", () => {
    renderSelectionTable();
    renderScoreState("IDLE");
    setReportButtonEnabled(false);
    setView("score");
  });

  const editBtn = $("btn-edit-input");
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      setView("form");
      updateContractSubmitButton();
      // 기존 입력값은 DOM에 유지됨 (요구사항: 입력값 유지)
    });
  }
}

function bindErrorScreens() {
  $("btn-back-to-form-1").addEventListener("click", () => {
    setView("form");
    updateContractSubmitButton();
  });
  $("btn-back-to-form-2").addEventListener("click", () => {
    setView("form");
    updateContractSubmitButton();
  });

  $("btn-retry-server").addEventListener("click", async () => retryContractSubmit());
  $("btn-retry-timeout").addEventListener("click", async () => retryContractSubmit());

  const top1 = $("btn-error-topbar-1");
  if (top1) top1.addEventListener("click", () => {
    setView("form");
    updateContractSubmitButton();
  });
  const top2 = $("btn-error-topbar-2");
  if (top2) top2.addEventListener("click", () => {
    setView("form");
    updateContractSubmitButton();
  });
}

async function retryContractSubmit() {
  if (!state.lastContractPayload) {
    setView("form");
    updateContractSubmitButton();
    return;
  }

  setSubmitLoading(true);
  try {
    const res = await withTimeout(simulateContractSubmit(state.lastContractPayload), 6000);
    state.match = { status: res.status, reasonCodes: res.reasonCodes, rule_version: res.rule_version };
    state.selection = res.selection;
    state.selectionId = res.selection_id;
    renderMatchResult();
    setView("match");
  } catch (err) {
    const now = new Date().toISOString();
    if (err && err.code === "TIMEOUT") {
      $("err-timeout-time").textContent = now;
      setView("error-timeout");
    } else {
      $("err-server-time").textContent = now;
      setView("error-server");
    }
  } finally {
    setSubmitLoading(false);
  }
}

function bindScore() {
  $("btn-score").addEventListener("click", async () => {
    const now = Date.now();
    if (now - state.ui.lastScoreClickAt < 3000) {
      // 3초 이내 연속 클릭 차단
      return;
    }
    state.ui.lastScoreClickAt = now;

    $("btn-score").disabled = true;
    // 로딩 화면으로 전환(우정인_PayScore 계산 중)
    renderSelectionTable();
    renderScoreState("LOADING");
    setReportButtonEnabled(false);
    setView("score-loading");

    logEvent("score_cta_click", {
      session_id: state.sessionId,
      selection_id: state.selectionId,
      rule_version: RULES.ruleVersionScore,
      timestamp: new Date().toISOString(),
    });

    try {
      const res = await withTimeout(
        simulateScoreRangeApi({ session_id: state.sessionId, selection_id: state.selectionId }),
        7000,
      );

      state.score = { status: "SUCCESS", result: res, reason_code: res.reason_code ?? null };
      setView("score");
      renderScoreState("SUCCESS");
      setReportButtonEnabled(res.scorable === true);

      logEvent("score_result_success", {
        session_id: state.sessionId,
        selection_id: state.selectionId,
        rule_version: res.rule_version,
        timestamp: new Date().toISOString(),
        reason_code: res.reason_code ?? null,
      });
    } catch (err) {
      const reason = err?.reason_code ?? null;
      state.score = { status: "FAIL", result: null, reason_code: reason };
      setView("score");
      renderScoreState("FAIL");
      setReportButtonEnabled(false);

      logEvent("score_result_fail", {
        session_id: state.sessionId,
        selection_id: state.selectionId,
        rule_version: RULES.ruleVersionScore,
        timestamp: new Date().toISOString(),
        reason_code: reason,
      });
    } finally {
      $("btn-score").disabled = false;
    }
  });

  $("btn-report").addEventListener("click", () => {
    if (state.score.status !== "SUCCESS" || state.score.result?.scorable !== true) return;
    if (state.report.inProgress || state.report.completed) return;

    logEvent("report_cta_click", {
      session_id: state.sessionId,
      selection_id: state.selectionId,
      rule_version: state.score.result?.rule_version ?? RULES.ruleVersionScore,
      timestamp: new Date().toISOString(),
      reason_code: state.score.result?.reason_code ?? null,
    });

    openContactModal();
  });

  const scoreBack = $("btn-score-back");
  if (scoreBack) scoreBack.addEventListener("click", () => setView("match"));
}

function bindModals() {
  $("btn-close-contact").addEventListener("click", closeAllModals);
  $("btn-open-terms").addEventListener("click", () => openTermsModal());
  $("btn-close-terms").addEventListener("click", closeTermsAndReturnToContact);
  $("btn-terms-ok").addEventListener("click", closeTermsAndReturnToContact);
  $("btn-open-criteria").addEventListener("click", () => openCriteriaModal());
  $("btn-close-criteria").addEventListener("click", closeAllModals);
  $("btn-criteria-ok").addEventListener("click", closeAllModals);

  $("contactName").addEventListener("input", validateContactForm);
  $("contactEmail").addEventListener("input", validateContactForm);
  $("consentRequired").addEventListener("change", validateContactForm);

  $("btn-contact-submit").addEventListener("click", async () => {
    clearContactErrors();

    const name = $("contactName").value.trim();
    const email = $("contactEmail").value.trim();
    const consent = $("consentRequired").checked;

    const errors = {};
    if (!name) errors.contactName = "이름을 입력해 주세요";
    if (!email || !isValidEmail(email)) errors.contactEmail = "이메일 형식을 확인해 주세요";
    if (!consent) {
      // 제출 버튼 자체가 비활성이라 일반적으로 도달하지 않음
    }

    if (Object.keys(errors).length > 0) {
      showContactErrors(errors);
      return;
    }

    // "저장"은 로컬 모사: reportId 생성, 이벤트 로깅(개인정보는 이벤트에 포함하지 않음)
    state.report.reportId = cryptoRandomId("rpt");
    state.report.email = email;
    closeAllModals();

    logEvent("contact_submit", {
      session_id: state.sessionId,
      selection_id: state.selectionId,
      report_id: state.report.reportId,
      timestamp: new Date().toISOString(),
    });

    await startReportProcessing();
  });
}

function bindReportFail() {
  const back = $("btn-report-fail-back");
  if (back) back.addEventListener("click", () => setView("score"));
  const retry = $("btn-report-retry");
  if (retry) retry.addEventListener("click", () => startReportProcessing());
  const cancel = $("btn-report-cancel");
  if (cancel) cancel.addEventListener("click", () => setView("score"));
}

function bindReportSendFail() {
  const toStart = $("btn-report-send-fail-to-start");
  if (toStart) toStart.addEventListener("click", () => setView("landing"));
}

function bindReportComplete() {
  const guide = $("btn-report-guide");
  if (guide) guide.addEventListener("click", () => {
    renderReportPreview();
    setView("report-preview");
  });
  const toStart = $("btn-report-to-start");
  if (toStart) toStart.addEventListener("click", () => setView("landing"));
}

function bindReportPreview() {
  const back = $("btn-report-preview-back");
  if (back) back.addEventListener("click", () => setView("report-complete"));
  const share = $("btn-report-share");
  if (share) share.addEventListener("click", () => { /* 프로토타입: 공유 미구현 */ });
  const download = $("btn-report-download");
  if (download) download.addEventListener("click", () => {
    renderPdfPreview();
    setView("pdf-preview");
  });
}

function renderReportPreview() {
  const res = state.score.result;
  const badgeEl = $("report-preview-badge");
  const scoreEl = $("report-preview-score");
  const niceEl = $("report-preview-nice");
  const kcbEl = $("report-preview-kcb");
  const basisEl = $("report-preview-product-basis");
  if (!res?.scorable) {
    if (badgeEl) badgeEl.textContent = "-";
    if (scoreEl) scoreEl.textContent = "-";
    if (niceEl) niceEl.textContent = "-";
    if (kcbEl) kcbEl.textContent = "-";
    if (basisEl) basisEl.textContent = "PayScore -점 기준 추천";
    return;
  }
  const cr = res.credit_score_increase;
  const niceText = cr && Number.isInteger(cr.min) && Number.isInteger(cr.max) ? `+${cr.min}~${cr.max}점` : "-";
  if (badgeEl) badgeEl.textContent = getScoreBadgeLabel(res.payscore);
  if (scoreEl) scoreEl.textContent = String(res.payscore);
  if (niceEl) niceEl.textContent = niceText;
  if (kcbEl) kcbEl.textContent = niceText;
  if (basisEl) basisEl.textContent = `PayScore ${res.payscore}점 기준 추천`;
}

function bindPdfPreview() {
  const back = $("btn-pdf-preview-back");
  if (back) back.addEventListener("click", () => setView("report-preview"));
  const download = $("btn-pdf-download");
  if (download) download.addEventListener("click", () => {
    logEvent("pdf_download_click", { session_id: state.sessionId, timestamp: new Date().toISOString() });
    if (typeof window !== "undefined" && window.alert) {
      window.alert("프로토타입: PDF 다운로드는 준비 중입니다.");
    }
  });
}

function renderPdfPreview() {
  const payload = state.lastContractPayload;
  const res = state.score?.result;
  const tendencyEl = $("pdf-preview-tendency");
  const scoreNumEl = $("pdf-preview-score-num");
  const badgeEl = $("pdf-preview-badge");
  const creditHintEl = $("pdf-preview-credit-hint");
  const contractSummaryEl = $("pdf-preview-contract-summary");

  const months = payload ? calcContractMonths(payload.startDate, payload.endDate) : null;
  const monthText = months != null ? `${months}개월` : "-";
  if (tendencyEl) tendencyEl.textContent = `귀하는 ${monthText} 이력을 보유하고 있습니다.`;

  if (res?.scorable) {
    if (scoreNumEl) scoreNumEl.textContent = String(res.payscore);
    if (badgeEl) badgeEl.textContent = getScoreBadgeLabel(res.payscore);
    const cr = res.credit_score_increase;
    const hintText = cr && Number.isInteger(cr.min) && Number.isInteger(cr.max) ? `예상 상승 +${cr.min}~${cr.max}점 내외` : "예상 상승 -";
    if (creditHintEl) creditHintEl.textContent = hintText;
  } else {
    if (scoreNumEl) scoreNumEl.textContent = "-";
    if (badgeEl) badgeEl.textContent = "-";
    if (creditHintEl) creditHintEl.textContent = "예상 상승 -";
  }

  if (contractSummaryEl && payload) {
    const periodStr =
      payload.startDate && payload.endDate && months != null
        ? `${payload.startDate} ~ ${payload.endDate} (${months}개월)`
        : "-";
    const rentStr = formatWon(payload.rentAmount);
    const mgmtStr = payload.mgmtIncluded === true ? `포함 (${formatWon(payload.mgmtAmount)})` : "미포함";
    contractSummaryEl.innerHTML = `
      <div class="pdf-preview-summary-row"><span class="k">계약 기간</span><span class="v">${escapeHtml(periodStr)}</span></div>
      <div class="pdf-preview-summary-row"><span class="k">월세 금액</span><span class="v">${escapeHtml(rentStr)}</span></div>
      <div class="pdf-preview-summary-row"><span class="k">관리비</span><span class="v">${escapeHtml(mgmtStr)}</span></div>
    `;
  } else if (contractSummaryEl) {
    contractSummaryEl.innerHTML = "";
  }
}

function bindToast() {
  $("btn-toast-close").addEventListener("click", hideToast);
}

function openContactModal() {
  $("contactName").value = "";
  $("contactEmail").value = "";
  $("consentRequired").checked = false;
  const opt = $("consentOptional");
  if (opt) opt.checked = false;
  clearContactErrors();
  validateContactForm();
  showModal("modal-contact");
  $("contactName").focus();
}

function openTermsModal() {
  showModal("modal-terms");
  $("btn-terms-ok").focus();
}

function openCriteriaModal() {
  showModal("modal-criteria");
  $("btn-criteria-ok").focus();
}

function showModal(id) {
  $("modal-backdrop").classList.remove("hidden");
  $("modal-backdrop").setAttribute("aria-hidden", "false");
  $(id).classList.remove("hidden");
}

function closeAllModals() {
  $("modal-backdrop").classList.add("hidden");
  $("modal-backdrop").setAttribute("aria-hidden", "true");
  $("modal-contact").classList.add("hidden");
  $("modal-terms").classList.add("hidden");
  $("modal-criteria").classList.add("hidden");
}

/** 개인정보 수집·이용 동의 모달에서 확인/닫기 시 이메일 입력 모달로 복귀 */
function closeTermsAndReturnToContact() {
  $("modal-terms").classList.add("hidden");
  const contact = $("modal-contact");
  if (contact && !contact.classList.contains("hidden")) {
    const nameEl = $("contactName");
    if (nameEl) nameEl.focus();
  }
}

function validateContactForm() {
  const nameOk = $("contactName").value.trim().length > 0;
  const email = $("contactEmail").value.trim();
  const emailOk = email.length > 0 && isValidEmail(email);
  const consentOk = $("consentRequired").checked;
  $("btn-contact-submit").disabled = !(nameOk && emailOk && consentOk);
}

async function startReportProcessing() {
  state.report.inProgress = true;
  setView("report-processing");
  hideToast();

  setProgressPct(0);
  const steps = [0, 33, 66]; // 100%는 성공 응답 시점에만
  let stepIdx = 0;

  const stepTimer = setInterval(() => {
    stepIdx += 1;
    if (stepIdx >= steps.length) {
      clearInterval(stepTimer);
      return;
    }
    setProgressPct(steps[stepIdx]);
  }, 900);

  const toastTimer = setTimeout(() => {
    if (!state.report.completed) {
      showToast("현재 요청 처리가 지연되고 있습니다. 잠시만 기다려 주세요.");
    }
  }, 10_000);

  try {
    await withTimeout(simulateReportGeneration(), 20_000);
    clearInterval(stepTimer);
    clearTimeout(toastTimer);

    state.report.inProgress = false;
    state.report.completed = true;
    setProgressPct(100);

    renderReportComplete();
    setView("report-complete");

    if (!state.report.loggedComplete) {
      state.report.loggedComplete = true;
      logEvent("report_complete_view", {
        session_id: state.sessionId,
        selection_id: state.selectionId,
        report_id: state.report.reportId,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    clearInterval(stepTimer);
    clearTimeout(toastTimer);
    state.report.inProgress = false;
    state.report.completed = false;
    setView("report-fail");

    // 실패 이벤트(개인정보 제외)
    logEvent("report_fail", {
      session_id: state.sessionId,
      selection_id: state.selectionId,
      report_id: state.report.reportId,
      timestamp: new Date().toISOString(),
      reason_code: err?.reason_code ?? null,
    });
  }
}

function setProgressPct(pct) {
  const safe = [0, 33, 66, 100].includes(pct) ? pct : 0;
  const fillEl = $("progress-fill");
  const pctEl = $("progress-pct");
  if (fillEl) fillEl.style.width = `${safe}%`;
  if (pctEl) pctEl.textContent = `${safe}%`;

  // 김민하_리포트생성중: 단계 카드 상태
  const step1 = $("report-step-1");
  const step2 = $("report-step-2");
  const step3 = $("report-step-3");
  if (step1) step1.classList.add("is-done");
  if (step2) {
    step2.classList.remove("is-done", "is-active", "is-pending");
    const icon2 = step2.querySelector(".report-step-icon");
    if (icon2) {
      if (safe >= 66) {
        step2.classList.add("is-done");
        icon2.textContent = "✓";
        icon2.classList.remove("report-step-icon-num");
        icon2.classList.add("report-step-icon-done");
      } else {
        step2.classList.add("is-active");
        icon2.textContent = "2";
        icon2.classList.add("report-step-icon-num");
        icon2.classList.remove("report-step-icon-done");
      }
    }
  }
  if (step3) {
    step3.classList.remove("is-done", "is-active", "is-pending");
    const icon3 = step3.querySelector(".report-step-icon");
    if (icon3) {
      if (safe >= 100) {
        step3.classList.add("is-done");
        icon3.textContent = "✓";
        icon3.classList.remove("report-step-icon-num");
        icon3.classList.add("report-step-icon-done");
      } else if (safe >= 66) {
        step3.classList.add("is-active");
        icon3.textContent = "3";
        icon3.classList.add("report-step-icon-num");
        icon3.classList.remove("report-step-icon-done");
      } else {
        step3.classList.add("is-pending");
        icon3.textContent = "3";
        icon3.classList.add("report-step-icon-num");
        icon3.classList.remove("report-step-icon-done");
      }
    }
  }
}

function renderReportComplete() {
  $("masked-email").textContent = maskEmail(state.report.email || "");
}

function showToast(msg) {
  $("toast-text").textContent = msg;
  $("toast").classList.remove("hidden");
}

function hideToast() {
  $("toast").classList.add("hidden");
}

function renderRentWarning() {
  const val = parseIntSafe($("rentAmount").value);
  const warnEl = $("warn-rentAmount");
  if (!val) {
    warnEl.textContent = "";
    return;
  }
  const { min, max } = RULES.rentWarningRange;
  if (val < min || val > max) {
    warnEl.textContent = "입력값이 테스트데이터 기준 범위를 벗어났어요. 제출은 가능해요.";
  } else {
    warnEl.textContent = "";
  }
}

function onMgmtIncludedChanged() {
  const included = getMgmtIncluded();
  const wrap = $("mgmtAmountWrap");
  wrap.classList.toggle("hidden", included !== true);
  if (included !== true) {
    $("mgmtAmount").value = "";
  }
}

function onContractDatesChanged() {
  const start = $("startDate").value;
  const end = $("endDate").value;
  const hint = $("hint-contractMonths");
  if (!start || !end) {
    hint.textContent = "";
    return;
  }
  const months = calcContractMonths(start, end);
  if (months != null) {
    hint.textContent = `계약 기간: ${months}개월`;
  } else {
    hint.textContent = "";
  }
}

function buildContractPayload() {
  const mgmtIncluded = getMgmtIncluded();
  const fixed = readFixedInputs();
  return {
    startDate: $("startDate").value,
    endDate: $("endDate").value,
    rentAmount: parseIntSafe($("rentAmount").value),
    mgmtIncluded,
    mgmtAmount: mgmtIncluded === true ? parseIntSafe($("mgmtAmount").value) : null,
    fixed,
  };
}

function readFixedInputs() {
  const selected = new Set(
    Array.from(document.querySelectorAll('input[name="fixedType"]'))
      .filter((x) => x.checked)
      .map((x) => x.value),
  );

  const out = {};
  for (const t of FIXED_TYPES) {
    out[t.key] = { selected: selected.has(t.key), rows: [] };
  }

  for (const t of FIXED_TYPES) {
    if (!out[t.key].selected) continue;
    const container = getFixedRowsContainer(t.key);
    const rows = container ? Array.from(container.querySelectorAll(".fixed-row")) : [];
    out[t.key].rows = rows.map((row) => {
      const amountInput = row.querySelector('input[data-fixed-field="amount"]');
      const monthsInput = row.querySelector('input[data-fixed-field="months"]');
      return {
        amount: parseIntSafe(amountInput?.value),
        months: parseIntSafe(monthsInput?.value),
      };
    });
  }

  return out;
}

function validateContractPayload(payload) {
  const errors = {};
  let firstErrorId = null;
  let firstErrorEl = null;

  const setErr = (fieldId, msg) => {
    errors[fieldId] = msg;
    if (!firstErrorId) firstErrorId = fieldId;
  };

  // required: start/end/rent/mgmtIncluded
  if (!payload.startDate) setErr("startDate", "계약 시작일을 입력해 주세요");
  if (!payload.endDate) setErr("endDate", "만료일을 입력해 주세요");

  if (payload.startDate && payload.endDate) {
    if (payload.startDate >= payload.endDate) {
      setErr("endDate", "만료일은 시작일 이후여야 합니다");
    } else {
      const months = calcContractMonths(payload.startDate, payload.endDate);
      if (months == null || months < 1 || months > 36) {
        setErr("endDate", "계약 기간은 최소 1개월 이상 최대 36개월 이하만 유효합니다");
      }
    }
  }

  if (!Number.isInteger(payload.rentAmount) || payload.rentAmount < 1) {
    setErr("rentAmount", "월세 금액을 입력해 주세요");
  }

  if (payload.mgmtIncluded !== true && payload.mgmtIncluded !== false) {
    setErr("mgmtIncluded", "관리비 포함 여부를 선택해 주세요");
  }

  // conditional required: mgmtAmount
  if (payload.mgmtIncluded === true) {
    if (!Number.isInteger(payload.mgmtAmount) || payload.mgmtAmount < 1) {
      setErr("mgmtAmount", "관리비 금액을 입력해 주세요");
    }
  }

  // fixed (P0): 선택된 고정비는 각 행의 월 구독료/구독 개월 수가 필수
  for (const t of FIXED_TYPES) {
    const item = payload.fixed[t.key];
    if (!item?.selected) continue;

    const container = getFixedRowsContainer(t.key);
    const rows = container ? Array.from(container.querySelectorAll(".fixed-row")) : [];
    for (const rowEl of rows) {
      const errEl = rowEl.querySelector(".row-error");
      if (errEl) errEl.textContent = "";

      const amountInput = rowEl.querySelector('input[data-fixed-field="amount"]');
      const monthsInput = rowEl.querySelector('input[data-fixed-field="months"]');
      const amount = parseIntSafe(amountInput?.value);
      const months = parseIntSafe(monthsInput?.value);

      if (!Number.isInteger(amount) || amount < 1) {
        if (errEl) errEl.textContent = "월 구독료를 입력해 주세요";
        if (!firstErrorEl) firstErrorEl = amountInput || rowEl;
        break;
      }
      if (!Number.isInteger(months) || months < 1) {
        if (errEl) errEl.textContent = "구독 개월 수를 입력해 주세요";
        if (!firstErrorEl) firstErrorEl = monthsInput || rowEl;
        break;
      }
    }
    if (firstErrorEl) break;
  }

  return { errors, firstErrorId, firstErrorEl };
}

/** 권정_정보입력_2·요구사항: 필수값 미충족 시 입력 완료 버튼 비활성화 */
function updateContractSubmitButton() {
  const btn = $("btn-submit");
  if (!btn) return;
  const spinner = btn.querySelector(".spinner");
  if (spinner && !spinner.classList.contains("hidden")) return;
  const payload = buildContractPayload();
  const { errors, firstErrorEl } = validateContractPayload(payload);
  btn.disabled = Object.keys(errors).length > 0 || !!firstErrorEl;
}

function clearAllFieldErrors() {
  const ids = [
    "startDate",
    "endDate",
    "rentAmount",
    "mgmtIncluded",
    "mgmtAmount",
  ];
  for (const id of ids) {
    const err = $(`err-${id}`);
    if (err) err.textContent = "";
  }
  for (const el of document.querySelectorAll(".row-error")) {
    el.textContent = "";
  }
}

function showFieldErrors(errors) {
  for (const [fieldId, msg] of Object.entries(errors)) {
    const err = $(`err-${fieldId}`);
    if (err) err.textContent = msg;
  }
}

function scrollToFirstError(fieldId) {
  if (!fieldId) return;
  const input = $(fieldId) || document.querySelector(`[name="${fieldId}"]`);
  if (!input) return;
  const top = input.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top, behavior: "smooth" });
  try {
    input.focus({ preventScroll: true });
  } catch {
    // ignore
  }
}

function setSubmitLoading(isLoading) {
  const btn = $("btn-submit");
  btn.disabled = isLoading;
  btn.querySelector(".spinner").classList.toggle("hidden", !isLoading);
}

function renderMatchResult() {
  const badge = $("match-badge");
  const reasons = $("match-reasons");
  const sum = $("match-summary");
  const fixedCountEl = $("match-fixed-count");
  const fixedListEl = $("match-fixed-list");

  if (!state.match) return;

  reasons.innerHTML = "";
  sum.innerHTML = "";
  if (fixedListEl) fixedListEl.innerHTML = "";

  if (state.match.status === "MATCHED") {
    badge.textContent = "입력 기준 충족";
    badge.className = "result-pill";
    reasons.classList.add("hidden");
  } else {
    badge.textContent = "추가 확인 필요";
    badge.className = "result-pill warn";
    reasons.classList.remove("hidden");
    for (const code of state.match.reasonCodes) {
      const li = document.createElement("li");
      li.textContent = REASON_TEXT[code] ?? `추가 확인이 필요합니다 (${code})`;
      reasons.appendChild(li);
    }
  }

  const payload = state.lastContractPayload;
  const months = calcContractMonths(payload.startDate, payload.endDate);
  const periodText =
    payload.startDate && payload.endDate && months != null
      ? `${payload.startDate} ~ ${payload.endDate} (${months}개월)`
      : "-";

  sum.appendChild(summaryRow("계약 기간", periodText));
  sum.appendChild(summaryRow("월세 금액", formatWon(payload.rentAmount)));
  sum.appendChild(
    summaryRow(
      "관리비",
      payload.mgmtIncluded === true ? `포함 (${formatWon(payload.mgmtAmount)})` : "미포함",
    ),
  );

  // fixed items (rows)
  const allFixedRows = [];
  for (const t of FIXED_TYPES) {
    const it = payload.fixed?.[t.key];
    if (!it?.selected) continue;
    const rows = Array.isArray(it.rows) ? it.rows : [];
    rows.forEach((r) => allFixedRows.push({ type: t, row: r }));
  }

  if (fixedCountEl) fixedCountEl.textContent = `${allFixedRows.length}개 항목`;

  if (fixedListEl && allFixedRows.length) {
    allFixedRows.forEach((x) => {
      const item = document.createElement("div");
      item.className = "fixed-item";
      item.innerHTML = `
        <div class="left">• ${escapeHtml(x.type.label)} 구독료: 월 ${escapeHtml(formatWon(x.row.amount))}</div>
        <div class="right">${escapeHtml(String(x.row.months ?? "-"))}개월</div>
      `;
      fixedListEl.appendChild(item);
    });
  }
}

function summaryRow(k, v) {
  const row = document.createElement("div");
  row.className = "row";
  const kk = document.createElement("div");
  kk.className = "k";
  kk.textContent = k;
  const vv = document.createElement("div");
  vv.className = "v";
  vv.textContent = v;
  row.appendChild(kk);
  row.appendChild(vv);
  return row;
}

function renderSelectionTable() {
  const tbody = $("selection-rows");
  tbody.innerHTML = "";
  if (!state.selection) return;

  for (const it of state.selection.items) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(it.label)}</td>
      <td>${it.monthly_amount != null ? formatWon(it.monthly_amount) : "-"}</td>
      <td>${it.months != null ? `${it.months}개월` : "-"}</td>
      <td>${it.selected ? "선택" : "미선택"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function getScoreBadgeLabel(payscore) {
  if (payscore <= 40) return "새싹 납부러";
  if (payscore <= 70) return "성실 납부러";
  return "마스터 납부러★";
}

/** Figma 우정인_PayScore 결과 Frame2: 산출 근거 키-값 행 + 고정비 상세 들여쓰기 */
function buildScoreBasisListHtml() {
  const payload = state.lastContractPayload;
  if (!payload) return "";
  const months = calcContractMonths(payload.startDate, payload.endDate);
  const periodStr =
    payload.startDate && payload.endDate && months != null
      ? `${payload.startDate} ~ ${payload.endDate} (${months}개월)`
      : "-";
  const rentStr = formatWon(payload.rentAmount);
  const mgmtStr =
    payload.mgmtIncluded === true ? `포함 (${formatWon(payload.mgmtAmount)})` : "미포함";

  const parts = [
    `<div class="score-basis-row"><span class="k">계약 기간</span><span class="v">${escapeHtml(periodStr)}</span></div>`,
    `<div class="score-basis-row"><span class="k">월세 금액</span><span class="v">${escapeHtml(rentStr)}</span></div>`,
    `<div class="score-basis-row"><span class="k">관리비</span><span class="v">${escapeHtml(mgmtStr)}</span></div>`,
  ];

  const fixedRows = [];
  for (const t of FIXED_TYPES) {
    const it = payload.fixed?.[t.key];
    if (!it?.selected) continue;
    const rows = Array.isArray(it.rows) ? it.rows : [];
    rows.forEach((r) => {
      fixedRows.push({
        label: t.label,
        amount: r.amount,
        months: r.months,
      });
    });
  }
  if (fixedRows.length) {
    parts.push(`<div class="score-basis-row"><span class="k">선택한 고정비</span><span class="v">${fixedRows.length}개 항목</span></div>`);
    fixedRows.forEach((x) => {
      const amt = Number.isInteger(x.amount) ? formatWon(x.amount) : "-";
      const mon = x.months != null ? `${x.months}개월` : "-";
      parts.push(`<div class="score-basis-row score-basis-sub"><span class="label">${escapeHtml(x.label)} 구독료: 월 ${escapeHtml(amt)}</span><span class="v">${escapeHtml(mon)}</span></div>`);
    });
  }

  return parts.join("");
}

function renderScoreState(status) {
  state.score.status = status;
  const entryBlock = $("score-entry-block");
  const resultBlock = $("score-result-block");
  const successContent = $("score-success-content");
  const failContent = $("score-fail-content");
  const actionsEl = $("score-actions");

  if (actionsEl) actionsEl.innerHTML = "";

  if (status === "IDLE" || status === "LOADING") {
    if (entryBlock) entryBlock.classList.remove("hidden");
    if (resultBlock) resultBlock.classList.add("hidden");
    return;
  }

  if (entryBlock) entryBlock.classList.add("hidden");
  if (resultBlock) resultBlock.classList.remove("hidden");

  if (status === "SUCCESS") {
    if (failContent) failContent.classList.add("hidden");
    if (successContent) successContent.classList.remove("hidden");
    const res = state.score.result;
    const badgeEl = $("score-badge");
    const numberEl = $("score-number");
    const niceEl = $("score-credit-nice");
    const kcbEl = $("score-credit-kcb");
    const basisEl = $("score-basis-list");

    if (res.scorable !== true) {
      if (badgeEl) badgeEl.textContent = "산출 불가";
      if (numberEl) numberEl.textContent = "-";
      if (niceEl) niceEl.textContent = "-";
      if (kcbEl) kcbEl.textContent = "-";
      if (basisEl) basisEl.innerHTML = "";
      return;
    }

    const cr = res.credit_score_increase;
    const niceText = cr && Number.isInteger(cr.min) && Number.isInteger(cr.max) ? `+${cr.min}~${cr.max}점 예상` : "-";
    const kcbText = niceText;

    if (badgeEl) badgeEl.textContent = getScoreBadgeLabel(res.payscore);
    if (numberEl) numberEl.textContent = String(res.payscore);
    if (niceEl) niceEl.textContent = niceText;
    if (kcbEl) kcbEl.textContent = kcbText;

    if (basisEl) basisEl.innerHTML = buildScoreBasisListHtml();
    return;
  }

  // FAIL
  if (successContent) successContent.classList.add("hidden");
  if (failContent) failContent.classList.remove("hidden");
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "btn btn-primary";
  retryBtn.textContent = "재시도";
  retryBtn.addEventListener("click", () => $("btn-score").click());
  if (actionsEl) actionsEl.appendChild(retryBtn);
}

function setReportButtonEnabled(enabled) {
  $("btn-report").disabled = !enabled;
}

function clearContactErrors() {
  $("err-contactName").textContent = "";
  $("err-contactEmail").textContent = "";
}

function showContactErrors(errors) {
  if (errors.contactName) $("err-contactName").textContent = errors.contactName;
  if (errors.contactEmail) $("err-contactEmail").textContent = errors.contactEmail;
}

// -----------------------
// Local "server" simulation
// -----------------------

async function simulateContractSubmit(payload) {
  // 최소 전송: 사용자 입력값만 사용(원문 금융 데이터 없음)
  await sleep(650);

  const months = calcContractMonths(payload.startDate, payload.endDate);

  const reasonCodes = [];
  const { min, max } = RULES.matchRuleRange;
  if (Number.isInteger(payload.rentAmount) && (payload.rentAmount < min || payload.rentAmount > max)) {
    reasonCodes.push("RENT_OUT_OF_RANGE");
  }
  if (payload.mgmtIncluded === true && Number.isInteger(payload.mgmtAmount) && payload.mgmtAmount > 2_000_000) {
    reasonCodes.push("MGMT_OUT_OF_RANGE");
  }
  // 판정 원칙: 필수 조건 하나라도 미충족 => NEEDS_REVIEW
  const status = reasonCodes.length ? "NEEDS_REVIEW" : "MATCHED";

  // server selection object (렌더 기준)
  const selection = buildServerSelection(payload, months);
  const selectionId = cryptoRandomId("sel");

  return {
    status,
    reasonCodes,
    rule_version: RULES.ruleVersionMatch,
    selection,
    selection_id: selectionId,
  };
}

function buildServerSelection(payload, contractMonths) {
  const items = [];
  items.push({
    key: "RENT",
    label: "월세",
    monthly_amount: payload.rentAmount ?? null,
    months: contractMonths ?? null,
    selected: true,
  });

  for (const t of FIXED_TYPES) {
    const it = payload.fixed[t.key];
    if (it?.selected === true) {
      const rows = Array.isArray(it.rows) ? it.rows : [];
      rows.forEach((r, idx) => {
        items.push({
          key: `${t.key}:${idx + 1}`,
          label: `${t.label} ${idx + 1}`,
          monthly_amount: r.amount ?? null,
          months: r.months ?? null,
          selected: true,
        });
      });
    } else {
      items.push({
        key: t.key,
        label: t.label,
        monthly_amount: null,
        months: null,
        selected: false,
      });
    }
  }

  return { items };
}

async function simulateScoreRangeApi(body) {
  // 요청 바디 스키마 누락 시 400 (로컬 모사)
  if (!body || !body.selection_id || !body.session_id) {
    const err = new Error("Bad Request");
    err.status = 400;
    throw err;
  }

  await sleep(800);

  // 산출 불가 조건 판정
  const sel = state.selection;
  if (!sel || !Array.isArray(sel.items)) {
    return {
      scorable: false,
      reason_code: "INVALID_AMOUNT",
      rule_version: RULES.ruleVersionScore,
    };
  }

  const rent = sel.items.find((x) => x.key === "RENT");
  if (!rent?.monthly_amount || rent.monthly_amount < 1) {
    return {
      scorable: false,
      reason_code: "NO_RENT_ITEM",
      rule_version: RULES.ruleVersionScore,
    };
  }
  if (!rent.months || rent.months < 1) {
    return {
      scorable: false,
      reason_code: "INSUFFICIENT_MONTHS",
      rule_version: RULES.ruleVersionScore,
    };
  }

  const computed = computePayScore(sel.items);
  if (!computed) {
    return {
      scorable: false,
      reason_code: "INVALID_AMOUNT",
      rule_version: RULES.ruleVersionScore,
    };
  }

  return {
    scorable: true,
    payscore: computed.payscore,
    credit_score_increase: computed.credit_score_increase,
    rule_version: RULES.ruleVersionScore,
  };
}

async function simulateReportGeneration() {
  // prototype: 기본은 성공 (실패 UI는 예외 처리로만 제공)
  await sleep(3800);
  return { ok: true };
}

function computePayScore(items) {
  // 기간(50%), 규모(30%), 항목 다양성(20%)
  const selected = items.filter((x) => x.selected === true);
  if (!selected.length) return null;

  let maxMonths = 0;
  let totalMonthly = 0;
  const categories = new Set();

  for (const it of selected) {
    if (!Number.isInteger(it.monthly_amount) || it.monthly_amount < 1) return null;
    if (!Number.isInteger(it.months) || it.months < 1) return null;
    totalMonthly += it.monthly_amount;
    maxMonths = Math.max(maxMonths, it.months);
    const baseKey = String(it.key).split(":")[0];
    categories.add(baseKey);
  }

  const durationPart = Math.round(clamp(maxMonths / 36, 0, 1) * 50);
  const scalePart = Math.round(clamp(totalMonthly / 5_000_000, 0, 1) * 30);
  const diversityPart = Math.round(clamp(categories.size / 4, 0, 1) * 20); // RENT + 3 고정비 기준

  const payscore = clampInt(durationPart + scalePart + diversityPart, 0, 100);
  const credit = mapCreditIncrease(payscore);

  return { payscore, credit_score_increase: credit };
}

function mapCreditIncrease(payscore) {
  if (payscore <= 40) return { min: 3, max: 7 };
  if (payscore <= 70) return { min: 10, max: 20 };
  return { min: 25, max: 35 };
}

// -----------------------
// Utilities
// -----------------------

function parseUtmParams() {
  const p = new URLSearchParams(location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const out = {};
  for (const k of keys) {
    const v = p.get(k);
    if (v) out[k] = v;
  }
  return out;
}

function cryptoRandomId(prefix) {
  const rand = Math.random().toString(16).slice(2, 10);
  const t = Date.now().toString(16).slice(-6);
  return `${prefix}_${t}_${rand}`;
}

function digitsOnly(s) {
  return (s || "").replace(/[^\d]/g, "");
}

function parseIntSafe(s) {
  const v = digitsOnly(String(s ?? ""));
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function getMgmtIncluded() {
  const el = document.querySelector('input[name="mgmtIncluded"]:checked');
  if (!el) return null;
  return el.value === "true";
}

function calcContractMonths(startStr, endStr) {
  // YYYY-MM-DD 기준. end > start는 validator에서 강제.
  // 가장 단순한 월수 산정: 월 차이 + (일 차이가 남으면 1개월 올림)
  const s = parseDate(startStr);
  const e = parseDate(endStr);
  if (!s || !e) return null;
  if (e.getTime() <= s.getTime()) return null;

  const monthDiff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  const needsCeil = e.getDate() > s.getDate();
  const months = monthDiff + (needsCeil ? 1 : 0);
  return Math.max(1, months);
}

function parseDate(yyyyMMdd) {
  if (!yyyyMMdd) return null;
  const [y, m, d] = yyyyMMdd.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function formatWon(n) {
  if (!Number.isInteger(n)) return "-";
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatRangeText(range) {
  if (!range) return "산출 불가";
  const { min, max } = range;
  if (!Number.isInteger(min) || !Number.isInteger(max)) return "산출 불가";
  return `NICE +${min}~${max}점 예상 / KCB +${min}~${max}점 예상`;
}

function maskEmail(email) {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${"*".repeat(Math.max(1, local.length - head.length))}@${domain}`;
}

function isValidEmail(email) {
  // 단순 형식 검증 (P0)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function clampInt(x, a, b) {
  return Math.max(a, Math.min(b, Math.round(x)));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms) {
  let t = null;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => {
      const err = new Error("Timeout");
      err.code = "TIMEOUT";
      rej(err);
    }, ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(t)), timeout]);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
