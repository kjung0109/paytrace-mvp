# PayScore MVP 프로토타입 배포 가이드

이 프로젝트는 **정적 웹(HTML/CSS/JS)** 이라 빌드 없이 그대로 배포할 수 있습니다.

---

## 1. Vercel (권장)

1. [vercel.com](https://vercel.com) 가입 후 **New Project**
2. 이 폴더를 **GitHub/GitLab 등에 올린 뒤** 저장소 연결  
   또는 **로컬에서** 터미널 실행:
   ```bash
   npx vercel
   ```
3. 프롬프트에서 프롬트 엔터 → 배포 완료 후 URL 발급

- **Git 연동 시**: `main`(또는 기본 브랜치)에 push할 때마다 자동 재배포
- `vercel.json`이 있으면 “빌드 없이 현재 폴더를 그대로 서빙”으로 동작

---

## 2. Netlify

1. [netlify.com](https://netlify.com) 가입 후 **Add new site**
2. **Deploy manually**:  
   `payscore` 폴더 전체를 드래그 앤 드롭
3. 또는 **Git 연결** 후:
   - Build command: *(비움)*
   - Publish directory: `./` (프로젝트 루트)

---

## 3. GitHub Pages

1. 이 프로젝트를 **GitHub 저장소**에 push
2. 저장소 **Settings → Pages**
3. **Source**: `Deploy from a branch`
4. **Branch**: `main`(또는 사용 중인 브랜치), **Folder**: `/ (root)`
5. 저장 후 잠시 뒤 `https://<username>.github.io/<repo-name>/` 에서 확인

- 루트에 `index.html`이 있으므로 `https://...github.io/<repo>/` 로 접속하면 됩니다.

---

## 4. 그 외

- **Firebase Hosting**, **AWS S3 + 정적 웹 호스팅**, **Cloudflare Pages** 등도  
  “폴더 안의 HTML/CSS/JS를 그대로 올리는” 방식으로 배포 가능합니다.
- 서버나 DB가 없으므로 **빌드 단계 없이**  
  `index.html`, `style.css`, `script.js` 등이 있는 디렉터리만 업로드하면 됩니다.

---

## 배포 전 체크

- [ ] `requirements.csv` 등 내부용 파일을 공개 URL에서 제거할지 결정 (필요 시 배포 대상에서 제외)
- [ ] 상대 경로 사용 중이면 도메인/서브경로만 맞추면 됨 (예: `/payscore/` 아래에 넣을 경우 `<base href="/payscore/">` 검토)
