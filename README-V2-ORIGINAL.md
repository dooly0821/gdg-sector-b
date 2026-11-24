# GDG — SECTOR B 전체 소스 내보내기

2026-11-24에 확인한 현재 배포 버전 2의 전체 저장소 스냅샷입니다.

- 배포 주소 https://gdg-sector-b-night-shift.rich-flame-3289.chatgpt.site/
- 원본 커밋 `b4d4f926700bee72bf24cc819907c1ffa075d5ea`
- Site ID `appgprj_6afcf2800b8481918f57ee52d5aadce6`
- 저장된 버전 ID `appgprj_6afcf2800b8481918f57ee52d5aadce6~appgver_4c94179c92b88191b3645ee49b8c1cc6`

원본 저장소에서 추출한 모든 추적 파일을 동일한 바이트로 포함했습니다. 이 README와 EXPORT_MANIFEST.json만 내보내기용으로 추가했습니다. 원본 사이트에 대한 소스 수정, 푸시, 재배포 작업은 수행하지 않았습니다. Git 내부 데이터와 인증 정보는 ZIP에 포함하지 않습니다. 각 원본 파일의 SHA-256은 EXPORT_MANIFEST.json에 기록했습니다.

## 빠른 실행

ZIP을 전부 압축 해제하고 이 README가 있는 프로젝트 폴더에서 실행합니다. Python 3가 설치되어 있어야 합니다.

Windows PowerShell 또는 명령 프롬프트

```powershell
py -3 -m http.server 8000 --directory dist --bind 127.0.0.1
```

macOS / Linux

```sh
python3 -m http.server 8000 --directory dist --bind 127.0.0.1
```

Chrome에서 http://127.0.0.1:8000 을 열고 게임 시작을 누릅니다. 서버 종료는 터미널에서 Ctrl+C입니다. ES 모듈과 텍스처를 HTTP로 읽으므로 index.html을 파일로 직접 열면 정상 작동하지 않을 수 있습니다. 다른 포트가 필요하면 8000을 바꿉니다.

## 의존성과 빌드

이 버전은 빌드 단계가 없는 정적 HTML/CSS/JavaScript 프로젝트입니다. dist/ 안의 파일이 실행 가능한 원본 소스이자 배포 산출물입니다. 번들러, npm 패키지, CDN 의존성이 없으며 npm install이나 npm run build를 실행할 필요가 없습니다. package.json은 Node가 .js를 ES 모듈로 해석하도록 type을 선언합니다. 원본에 lockfile이 없는 이유도 외부 패키지 의존성이 없기 때문입니다.

게임 실행에는 ES 모듈, Canvas, Web Audio를 지원하는 데스크톱 Chrome을 사용하세요. WebGL 2가 가능하면 GPU 렌더러를 사용하고, 불가능하면 포함된 CPU 소프트웨어 렌더러로 전환합니다. CPU 모드는 장면 해상도와 속도에 차이가 있습니다. 소리는 사용자 입력 후 활성화됩니다. 포인터 잠금이 허용되지 않는 환경에서는 화면 드래그로 시점을 돌릴 수 있습니다.

개발용 자동 검사에는 Node.js 20 이상을 권장합니다. 이번 내보내기에서 실제 사용한 버전은 EXPORT_MANIFEST.json에 있습니다. Node 내장 모듈만 사용합니다.

```sh
node scripts/check-mission.mjs
node scripts/export-layout.mjs layout.json
```

첫 명령은 5개 배송 경로, 계단 왕복, 점프, 충돌, 집기/내려놓기 애니메이션의 상태 전환과 중복 입력을 검사합니다. 두 번째 명령은 현재 장면의 좌표, 메시, 재질, 충돌 상자와 게임 설정을 JSON으로 생성합니다. 생성된 layout.json은 Unity 이식에 사용할 수 있습니다. 게임을 수정한 후에는 두 명령을 다시 실행하고 브라우저 플레이도 확인하세요.

## 소스 구조

| 경로 | 내용 |
| --- | --- |
| dist/index.html | 한국어 메인 메뉴, 로딩 화면, HUD와 모달 구조 |
| dist/app.js | 메뉴 버튼 연결, 로딩 완료 전환, 입력, 프레임 루프, 일시 정지, 배송 완료 화면 |
| dist/style.css, dist/work.css | 기존 화면 스타일과 WORK 모드 UI 스타일 |
| dist/mission.js | 맵 조립, 플레이어 설정, 이동·점프·충돌·중력, 다섯 미션, 집기/배송 상태 |
| dist/handling.js | 집기·내려놓기 시간, 취소 조건, 손과 운반 상자의 동작 |
| dist/viewmodel.js | GDG 소매·장갑과 화물의 3D 메시 구성 |
| dist/geometry.js, dist/world.js | 기본 메시 생성, 장면 자료구조와 3D 수학 |
| dist/architecture.js | 바닥, 벽, 창, 철골, 계단, 캣워크 |
| dist/storage.js, dist/freight.js | 팔레트 랙, 적재 화물, 보관 구역 구성 |
| dist/machinery.js | 지게차와 컨베이어 등 설비 |
| dist/renderer.js | WebGL 2 렌더링, 텍스처, 셰이더, 그림자, 품질 설정 |
| dist/software.js | CPU 기반 3D 렌더링 대체 경로 |
| dist/assets/ | 모든 실제 사용 텍스처, 폰트, 브랜드 및 한국어 UI 그래픽 |
| dist/assets/font-license.txt | 포함 폰트의 라이선스 |
| dist/unity-migration.html | 좌표계, 스케일, 물리, 재질, 상태와 Unity 이식 설명 |
| dist/gdg-unity-handoff.zip | 기존 배포본에 포함된 Unity 이식용 메시·배치 데이터와 소스 |
| scripts/ | 회귀 검사 및 장면 데이터 내보내기 |
| playtest/ | 원본 저장소에 포함된 이전 플레이 검증 캡처 |
| .openai/hosting.json | 기존 Site ID와 정적 배포 폴더 설정 |

