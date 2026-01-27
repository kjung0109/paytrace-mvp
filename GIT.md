# Git에 올리는 방법

## 1. Git이 설치되어 있는지 확인

터미널(또는 PowerShell)에서:

```bash
git --version
```

나온다면 설치된 것. 없다면 [git-scm.com](https://git-scm.com)에서 설치.

---

## 2. 이 폴더를 Git 저장소로 만들기

`c:\payscore` 폴더로 이동한 뒤:

```bash
cd c:\payscore

git init
```

---

## 3. 파일 담기(스테이징) → 커밋

```bash
git add .
git commit -m "PayScore MVP 프로토타입 초기 버전"
```

`git add .`는 **현재 폴더 모든 변경**을 담고,  
`git commit -m "..."`은 그걸 한 번에 기록합니다.

---

## 4. GitHub에 저장소 만들기

1. [github.com](https://github.com) 로그인
2. 오른쪽 위 **+** → **New repository**
3. **Repository name**: 예) `payscore` 또는 `payscore-mvp`
4. **Public** 선택
5. **"Add a README"** 등 추가 옵션은 **체크하지 않고** **Create repository** 클릭

---

## 5. 로컬과 GitHub 연결 후 올리기

GitHub에서 만든 저장소의 **주소**를 복사합니다.  
예: `https://github.com/내아이디/payscore.git`

그 다음 터미널에서:

```bash
git remote add origin https://github.com/내아이디/payscore.git
git branch -M main
git push -u origin main
```

- `내아이디` / `payscore`는 본인이 만든 저장소 이름으로 바꾸면 됩니다.
- 이미 `git init` · `git add` · `git commit` 을 했다고 가정했습니다.
- 처음 push 시 GitHub 로그인 창이나 토큰 입력이 나올 수 있습니다.

---

## 6. 이후에 수정했을 때 올리는 방법

```bash
git add .
git commit -m "수정 내용 한 줄 요약"
git push
```

---

## 한 번에 복사해서 쓸 수 있는 예시

```bash
cd c:\payscore
git init
git add .
git commit -m "PayScore MVP 프로토타입 초기 버전"
git remote add origin https://github.com/내아이디/payscore.git
git branch -M main
git push -u origin main
```

`https://github.com/내아이디/payscore.git` 부분만 본인 저장소 주소로 바꾸면 됩니다.
