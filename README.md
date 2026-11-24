# GDG : SECTOR B — V3.5 Dual Carry & Glove Motion

개발용 빌드. 기존 공개 사이트 변경 없음.

## 실행 (Windows)
1. ZIP을 압축 해제합니다.
2. `PLAY-WINDOWS.bat`를 실행합니다 (Python 3 필요).
3. Chrome/Edge에서 `http://127.0.0.1:8090/`를 열고 게임 시작을 누릅니다.
서버 창을 닫으면 종료됩니다. 파일을 더블클릭하여 index.html을 file://로 여는 방식은 ES 모듈 보안으로 동작하지 않을 수 있습니다.

macOS/Linux: `python3 -m http.server 8090 --bind 127.0.0.1 --directory dist`

## 조작
WASD 이동 / Shift 달리기 / 마우스 시점 / Space 또는 마우스 휠 점프 / Q 손전등 들기·내리기 / E 상자 집기·배송 / Esc 일시 정지.
버니합은 착지 직전 점프 입력과 A/D, 마우스 방향 조절을 사용합니다. 100ms 입력 버퍼. 자동 점프 아님.
상호작용 가능 거리는 1.45m (시점부터 대상 중심점까지)입니다. 기존 2.75m에서 줄였습니다. 가까이 접근해 E를 사용하세요. Q는 빈손과 운반 중 모두 작동합니다. 운반 중 Q를 누르면 왼손이 상자 하단을 받치고 오른손으로 손전등을 꺼냅니다. 다시 Q를 누르면 양손 운반으로 돌아갑니다. 손전등이 켜진 상태로 E를 누르면 잠시 수납 후 집기/배송을 수행하고 다시 장착합니다. 집기 0.48초, 내려놓기 0.52초, 운반 중 장착 0.34초/수납 0.28초.

## 프로젝트 구조
- `dist/` 편집 가능한 전체 웹게임 소스 및 정적 배포 산출물 (npm 의존성 없음)
- `dist/movement.js`: 120Hz 이동, 가속, 마찰, 공중 가속, 관성, 충돌 법선 슬라이딩, 침투 복구, 단차, 바닥/천장, 점프 버퍼. 수직 원통형 근사 캐릭터 콜라이더 + AABB; 상용 물리엔진 아님.
- `dist/viewmodel.js`, `dist/viewmodel-mesh-data.js`: 연속 표면으로 교체된 3D 장갑/소매/손전등, 빈손/양손 운반/왼손 받침/손전등의 접촉점 기반 자세 메시와 실시간 손가락 굴곡 변형. 개별 본 스키닝은 아직 없음.
- `modeling/`: 원본 모델 생성 Python 스크립트, 자세별 GLB, 연결된 장갑 OBJ, 형상 검사 기록. `python modeling/build_viewmodel.py` (numpy, scipy, scikit-image, trimesh, Pillow 필요). 모델 생성은 플레이 시 필요하지 않음.
- `dist/handling.js`: 손 모션, 달리기/착지/시점 스웨이, 장비 토글, 한 손 운반 전환 및 화물 관성 스프링.
- `dist/renderer.js`: WebGL 2 표면 조명 (손전등 스포트라이트), `dist/software.js`: CPU 깊이 기반 손전등 fallback.
- `dist/mission.js`: 기존 5개 화물 미션, 공간 조립, 상호작용.
- `scripts/check-mission.mjs`, `scripts/check-physics.mjs`: Node.js 20+ 자동 검증.
- `README-V2-ORIGINAL.md`, `EXPORT_MANIFEST-V2-ORIGINAL.json`: 원본 기록. 원본 Unity 이식 ZIP 및 설명은 V2 시점의 자료이며 V3 이식 데이터가 아닙니다.
- `playtest/`: 원본 V2 캡처 및 V3 오프라인 CPU 렌더 캡처(브라우저 캡처 아님).
- `COMPETITION.md`: 등록 요구사항 및 미완료 QA.
- `CHANGELOG.md`, `TEST-RESULTS.md`, `MANIFEST-V3.json`: 변경/검증/해시 기록.

## 검증 및 내보내기
```
node scripts/check-physics.mjs
node scripts/check-mission.mjs
node scripts/check-contact-motion.mjs
node scripts/check-hand-timing.mjs
node scripts/check-dual.mjs
python modeling/check_contacts.py # numpy 필요
node scripts/export-layout.mjs layout.json
```

## 배포
정적 HTTPS 호스팅에서 `dist/`를 publish directory로 지정. 설치/빌드 명령 없음. 자산은 모두 상대 경로. 외부 CDN 없음. `.openai/hosting.json`은 V2 기존 사이트 식별자 보존용이며 새 사이트 식별자로 재사용하면 안 됩니다. 기존 사이트 반영 전 최신 저장소와 비교하고 백업 및 브라우저 QA 수행 필요. 원본 ZIP은 별도로 유지하세요.

## 제한 사항
- V3는 조작 물리와 장비/뷰모델 기반의 개발 단계. 미션 오브젝트는 기존 정적 충돌 구조를 유지. 동적 강체, 질량/마찰의 물체 간 전달, 개별 손가락 실시간 스키닝, 손전등 동적 그림자, 호러 AI 추가는 후속 개발.
- WebGL 실제 화면 및 브라우저 키 입력/Pointer Lock/FPS/임베드는 이번 환경에서 로컬 주소 차단으로 검증하지 못함. CPU 렌더러는 별도의 오프라인 이미지·캔버스 어댑터에서 실행 확인(표지 문자 일부 생략, HUD 없음).
- 레퍼런스에 근접시키기 위한 외형 1차 개선입니다. 피부/장갑 전용 스캔, 수작업 리토폴로지, 실제 스키닝, 고해상도 PBR 베이크는 미완료입니다. GLB는 재질색 확인용이며 게임 텍스처는 dist/assets의 별도 파일을 사용합니다.

## V3.3 변경
- 양손/박스 공통 변환 및 좌우 손 접촉 기준 메시; 원통 단면 기반 손전등 그립과 정확한 Q 종료 상태.
- 집기 0.58초, 내려놓기 0.64초. 접근/접촉/운반/이완/복귀 단계, 소매의 손목 연결 변환.
- `modeling/contact-report.json`은 실제 양자화된 메시 정점/삼각형 중심/변 중앙 표본 검사입니다. 연속적 충돌 시뮬레이션 또는 모든 자세의 정확한 교차 판정은 아닙니다.
- `scripts/render-offline.mjs`는 sharp 설치 환경에서 Node CPU 렌더러 재현용 (웹 빌드에는 의존성 없음).
- 실제 WebGL 및 실시간 플레이 QA 미완료. 기존 공개 사이트 변경 없음.