3D 모델은 JavaScript에서 생성합니다. 별도 Blender, FBX, GLB 제작 파일은 현재 저장소에 없습니다. 물리 동작은 mission.js에 구현된 플레이어 충돌·중력·점프 로직이며, 별도 상용 물리엔진 바이너리가 없습니다. 애니메이션은 viewmodel.js의 자세 메시와 handling.js의 절차적 동작을 결합합니다. 이 ZIP은 현재 배포된 구현 전체를 담고 있습니다. 카운터스트라이크식 이동이나 버니합 개선은 이 배포 버전에 포함되어 있지 않습니다.

## 조작과 미션

WASD 이동, Shift 달리기, 마우스 시점 회전, Space 점프, E 상호작용, Esc 일시 정지입니다. 시작점 근처 B-01을 포함해 총 5개 화물을 02번 출고대로 옮깁니다. B-04는 계단으로 연결된 상층 캣워크에 있습니다. 가까운 상자나 출고대를 바라봐야 E 안내가 나타납니다. 집기와 내려놓기는 동작 끝에서 상태를 갱신하며, 시선이나 거리를 벗어나면 취소됩니다. 배송 데이터는 현재 탭의 메모리에 있고, 설정은 브라우저 localStorage의 gdg.settings에 저장됩니다. 페이지 새로고침 시 미션은 새 근무로 시작합니다. 서버 데이터베이스나 별도 환경 변수는 필요하지 않습니다.

## 빌드 및 배포 방법

### 일반 정적 호스팅

배포 폴더를 dist로 지정하고 dist 안의 파일을 하위 폴더까지 모두 업로드합니다. 빌드 명령과 설치 명령은 비워둡니다. 호스팅 루트에 index.html이 위치해야 합니다. JavaScript는 올바른 MIME 유형으로 응답해야 합니다. HTTPS를 사용하면 브라우저 기능 사용이 원활합니다. 로컬로 실행한 게임에는 Sites의 ChatGPT 로그인 게이트가 적용되지 않으며, 해당 접근 제어는 호스팅 플랫폼에서 제공합니다.

### ChatGPT Sites에서 이어서 작업

이 ZIP을 새 대화에 첨부하고 먼저 이 README를 읽도록 요청하세요. 기존 Site를 수정할 때는 Sites에서 위 project_id의 현재 배포 버전과 최신 소스를 먼저 확인하고, 파일을 로컬에서 수정·검증한 뒤 사용자 요청에 따라 배포합니다. Sites의 저장소 인증 정보와 도구 경로는 작업 환경에서 새로 받아야 합니다. ZIP에는 인증 토큰이 없습니다.

Sites에서 기존 프로젝트 업데이트를 요청받은 경우의 작업 순서

1. 기존 project_id로 Site 메타데이터와 버전을 읽고 최신 저장소를 엽니다.
2. 이 내보내기의 커밋과 비교하고 이후 수정분이 있으면 통합합니다.
3. 필요한 소스만 수정하고 node scripts/check-mission.mjs 및 브라우저 검증을 수행합니다.
4. Sites의 현재 소스 저장·패키징 도구로 소스를 저장하고 배포용 아카이브를 만듭니다.
5. 저장된 정확한 버전을 기존 접근 권한에 맞춰 배포하고 성공 상태를 확인합니다.

별도의 새 Site로 배포하는 경우 새 Site를 생성해 받은 ID를 그 사본의 .openai/hosting.json에 기록합니다. 기존 ID가 들어 있는 원본 내보내기를 새 프로젝트 ID처럼 사용하면 안 됩니다. 기존 Site에 배포할 때는 기존 ID를 사용합니다.

새 대화에 붙여 넣을 작업 설명 예시

> 첨부 ZIP은 GDG Sector B 배포 버전 2의 전체 소스입니다. README.md와 EXPORT_MANIFEST.json을 먼저 읽고 dist/의 실제 소스를 수정해 주세요. 3D 모델은 JavaScript로 생성되며 빌드 단계와 외부 npm 의존성은 없습니다. 로컬 HTTP 서버로 실행하고 scripts/check-mission.mjs로 검사하세요. 기존 사이트에 반영하기 전에는 Sites에서 현재 최신 소스와 비교하세요. 이번 요청의 수정 범위와 배포 여부를 따라 작업해 주세요.

## 내보내기 검증 범위

원본 커밋과 현재 배포 버전의 일치를 확인했고, 원본의 모든 추적 파일을 바이트 단위로 대조합니다. 내보낸 폴더의 자동 미션 검사, JavaScript 문법 검사, ZIP CRC 검증 및 압축 해제 후 체크섬 대조 결과는 EXPORT_MANIFEST.json에 기록합니다. 이번 내보내기 작업에서 새로운 브라우저 플레이 검증은 수행하지 않습니다. playtest 캡처는 이전 개발 시점의 기록입니다.
