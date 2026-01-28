// ========================================
// PDF 데이터 동적 업데이트 (완전판)
// ========================================

// 상품 데이터
const PRODUCT_DATA = {
    SPROUT: [
        { type: "카드", name: "KB국민 체크-신용 하이브리드", desc: "체크카드에 신용 기능을 더하다", url: "#" },
        { type: "대출", name: "서민금융진흥원 햇살론유스", desc: "청년층의 자금애로 해소", url: "#" },
        { type: "대출", name: "우리은행 WON Easy 생활비 대출", desc: "소액 생활자금 필요시 간편하게", url: "#" },
        { type: "카드", name: "신한카드 처음(First)", desc: "첫 출발을 위한 맞춤 혜택", url: "#" }
    ],
    SINCERE: [
        { type: "대출", name: "카카오뱅크 비상금대출", desc: "휴대폰 본인인증만으로 간편한 대출", url: "#" },
        { type: "카드", name: "현대카드 ZERO Edition3", desc: "조건 없는 무제한 할인 혜택", url: "#" },
        { type: "카드", name: "삼성카드 taptap O", desc: "내 라이프스타일에 맞춘 맞춤형 카드", url: "#" },
        { type: "카드", name: "신한카드 Deep Dream", desc: "전월 실적 조건 없는 기본 적립", url: "#" }
    ],
    MASTER: [
        { type: "대출", name: "햇살론뱅크", desc: "성실 상환자를 위한 징검다리 대출", url: "#" },
        { type: "카드", name: "신한카드 Mr.Life", desc: "공과금 및 생활비 밀착형 할인", url: "#" },
        { type: "카드", name: "KB국민 청춘대로 톡톡", desc: "온라인 쇼핑부터 음식점까지 할인", url: "#" },
        { type: "대출", name: "토스뱅크 마이너스통장", desc: "필요할 때 쓰고 이자만 내세요", url: "#" }
    ]
};

const SCORE_RANK_COMMENTS = {
    master: { duration: "장기적인 납부 이력이 귀하의 성실함을 증명합니다.", amount: "규모 있는 지출 관리가 매우 안정적입니다.", diversity: "다양한 고정비 항목이 체계적으로 관리되고 있습니다.", summaryDesc: "귀하는 완벽한 납부 습관을 가진 '마스터 납부러'입니다." },
    sincere: { duration: "꾸준한 납부 이력이 신용에 긍정적인 영향을 미칩니다.", amount: "적정 수준의 지출을 잘 관리하고 계십니다.", diversity: "항목별 관리가 원활하게 이루어지고 있습니다.", summaryDesc: "성실하게 미래를 준비하는 '성실 납부러'입니다." },
    sprout: { duration: "이제 막 납부 이력을 쌓기 시작한 단계입니다.", amount: "작은 실천부터 시작하여 점진적으로 확대 중입니다.", diversity: "관리가 필요한 항목들을 하나씩 늘려가고 있습니다.", summaryDesc: "성실한 금융 생활을 시작하는 '새싹 납부러'입니다." }
};

function formatWon(num) { return new Intl.NumberFormat('ko-KR').format(num) + '원'; }
function updateText(selector, value) { document.querySelectorAll(selector).forEach(el => el.textContent = value); }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

(function () {
    try {
        const pdfDataStr = localStorage.getItem('paytracePdfData');
        if (!pdfDataStr) { console.log('⚠️ No PDF data'); return; }

        const data = JSON.parse(pdfDataStr);
        const { payscore, badge, rankKey, reportId, today, summary, creditImpact, payload, result } = data;
        const comments = SCORE_RANK_COMMENTS[rankKey];

        console.log('📄 PDF 데이터 로드:', { payscore, badge });

        // Cover
        const metaDiv = document.querySelector('.cover .meta');
        if (metaDiv) metaDiv.innerHTML = `<div>생성일: ${today}</div><div>리포트 ID: ${reportId}</div>`;

        // Page 1: Summary
        updateText('.score-big', payscore);
        updateText('.badge-rank', badge);
        const summaryP = document.querySelector('.page:nth-child(2) .p');
        if (summaryP) summaryP.innerHTML = `귀하는 <span class="strong">${summary.months}개월간 월세 및 ${summary.fixedCount}개 고정비 항목</span>을 성실하게 납부한 이력을 보유하고 있습니다. 장기간에 걸친 일정한 지출 패턴은 재무 관리 능력의 긍정적 신호로 평가됩니다.`;
        const creditNote = document.querySelector('.center-note .plus');
        if (creditNote) creditNote.textContent = creditImpact;

        // Page 2: Contract table
        const contractTable = document.querySelector('.page:nth-child(3) table tbody');
        if (contractTable && payload) {
            const mgmt = payload.mgmtIncluded ? "포함" : "미포함";
            const mgmtAmt = payload.mgmtIncluded ? formatWon(payload.mgmtAmount) : "-";
            const totalH = (payload.rentAmount || 0) + (payload.mgmtIncluded ? (payload.mgmtAmount || 0) : 0);
            contractTable.innerHTML = `
        <tr><td class="strong">계약 기간</td><td><span class="strong">${payload.startDate} ~ ${payload.endDate} (${summary.months}개월)</span></td></tr>
        <tr><td class="strong">월세 금액</td><td><span class="strong">${formatWon(payload.rentAmount)}</span></td></tr>
        <tr><td class="strong">관리비 포함 여부</td><td><span class="strong">${mgmt}</span></td></tr>
        <tr><td class="strong">별도 관리비</td><td><span class="strong">${mgmtAmt}</span></td></tr>
        <tr class="row-strong"><td>월 총 주거비</td><td>${formatWon(totalH)}</td></tr>
      `;
        }

        // Page 2: Fixed table
        const fixedTable = document.querySelectorAll('.page:nth-child(3) table')[1];
        if (fixedTable && payload) {
            const tbody = fixedTable.querySelector('tbody');
            if (tbody) {
                let html = '', total = 0;
                html += `<tr><td class="strong">월세</td><td class="num strong">${formatWon(payload.rentAmount)}</td><td class="center strong">${summary.months}개월</td></tr>`;
                total += payload.rentAmount;
                if (payload.mgmtIncluded) {
                    html += `<tr><td class="strong">관리비</td><td class="num strong">${formatWon(payload.mgmtAmount)}</td><td class="center strong">${summary.months}개월</td></tr>`;
                    total += payload.mgmtAmount;
                }
                const types = [{ key: 'ott', label: 'OTT 구독' }, { key: 'music', label: '음악 스트리밍' }, { key: 'ebook', label: '전자책 구독' }, { key: 'fitness', label: '헬스/PT' }, { key: 'cloud', label: '클라우드 저장소' }];
                types.forEach(t => {
                    const it = payload.fixed[t.key];
                    if (it?.selected && it.rows) it.rows.forEach((r, i) => {
                        const lbl = it.rows.length > 1 ? `${t.label} ${i + 1}` : t.label;
                        html += `<tr><td class="strong">${lbl}</td><td class="num strong">${formatWon(r.amount)}</td><td class="center strong">${r.months}개월</td></tr>`;
                        total += r.amount;
                    });
                });
                html += `<tr class="row-strong"><td>월 고정비 합계</td><td class="num">${formatWon(total)}</td><td class="center">-</td></tr>`;
                tbody.innerHTML = html;
                const totalSum = document.querySelector('.page:nth-child(3) .p.mt-14.muted');
                if (totalSum) totalSum.innerHTML = `분석 기간 총 지출: <span class="strong">약 ${formatWon(total * summary.months)}</span> (${summary.months}개월 기준)`;
            }
        }

        // Page 3: Score details
        let maxM = summary.months, totalA = payload.rentAmount + (payload.mgmtIncluded ? payload.mgmtAmount : 0), cats = summary.fixedCount;
        const durP = Math.round(clamp(maxM / 36, 0, 1) * 50), scaP = Math.round(clamp(totalA / 5000000, 0, 1) * 30), divP = Math.round(clamp(cats / 4, 0, 1) * 20);
        const cards = document.querySelectorAll('.page:nth-child(4) .mcard');
        if (cards[0]) { cards[0].querySelector('.v').innerHTML = `${durP}<small>/50</small>`; cards[0].querySelector('.d').textContent = `${maxM}개월간 지속적인 납부 이력`; }
        if (cards[1]) { cards[1].querySelector('.v').innerHTML = `${scaP}<small>/30</small>`; cards[1].querySelector('.d').textContent = `월 평균 ${formatWon(totalA)} 관리`; }
        if (cards[2]) { cards[2].querySelector('.v').innerHTML = `${divP}<small>/20</small>`; cards[2].querySelector('.d').textContent = `${cats}개 고정비 항목 관리`; }

        const blockPs = document.querySelectorAll('.page:nth-child(4) .block p');
        if (blockPs[0]) blockPs[0].innerHTML = `<b>기간 점수 분석:</b> ${comments.duration}`;
        if (blockPs[1]) blockPs[1].innerHTML = `<b>금액 점수 분석:</b> ${comments.amount}`;
        if (blockPs[2]) blockPs[2].innerHTML = `<b>항목 다양성 분석:</b> ${comments.diversity}`;
        const sumP3 = document.querySelector('.page:nth-child(4) .p.mt-14');
        if (sumP3) sumP3.innerHTML = `${comments.summaryDesc} PayScore ${payscore}점은 <span class="strong">${summary.months}개월 동안 안정적 납부 패턴</span>에서 도출되었습니다.`;

        // Page 4: Impact
        const plus = result.credit_score_increase ? result.credit_score_increase.max : 0;
        const impTbl = document.querySelectorAll('.page:nth-child(5) table')[1];
        if (impTbl) {
            const tb = impTbl.querySelector('tbody');
            if (tb) tb.innerHTML = `
        <tr><td class="strong">보수적 추정</td><td class="center strong">680점</td><td class="center strong">+${plus}점</td><td class="center strong">${680 + plus}점</td></tr>
        <tr><td class="strong">중립적 추정</td><td class="center strong">705점</td><td class="center strong">+${plus}점</td><td class="center strong">${705 + plus}점</td></tr>
        <tr><td class="strong">낙관적 추정</td><td class="center strong">730점</td><td class="center strong">+${plus}점</td><td class="center strong">${730 + plus}점</td></tr>
      `;
        }
        const rankIdx = payscore >= 71 ? 3 : (payscore >= 41 ? 2 : 1);
        const rankTbl = document.querySelectorAll('.page:nth-child(5) table')[2];
        if (rankTbl) rankTbl.querySelectorAll('tbody tr').forEach((r, i) => { if (i + 1 === rankIdx) r.classList.add('row-strong'); });
        const rankP = document.querySelector('.page:nth-child(5) .p.mt-14');
        if (rankP) {
            const desc = summary.months >= 24 ? "24개월 이상" : (summary.months >= 12 ? "12개월 이상" : "신규");
            rankP.innerHTML = `귀하는 <span class="strong">${badge}</span> 등급으로, <span class="strong">${desc}</span>의 납부 이력을 보유한 고객군에 해당합니다.`;
        }

        // Page 5-6: Products
        const cat = payscore >= 71 ? 'MASTER' : (payscore >= 41 ? 'SINCERE' : 'SPROUT');
        const prods = PRODUCT_DATA[cat];
        const banner = document.querySelector('.success-banner .t2');
        if (banner) banner.textContent = `🟢 PayScore ${payscore}점 · ${badge}`;
        const cards_list = prods.filter(p => p.type === '카드');
        const loans_list = prods.filter(p => p.type === '대출');
        const cardsList = document.querySelector('.page:nth-child(6) .plist');
        if (cardsList) cardsList.innerHTML = cards_list.map(p => `<div class="pcard"><div class="head"><div><p class="name">${p.name}</p><p class="desc">${p.desc}</p></div><div class="org">${p.name.split(' ')[0]}</div></div></div>`).join('');
        const loansList = document.querySelector('.page:nth-child(7) .plist');
        if (loansList) loansList.innerHTML = loans_list.map(p => `<div class="pcard"><div class="head"><div><p class="name">${p.name}</p><p class="desc">${p.desc}</p></div><div class="org">${p.name.split(' ')[0]}</div></div></div>`).join('');

        console.log('✅ PDF 전체 업데이트 완료');
    } catch (e) { console.error('❌ PDF 오류:', e); }
})();
